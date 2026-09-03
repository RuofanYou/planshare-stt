import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import pagesWorker from "../../frontend/public/_worker.js";
import { writeGlobalStatus, writeTargetResult } from "../src/ranking-store.js";
import { openLocalD1 } from "../../testing/local-d1.mjs";

function request(path) {
    return new Request(`https://zhaobanzi.pages.dev/log${path}`);
}

function isoHoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function fakeEnv(t, options = {}) {
    const metadata = {
        "/api/specs.json": { specs: [
            { full_name_slug: "mage-fire", role: "rdps" },
            { full_name_slug: "priest-holy", role: "heal" },
            { full_name_slug: "deathknight-blood", role: "tank" },
            { full_name_slug: "rogue-outlaw", role: "mdps" },
        ] },
        "/api/roles.json": { roles: [
            { code: "rdps", metrics: ["dps", "bossdps"] },
            { code: "mdps", metrics: ["dps", "bossdps"] },
            { code: "heal", metrics: ["dps", "hps", "bossdps"] },
            { code: "tank", metrics: ["dps", "hps", "bossdps"] },
        ] },
        "/api/current_season/zones.json": [{
            id: 46.1,
            bosses: [{ full_name_slug: "imperator-averzian" }],
        }],
        "/snapshot-manifest.json": {
            schema_version: 2,
            top_n: 10,
            release_id: "release-v2",
            build_id: "build-v2",
            source_tree_hash: "a".repeat(64),
            published_at: "2026-08-09T12:00:00.000Z",
        },
        ...options.metadata,
    };
    const db = openLocalD1();
    t.after(() => db.close());
    db.exec(await readFile(new URL("../migrations/0001_dynamic_rankings.sql", import.meta.url), "utf8"));
    return {
        db,
        env: {
            ASSETS: {
                async fetch(assetRequest) {
                    const pathname = new URL(assetRequest.url).pathname;
                    const payload = metadata[pathname];
                    return payload
                        ? Response.json(payload)
                        : new Response("not found", { status: 404 });
                },
            },
            RANKING_DB: db,
        },
    };
}

function specTarget(overrides = {}) {
    const value = {
        kind: "spec",
        bossSlug: "imperator-averzian",
        specSlug: "mage-fire",
        role: "rdps",
        difficulty: "heroic",
        metric: "bossdps",
        ...overrides,
    };
    return {
        ...value,
        targetKey: `spec/${value.bossSlug}/${value.specSlug}/${value.difficulty}/${value.metric}`,
    };
}

function compTarget() {
    return {
        kind: "comp",
        targetKey: "comp/imperator-averzian",
        bossSlug: "imperator-averzian",
    };
}

function specRanking(overrides = {}) {
    return {
        boss_slug: "imperator-averzian",
        spec_slug: "mage-fire",
        difficulty: "heroic",
        metric: "bossdps",
        updated: isoHoursAgo(1),
        reports: [{ report_id: "one" }],
        edge_top_n: 10,
        source_report_count: 20,
        ...overrides,
    };
}

function targetRefresh(overrides = {}) {
    return {
        status: "fresh",
        checked_at: isoHoursAgo(1),
        published_at: isoHoursAgo(1),
        upstream_updated: isoHoursAgo(1),
        last_error_code: null,
        ...overrides,
    };
}

async function seedTarget(db, target, ranking, refresh = targetRefresh()) {
    await writeTargetResult(db, {
        target,
        status: "published",
        ranking,
        checkedAt: refresh.published_at,
        publishedAt: refresh.published_at,
        upstreamUpdated: refresh.upstream_updated,
        errorCode: null,
        errorMessage: null,
    }, "seed-published");
    if (refresh.status === "stale") {
        await writeTargetResult(db, {
            target,
            status: "failed",
            checkedAt: refresh.checked_at,
            publishedAt: null,
            upstreamUpdated: null,
            errorCode: refresh.last_error_code,
            errorMessage: "fixture failure",
        }, "seed-stale");
    } else if (refresh.checked_at !== refresh.published_at) {
        await writeTargetResult(db, {
            target,
            status: "reused",
            checkedAt: refresh.checked_at,
            publishedAt: refresh.published_at,
            upstreamUpdated: refresh.upstream_updated,
            errorCode: null,
            errorMessage: null,
        }, "seed-reused");
    }
}

function completeGlobalStatus(overrides = {}) {
    return {
        schema_version: 2,
        run_id: "run-current",
        latest_run_id: "run-current",
        active_run_id: null,
        last_completed_run_id: "run-current",
        status: "fresh",
        matrix_id: "midnight-s1-1870-v3",
        expected_count: 1870,
        available_count: 1870,
        fresh_count: 1870,
        stale_count: 0,
        unchecked_count: 0,
        spec_expected: 1860,
        spec_available: 1860,
        spec_fresh: 1860,
        spec_stale: 0,
        spec_unchecked: 0,
        comp_expected: 10,
        comp_available: 10,
        comp_fresh: 10,
        comp_stale: 0,
        comp_unchecked: 0,
        checked_at: isoHoursAgo(1),
        ...overrides,
    };
}

test("Pages 从 D1 单行读取专精排行与 refresh", async (t) => {
    const fixture = await fakeEnv(t);
    const target = specTarget();
    const ranking = specRanking();
    const refresh = targetRefresh({
        status: "stale",
        last_error_code: "upstream_ranking_http_503",
    });
    await seedTarget(fixture.db, target, ranking, refresh);

    const response = await pagesWorker.fetch(
        request("/api/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.reports.length, 1);
    assert.deepEqual(body.refresh, refresh);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
});

test("Pages 只开放单一专精排行 URL", async (t) => {
    const fixture = await fakeEnv(t);
    const response = await pagesWorker.fetch(
        request("/api/rankings/spec/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "not_found");
});

test("Pages 缺排行或状态损坏时返回结构化 503", async (t) => {
    const fixture = await fakeEnv(t);
    await writeTargetResult(fixture.db, {
        target: specTarget(),
        status: "failed",
        checkedAt: isoHoursAgo(1),
        publishedAt: null,
        upstreamUpdated: null,
        errorCode: "upstream_ranking_http_503",
        errorMessage: "fixture failure",
    }, "seed-failed");
    const missingRanking = await pagesWorker.fetch(
        request("/api/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );
    assert.equal(missingRanking.status, 503);
    assert.equal((await missingRanking.json()).error, "ranking_unavailable");

    await seedTarget(fixture.db, specTarget(), specRanking(), targetRefresh());
    await fixture.db.prepare(
        "UPDATE ranking_targets SET checked_at = 'invalid' WHERE target_key = ?",
    ).bind(specTarget().targetKey).run();
    const invalidStatus = await pagesWorker.fetch(
        request("/api/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );
    assert.equal(invalidStatus.status, 503);
    assert.equal((await invalidStatus.json()).error, "ranking_status_invalid");
});

test("Pages 拒绝身份错误的排行，避免串目标", async (t) => {
    const fixture = await fakeEnv(t);
    await seedTarget(
        fixture.db,
        specTarget(),
        specRanking({ boss_slug: "wrong-boss" }),
        targetRefresh(),
    );
    const response = await pagesWorker.fetch(
        request("/api/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "ranking_identity_invalid");
});

test("Pages 将超过 8 小时未检查的数据标为过期", async (t) => {
    const fixture = await fakeEnv(t);
    const refresh = targetRefresh({ checked_at: isoHoursAgo(9) });
    await seedTarget(fixture.db, specTarget(), specRanking(), refresh);
    const response = await pagesWorker.fetch(
        request("/api/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=bossdps"),
        fixture.env,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).refresh.status, "stale");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
});

test("Pages 接受各角色合同内指标", async (t) => {
    const fixture = await fakeEnv(t);
    const cases = [
        ["mage-fire", "rdps", "bossdps"],
        ["rogue-outlaw", "mdps", "dps"],
        ["priest-holy", "heal", "hps"],
        ["priest-holy", "heal", "bossdps"],
        ["deathknight-blood", "tank", "hps"],
    ];
    for (const [specSlug, role, metric] of cases) {
        const target = specTarget({ specSlug, role, difficulty: "mythic", metric });
        await seedTarget(fixture.db, target, specRanking({
            spec_slug: specSlug,
            difficulty: "mythic",
            metric,
        }), targetRefresh());
        const response = await pagesWorker.fetch(
            request(`/api/spec_ranking/${specSlug}/imperator-averzian?difficulty=mythic&metric=${metric}`),
            fixture.env,
        );
        assert.equal(response.status, 200, `${specSlug}/${metric}`);
    }
});

test("Pages 从 D1 返回阵容 Top10 与相同 refresh 合同", async (t) => {
    const fixture = await fakeEnv(t);
    const ranking = {
        boss_slug: "imperator-averzian",
        updated: isoHoursAgo(1),
        reports: [{ report_id: "comp-one" }],
        edge_top_n: 10,
        source_report_count: 20,
    };
    const refresh = targetRefresh({
        status: "stale",
        last_error_code: "upstream_comp_http_503",
    });
    await seedTarget(fixture.db, compTarget(), ranking, refresh);
    const response = await pagesWorker.fetch(
        request("/api/comp_ranking/imperator-averzian"),
        fixture.env,
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.reports[0].report_id, "comp-one");
    assert.equal(body.refresh.status, "stale");
    assert.equal(body.refresh.last_error_code, "upstream_comp_http_503");
});

test("Pages 运维接口以 D1 的 1870 全局状态为唯一动态真源", async (t) => {
    const fixture = await fakeEnv(t);
    await writeGlobalStatus(fixture.db, completeGlobalStatus());
    const health = await pagesWorker.fetch(request("/api/health"), fixture.env);
    const healthBody = await health.json();
    assert.equal(health.status, 200);
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.mode, "worker-assets-d1");
    assert.equal(healthBody.expected_count, 1870);
    assert.equal(healthBody.available_count, 1870);

    const admin = await pagesWorker.fetch(request("/api/admin/refresh-state"), fixture.env);
    const adminBody = await admin.json();
    assert.equal(admin.status, 200);
    assert.equal(adminBody.spec_expected, 1860);
    assert.equal(adminBody.comp_expected, 10);
    assert.equal(adminBody.latest_run_id, "run-current");
    assert.equal(adminBody.release_id, "release-v2");
    assert.equal(adminBody.build_id, "build-v2");
    assert.equal(adminBody.source_tree_hash, "a".repeat(64));
    assert.equal(adminBody.published_at, "2026-08-09T12:00:00.000Z");
});

test("Pages 缺全局状态时运维接口返回 JSON 503", async (t) => {
    const fixture = await fakeEnv(t);
    const response = await pagesWorker.fetch(request("/api/health"), fixture.env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "refresh_status_unavailable");
});
