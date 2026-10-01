import assert from "node:assert/strict";
import test from "node:test";

import worker, { loadManifest } from "../../public/_worker.js";

const manifest = {
    schema_version: 2,
    top_n: 10,
    source_tree_hash: "a".repeat(64),
    build_id: "build-worker-test",
    release_id: "release-worker-test",
    matrix_id: "midnight-s2-1683-v1",
    expected_count: 1683,
    spec_expected: 1674,
    comp_expected: 9,
    published_at: "2026-08-09T12:00:00.000Z",
};

function request(path, init) {
    return new Request(`https://zhaobanzi.pages.dev${path}`, init);
}

function fakeEnv({ assetRequests = [], manifestPayload = manifest } = {}) {
    return {
        ASSETS: {
            async fetch(assetRequest) {
                const pathname = new URL(assetRequest.url).pathname;
                assetRequests.push({
                    pathname,
                    etag: assetRequest.headers.get("if-none-match"),
                });
                if (pathname === "/snapshot-manifest.json" && manifestPayload) {
                    return Response.json(manifestPayload);
                }
                return new Response("not found", { status: 404 });
            },
        },
        RANKING_DB: {
            prepare() {
                return {
                    bind() { return { async first() { return null; } }; },
                    async first() { return null; },
                };
            },
        },
    };
}

for (const path of [
    "/api/user_reports/REPORT-1",
    "/api/user_reports/REPORT-1/fights",
    "/api/tasks/TASK-1",
]) {
    test(`${path} 保持通用 JSON 404`, async () => {
        const response = await worker.fetch(request(path), fakeEnv());

        assert.equal(response.status, 404);
        assert.match(response.headers.get("content-type") || "", /^application\/json\b/);
        assert.deepEqual(await response.json(), { error: "not_found", path });
    });
}

test("部署清单 v2 只声明 UI 与构建身份", async () => {
    const loaded = await loadManifest(request("/snapshot-manifest.json"), fakeEnv());
    assert.deepEqual(loaded, manifest);
    for (const obsolete of [
        "ranking_data_hash",
        "ranking_expected_count",
        "ranking_valid_count",
        "snapshot_created_at",
        "data_as_of",
    ]) {
        assert.equal(Object.hasOwn(loaded, obsolete), false, obsolete);
    }
});

test("旧清单或缺失发布时间的清单会被拒绝", async () => {
    await assert.rejects(
        loadManifest(request("/snapshot-manifest.json"), fakeEnv({
            manifestPayload: { ...manifest, schema_version: 1 },
        })),
        /deployment manifest is invalid/,
    );
    const missingPublishedAt = { ...manifest };
    delete missingPublishedAt.published_at;
    await assert.rejects(
        loadManifest(request("/snapshot-manifest.json"), fakeEnv({ manifestPayload: missingPublishedAt })),
        /deployment manifest is invalid/,
    );
});

test("缺少 Pages D1 绑定时 API 明确返回 503", async () => {
    const env = fakeEnv();
    delete env.RANKING_DB;
    const response = await worker.fetch(request("/api/health"), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "ranking_store_unavailable");
});

test("/log 前缀在 Worker 内只剥离一次", async () => {
    const env = fakeEnv();
    delete env.RANKING_DB;
    const response = await worker.fetch(request("/log/api/health"), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "ranking_store_unavailable");
});

test("浏览器条件请求命中 304 时原样返回静态资源", async () => {
    const assetRequests = [];
    const env = fakeEnv({ assetRequests });
    env.ASSETS.fetch = async (assetRequest) => {
        assetRequests.push({
            pathname: new URL(assetRequest.url).pathname,
            etag: assetRequest.headers.get("if-none-match"),
        });
        return new Response(null, {
            status: 304,
            headers: { ETag: 'W/"cached-build-asset"' },
        });
    };
    const response = await worker.fetch(request("/assets/index-build.js", {
        headers: { "If-None-Match": 'W/"cached-build-asset"' },
    }), env);

    assert.equal(response.status, 304);
    assert.equal(response.headers.get("etag"), 'W/"cached-build-asset"');
    assert.deepEqual(assetRequests, [{
        pathname: "/assets/index-build.js",
        etag: 'W/"cached-build-asset"',
    }]);
});

test("公开静态元数据保留条件请求且每次重新验证", async () => {
    const env = fakeEnv();
    env.ASSETS.fetch = async (assetRequest) => {
        assert.equal(new URL(assetRequest.url).pathname, "/api/specs.json");
        assert.equal(assetRequest.headers.get("if-none-match"), 'W/"cached-api"');
        return new Response(null, {
            status: 304,
            headers: { ETag: 'W/"cached-api"' },
        });
    };
    const response = await worker.fetch(request("/api/specs", {
        headers: { "If-None-Match": 'W/"cached-api"' },
    }), env);

    assert.equal(response.status, 304);
    assert.equal(response.headers.get("etag"), 'W/"cached-api"');
    assert.equal(response.headers.get("cache-control"), "no-cache");
});

test("专精技能书走静态资源且不读取 D1", async () => {
    const env = fakeEnv();
    env.RANKING_DB.prepare = () => { throw new Error("unexpected D1 read"); };
    env.ASSETS.fetch = async assetRequest => {
        assert.equal(new URL(assetRequest.url).pathname, "/api/spellbook.json");
        return Response.json({ schema_version: 1, specs: { "evoker-preservation": { 366155: { name: "逆转" } } } });
    };
    const response = await worker.fetch(request("/api/spellbook"), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).specs["evoker-preservation"][366155].name, "逆转");
});

test("D1 当日读额度耗尽时仅对合法排行目标使用公开上游应急响应", async (t) => {
    const env = fakeEnv();
    env.ASSETS.fetch = async assetRequest => {
        const path = new URL(assetRequest.url).pathname;
        if (path === "/api/specs.json") return Response.json([{ full_name_slug: "mage-fire", role: "rdps" }]);
        if (path === "/api/roles.json") return Response.json([{ code: "rdps", metrics: ["dps"] }]);
        if (path === "/api/current_season/zones.json") return Response.json({ zones: [{ bosses: ["nekzali-the-soulcoiler"] }] });
        return new Response("not found", { status: 404 });
    };
    env.RANKING_DB.prepare = () => { throw new Error("D1 free tier daily row read limit exceeded"); };
    const originalFetch = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async url => {
        urls.push(String(url));
        return Response.json({ boss_slug: "nekzali-the-soulcoiler", spec_slug: "mage-fire",
            difficulty: "mythic", metric: "dps", updated: "2026-09-26T20:00:00Z",
            reports: Array.from({ length: 12 }, (_, i) => ({ report_id: `report-${i}` })) });
    };
    t.after(() => { globalThis.fetch = originalFetch; });
    const path = "/api/spec_ranking/mage-fire/nekzali-the-soulcoiler?difficulty=mythic&metric=dps";
    const response = await worker.fetch(request(path), env);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.reports.length, 10);
    assert.equal(payload.source_report_count, 12);
    assert.equal(payload.refresh.status, "stale");
    assert.equal(payload.refresh.last_error_code, "d1_daily_read_limit");
    assert.match(urls[0], /^https:\/\/api2\.lorrgs\.io\/api\/spec_ranking\/mage-fire\/nekzali-the-soulcoiler\?/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    const info = await worker.fetch(request(path.replace("?", "/info?")), env);
    assert.equal((await info.json()).report_count, 10);
    globalThis.fetch = async url => {
        urls.push(String(url));
        return Response.json({ boss_slug: "nekzali-the-soulcoiler",
            updated: "2026-09-26T20:00:00Z", reports: [{ report_id: "comp-1" }] });
    };
    const comp = await worker.fetch(request("/api/comp_ranking/nekzali-the-soulcoiler"), env);
    assert.equal(comp.status, 200);
    assert.equal((await comp.json()).reports.length, 1);
    assert.match(urls.at(-1), /\/api\/comp_ranking\/nekzali-the-soulcoiler\?limit=20$/);
    env.RANKING_DB.prepare = () => { throw new Error("unrelated database fault"); };
    const unrelated = await worker.fetch(request(path), env);
    assert.equal(unrelated.status, 503);
    assert.equal(urls.length, 3);
});

test("按需补采通过内部绑定登记、GET只读，校验目标与跨站请求", async () => {
    const env = fakeEnv();
    env.ASSETS.fetch = async assetRequest => {
        const path = new URL(assetRequest.url).pathname;
        if (path === "/api/specs.json") return Response.json([{ full_name_slug: "mage-fire", role: "rdps" }]);
        if (path === "/api/roles.json") return Response.json([{ code: "rdps", metrics: ["dps"] }]);
        if (path === "/api/current_season/zones.json") return Response.json({ zones: [{ bosses: ["nekzali-the-soulcoiler"] }] });
        return new Response("not found", { status: 404 });
    };
    const calls = [];
    env.CAST_BACKFILL = { async request(key, client) {
        calls.push({ key, client });
        return { skill_completion: { version: 1, complete: 2, total: 10, status: "queued" }, revision: "sample" };
    } };
    const path = "/log/api/spec_ranking/mage-fire/nekzali-the-soulcoiler/backfill?difficulty=heroic&metric=dps";
    const post = await worker.fetch(request(path, { method: "POST", headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
    assert.equal(post.status, 202);
    assert.equal(post.headers.get("cache-control"), "no-store");
    assert.match(calls[0].client, /^[a-f0-9]{64}$/);
    assert.equal((await worker.fetch(request(path), env)).status, 200);
    assert.equal(calls[1].client, null);
    assert.equal((await worker.fetch(request(path, { method: "POST", headers: { Origin: "https://foreign.test" } }), env)).status, 403);
    assert.equal((await worker.fetch(request(path.replace("mage-fire", "missing"), { method: "POST" }), env)).status, 400);
    assert.equal(calls.length, 2);
    env.CAST_BACKFILL.request = async () => ({ error: "rate_limited", http_status: 429 });
    assert.equal((await worker.fetch(request(path, { method: "POST" }), env)).status, 429);
});
