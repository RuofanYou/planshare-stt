import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { consumeQueueBatch } from "../src/refresh.js";
import { loadTargetRecord, writeTargetResult } from "../src/ranking-store.js";
import { openLocalD1 } from "../../testing/local-d1.mjs";

const CHECKED_AT = "2026-08-09T12:00:00.000Z";
const PUBLISHED_AT = "2026-08-09T06:00:00.000Z";
const UPSTREAM_UPDATED = "2026-08-09T05:59:00.000Z";

function specTarget() {
    return {
        kind: "spec",
        targetKey: "spec/imperator-averzian/mage-fire/heroic/dps",
        bossSlug: "imperator-averzian",
        specSlug: "mage-fire",
        role: "rdps",
        difficulty: "heroic",
        metric: "dps",
    };
}

function queueMessage(target) {
    return {
        body: {
            schema_version: 2,
            run_id: "scheduled-1",
            batch_id: "batch-0001",
            targets: [target],
        },
        acked: false,
        retried: false,
        ack() { this.acked = true; },
        retry() { this.retried = true; },
    };
}

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function ranking(target, reports = [{ report_id: "old" }]) {
    return {
        boss_slug: target.bossSlug,
        spec_slug: target.specSlug,
        difficulty: target.difficulty,
        metric: target.metric,
        updated: UPSTREAM_UPDATED,
        reports,
        edge_top_n: 10,
        source_report_count: reports.length,
    };
}

async function fakeEnvironment(t, target) {
    const db = openLocalD1();
    t.after(() => db.close());
    db.exec(await readFile(new URL("../migrations/0001_dynamic_rankings.sql", import.meta.url), "utf8"));
    const recorded = [];
    const coordinator = {
        async claimBatch() { return { status: "claimed", terminal_statuses: [] }; },
        async recordTarget(runId, batchId, result) {
            recorded.push({ runId, batchId, result });
            return {
                schema_version: 2,
                target_key: target.targetKey,
                status: result.status === "failed" ? "stale" : "fresh",
                checked_at: result.checkedAt,
                published_at: result.publishedAt,
                upstream_updated: result.upstreamUpdated,
                last_error_code: result.errorCode,
            };
        },
        async completeBatch() {
            return {
                global_status: {
                    schema_version: 2,
                    status: "fresh",
                    checked_at: CHECKED_AT,
                },
                run_status: { schema_version: 2, status: "complete" },
            };
        },
    };
    return {
        db,
        recorded,
        env: {
            UPSTREAM_ORIGIN: "https://api2.lorrgs.io",
            RANKING_DB: db,
            REFRESH_COORDINATOR: { getByName() { return coordinator; } },
        },
    };
}

async function seedRanking(db, target) {
    await writeTargetResult(db, {
        target,
        status: "published",
        ranking: ranking(target),
        checkedAt: PUBLISHED_AT,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
        errorCode: null,
        errorMessage: null,
    }, "seed-1");
}

test("专精 info 未变化时零完整排行 GET、零排行覆盖并刷新检查状态", async (t) => {
    const target = specTarget();
    const message = queueMessage(target);
    const fixture = await fakeEnvironment(t, target);
    await seedRanking(fixture.db, target);
    const before = await loadTargetRecord(fixture.db, target.targetKey);
    const fetched = [];

    await consumeQueueBatch({ messages: [message] }, fixture.env, {
        fetchImpl: async (url, init) => {
            fetched.push({ url: String(url), redirect: init.redirect });
            return jsonResponse({
                boss_slug: target.bossSlug,
                spec_slug: target.specSlug,
                difficulty: target.difficulty,
                metric: target.metric,
                updated: UPSTREAM_UPDATED,
            });
        },
        now: () => new Date(CHECKED_AT),
        log: () => {},
    });

    const after = await loadTargetRecord(fixture.db, target.targetKey);
    assert.equal(message.acked, true);
    assert.equal(message.retried, false);
    assert.equal(fetched.length, 1);
    assert.match(fetched[0].url, /\/info\?/);
    assert.equal(fetched[0].redirect, "manual");
    assert.equal(after.ranking_json, before.ranking_json);
    assert.equal(after.checked_at, CHECKED_AT);
    assert.equal(after.refresh_status, "fresh");
    assert.equal(fixture.recorded[0].result.status, "reused");
    assert.equal(fixture.recorded[0].result.available, true);
    assert.equal(fixture.recorded[0].result.publishedAt, PUBLISHED_AT);
});

test("专精完整排行失败时保留旧排行并原子写入 stale 状态", async (t) => {
    const target = specTarget();
    const message = queueMessage(target);
    const fixture = await fakeEnvironment(t, target);
    await seedRanking(fixture.db, target);
    const before = await loadTargetRecord(fixture.db, target.targetKey);
    const fetched = [];

    await consumeQueueBatch({ messages: [message] }, fixture.env, {
        fetchImpl: async (url) => {
            fetched.push(String(url));
            if (String(url).includes("/info")) {
                return jsonResponse({
                    boss_slug: target.bossSlug,
                    spec_slug: target.specSlug,
                    difficulty: target.difficulty,
                    metric: target.metric,
                    updated: "2026-08-09T11:59:00.000Z",
                });
            }
            return jsonResponse({ error: "quota" }, 503);
        },
        now: () => new Date(CHECKED_AT),
        log: () => {},
    });

    const after = await loadTargetRecord(fixture.db, target.targetKey);
    assert.equal(message.acked, true);
    assert.equal(fetched.length, 2);
    assert.equal(after.ranking_json, before.ranking_json);
    assert.equal(after.published_at, PUBLISHED_AT);
    assert.equal(after.upstream_updated, UPSTREAM_UPDATED);
    assert.equal(after.refresh_status, "stale");
    assert.equal(after.last_error_code, "upstream_ranking_http_503");
    assert.equal(fixture.recorded[0].result.status, "failed");
    assert.equal(fixture.recorded[0].result.available, true);
    assert.equal(fixture.recorded[0].result.publishedAt, PUBLISHED_AT);
    assert.equal(fixture.recorded[0].result.upstreamUpdated, UPSTREAM_UPDATED);
});

test("阵容目标每轮公开 GET limit=20 并在 D1 只写 Top10", async (t) => {
    const target = {
        kind: "comp",
        targetKey: "comp/imperator-averzian",
        bossSlug: "imperator-averzian",
    };
    const message = queueMessage(target);
    const fixture = await fakeEnvironment(t, target);
    const fetched = [];

    await consumeQueueBatch({ messages: [message] }, fixture.env, {
        fetchImpl: async (url) => {
            fetched.push(String(url));
            return jsonResponse({
                boss_slug: target.bossSlug,
                updated: UPSTREAM_UPDATED,
                reports: Array.from({ length: 20 }, (_, index) => ({ report_id: `report-${index}` })),
            });
        },
        now: () => new Date(CHECKED_AT),
        log: () => {},
    });

    assert.equal(fetched.length, 1);
    assert.match(fetched[0], /\/api\/comp_ranking\/imperator-averzian\?limit=20$/);
    const row = await loadTargetRecord(fixture.db, target.targetKey);
    const stored = JSON.parse(row.ranking_json);
    assert.equal(stored.reports.length, 10);
    assert.equal(stored.source_report_count, 20);
    assert.equal(stored.edge_top_n, 10);
});

test("上游合法空 reports 作为可用无样本结果发布", async (t) => {
    const target = specTarget();
    const message = queueMessage(target);
    const fixture = await fakeEnvironment(t, target);

    await consumeQueueBatch({ messages: [message] }, fixture.env, {
        fetchImpl: async (url) => jsonResponse({
            boss_slug: target.bossSlug,
            spec_slug: target.specSlug,
            difficulty: target.difficulty,
            metric: target.metric,
            updated: UPSTREAM_UPDATED,
            reports: [],
        }),
        now: () => new Date(CHECKED_AT),
        log: () => {},
    });

    const row = await loadTargetRecord(fixture.db, target.targetKey);
    assert.equal(message.acked, true);
    assert.equal(row.refresh_status, "fresh");
    assert.equal(row.published_at, CHECKED_AT);
    assert.equal(row.last_error_code, null);
    assert.deepEqual(JSON.parse(row.ranking_json).reports, []);
    assert.equal(fixture.recorded[0].result.status, "published");
    assert.equal(fixture.recorded[0].result.available, true);
});

test("D1 写入失败时 Queue 重试且 Durable Object 不记录终态", async () => {
    const target = specTarget();
    const message = queueMessage(target);
    const recorded = [];
    const coordinator = {
        async claimBatch() { return { status: "claimed", terminal_statuses: [] }; },
        async recordTarget(...args) { recorded.push(args); },
    };
    const env = {
        UPSTREAM_ORIGIN: "https://api2.lorrgs.io",
        RANKING_DB: { prepare() { throw new Error("d1 unavailable"); } },
        REFRESH_COORDINATOR: { getByName() { return coordinator; } },
    };

    await consumeQueueBatch({ messages: [message] }, env, {
        fetchImpl: async () => jsonResponse({}),
        now: () => new Date(CHECKED_AT),
        log: () => {},
    });

    assert.equal(message.acked, false);
    assert.equal(message.retried, true);
    assert.equal(recorded.length, 0);
});
