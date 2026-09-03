import assert from "node:assert/strict";
import test from "node:test";

import { handleAdminRequest, runScheduledRefresh } from "../src/orchestrator.js";

function target(index) {
    return {
        kind: "comp",
        targetKey: `comp/boss-${index}`,
        bossSlug: `boss-${index}`,
    };
}

function fakeBindings() {
    const sent = [];
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
        coordinator,
        env: {
            ALLOWED_CRON: "0 */6 * * *",
            REFRESH_QUEUE: { async send(message) { sent.push(message); } },
            REFRESH_COORDINATOR: { getByName() { return coordinator; } },
            RANKING_DB: {
                prepare() {
                    return {
                        bind() {
                            return { async run() { return { meta: { changes: 1 } }; } };
                        },
                    };
                },
            },
        },
    };
}

test("六小时 Cron 将目标切成最多 20 个的 schema v2 单消息", async () => {
    const fixture = fakeBindings();
    const targets = Array.from({ length: 41 }, (_, index) => target(index));
    const result = await runScheduledRefresh(
        { cron: "0 */6 * * *", scheduledTime: Date.parse("2026-08-09T12:00:00Z") },
        fixture.env,
        targets,
        { now: () => new Date("2026-08-09T12:00:01Z"), log: () => {} },
    );

    assert.equal(result.status, "enqueued");
    assert.deepEqual(fixture.sent.map((message) => message.targets.length), [20, 20, 1]);
    assert.equal(fixture.sent.every((message) => message.schema_version === 2), true);
    assert.equal(fixture.coordinator.beginArgs[5], "midnight-s2-1683-v1");
});

test("重复或重叠 Cron 由 Durable Object 拒绝且零排队", async () => {
    const fixture = fakeBindings();
    fixture.coordinator.beginRun = async () => ({ accepted: false, reason: "active_run" });
    const result = await runScheduledRefresh(
        { cron: "0 */6 * * *", scheduledTime: 1234 },
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
    assert.deepEqual(fixture.sent.map((message) => message.targets.length), [20, 1]);
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
