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

test("公开静态元数据保留条件请求和一小时缓存", async () => {
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
    assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
});
