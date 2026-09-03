import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    loadTargetRecord,
    writeGlobalStatus,
    writeTargetResult,
} from "../src/ranking-store.js";
import { openLocalD1 } from "../../testing/local-d1.mjs";

const CHECKED_AT = "2026-08-09T12:00:00.000Z";
const PUBLISHED_AT = "2026-08-09T06:00:00.000Z";
const UPSTREAM_UPDATED = "2026-08-09T05:59:00.000Z";

function target() {
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

async function database(t) {
    const db = openLocalD1();
    t.after(() => db.close());
    db.exec(await readFile(new URL("../migrations/0001_dynamic_rankings.sql", import.meta.url), "utf8"));
    return db;
}

function ranking() {
    return {
        boss_slug: "imperator-averzian",
        spec_slug: "mage-fire",
        difficulty: "heroic",
        metric: "dps",
        updated: UPSTREAM_UPDATED,
        reports: [{ report_id: "one" }],
        source_report_count: 20,
        edge_top_n: 10,
    };
}

test("D1 成功发布后目标排行与刷新状态位于同一行", async (t) => {
    const db = await database(t);
    const stored = await writeTargetResult(db, {
        target: target(),
        status: "published",
        ranking: ranking(),
        checkedAt: PUBLISHED_AT,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
        errorCode: null,
        errorMessage: null,
    }, "scheduled-1");

    const row = await loadTargetRecord(db, target().targetKey);
    assert.equal(row.target_key, target().targetKey);
    assert.equal(row.refresh_status, "fresh");
    assert.equal(row.published_at, PUBLISHED_AT);
    assert.equal(row.upstream_updated, UPSTREAM_UPDATED);
    assert.deepEqual(JSON.parse(row.ranking_json), ranking());
    assert.deepEqual(stored, {
        available: true,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
    });
});

test("D1 局部失败只更新 stale 状态并完整保留旧排行", async (t) => {
    const db = await database(t);
    await writeTargetResult(db, {
        target: target(),
        status: "published",
        ranking: ranking(),
        checkedAt: PUBLISHED_AT,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
        errorCode: null,
        errorMessage: null,
    }, "scheduled-1");
    const stored = await writeTargetResult(db, {
        target: target(),
        status: "failed",
        checkedAt: CHECKED_AT,
        publishedAt: null,
        upstreamUpdated: null,
        errorCode: "upstream_ranking_http_503",
        errorMessage: "ranking request returned HTTP 503",
    }, "scheduled-2");

    const row = await loadTargetRecord(db, target().targetKey);
    assert.equal(row.refresh_status, "stale");
    assert.equal(row.checked_at, CHECKED_AT);
    assert.equal(row.published_at, PUBLISHED_AT);
    assert.equal(row.upstream_updated, UPSTREAM_UPDATED);
    assert.equal(row.last_error_code, "upstream_ranking_http_503");
    assert.deepEqual(JSON.parse(row.ranking_json), ranking());
    assert.deepEqual(stored, {
        available: true,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
    });
});

test("D1 未变化复用只刷新检查字段且无旧排行时拒绝伪复用", async (t) => {
    const db = await database(t);
    const reused = {
        target: target(),
        status: "reused",
        checkedAt: CHECKED_AT,
        publishedAt: PUBLISHED_AT,
        upstreamUpdated: UPSTREAM_UPDATED,
        errorCode: null,
        errorMessage: null,
    };
    await assert.rejects(() => writeTargetResult(db, reused, "scheduled-2"), /reused ranking is missing/);

    await writeTargetResult(db, {
        ...reused,
        status: "published",
        ranking: ranking(),
        checkedAt: PUBLISHED_AT,
    }, "scheduled-1");
    await writeTargetResult(db, reused, "scheduled-2");

    const row = await loadTargetRecord(db, target().targetKey);
    assert.equal(row.refresh_status, "fresh");
    assert.equal(row.checked_at, CHECKED_AT);
    assert.equal(row.published_at, PUBLISHED_AT);
    assert.deepEqual(JSON.parse(row.ranking_json), ranking());
});

test("D1 全局状态固定写入单例行", async (t) => {
    const db = await database(t);
    const status = {
        schema_version: 2,
        status: "fresh",
        checked_at: CHECKED_AT,
        expected_count: 1870,
    };
    await writeGlobalStatus(db, status);

    const row = await db.prepare(
        "SELECT payload_json, updated_at FROM global_status WHERE singleton = 1",
    ).first();
    assert.deepEqual(JSON.parse(row.payload_json), status);
    assert.equal(row.updated_at, CHECKED_AT);
});
