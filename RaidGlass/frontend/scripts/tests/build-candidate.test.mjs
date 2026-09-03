import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runBuildCandidate } from "../build-candidate.mjs";

test("候选构建只写 cache 发布区并输出可追溯回执", async () => {
    const cacheRoot = await mkdtemp(join(homedir(), ".Trash", "raidglass-candidate-test-"));
    const calls = [];
    const lines = [];
    const candidate = {
        releaseRoot: join(cacheRoot, "site-publish", "releases", "release-test"),
        publicDir: join(cacheRoot, "site-publish", "releases", "release-test", "public"),
        buildDir: join(cacheRoot, "site-publish", "releases", "release-test", "build"),
        manifestPath: join(cacheRoot, "site-publish", "releases", "release-test", "public", "snapshot-manifest.json"),
    };

    const receipt = await runBuildCandidate({
        env: { RAIDGLASS_CACHE_ROOT: cacheRoot },
        prepareCandidate: async (options) => {
            calls.push(["prepare", options]);
            await mkdir(candidate.publicDir, { recursive: true });
            await writeFile(candidate.manifestPath, JSON.stringify({
                release_id: "release-test",
                build_id: "build-test",
            }));
            return candidate;
        },
        buildCandidate: async (options) => calls.push(["build", options]),
        writeLine: (line) => lines.push(line),
    });

    assert.equal(calls[0][0], "prepare");
    assert.equal(calls[0][1].releaseParent, join(cacheRoot, "site-publish", "releases"));
    assert.equal(calls[1][0], "build");
    assert.equal(receipt.status, "built");
    assert.equal(receipt.release_id, "release-test");
    assert.equal(receipt.cache_relative_root, "site-publish/releases/release-test");
    assert.equal(JSON.stringify(receipt).includes(cacheRoot), false);
    assert.deepEqual(JSON.parse(lines[0]), receipt);
});
