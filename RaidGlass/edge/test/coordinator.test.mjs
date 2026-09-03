import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { Miniflare } from "miniflare";

const EXPECTED = { spec_expected: 1674, comp_expected: 9 };
const NOW = "2026-08-09T12:00:00.000Z";
const TARGET = {
    kind: "spec",
    targetKey: "spec/imperator-averzian/mage-fire/heroic/dps",
    bossSlug: "imperator-averzian",
    specSlug: "mage-fire",
    role: "rdps",
    difficulty: "heroic",
    metric: "dps",
};

async function call(mf, action, ...args) {
    const response = await mf.dispatchFetch("https://coordinator.test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args }),
    });
    if (response.status !== 200) {
        throw new Error(`coordinator action failed status=${response.status} body=${await response.text()}`);
    }
    return response.json();
}

test("SQLite Durable Object 拒绝重叠 run 并汇总 S2 状态", async (context) => {
    const raidGlassRoot = fileURLToPath(new URL("../../", import.meta.url));
    const mf = new Miniflare({
        rootPath: raidGlassRoot,
        modules: true,
        modulesRoot: raidGlassRoot,
        scriptPath: "edge/coordinator-test-worker.mjs",
        modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
        compatibilityDate: "2026-07-15",
        durableObjects: {
            REFRESH_COORDINATOR: { className: "RefreshCoordinator", useSQLite: true },
        },
        durableObjectsPersist: false,
    });
    context.after(() => mf.dispose());

    const started = await call(
        mf,
        "beginRun",
        "scheduled-1",
        "scheduled",
        null,
        1,
        1,
        "midnight-s2-1683-v1",
        EXPECTED,
        NOW,
    );
    assert.equal(started.accepted, true);
    await call(mf, "markBatchEnqueued", "scheduled-1", "batch-0001", [TARGET], NOW);
    await call(mf, "finalizeEnqueue", "scheduled-1", NOW);

    const overlap = await call(
        mf,
        "beginRun",
        "scheduled-2",
        "scheduled",
        null,
        1,
        1,
        "midnight-s2-1683-v1",
        EXPECTED,
        NOW,
    );
    assert.equal(overlap.accepted, false);
    assert.equal(overlap.reason, "active_run");

    const claim = await call(mf, "claimBatch", "scheduled-1", "batch-0001", [TARGET], NOW);
    assert.equal(claim.status, "claimed");
    await call(mf, "recordTarget", "scheduled-1", "batch-0001", {
        target: TARGET,
        status: "published",
        available: true,
        checkedAt: NOW,
        publishedAt: NOW,
        upstreamUpdated: "2026-08-09T11:59:00.000Z",
        errorCode: null,
        errorMessage: null,
    });
    const completed = await call(mf, "completeBatch", "scheduled-1", "batch-0001", NOW);

    assert.equal(completed.run_status.status, "complete");
    assert.equal(completed.run_status.published_count, 1);
    assert.equal(completed.global_status.expected_count, 1683);
    assert.equal(completed.global_status.available_count, 1);
    assert.equal(completed.global_status.fresh_count, 1);
    assert.equal(completed.global_status.unchecked_count, 1682);
    assert.equal(completed.global_status.spec_available, 1);
    assert.equal(completed.global_status.comp_available, 0);

    const later = "2026-08-09T18:00:00.000Z";
    const second = await call(
        mf,
        "beginRun",
        "scheduled-2",
        "scheduled",
        null,
        1,
        1,
        "midnight-s2-1683-v1",
        EXPECTED,
        later,
    );
    assert.equal(second.accepted, true);
    await call(mf, "markBatchEnqueued", "scheduled-2", "batch-0001", [TARGET], later);
    await call(mf, "finalizeEnqueue", "scheduled-2", later);
    await call(mf, "claimBatch", "scheduled-2", "batch-0001", [TARGET], later);
    await call(mf, "recordTarget", "scheduled-2", "batch-0001", {
        target: TARGET,
        status: "failed",
        available: true,
        checkedAt: later,
        publishedAt: NOW,
        upstreamUpdated: "2026-08-09T11:59:00.000Z",
        errorCode: "upstream_ranking_http_503",
        errorMessage: "ranking request returned HTTP 503",
    });
    const stale = await call(mf, "completeBatch", "scheduled-2", "batch-0001", later);
    assert.equal(stale.run_status.status, "partial");
    assert.equal(stale.global_status.available_count, 1);
    assert.equal(stale.global_status.fresh_count, 0);
    assert.equal(stale.global_status.stale_count, 1);
    assert.equal(stale.global_status.spec_available, 1);
});

test("SQLite Durable Object 在新 run 开始时清理超过 30 天的历史轮次", async (context) => {
    const raidGlassRoot = fileURLToPath(new URL("../../", import.meta.url));
    const mf = new Miniflare({
        rootPath: raidGlassRoot,
        modules: true,
        modulesRoot: raidGlassRoot,
        scriptPath: "edge/coordinator-test-worker.mjs",
        modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
        compatibilityDate: "2026-07-15",
        durableObjects: {
            REFRESH_COORDINATOR: { className: "RefreshCoordinator", useSQLite: true },
        },
        durableObjectsPersist: false,
    });
    context.after(() => mf.dispose());

    await call(mf, "beginRun", "scheduled-old", "scheduled", null, 1, 1, "midnight-s2-1683-v1", EXPECTED, NOW);
    await call(mf, "markBatchEnqueued", "scheduled-old", "batch-0001", [TARGET], NOW);
    await call(mf, "finalizeEnqueue", "scheduled-old", NOW);
    await call(mf, "claimBatch", "scheduled-old", "batch-0001", [TARGET], NOW);
    await call(mf, "recordTarget", "scheduled-old", "batch-0001", {
        target: TARGET,
        status: "failed",
        available: false,
        checkedAt: NOW,
        publishedAt: null,
        upstreamUpdated: null,
        errorCode: "upstream_ranking_http_503",
        errorMessage: "ranking request returned HTTP 503",
    });
    await call(mf, "completeBatch", "scheduled-old", "batch-0001", NOW);

    const future = "2026-09-10T12:00:00.000Z";
    const started = await call(
        mf,
        "beginRun",
        "scheduled-new",
        "scheduled",
        null,
        1,
        1,
        "midnight-s2-1683-v1",
        EXPECTED,
        future,
    );
    assert.equal(started.accepted, true);
    await assert.rejects(
        () => call(
            mf,
            "prepareRetry",
            "manual-old",
            "scheduled-old",
            1,
            "midnight-s2-1683-v1",
            EXPECTED,
            future,
        ),
        /source run not found/,
    );
});
