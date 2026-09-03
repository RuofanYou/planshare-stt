import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareDeploymentAssets } from "./lib/deployment-assets.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.RAIDGLASS_STATIC_ASSET_SOURCE;

if (!sourceRoot) {
    throw new Error("RAIDGLASS_STATIC_ASSET_SOURCE is required");
}

const buildId = process.env.RAIDGLASS_BUILD_ID || randomUUID();
const releaseId = process.env.RAIDGLASS_RELEASE_ID || randomUUID();
const publishedAt = process.env.RAIDGLASS_PUBLISHED_AT || null;
const outputRoot = process.env.RAIDGLASS_STATIC_ASSET_OUTPUT || resolve(frontendRoot, "public");

const manifest = await prepareDeploymentAssets({
    sourceRoot: resolve(sourceRoot),
    outputRoot: resolve(outputRoot),
    buildId,
    releaseId,
    publishedAt,
});

console.info("[DeploymentAssets] prepared", {
    build_id: manifest.build_id,
    release_id: manifest.release_id,
    published_at: manifest.published_at,
    static_file_count: manifest.static_file_count,
});
