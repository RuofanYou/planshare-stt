#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    buildReleaseCandidate,
    prepareReleaseCandidate,
} from "./lib/release-candidate.mjs";

const frontendRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultStaticAssetRoot = resolve(frontendRoot, "..", "reference");

export async function runBuildCandidate({
    env = process.env,
    prepareCandidate = prepareReleaseCandidate,
    buildCandidate = buildReleaseCandidate,
    writeLine = (line) => process.stdout.write(`${line}\n`),
} = {}) {
    if (!env.RAIDGLASS_CACHE_ROOT) throw new Error("RAIDGLASS_CACHE_ROOT is required");
    const releaseParent = resolve(env.RAIDGLASS_CACHE_ROOT, "site-publish", "releases");
    const staticAssetRoot = resolve(env.RAIDGLASS_STATIC_ASSET_ROOT || defaultStaticAssetRoot);
    const candidate = await prepareCandidate({
        staticAssetRoot,
        frontendRoot,
        releaseParent,
    });
    await buildCandidate({ candidate, frontendRoot });
    const manifest = JSON.parse(await readFile(candidate.manifestPath, "utf8"));
    const receipt = {
        schema_version: 2,
        status: "built",
        release_id: manifest.release_id,
        build_id: manifest.build_id,
        cache_relative_root: `site-publish/releases/${manifest.release_id}`,
    };
    writeLine(JSON.stringify(receipt));
    return receipt;
}

const isDirectExecution = process.argv[1]
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    runBuildCandidate().catch((error) => {
        process.stderr.write(`${JSON.stringify({
            schema_version: 2,
            status: "failed",
            stage: "candidate_build",
            reason: error instanceof Error ? error.message : String(error),
        })}\n`);
        process.exitCode = 1;
    });
}
