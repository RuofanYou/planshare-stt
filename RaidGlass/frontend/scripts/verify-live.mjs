import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = resolve(process.env.RAIDGLASS_BUILD_DIR || join(frontendRoot, "build"));
const expectedManifestPath = process.argv[3] || process.env.RAIDGLASS_EXPECTED_MANIFEST;
const baseURL = new URL(process.argv[2] || "https://zhaobanzi.pages.dev/log/");
if (!baseURL.pathname.endsWith("/")) baseURL.pathname += "/";
baseURL.search = "";
baseURL.hash = "";

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

async function fetchRequired(path, kind) {
    const url = new URL(path.replace(/^\/+/, ""), baseURL);
    url.searchParams.set("release_check", String(Date.now()));
    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: kind === "json" ? "application/json" : "text/html" },
    });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    if (kind === "json") {
        assert.match(response.headers.get("content-type") || "", /application\/json/i, `${path} is not JSON`);
        return response.json();
    }
    return response.text();
}

function validateManifest(manifest) {
    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.deployment_mode, "worker-assets-d1");
    assert.equal(manifest.worker_entry, "_worker.js");
    assert.equal(manifest.top_n, 10);
    assert.match(manifest.source_tree_hash, /^[a-f0-9]{64}$/);
    assert.match(manifest.build_id, /^[A-Za-z0-9._-]{1,128}$/);
    assert.match(manifest.release_id, /^[A-Za-z0-9._-]{1,128}$/);
    assert.match(manifest.matrix_id, /^[A-Za-z0-9._-]{1,128}$/);
    assert.ok(Number.isInteger(manifest.expected_count) && manifest.expected_count > 0);
    assert.ok(Number.isInteger(manifest.spec_expected) && manifest.spec_expected > 0);
    assert.ok(Number.isInteger(manifest.comp_expected) && manifest.comp_expected > 0);
    assert.equal(manifest.spec_expected + manifest.comp_expected, manifest.expected_count);
    assert.ok(!Number.isNaN(Date.parse(manifest.published_at)));
    assert.ok(Number.isInteger(manifest.static_file_count) && manifest.static_file_count > 0);
}

function validateRefresh(refresh) {
    assert.ok(refresh?.status === "fresh" || refresh?.status === "stale");
    assert.ok(!Number.isNaN(Date.parse(refresh.checked_at)));
    for (const value of [refresh.published_at, refresh.upstream_updated]) {
        assert.ok(value === null || !Number.isNaN(Date.parse(value)));
    }
    assert.ok(refresh.last_error_code === null || typeof refresh.last_error_code === "string");
}

function validateSpecRanking(payload, expected) {
    assert.equal(payload.boss_slug, expected.bossSlug);
    assert.equal(payload.spec_slug, expected.specSlug);
    assert.equal(payload.difficulty, expected.difficulty);
    assert.equal(payload.metric, expected.metric);
    assert.equal(payload.edge_top_n, 10);
    assert.ok(Number.isInteger(payload.source_report_count) && payload.source_report_count >= payload.reports.length);
    assert.equal(payload.reports.length, Math.min(10, payload.source_report_count));
    assert.ok(!Number.isNaN(Date.parse(payload.updated)));
    validateRefresh(payload.refresh);
}

function validateCompRanking(payload, bossSlug) {
    assert.equal(payload.boss_slug, bossSlug);
    assert.equal(payload.edge_top_n, 10);
    assert.ok(Array.isArray(payload.reports) && payload.reports.length <= 10);
    assert.ok(!Number.isNaN(Date.parse(payload.updated)));
    validateRefresh(payload.refresh);
}

const specCases = [
    ["/api/spec_ranking/deathknight-blood/entombed-sentinels?difficulty=heroic&metric=dps", {
        bossSlug: "entombed-sentinels", specSlug: "deathknight-blood", difficulty: "heroic", metric: "dps",
    }],
    ["/api/spec_ranking/mage-fire/nekzali-the-soulcoiler?difficulty=mythic&metric=bossdps", {
        bossSlug: "nekzali-the-soulcoiler", specSlug: "mage-fire", difficulty: "mythic", metric: "bossdps",
    }],
    ["/api/spec_ranking/priest-holy/ulatek?difficulty=mythic&metric=hps", {
        bossSlug: "ulatek", specSlug: "priest-holy", difficulty: "mythic", metric: "hps",
    }],
    ["/api/spec_ranking/warlock-demonology/the-twin-fangs?difficulty=mythic&metric=dps", {
        bossSlug: "the-twin-fangs", specSlug: "warlock-demonology", difficulty: "mythic", metric: "dps",
    }],
];
const [manifest, health, refreshState, home, specResponses, comp] = await Promise.all([
    fetchRequired("/snapshot-manifest.json", "json"),
    fetchRequired("/api/health", "json"),
    fetchRequired("/api/admin/refresh-state", "json"),
    fetchRequired("/", "html"),
    Promise.all(specCases.map(([path]) => fetchRequired(path, "json"))),
    fetchRequired("/api/comp_ranking/entombed-sentinels", "json"),
]);

validateManifest(manifest);
if (expectedManifestPath) {
    const expected = JSON.parse(await readFile(resolve(expectedManifestPath), "utf8"));
    assert.deepEqual(manifest, expected, "live deployment manifest mismatch");
}

assert.equal(health.ok, true);
assert.equal(health.mode, "worker-assets-d1");
assert.equal(health.matrix_id, manifest.matrix_id);
assert.equal(health.expected_count, manifest.expected_count);
assert.equal(health.available_count, manifest.expected_count);
assert.equal(refreshState.matrix_id, manifest.matrix_id);
assert.equal(refreshState.expected_count, manifest.expected_count);
assert.equal(refreshState.available_count, manifest.expected_count);
assert.equal(refreshState.spec_expected, manifest.spec_expected);
assert.equal(refreshState.spec_available, manifest.spec_expected);
assert.equal(refreshState.comp_expected, manifest.comp_expected);
assert.equal(refreshState.comp_available, manifest.comp_expected);
for (const key of ["release_id", "build_id", "source_tree_hash", "published_at"]) {
    assert.equal(health[key], manifest[key], `health mismatch: ${key}`);
    assert.equal(refreshState[key], manifest[key], `refresh-state mismatch: ${key}`);
}
assert.match(home, /<html lang="zh-CN"/);
specResponses.forEach((payload, index) => validateSpecRanking(payload, specCases[index][1]));
validateCompRanking(comp, "entombed-sentinels");

const entryPaths = Array.from(home.matchAll(/(?:src|href)="(\/log\/assets\/[^\"]+)"/g), (match) => match[1]);
assert.ok(entryPaths.length >= 2, "live index has no hashed entries");
for (const entryPath of entryPaths) {
    const entryUrl = new URL(entryPath, baseURL);
    const response = await fetch(entryUrl, { cache: "no-store" });
    assert.equal(response.status, 200, `live asset failed: ${entryPath}`);
    assert.equal((response.headers.get("content-type") || "").includes("text/html"), false, `asset returned HTML: ${entryPath}`);
    const remote = Buffer.from(await response.arrayBuffer());
    const local = await readFile(join(buildRoot, entryPath.replace(/^\/log\//, "")));
    assert.equal(sha256(remote), sha256(local), `live asset hash mismatch: ${entryPath}`);
    const etag = response.headers.get("etag");
    assert.ok(etag, `live asset has no etag: ${entryPath}`);
    assert.equal((await fetch(entryUrl, { headers: { "If-None-Match": etag } })).status, 304);
}

const e2e = spawnSync("npx", ["playwright", "test"], {
    cwd: frontendRoot,
    env: {
        ...process.env,
        RAIDGLASS_E2E_BASE_URL: baseURL.href,
        RAIDGLASS_SCREENSHOT_ROOT: process.env.RAIDGLASS_SCREENSHOT_ROOT
            || `/tmp/raidglass-live-${manifest.release_id}/screens`,
        RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT: process.env.RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT
            || `/tmp/raidglass-live-${manifest.release_id}/playwright`,
    },
    encoding: "utf8",
    stdio: "inherit",
});
assert.equal(e2e.status, 0, `live browser verification failed status=${e2e.status}`);

console.info(JSON.stringify({
    status: "ok",
    base_url: baseURL.href,
    release_id: manifest.release_id,
    build_id: manifest.build_id,
    source_tree_hash: manifest.source_tree_hash,
    freshness: health.freshness,
    expected_count: health.expected_count,
    available_count: health.available_count,
    verified_asset_count: entryPaths.length,
}));
