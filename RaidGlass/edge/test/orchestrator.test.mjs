import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { consumeBackfillBatch, handleAdminRequest, runScheduledBackfill, runScheduledRefresh } from "../src/orchestrator.js";
import { loadTargetRecord, writeGlobalStatus, writeTargetResult } from "../src/ranking-store.js";
import { openLocalD1 } from "../../testing/local-d1.mjs";

function target(index) {
    return {
        kind: "comp",
        targetKey: `comp/boss-${index}`,
        bossSlug: `boss-${index}`,
    };
}

function fakeBindings() {
    const sent = [];
    const sends = [];
    const coordinator = {
        async beginRun(...args) {
            this.beginArgs = args;
            return {
                accepted: true,
                global_status: {
                    schema_version: 2,
                    status: "refreshing",
                    checked_at: "2026-08-09T12:00:00.000Z",
                },
                run_status: { schema_version: 2, status: "enqueuing" },
            };
        },
        async markBatchEnqueued() {},
        async runProgress() { return { active: false }; },
        async finalizeEnqueue() {
            return {
                global_status: {
                    schema_version: 2,
                    status: "refreshing",
                    checked_at: "2026-08-09T12:00:00.000Z",
                },
                run_status: { schema_version: 2, status: "running" },
            };
        },
        async abortRun() {
            return {
                global_status: {
                    schema_version: 2,
                    status: "stale",
                    checked_at: "2026-08-09T12:00:00.000Z",
                },
                run_status: { schema_version: 2, status: "failed" },
            };
        },
    };
    return {
        sent,
        sends,
        coordinator,
        env: {
            ALLOWED_CRON: "0 * * * *",
            REFRESH_QUEUE: { async sendBatch(messages) {
                sends.push(messages.length);
                for (const message of messages) sent.push(message.body);
            } },
            REFRESH_COORDINATOR: { getByName() { return coordinator; } },
            RANKING_DB: {
                prepare() {
                    return {
                        async run() { return { meta: { changes: 1 } }; },
                        bind() {
                            return { async run() { return { meta: { changes: 1 } }; } };
                        },
                    };
                },
            },
        },
    };
}

test("六小时 Cron 将目标切成最多 8 个的 schema v2 单消息", async () => {
    const fixture = fakeBindings();
    const targets = Array.from({ length: 41 }, (_, index) => target(index));
    const result = await runScheduledRefresh(
        { cron: "0 * * * *", scheduledTime: Date.parse("2026-08-09T12:00:00Z") },
        fixture.env,
        targets,
        { now: () => new Date("2026-08-09T12:00:01Z"), log: () => {} },
    );

    assert.equal(result.status, "enqueued");
    assert.deepEqual(fixture.sent.map((message) => message.targets.length), [8, 8, 8, 8, 8, 1]);
    assert.deepEqual(fixture.sends, [6]);
    assert.equal(fixture.sent.every((message) => message.schema_version === 2), true);
    assert.equal(fixture.coordinator.beginArgs[5], "midnight-s2-1683-v1");
});

test("Production 单 Cron 在非六小时整点不触发完整排行刷新", async () => {
    const fixture = fakeBindings();
    fixture.env.WCL_ALL_CASTS = "true";
    const result = await runScheduledRefresh({ cron: "0 * * * *",
        scheduledTime: Date.parse("2026-09-28T13:00:00Z") }, fixture.env, [target(1)], { log: () => {} });
    assert.deepEqual(result, { status: "skipped", reason: "unexpected_schedule" });
    assert.equal(fixture.sent.length, 0);
});

test("D1 日写入额度耗尽时不启动整轮刷新或补采队列", async () => {
    const fixture = fakeBindings();
    fixture.env.WCL_ALL_CASTS = "true";
    fixture.env.RANKING_DB.prepare = () => ({ async run() { throw new Error("D1 daily row write limit"); } });
    fixture.coordinator.beginRun = async () => { throw new Error("should not start"); };
    const result = await runScheduledRefresh({ cron: "0 * * * *",
        scheduledTime: Date.parse("2026-09-28T12:00:00Z") }, fixture.env, [target(1)], { log: () => {} });
    assert.deepEqual(result, { status: "skipped", reason: "d1_writes_unavailable" });
    assert.equal(fixture.sent.length, 0);
});

test("小时补采每消息八目标，只登记任务而不抢占采集", async t => {
    const db = openLocalD1();
    t.after(() => db.close());
    db.exec(await readFile(new URL("../migrations/0001_dynamic_rankings.sql", import.meta.url), "utf8"));
    const targets = Array.from({ length: 301 }, (_, index) => ({ kind: "spec", targetKey: `spec/boss/mage-fire/mythic/dps-${index}`,
        bossSlug: "boss", specSlug: "mage-fire", role: "rdps", difficulty: "mythic", metric: "dps" }));
    for (const [index, value] of targets.entries()) await writeTargetResult(db, {
        target: value, status: "published", ranking: { reports: [],
            skill_completion: { version: 1, complete: 0, total: 1, failed: 0 } },
        checkedAt: "2026-09-28T00:00:00Z",
        publishedAt: new Date(Date.parse("2026-09-27T00:00:00Z") + index * 1000).toISOString(),
        upstreamUpdated: "2026-09-28T00:00:00Z",
    }, "seed-1");
    await writeTargetResult(db, { target: { ...targets[0], targetKey: "spec/old/mage-fire/mythic/dps" },
        status: "published", ranking: { reports: [], skill_completion: { version: 1, complete: 0, total: 1 } },
        checkedAt: "2026-08-09T00:00:00Z", publishedAt: "2026-08-09T00:00:00Z",
        upstreamUpdated: "2026-08-09T00:00:00Z" }, "seed-old");
    await writeGlobalStatus(db, { checked_at: "2026-09-28T00:00:00Z", latest_run_id: "seed-1" });
    let active = true;
    let pages = 0;
    const sent = [];
    const coordinator = {
        async runProgress() { return { active }; },
        async wclPauseReason() { return pages ? "wcl_hourly_budget" : null; },
        async registerCasts() { pages++; },
    };
    const env = { WCL_ALL_CASTS: "true", ALLOWED_CRON: "0 * * * *", RANKING_DB: db,
        REFRESH_COORDINATOR: { getByName() { return coordinator; } },
        REFRESH_QUEUE: { async sendBatch(messages) { sent.push(...messages.map(message => message.body)); } } };
    const controller = { cron: "0 * * * *", scheduledTime: Date.parse("2026-09-28T01:00:00Z") };
    assert.equal((await runScheduledBackfill(controller, env, { log: () => {} })).reason, "refresh_active");
    active = false;
    const result = await runScheduledBackfill(controller, env, { log: () => {},
        now: () => new Date("2026-09-28T01:00:00Z") });
    assert.deepEqual(result, { status: "enqueued", target_count: 300, message_count: 38 });
    assert.equal(sent.length, 38);
    assert.equal(sent.slice(0, 37).every(message => message.target_keys.length === 8), true);
    assert.equal(sent.at(-1).target_keys.length, 4);
    let acked = false;
    await consumeBackfillBatch({ messages: [{ body: sent[0], ack() { acked = true; }, retry() {
        throw new Error("unexpected retry");
    } }] }, env, new Map(targets.map(value => [value.targetKey, value])), { log: () => {},
        now: () => new Date("2026-09-28T01:00:01Z") });
    assert.equal(acked, true);
    assert.equal(pages, 8);
    assert.equal(JSON.parse((await loadTargetRecord(db, targets[0].targetKey)).ranking_json).skill_completion.complete, 0);
    assert.equal(JSON.parse((await loadTargetRecord(db, targets[1].targetKey)).ranking_json).skill_completion.complete, 0);
});

test("重复或重叠 Cron 由 Durable Object 拒绝且零排队", async () => {
    const fixture = fakeBindings();
    fixture.coordinator.beginRun = async () => ({ accepted: false, reason: "active_run" });
    const result = await runScheduledRefresh(
        { cron: "0 * * * *", scheduledTime: 1234 },
        fixture.env,
        [target(1)],
        { log: () => {} },
    );

    assert.deepEqual(result, { status: "skipped", reason: "active_run", run_id: "scheduled-1234" });
    assert.equal(fixture.sent.length, 0);
});

test("手动 retry 只接受 Durable Object 返回的失败目标且上限为 100", async () => {
    const fixture = fakeBindings();
    const failedTargets = Array.from({ length: 21 }, (_, index) => target(index));
    fixture.env.RETRY_TOKEN = "preview-test-secret\n";
    fixture.coordinator.prepareRetry = async (...args) => {
        fixture.coordinator.retryArgs = args;
        return { accepted: true, targets: failedTargets };
    };

    const response = await handleAdminRequest(
        new Request("https://edge.test/admin/retry", {
            method: "POST",
            headers: {
                Authorization: "Bearer preview-test-secret",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ run_id: "scheduled-source", limit: 21 }),
        }),
        fixture.env,
        {
            now: () => new Date("2026-08-09T12:00:00Z"),
            randomUUID: () => "11111111-1111-4111-8111-111111111111",
            log: () => {},
        },
    );
    assert.equal(response.status, 202);
    assert.deepEqual(fixture.sent.map((message) => message.targets.length), [8, 8, 5]);
    assert.equal(fixture.coordinator.retryArgs[1], "scheduled-source");
    assert.equal(fixture.coordinator.retryArgs[2], 21);

    const clientTargets = await handleAdminRequest(
        new Request("https://edge.test/admin/retry", {
            method: "POST",
            headers: {
                Authorization: "Bearer preview-test-secret",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ targets: [target(1)] }),
        }),
        fixture.env,
        { log: () => {} },
    );
    const tooMany = await handleAdminRequest(
        new Request("https://edge.test/admin/retry", {
            method: "POST",
            headers: {
                Authorization: "Bearer preview-test-secret",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ limit: 101 }),
        }),
        fixture.env,
        { log: () => {} },
    );
    assert.equal(clientTargets.status, 400);
    assert.equal(tooMany.status, 400);

    const unauthorizedLogs = [];
    const unauthorized = await handleAdminRequest(
        new Request("https://edge.test/admin/retry", {
            method: "POST",
            headers: {
                Authorization: "Bearer wrong",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ limit: 1 }),
        }),
        fixture.env,
        { log: (event, fields) => unauthorizedLogs.push({ event, ...fields }) },
    );
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(unauthorizedLogs.at(-1), {
        event: "filtered",
        trigger: "http",
        reason: "unauthorized",
        expected_token_length: 19,
        provided_token_length: 5,
    });
});

test("授权补采只登记矩阵内专精，不同步查询或改写排行", async () => {
    const target = { kind: "spec", targetKey: "spec/boss/evoker-preservation/mythic/hps",
        specSlug: "evoker-preservation" };
    const original = JSON.stringify({ reports: [{ report_id: "REPORTCODE123456" }] });
    let saved;
    const env = {
        CASTS_ADMIN_TOKEN: "backfill-secret",
        RANKING_DB: { prepare(sql) { return { bind(...values) { return {
            async first() { return sql.startsWith("SELECT") ? { ranking_json: original } : null; },
            async run() { saved = values; return { meta: { changes: 1 } }; },
        }; } }; } },
        REFRESH_COORDINATOR: { getByName() { return { async registerCasts(value, completion, foreground) {
            assert.equal(value.targetKey, target.targetKey);
            assert.equal(foreground, true);
            return { version: 1, complete: 0, total: 1, failed: 0, status: "queued" };
        } }; } },
    };
    const request = (token, key) => new Request("https://edge.test/admin/backfill-casts", {
        method: "POST", headers: { authorization: `Bearer ${token}`,
            "content-type": "application/json" }, body: JSON.stringify({ target_key: key }),
    });
    const deps = { targetIndex: new Map([[target.targetKey, target]]), log: () => {} };
    assert.equal((await handleAdminRequest(request("wrong", target.targetKey), env, deps)).status, 401);
    assert.equal((await handleAdminRequest(request("backfill-secret", "other"), env, deps)).status, 400);
    const response = await handleAdminRequest(request("backfill-secret", target.targetKey), env, deps);
    assert.equal(response.status, 202);
    assert.equal((await response.json()).skill_completion.status, "queued");
    assert.equal(saved, undefined);
});

test("完整矩阵分组发送队列消息，断点续排只投递缺失批次", async () => {
    const fixture = fakeBindings();
    const targets = Array.from({ length: 1683 }, (_, index) => target(index));
    const controller = { cron: "0 * * * *", scheduledTime: Date.parse("2026-08-09T12:00:00Z") };
    const options = { now: () => new Date("2026-08-09T12:00:01Z"), log: () => {} };
    await runScheduledRefresh(controller, fixture.env, targets, options);
    assert.equal(fixture.sent.length, 211);
    assert.equal(fixture.sends.reduce((sum, count) => sum + count, 0), 211);
    assert.equal(fixture.sent.every(message => message.targets.length <= 8), true);

    const resumed = fakeBindings();
    resumed.coordinator.beginRun = async () => ({ accepted: false, reason: "active_run" });
    resumed.coordinator.runProgress = async () => ({ active: true, status: "enqueuing",
        run_id: "scheduled-original", matrix_id: "midnight-s2-1683-v1",
        expected_batches: 6, expected_targets: 41,
        registered_batches: 5, complete_batches: 5 });
    const result = await runScheduledRefresh(controller, resumed.env,
        Array.from({ length: 41 }, (_, index) => target(index)), options);
    assert.equal(result.run_id, "scheduled-original");
    assert.deepEqual(resumed.sent.map(message => message.batch_id), ["batch-0006"]);
    assert.deepEqual(resumed.sends, [1]);
});
