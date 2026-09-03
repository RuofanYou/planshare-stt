import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseSourceHash } from "./release-source-hash.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const productConfig = JSON.parse(await readFile(join(frontendRoot, "config", "product.json"), "utf8"));

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const REQUIRED_API_FILES = [
    "season_current.json",
    "bosses.json",
    "classes.json",
    "roles.json",
    "specs.json",
    "zones.json",
];
const STATIC_API_DIRECTORIES = ["boss_spells", "current_season", "spec_spells"];
const OPTIONAL_NON_COMBAT_ASSETS = new Set([
    "assets/images/classes/other.webp",
    "assets/images/roles/item.jpg",
    "assets/images/roles/util.jpg",
]);

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function requirePath(root, relativePath) {
    const path = join(root, relativePath);
    if (!(await exists(path))) throw new Error(`missing required deployment asset: ${relativePath}`);
    return path;
}

async function listFiles(root) {
    const files = [];
    async function walk(current) {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const child = join(current, entry.name);
            if (entry.isDirectory()) await walk(child);
            else if (entry.isFile()) files.push(child);
        }
    }
    if (await exists(root)) await walk(root);
    return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

async function assertFileSize(path, relativePath) {
    const fileStat = await stat(path);
    if (!fileStat.isFile() || fileStat.size > MAX_FILE_BYTES) {
        throw new Error(`deployment asset is invalid: ${relativePath}`);
    }
}

function containsErrorPayload(payload) {
    return Boolean(payload && typeof payload === "object" && (payload.error || payload.errors || payload.detail));
}

async function copyJson(sourceRoot, outputRoot, relativePath) {
    const sourcePath = await requirePath(sourceRoot, relativePath);
    await assertFileSize(sourcePath, relativePath);
    let payload;
    try {
        payload = JSON.parse(await readFile(sourcePath, "utf8"));
    } catch (error) {
        throw new Error(`invalid deployment JSON: ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (containsErrorPayload(payload)) throw new Error(`error payload is not deployable: ${relativePath}`);
    const targetPath = join(outputRoot, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
    return payload;
}

async function copyJsonDirectory(sourceRoot, outputRoot, relativeRoot) {
    const directory = await requirePath(sourceRoot, relativeRoot);
    const files = (await listFiles(directory))
        .map((path) => join(relativeRoot, relative(directory, path)).replaceAll("\\", "/"))
        .filter((path) => path.endsWith(".json"));
    for (const relativePath of files) await copyJson(sourceRoot, outputRoot, relativePath);
}

function validImage(buffer) {
    const jpeg = buffer.length >= 3
        && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const png = buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const header = buffer.subarray(0, 6).toString("ascii");
    const gif = header === "GIF87a" || header === "GIF89a";
    const webp = buffer.length >= 12
        && buffer.subarray(0, 4).toString("ascii") === "RIFF"
        && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    return jpeg || png || gif || webp;
}

async function copyImages(sourceRoot, outputRoot) {
    const relativeRoot = "assets/images";
    const directory = await requirePath(sourceRoot, relativeRoot);
    for (const sourcePath of await listFiles(directory)) {
        const relativePath = join(relativeRoot, relative(directory, sourcePath)).replaceAll("\\", "/");
        await assertFileSize(sourcePath, relativePath);
        const buffer = await readFile(sourcePath);
        if (!validImage(buffer)) {
            if (OPTIONAL_NON_COMBAT_ASSETS.has(relativePath)) continue;
            throw new Error(`invalid deployment image: ${relativePath}`);
        }
        const targetPath = join(outputRoot, relativePath);
        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
    }
}

async function writeCurrentSeasonZones(sourceRoot, outputRoot, season) {
    if (!Array.isArray(season?.raids) || season.raids.length === 0) {
        throw new Error("current season has no raids");
    }
    const zones = [];
    for (const zoneId of season.raids) {
        zones.push(JSON.parse(await readFile(
            await requirePath(sourceRoot, `api/current_season/zones/${zoneId}.json`),
            "utf8",
        )));
    }
    const path = join(outputRoot, "api/current_season/zones.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(zones, null, 2)}\n`);
    return zones;
}

async function assertCurrentBossImages(outputRoot, zones) {
    for (const boss of zones.flatMap((zone) => zone?.bosses || [])) {
        const icon = boss?.icon;
        if (typeof icon !== "string" || basename(icon) !== icon || !/^[A-Za-z0-9._-]+$/.test(icon)) {
            throw new Error(`invalid current boss image: ${String(icon)}`);
        }
        await requirePath(outputRoot, `assets/images/spells/${icon}`);
    }
}

function requireIdentifier(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
        throw new Error(`${label} is invalid`);
    }
    return value;
}

function requireTimestampOrNull(value, label) {
    if (value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) {
        throw new Error(`${label} is invalid`);
    }
    return value;
}

export async function stableTreeHash(root, predicate = () => true) {
    const hash = createHash("sha256");
    for (const path of (await listFiles(root)).filter((item) => predicate(relative(root, item)))) {
        const relativePath = relative(root, path).replaceAll("\\", "/");
        hash.update(relativePath);
        hash.update("\0");
        hash.update(await readFile(path));
        hash.update("\0");
    }
    return hash.digest("hex");
}

export async function prepareDeploymentAssets({
    sourceRoot,
    outputRoot,
    buildId,
    releaseId,
    publishedAt,
}) {
    const source = resolve(sourceRoot);
    const output = resolve(outputRoot);
    requireIdentifier(buildId, "build id");
    requireIdentifier(releaseId, "release id");
    requireTimestampOrNull(publishedAt, "published at");
    await requirePath(output, "_worker.js");
    if (await exists(join(output, "api/rankings"))) {
        throw new Error("dynamic rankings must not exist in Pages assets");
    }

    await mkdir(join(output, "api"), { recursive: true });
    let season;
    for (const file of REQUIRED_API_FILES) {
        const payload = await copyJson(source, output, `api/${file}`);
        if (file === "season_current.json") season = payload;
    }
    for (const directory of STATIC_API_DIRECTORIES) {
        await copyJsonDirectory(source, output, `api/${directory}`);
    }
    const currentZones = await writeCurrentSeasonZones(source, output, season);
    await copyImages(source, output);
    await assertCurrentBossImages(output, currentZones);

    const sourceTreeHash = await releaseSourceHash({
        frontendRoot,
        deploymentRoot: output,
    });
    const staticFileCount = (await listFiles(output)).length + 1;
    const manifest = {
        schema_version: productConfig.deploymentManifestSchemaVersion,
        deployment_mode: "worker-assets-d1",
        worker_entry: "_worker.js",
        top_n: productConfig.rankingTopN,
        source_tree_hash: sourceTreeHash,
        build_id: buildId,
        release_id: releaseId,
        published_at: publishedAt,
        static_file_count: staticFileCount,
    };
    await writeFile(join(output, "snapshot-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}
