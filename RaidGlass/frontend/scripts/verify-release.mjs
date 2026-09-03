import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stableTreeHash } from "./lib/deployment-assets.mjs";
import { buildRankingMatrix } from "./lib/ranking-matrix.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(process.env.RAIDGLASS_PUBLIC_DIR || join(frontendRoot, "public"));
const buildRoot = resolve(process.env.RAIDGLASS_BUILD_DIR || join(frontendRoot, "build"));

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function listFiles(root) {
    const files = [];
    async function walk(path) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
            const child = join(path, entry.name);
            if (entry.isDirectory()) await walk(child);
            else if (entry.isFile()) files.push(child);
        }
    }
    await walk(root);
    return files.sort();
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
    for (const obsolete of [
        "ranking_data_hash",
        "ranking_expected_count",
        "ranking_valid_count",
        "snapshot_created_at",
        "data_as_of",
    ]) {
        assert.equal(Object.hasOwn(manifest, obsolete), false, `obsolete manifest field: ${obsolete}`);
    }
}

const publicManifest = await readJson(join(publicRoot, "snapshot-manifest.json"));
const buildManifest = await readJson(join(buildRoot, "snapshot-manifest.json"));
validateManifest(publicManifest);
assert.deepEqual(buildManifest, publicManifest, "build manifest differs from public manifest");

for (const root of [publicRoot, buildRoot]) {
    assert.equal(await exists(join(root, "api", "rankings")), false, "Pages artifact contains dynamic rankings");
    for (const relativePath of [
        "api/season_current.json",
        "api/current_season/zones.json",
        "api/roles.json",
        "api/specs.json",
        "_worker.js",
    ]) {
        assert.equal(await exists(join(root, relativePath)), true, `missing static deployment asset: ${relativePath}`);
    }
}

const matrix = await buildRankingMatrix(buildRoot);
assert.equal(matrix.length, publicManifest.spec_expected, "static metadata matrix count mismatch");

const indexHtml = await readFile(join(buildRoot, "index.html"), "utf8");
const entryPaths = Array.from(indexHtml.matchAll(/(?:src|href)="(\/log\/assets\/[^\"]+)"/g), (match) => match[1]);
assert.ok(entryPaths.length >= 2, "build index has no hashed entries");
for (const entryPath of entryPaths) {
    assert.ok((await stat(join(buildRoot, entryPath.replace(/^\/log\//, "")))).isFile(), `missing build entry: ${entryPath}`);
}

const buildFiles = await listFiles(buildRoot);
const bundledText = (
    await Promise.all(
        buildFiles
            .filter((path) => [".html", ".js", ".css"].some((suffix) => path.endsWith(suffix)))
            .map((path) => readFile(path, "utf8")),
    )
).join("\n");
for (const value of [publicManifest.build_id, publicManifest.release_id, publicManifest.source_tree_hash]) {
    assert.ok(bundledText.includes(value), `build identity missing: ${value}`);
}
for (const forbidden of [
    ["", "Users", ""].join("/"),
    [".config", "superpowers", "worktrees"].join("/"),
]) {
    assert.equal(bundledText.includes(forbidden), false, `build leaks local path: ${forbidden}`);
}

console.info(JSON.stringify({
    status: "ok",
    release_id: publicManifest.release_id,
    build_id: publicManifest.build_id,
    source_tree_hash: publicManifest.source_tree_hash,
    matrix_id: publicManifest.matrix_id,
    expected_count: publicManifest.expected_count,
    spec_expected: matrix.length,
    comp_expected: publicManifest.comp_expected,
    artifact_hash: await stableTreeHash(buildRoot),
}));
