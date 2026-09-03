import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
    access,
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    rename,
    writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";

import {
    GENERATED_FILTERABLE_SPELL_ID,
    GENERATED_PRIMARY_SPELL_BY_BOSS,
    GENERATED_PRIMARY_SPELL_BY_SPEC,
    GENERATED_TEST_TARGET_COUNT,
    generatedRankingTargets,
    prepareGeneratedTestSurface,
    resolveE2EMode,
} from "../lib/generated-test-surface.mjs";
import { prepareGeneratedBuildForE2E, runE2E } from "../run-e2e.mjs";
import { openLocalD1 } from "../../../testing/local-d1.mjs";

async function readJson(root, relativePath) {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

async function readTarget(database, targetKey) {
    const row = await database.prepare(
        "SELECT * FROM ranking_targets WHERE target_key = ?",
    ).bind(targetKey).first();
    assert.ok(row, targetKey);
    return { row, ranking: row.ranking_json ? JSON.parse(row.ranking_json) : null };
}

async function moveToTrash(root, label) {
    const trashRoot = join(homedir(), ".Trash");
    await mkdir(trashRoot, { recursive: true });
    const evidenceRoot = join(trashRoot, `raidglass-e2e-${label}-${randomUUID()}`);
    try {
        await rename(root, evidenceRoot);
    } catch (error) {
        if (error?.code !== "ENOENT") throw error;
    }
    return evidenceRoot;
}

function countsBy(players, key) {
    return countsByValues(players.map((player) => player[key]));
}

function countsByValues(values) {
    return Object.fromEntries(
        [...values.reduce((counts, value) => {
            counts.set(value, (counts.get(value) ?? 0) + 1);
            return counts;
        }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)),
    );
}

async function assertMovedReceipt({ lines, mode, ownedRoot, result, status }) {
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), result.receipt);
    assert.equal(result.receipt.mode, mode);
    assert.equal(result.receipt.status, status);
    const evidenceName = relative(join(homedir(), ".Trash"), result.receipt.evidence_root);
    assert.match(evidenceName, /^raidglass-e2e-[^/]+$/);
    assert.equal(result.receipt.screenshot_root, join(result.receipt.evidence_root, "screens"));
    assert.equal(
        result.receipt.playwright_output_root,
        join(result.receipt.evidence_root, "playwright"),
    );
    assert.equal((await lstat(result.receipt.evidence_root)).isDirectory(), true);
    await assert.rejects(() => lstat(ownedRoot), { code: "ENOENT" });
}

test("生成表面提供 20 目标、可筛选战斗、完整图片与空阵容过滤", async (t) => {
    const workRoot = await mkdtemp(join(homedir(), ".raidglass-f1-surface-"));
    t.after(() => moveToTrash(workRoot, "surface-test"));

    const { sourceRoot, publicRoot, buildRoot, d1Path, manifest } = await prepareGeneratedTestSurface(workRoot);
    const database = openLocalD1(d1Path);
    t.after(() => database.close());
    assert.equal(dirname(sourceRoot), workRoot);
    assert.equal(dirname(publicRoot), workRoot);
    assert.equal(dirname(buildRoot), workRoot);
    assert.equal(dirname(d1Path), workRoot);
    assert.equal((await lstat(buildRoot)).isDirectory(), true);

    const matrix = generatedRankingTargets();
    assert.equal(GENERATED_TEST_TARGET_COUNT, 20);
    assert.equal(matrix.length, GENERATED_TEST_TARGET_COUNT);
    assert.equal(matrix.filter(({ difficulty }) => difficulty === "heroic").length, 10);
    assert.equal(matrix.filter(({ difficulty }) => difficulty === "mythic").length, 10);
    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.deployment_mode, "worker-assets-d1");

    for (const target of matrix) {
        const targetKey = `spec/${target.bossSlug}/${target.specSlug}/${target.difficulty}/${target.metric}`;
        const { row, ranking: payload } = await readTarget(database, targetKey);
        assert.equal(row.refresh_status, "fresh");
        assert.equal(payload.boss_slug, target.bossSlug);
        assert.equal(payload.spec_slug, target.specSlug);
        assert.equal(payload.difficulty, target.difficulty);
        assert.equal(payload.metric, target.metric);
        assert.equal(payload.edge_top_n, 10);
        assert.equal(payload.source_report_count, 10);
        assert.equal(Number.isNaN(Date.parse(payload.updated)), false);
        assert.equal(payload.reports.length, 10);
        for (const report of payload.reports) {
            assert.equal(typeof report.report_id, "string");
            assert.ok(report.report_id.length > 0);
            assert.equal(Number.isNaN(Date.parse(report.start_time)), false);
            assert.equal(report.fights.length, 1);
            assert.equal(report.fights[0].duration, 600_000);
            const fight = report.fights[0];
            const casts = [fight.boss, ...fight.players].flatMap((actor) => actor.casts);
            assert.ok(casts.some(({ id }) => (
                id === GENERATED_PRIMARY_SPELL_BY_BOSS[target.bossSlug]
                || id === GENERATED_PRIMARY_SPELL_BY_SPEC[target.specSlug]
            )));
        }
    }

    for (const relativePath of [
        "api/classes.json",
        "api/current_season/zones/1.json",
    ]) {
        await access(join(sourceRoot, relativePath));
    }
    for (const relativePath of [
        "api/classes.json",
        "api/current_season/zones/1.json",
    ]) {
        await access(join(publicRoot, relativePath));
    }
    await assert.rejects(access(join(publicRoot, "api/rankings")), /ENOENT/);

    const specs = await readJson(sourceRoot, "api/specs.json");
    const specRoleBySlug = Object.fromEntries(
        specs.specs.map(({ full_name_slug: specSlug, role }) => [specSlug, role]),
    );
    const { row: compRow, ranking: comp } = await readTarget(database, "comp/vorasius");
    assert.equal(comp.boss_slug, "vorasius");
    assert.equal(comp.edge_top_n, 10);
    assert.equal(comp.source_report_count, 10);
    assert.equal(Number.isNaN(Date.parse(comp.updated)), false);
    assert.equal(comp.reports.length, 10);
    for (const report of comp.reports) {
        assert.ok(report.report_id.length > 0);
        assert.equal(Number.isNaN(Date.parse(report.start_time)), false);
        assert.ok(Array.isArray(report.fights));
        assert.ok(report.fights.length > 0);
        for (const fight of report.fights) {
            assert.equal(Number.isInteger(fight.fight_id), true);
            assert.equal(fight.duration, 600_000);
            assert.equal(Number.isFinite(fight.damage_taken), true);
            assert.equal(Number.isInteger(fight.deaths), true);
            assert.equal(Number.isNaN(Date.parse(fight.start_time)), false);
            assert.equal(fight.boss.boss_slug, "vorasius");
            assert.ok(Array.isArray(fight.boss.casts));
            assert.deepEqual(Object.keys(fight.boss).sort(), ["boss_slug", "casts"]);
            assert.ok(fight.players.length >= 3);
            const playerRoles = fight.players.map(({ spec_slug: specSlug }) => specRoleBySlug[specSlug]);
            assert.equal(playerRoles.filter((role) => role === "tank").length, 2);
            assert.ok(playerRoles.includes("rdps"));
            assert.deepEqual(fight.composition.roles, countsByValues(playerRoles));
            assert.deepEqual(fight.composition.specs, countsBy(fight.players, "spec_slug"));
            assert.deepEqual(fight.composition.classes, countsBy(fight.players, "class_slug"));

            for (const player of fight.players) {
                assert.deepEqual(Object.keys(player).sort(), [
                    "casts",
                    "class_slug",
                    "deaths",
                    "name",
                    "source_id",
                    "spec_slug",
                    "total",
                ]);
                assert.equal(Number.isInteger(player.source_id), true);
                assert.ok(player.name.length > 0);
                assert.ok(player.class_slug.length > 0);
                assert.ok(player.spec_slug.length > 0);
                assert.equal(Number.isFinite(player.total), true);
                assert.ok(Array.isArray(player.deaths));
                assert.ok(player.casts.some(({ id }) => (
                    id === GENERATED_PRIMARY_SPELL_BY_SPEC[player.spec_slug]
                )));
            }

            const filterablePlayer = fight.players.find((player) => (
                player.casts.some(({ id }) => id === GENERATED_FILTERABLE_SPELL_ID)
            ));
            assert.ok(filterablePlayer);
            const spellDisplay = { [GENERATED_FILTERABLE_SPELL_ID]: false };
            const visibleCasts = filterablePlayer.casts.filter(({ id }) => spellDisplay[id] !== false);
            assert.ok(visibleCasts.some(({ id }) => (
                id === GENERATED_PRIMARY_SPELL_BY_SPEC[filterablePlayer.spec_slug]
            )));
            assert.equal(visibleCasts.some(({ id }) => id === GENERATED_FILTERABLE_SPELL_ID), false);
        }
    }

    assert.equal(compRow.target_key, "comp/vorasius");
    assert.equal(compRow.refresh_status, "fresh");
    assert.equal((await lstat(join(publicRoot, "api"))).isSymbolicLink(), false);

    const classes = await readJson(sourceRoot, "api/classes.json");
    const roles = await readJson(sourceRoot, "api/roles.json");
    const zone = await readJson(sourceRoot, "api/current_season/zones/1.json");
    assert.deepEqual(roles.roles.map(({ code }) => code).sort(), ["heal", "mdps", "rdps", "tank"]);

    const imagePaths = new Set([
        ...Object.values(classes).map(({ name_slug }) => `assets/images/classes/${name_slug}.webp`),
        ...roles.roles.map(({ code }) => `assets/images/roles/${code}.jpg`),
        ...specs.specs.map(({ full_name_slug }) => `assets/images/specs/${full_name_slug}.jpg`),
        ...zone.bosses.map(({ icon }) => `assets/images/spells/${icon}`),
    ]);
    for (const metadataPath of [
        ...zone.bosses.map(({ full_name_slug }) => `api/boss_spells/${full_name_slug}.json`),
        ...specs.specs.map(({ full_name_slug }) => `api/spec_spells/${full_name_slug}.json`),
    ]) {
        const spells = await readJson(sourceRoot, metadataPath);
        const slug = metadataPath.split("/").at(-1).replace(".json", "");
        const primarySpellId = GENERATED_PRIMARY_SPELL_BY_BOSS[slug]
            ?? GENERATED_PRIMARY_SPELL_BY_SPEC[slug];
        assert.equal(spells[primarySpellId].show, true);
        for (const spell of Object.values(spells)) {
            imagePaths.add(`assets/images/spells/${spell.icon}`);
        }
    }
    assert.ok(imagePaths.has("assets/images/roles/rdps.jpg"));
    assert.ok(imagePaths.has("assets/images/roles/tank.jpg"));
    for (const relativePath of imagePaths) {
        await access(join(sourceRoot, relativePath));
        await access(join(publicRoot, relativePath));
    }
});

test("E2E 模式对成对产物变量执行唯一选择", () => {
    assert.equal(resolveE2EMode({}), "generated");
    assert.equal(resolveE2EMode({
        RAIDGLASS_PUBLIC_DIR: "/artifact/public",
        RAIDGLASS_BUILD_DIR: "/artifact/build",
    }), "artifact");
    assert.throws(
        () => resolveE2EMode({ RAIDGLASS_PUBLIC_DIR: "/artifact/public" }),
        /RAIDGLASS_PUBLIC_DIR.*RAIDGLASS_BUILD_DIR/,
    );
    assert.throws(
        () => resolveE2EMode({ RAIDGLASS_BUILD_DIR: "/artifact/build" }),
        /RAIDGLASS_PUBLIC_DIR.*RAIDGLASS_BUILD_DIR/,
    );
});

test("生成式构建精确移除固定外部脚本请求", async (t) => {
    const workRoot = await mkdtemp(join(homedir(), ".raidglass-f1-offline-build-"));
    t.after(() => moveToTrash(workRoot, "offline-build"));
    const buildRoot = join(workRoot, "build");
    await mkdir(buildRoot, { recursive: true });
    await writeFile(join(buildRoot, "index.html"), [
        "<script>const whTooltips = {};</script>",
        "<script async src=\"https://wow.zamimg.com/js/tooltips.js\"></script>",
        "<script type=\"module\" src=\"/assets/app.js\"></script>",
    ].join("\n"));

    await prepareGeneratedBuildForE2E(buildRoot);
    const html = await readFile(join(buildRoot, "index.html"), "utf8");
    assert.equal(html.includes("https://wow.zamimg.com/js/tooltips.js"), false);
    assert.equal(html.includes("const whTooltips = {}"), true);
    assert.equal(html.includes("/assets/app.js"), true);
});

test("E2E 运行器隔离两种模式的输出并将失败证据移入废纸篓", async (t) => {
    const artifactRoot = await mkdtemp(join(homedir(), ".raidglass-f1-artifact-"));
    t.after(() => moveToTrash(artifactRoot, "artifact-input"));
    const artifactPublic = join(artifactRoot, "public");
    const artifactBuild = join(artifactRoot, "build");
    await mkdir(artifactPublic, { recursive: true });
    await mkdir(artifactBuild, { recursive: true });

    const artifactCalls = [];
    const artifactLines = [];
    let artifactOwnedRoot;
    const artifactResult = await runE2E({
        args: ["--grep", "artifact-case"],
        env: {
            RAIDGLASS_PUBLIC_DIR: artifactPublic,
            RAIDGLASS_BUILD_DIR: artifactBuild,
            RAIDGLASS_SCREENSHOT_ROOT: "/caller/screens",
            RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT: "/caller/playwright",
        },
        runCommand: async (request) => {
            artifactCalls.push(request);
            return { status: 0 };
        },
        createWorkRoot: async () => {
            artifactOwnedRoot = await mkdtemp(join(homedir(), ".raidglass-f1-runner-artifact-"));
            return artifactOwnedRoot;
        },
        writeLine: (line) => artifactLines.push(line),
    });

    assert.equal(artifactResult.exitCode, 0);
    assert.equal(artifactCalls.length, 1);
    assert.deepEqual(artifactCalls[0].args, [
        "run",
        "test:e2e:direct",
        "--",
        "--grep",
        "artifact-case",
        "--workers=1",
    ]);
    assert.equal(artifactCalls[0].env.RAIDGLASS_PUBLIC_DIR, artifactPublic);
    assert.equal(artifactCalls[0].env.RAIDGLASS_BUILD_DIR, artifactBuild);
    const artifactWorkRoot = dirname(artifactCalls[0].env.RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT);
    assert.equal(artifactWorkRoot, artifactOwnedRoot);
    assert.equal(artifactCalls[0].env.RAIDGLASS_SCREENSHOT_ROOT, join(artifactWorkRoot, "screens"));
    await assertMovedReceipt({
        lines: artifactLines,
        mode: "artifact",
        ownedRoot: artifactOwnedRoot,
        result: artifactResult,
        status: "passed",
    });

    const generatedCalls = [];
    const generatedLines = [];
    const preparedBuildRoots = [];
    let generatedOwnedRoot;
    const generatedResult = await runE2E({
        args: ["--grep", "generated-case"],
        env: {},
        prepareGeneratedTestSurfaceImpl: async (workRoot) => {
            const sourceRoot = join(workRoot, "source");
            const publicRoot = join(workRoot, "public");
            const buildRoot = join(workRoot, "build");
            const d1Path = join(workRoot, "ranking.sqlite3");
            await Promise.all([sourceRoot, publicRoot, buildRoot].map((path) => mkdir(path, { recursive: true })));
            return { sourceRoot, publicRoot, buildRoot, d1Path, manifest: {} };
        },
        runCommand: async (request) => {
            generatedCalls.push(request);
            return { status: 0 };
        },
        createWorkRoot: async () => {
            generatedOwnedRoot = await mkdtemp(join(homedir(), ".raidglass-f1-runner-generated-"));
            return generatedOwnedRoot;
        },
        prepareGeneratedBuildForE2EImpl: async (buildRoot) => preparedBuildRoots.push(buildRoot),
        writeLine: (line) => generatedLines.push(line),
    });

    assert.equal(generatedResult.exitCode, 0);
    assert.equal(generatedCalls.length, 2);
    assert.deepEqual(generatedCalls[0].args, ["run", "build"]);
    assert.deepEqual(generatedCalls[1].args, ["run", "test:e2e:direct", "--", "--grep", "generated-case"]);
    const generatedWorkRoot = dirname(generatedCalls[0].env.RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT);
    assert.equal(relative(generatedWorkRoot, generatedCalls[0].env.RAIDGLASS_PUBLIC_DIR), "public");
    assert.equal(relative(generatedWorkRoot, generatedCalls[0].env.RAIDGLASS_BUILD_DIR), "build");
    assert.equal(relative(generatedWorkRoot, generatedCalls[0].env.RAIDGLASS_D1_PATH), "ranking.sqlite3");
    assert.deepEqual(preparedBuildRoots, [generatedCalls[0].env.RAIDGLASS_BUILD_DIR]);
    assert.equal(generatedCalls[0].env.RAIDGLASS_SCREENSHOT_ROOT, join(generatedWorkRoot, "screens"));
    assert.equal(generatedCalls[1].env.RAIDGLASS_PUBLIC_DIR, generatedCalls[0].env.RAIDGLASS_PUBLIC_DIR);
    assert.notEqual(generatedResult.receipt.evidence_root, artifactResult.receipt.evidence_root);
    await assertMovedReceipt({
        lines: generatedLines,
        mode: "generated",
        ownedRoot: generatedOwnedRoot,
        result: generatedResult,
        status: "passed",
    });

    const failedLines = [];
    let failedOwnedRoot;
    const failedResult = await runE2E({
        args: ["--grep", "failed-case"],
        env: {
            RAIDGLASS_PUBLIC_DIR: artifactPublic,
            RAIDGLASS_BUILD_DIR: artifactBuild,
        },
        runCommand: async () => ({ status: 7 }),
        createWorkRoot: async () => {
            failedOwnedRoot = await mkdtemp(join(homedir(), ".raidglass-f1-runner-failed-"));
            return failedOwnedRoot;
        },
        writeLine: (line) => failedLines.push(line),
    });

    assert.equal(failedResult.exitCode, 7);
    await assertMovedReceipt({
        lines: failedLines,
        mode: "artifact",
        ownedRoot: failedOwnedRoot,
        result: failedResult,
        status: "failed",
    });
});
