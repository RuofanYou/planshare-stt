import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { prepareDeploymentAssets } from "../lib/deployment-assets.mjs";

async function write(root, relativePath, value) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
}

async function writeJson(root, relativePath, value) {
    await write(root, relativePath, `${JSON.stringify(value)}\n`);
}

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function fixture({ includeBossImage = true } = {}) {
    const root = await mkdtemp(join(homedir(), ".Trash", "raidglass-deployment-assets-test-"));
    const sourceRoot = join(root, "source");
    for (const file of ["bosses", "classes", "zones"]) {
        await writeJson(sourceRoot, `api/${file}.json`, { [file]: [] });
    }
    await writeJson(sourceRoot, "api/roles.json", {
        roles: [
            { code: "mdps", metrics: ["dps", "bossdps"] },
            { code: "rdps", metrics: ["dps", "bossdps"] },
            { code: "heal", metrics: ["dps", "hps", "bossdps"] },
            { code: "tank", metrics: ["dps", "hps", "bossdps"] },
        ],
    });
    await writeJson(sourceRoot, "api/specs.json", {
        specs: [{ full_name_slug: "mage-fire", role: "mdps" }],
    });
    await writeJson(sourceRoot, "api/spellbook.json", {
        schema_version: 1, specs: { "mage-fire": { 153561: { name: "流星" } } },
    });
    await writeJson(sourceRoot, "api/season_current.json", { slug: "fixture-season", raids: [46.1] });
    await writeJson(sourceRoot, "api/current_season/zones/46.1.json", {
        id: 46.1,
        bosses: [{ full_name_slug: "imperator-averzian", icon: "imperator.jpg" }],
    });
    await writeJson(sourceRoot, "api/current_season/zone_bosses/46.1.json", []);
    await writeJson(sourceRoot, "api/boss_spells/imperator-averzian.json", {});
    await writeJson(sourceRoot, "api/spec_spells/mage-fire.json", {});
    await write(sourceRoot, "assets/images/specs/mage-fire.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    if (includeBossImage) {
        await write(sourceRoot, "assets/images/spells/imperator.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    }
    return { root, sourceRoot };
}

async function output(root, name) {
    const outputRoot = join(root, name);
    await write(outputRoot, "_worker.js", "export default {};\n");
    return outputRoot;
}

test("部署资产只复制静态元数据并生成 manifest v2", async () => {
    const { root, sourceRoot } = await fixture();
    const outputRoot = await output(root, "public-a");
    const manifest = await prepareDeploymentAssets({
        sourceRoot,
        outputRoot,
        buildId: "build-a",
        releaseId: "release-a",
        publishedAt: "2026-08-09T12:00:00.000Z",
    });

    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.deployment_mode, "worker-assets-d1");
    assert.equal(manifest.matrix_id, "fixture-season-5-v1");
    assert.equal(manifest.expected_count, 5);
    assert.equal(manifest.spec_expected, 4);
    assert.equal(manifest.comp_expected, 1);
    assert.match(manifest.source_tree_hash, /^[a-f0-9]{64}$/);
    assert.equal(await exists(join(outputRoot, "api/rankings")), false);
    assert.equal(await exists(join(outputRoot, "api/current_season/zones.json")), true);
    assert.equal(await exists(join(outputRoot, "api/spellbook.json")), true);
    assert.equal(await exists(join(outputRoot, "assets/images/specs/mage-fire.jpg")), true);
    assert.deepEqual(
        JSON.parse(await readFile(join(outputRoot, "api/current_season/zones.json"), "utf8")),
        [{ id: 46.1, bosses: [{ full_name_slug: "imperator-averzian", icon: "imperator.jpg" }] }],
    );
});

test("当前赛季首领图缺失时阻断候选", async () => {
    const { root, sourceRoot } = await fixture({ includeBossImage: false });
    const outputRoot = await output(root, "public-a");

    await assert.rejects(
        prepareDeploymentAssets({
            sourceRoot,
            outputRoot,
            buildId: "build-a",
            releaseId: "release-a",
            publishedAt: "2026-08-09T12:00:00.000Z",
        }),
        /missing required deployment asset: assets\/images\/spells\/imperator\.jpg/,
    );
});

test("构建与发布时间不进入 source_tree_hash，静态内容变化会进入", async () => {
    const { root, sourceRoot } = await fixture();
    const outputA = await output(root, "public-a");
    const outputB = await output(root, "public-b");
    const first = await prepareDeploymentAssets({
        sourceRoot,
        outputRoot: outputA,
        buildId: "build-a",
        releaseId: "release-a",
        publishedAt: "2026-08-09T12:00:00.000Z",
    });
    const second = await prepareDeploymentAssets({
        sourceRoot,
        outputRoot: outputB,
        buildId: "build-b",
        releaseId: "release-b",
        publishedAt: "2026-08-10T12:00:00.000Z",
    });
    assert.equal(first.source_tree_hash, second.source_tree_hash);

    await writeJson(sourceRoot, "api/specs.json", { specs: [{ full_name_slug: "mage-fire" }] });
    const outputC = await output(root, "public-c");
    const changed = await prepareDeploymentAssets({
        sourceRoot,
        outputRoot: outputC,
        buildId: "build-c",
        releaseId: "release-c",
        publishedAt: "2026-08-10T12:00:00.000Z",
    });
    assert.notEqual(changed.source_tree_hash, first.source_tree_hash);
});

test("Pages 输出中出现动态排行会阻断构建", async () => {
    const { root, sourceRoot } = await fixture();
    const outputRoot = await output(root, "public-a");
    await writeJson(outputRoot, "api/rankings/spec/forbidden.json", {});

    await assert.rejects(
        prepareDeploymentAssets({
            sourceRoot,
            outputRoot,
            buildId: "build-a",
            releaseId: "release-a",
            publishedAt: "2026-08-09T12:00:00.000Z",
        }),
        /dynamic rankings must not exist/,
    );
});
