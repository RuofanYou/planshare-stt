import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RANKING_DIFFICULTIES } from "./ranking-matrix.mjs";
import { prepareDeploymentAssets } from "./deployment-assets.mjs";
import { createStaticPublicFilter } from "./static-public-shell.mjs";
import { writeGlobalStatus, writeTargetResult } from "../../../edge/src/ranking-store.js";
import { openLocalD1 } from "../../../testing/local-d1.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const edgeMigration = resolve(frontendRoot, "..", "edge", "migrations", "0001_dynamic_rankings.sql");
const FIXTURE_NOW = "2026-07-16T00:00:00.000Z";
export const GENERATED_FILTERABLE_SPELL_ID = 1249266;
export const GENERATED_PRIMARY_SPELL_BY_SPEC = Object.freeze({
    "mage-fire": 190319,
    "warlock-affliction": 205180,
    "warlock-demonology": 265187,
    "warlock-destruction": 1122,
    "deathknight-blood": 48792,
});
export const GENERATED_PRIMARY_SPELL_BY_BOSS = Object.freeze({
    "imperator-averzian": 1249265,
    vorasius: 1241768,
});

const BOSSES = [
    {
        id: 1,
        index: 1,
        name: "Imperator Averzian",
        full_name: "Imperator Averzian",
        full_name_slug: "imperator-averzian",
        icon: "generated-imperator.jpg",
        phase_type: "static",
    },
    {
        id: 2,
        index: 2,
        name: "Vorasius",
        full_name: "Vorasius",
        full_name_slug: "vorasius",
        icon: "generated-vorasius.jpg",
        phase_type: "static",
    },
];

const SPECS = [
    {
        id: 265,
        index: 1,
        class: { name: "Warlock", name_slug: "warlock" },
        role: "rdps",
        name: "Affliction",
        full_name: "Affliction Warlock",
        full_name_slug: "warlock-affliction",
        icon: "warlock-affliction.jpg",
        spells_by_type: {},
    },
    {
        id: 266,
        index: 2,
        class: { name: "Warlock", name_slug: "warlock" },
        role: "rdps",
        name: "Demonology",
        full_name: "Demonology Warlock",
        full_name_slug: "warlock-demonology",
        icon: "warlock-demonology.jpg",
        spells_by_type: {},
    },
    {
        id: 267,
        index: 3,
        class: { name: "Warlock", name_slug: "warlock" },
        role: "rdps",
        name: "Destruction",
        full_name: "Destruction Warlock",
        full_name_slug: "warlock-destruction",
        icon: "warlock-destruction.jpg",
        spells_by_type: {},
    },
    {
        id: 63,
        index: 1,
        class: { name: "Mage", name_slug: "mage" },
        role: "rdps",
        name: "Fire",
        full_name: "Fire Mage",
        full_name_slug: "mage-fire",
        icon: "mage-fire.jpg",
        spells_by_type: {},
    },
    {
        id: 250,
        index: 1,
        class: { name: "Death Knight", name_slug: "deathknight" },
        role: "tank",
        name: "Blood",
        full_name: "Blood Death Knight",
        full_name_slug: "deathknight-blood",
        icon: "deathknight-blood.jpg",
        spells_by_type: {},
    },
];

const SPEC_ROLE_BY_SLUG = Object.fromEntries(
    SPECS.map(({ full_name_slug: specSlug, role }) => [specSlug, role]),
);

const CLASSES = Object.fromEntries([
    ["warlock", 9, "Warlock", "#8788EE"],
    ["mage", 8, "Mage", "#3FC7EB"],
    ["deathknight", 6, "Death Knight", "#C41E3A"],
].map(([nameSlug, id, name, color]) => [
    nameSlug,
    {
        id,
        name,
        name_slug: nameSlug,
        color,
        specs: SPECS
            .filter((spec) => spec.class.name_slug === nameSlug)
            .map((spec) => spec.full_name_slug),
        spec_ids: SPECS
            .filter((spec) => spec.class.name_slug === nameSlug)
            .map((spec) => spec.id),
    },
]));

const ROLES = [
    {
        id: 4,
        code: "rdps",
        name: "Ranged DPS",
        specs: SPECS.filter((spec) => spec.role === "rdps").map((spec) => spec.full_name_slug),
        spec_ids: SPECS.filter((spec) => spec.role === "rdps").map((spec) => spec.id),
        metrics: ["dps"],
    },
    {
        id: 1,
        code: "tank",
        name: "Tank",
        specs: SPECS.filter((spec) => spec.role === "tank").map((spec) => spec.full_name_slug),
        spec_ids: SPECS.filter((spec) => spec.role === "tank").map((spec) => spec.id),
        metrics: ["dps"],
    },
    { id: 3, code: "mdps", name: "Melee DPS", specs: [], spec_ids: [], metrics: ["dps", "bossdps"] },
    { id: 2, code: "heal", name: "Healer", specs: [], spec_ids: [], metrics: ["dps", "hps", "bossdps"] },
];

export const GENERATED_TEST_TARGET_COUNT = 20;

export function generatedRankingTargets() {
    const metricsByRole = new Map(ROLES.map((role) => [role.code, role.metrics]));
    return BOSSES.flatMap((boss) => SPECS.flatMap((spec) => (
        RANKING_DIFFICULTIES.flatMap((difficulty) => (
            metricsByRole.get(spec.role).map((metric) => ({
                bossSlug: boss.full_name_slug,
                specSlug: spec.full_name_slug,
                role: spec.role,
                difficulty,
                metric,
            }))
        ))
    )));
}

async function writeJson(root, relativePath, value) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function isoAt(index) {
    return new Date(Date.parse(FIXTURE_NOW) + index * 60_000).toISOString();
}

function spellPayload(spellType, primarySpellId) {
    return {
        [primarySpellId]: {
            spell_id: primarySpellId,
            spell_type: spellType,
            name: "Umbral Collapse",
            color: "#7B61FF",
            cooldown: 30,
            duration: 0,
            icon: "generated-primary-spell.jpg",
            show: true,
            specs: [],
        },
        [GENERATED_FILTERABLE_SPELL_ID]: {
            spell_id: GENERATED_FILTERABLE_SPELL_ID,
            spell_type: spellType,
            name: "Generated Secondary Event",
            color: "#4DA3FF",
            cooldown: 45,
            duration: 0,
            icon: "generated-secondary-spell.jpg",
            show: true,
            specs: [],
        },
    };
}

function actor({ sourceId, name, specSlug, classSlug, role, total, includeFilterable = false }) {
    return {
        source_id: sourceId,
        name,
        spec_slug: specSlug,
        class_slug: classSlug,
        role,
        total,
        deaths: [],
        resurrects: [],
        casts: [
            { id: GENERATED_PRIMARY_SPELL_BY_SPEC[specSlug], ts: 30_000 + sourceId * 1_000 },
            ...(includeFilterable ? [{ id: GENERATED_FILTERABLE_SPELL_ID, ts: 90_000 }] : []),
        ],
    };
}

function bossActor(bossSlug) {
    return {
        name: BOSSES.find((boss) => boss.full_name_slug === bossSlug)?.name ?? bossSlug,
        boss_slug: bossSlug,
        spec_slug: bossSlug,
        class_slug: "boss",
        total: 0,
        deaths: [],
        resurrects: [],
        casts: [{ id: GENERATED_PRIMARY_SPELL_BY_BOSS[bossSlug], ts: 120_000 }],
    };
}

function rawCompPlayer({ sourceId, name, specSlug, classSlug, total, includeFilterable = false }) {
    return {
        source_id: sourceId,
        name,
        spec_slug: specSlug,
        class_slug: classSlug,
        total,
        deaths: [],
        casts: [
            { id: GENERATED_PRIMARY_SPELL_BY_SPEC[specSlug], ts: 30_000 + sourceId * 1_000 },
            ...(includeFilterable ? [{ id: GENERATED_FILTERABLE_SPELL_ID, ts: 90_000 }] : []),
        ],
    };
}

function rawCompBoss(bossSlug) {
    return {
        boss_slug: bossSlug,
        casts: [{ id: GENERATED_PRIMARY_SPELL_BY_BOSS[bossSlug], ts: 120_000 }],
    };
}

function specReport(target, reportIndex) {
    const spec = SPECS.find(({ full_name_slug: slug }) => slug === target.specSlug);
    const startTime = isoAt(reportIndex);
    return {
        report_id: `generated-${target.bossSlug}-${target.specSlug}-${target.difficulty}-${reportIndex + 1}`,
        start_time: startTime,
        region: "CN",
        fights: [{
            fight_id: reportIndex + 1,
            duration: 600_000,
            start_time: startTime,
            difficulty: target.difficulty === "mythic" ? 5 : 4,
            phases: [],
            boss: bossActor(target.bossSlug),
            players: [actor({
                sourceId: reportIndex + 1,
                name: `Generated Player ${reportIndex + 1}`,
                specSlug: target.specSlug,
                classSlug: spec.class.name_slug,
                role: spec.role,
                total: 1_000_000 - reportIndex * 10_000,
            })],
        }],
    };
}

function countValues(values) {
    return Object.fromEntries(
        [...values.reduce((counts, value) => {
            counts.set(value, (counts.get(value) ?? 0) + 1);
            return counts;
        }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)),
    );
}

function countPlayers(players, key) {
    return countValues(players.map((player) => player[key]));
}

function compReport(reportIndex) {
    const startTime = isoAt(reportIndex);
    const players = [
        rawCompPlayer({
            sourceId: 1,
            name: `Generated Tank A ${reportIndex + 1}`,
            specSlug: "deathknight-blood",
            classSlug: "deathknight",
            total: 800_000,
        }),
        rawCompPlayer({
            sourceId: 2,
            name: `Generated Tank B ${reportIndex + 1}`,
            specSlug: "deathknight-blood",
            classSlug: "deathknight",
            total: 780_000,
        }),
        rawCompPlayer({
            sourceId: 3,
            name: `Generated Ranged ${reportIndex + 1}`,
            specSlug: "mage-fire",
            classSlug: "mage",
            total: 1_200_000,
            includeFilterable: true,
        }),
    ];

    return {
        report_id: `generated-comp-vorasius-${reportIndex + 1}`,
        start_time: startTime,
        fights: [{
            fight_id: reportIndex + 1,
            duration: 600_000,
            damage_taken: 100_000 + reportIndex,
            deaths: 0,
            start_time: startTime,
            difficulty: 5,
            phases: [],
            boss: rawCompBoss("vorasius"),
            players,
            composition: {
                roles: countValues(players.map(({ spec_slug: specSlug }) => SPEC_ROLE_BY_SLUG[specSlug])),
                specs: countPlayers(players, "spec_slug"),
                classes: countPlayers(players, "class_slug"),
            },
        }],
    };
}

async function writeImages(sourceRoot) {
    const webpSource = join(frontendRoot, "public", "img", "inv_scroll_08.webp");
    const jpegSource = join(frontendRoot, "public", "img", "inv_inscription_80_scroll.jpg");
    const webpPaths = Object.values(CLASSES)
        .map(({ name_slug: nameSlug }) => `assets/images/classes/${nameSlug}.webp`);
    const jpegPaths = [
        ...ROLES.map(({ code }) => `assets/images/roles/${code}.jpg`),
        ...SPECS.map(({ full_name_slug: specSlug }) => `assets/images/specs/${specSlug}.jpg`),
        ...BOSSES.map(({ icon }) => `assets/images/spells/${icon}`),
        "assets/images/spells/generated-primary-spell.jpg",
        "assets/images/spells/generated-secondary-spell.jpg",
    ];

    for (const relativePath of webpPaths) {
        const target = join(sourceRoot, relativePath);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(webpSource, target);
    }
    for (const relativePath of jpegPaths) {
        const target = join(sourceRoot, relativePath);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(jpegSource, target);
    }
}

async function seedRanking(database, target, ranking) {
    await writeTargetResult(database, {
        target,
        status: "published",
        ranking,
        checkedAt: FIXTURE_NOW,
        publishedAt: FIXTURE_NOW,
        upstreamUpdated: FIXTURE_NOW,
        errorCode: null,
        errorMessage: null,
    }, "generated-e2e-run");
}

export async function writeGeneratedTestSource(
    sourceRoot,
    d1Path = join(dirname(sourceRoot), "ranking.sqlite3"),
) {
    await mkdir(sourceRoot, { recursive: true });
    const zone = {
        id: 1,
        name: "Generated Raid",
        name_slug: "generated-raid",
        bosses: BOSSES,
    };

    await writeJson(sourceRoot, "api/season_current.json", {
        name: "Generated Season",
        slug: "generated-season",
        raids: [1],
    });
    await writeJson(sourceRoot, "api/bosses.json", { bosses: BOSSES });
    await writeJson(sourceRoot, "api/classes.json", CLASSES);
    await writeJson(sourceRoot, "api/roles.json", { roles: ROLES });
    await writeJson(sourceRoot, "api/specs.json", { specs: SPECS });
    await writeJson(sourceRoot, "api/zones.json", { zones: [zone] });
    await writeJson(sourceRoot, "api/current_season/zones/1.json", zone);

    for (const boss of BOSSES) {
        await writeJson(
            sourceRoot,
            `api/boss_spells/${boss.full_name_slug}.json`,
            spellPayload(
                boss.full_name_slug,
                GENERATED_PRIMARY_SPELL_BY_BOSS[boss.full_name_slug],
            ),
        );
    }
    for (const spec of SPECS) {
        await writeJson(
            sourceRoot,
            `api/spec_spells/${spec.full_name_slug}.json`,
            spellPayload(
                spec.full_name_slug,
                GENERATED_PRIMARY_SPELL_BY_SPEC[spec.full_name_slug],
            ),
        );
    }

    const matrix = generatedRankingTargets();
    if (matrix.length !== GENERATED_TEST_TARGET_COUNT) {
        throw new Error(`generated ranking matrix mismatch: expected=${GENERATED_TEST_TARGET_COUNT} actual=${matrix.length}`);
    }
    const database = openLocalD1(d1Path);
    try {
        database.exec(await readFile(edgeMigration, "utf8"));
        for (const target of matrix) {
            const identity = {
                kind: "spec",
                targetKey: `spec/${target.bossSlug}/${target.specSlug}/${target.difficulty}/${target.metric}`,
                bossSlug: target.bossSlug,
                specSlug: target.specSlug,
                role: target.role,
                difficulty: target.difficulty,
                metric: target.metric,
            };
            await seedRanking(database, identity, {
                spec_slug: target.specSlug,
                boss_slug: target.bossSlug,
                difficulty: target.difficulty,
                metric: target.metric,
                updated: FIXTURE_NOW,
                edge_top_n: 10,
                source_report_count: 10,
                reports: Array.from({ length: 10 }, (_, index) => specReport(target, index)),
            });
        }

        await seedRanking(database, {
            kind: "comp",
            targetKey: "comp/vorasius",
            bossSlug: "vorasius",
        }, {
            boss_slug: "vorasius",
            updated: FIXTURE_NOW,
            edge_top_n: 10,
            source_report_count: 10,
            reports: Array.from({ length: 10 }, (_, index) => compReport(index)),
        });
        await writeGlobalStatus(database, {
            schema_version: 2,
            run_id: "generated-e2e-run",
            latest_run_id: "generated-e2e-run",
            active_run_id: null,
            last_completed_run_id: "generated-e2e-run",
            status: "fresh",
            matrix_id: "generated-season-22-v1",
            expected_count: 22,
            available_count: 21,
            fresh_count: 21,
            stale_count: 0,
            unchecked_count: 1,
            spec_expected: 20,
            spec_available: 20,
            spec_fresh: 20,
            spec_stale: 0,
            spec_unchecked: 0,
            comp_expected: 2,
            comp_available: 1,
            comp_fresh: 1,
            comp_stale: 0,
            comp_unchecked: 1,
            checked_at: FIXTURE_NOW,
        });
    } finally {
        database.close();
    }
    await writeImages(sourceRoot);
    return { sourceRoot, d1Path };
}

export async function prepareGeneratedTestSurface(workRoot) {
    const sourceRoot = join(workRoot, "source");
    const publicRoot = join(workRoot, "public");
    const buildRoot = join(workRoot, "build");
    const d1Path = join(workRoot, "ranking.sqlite3");

    await mkdir(workRoot, { recursive: true });
    await cp(join(frontendRoot, "public"), publicRoot, {
        recursive: true,
        filter: createStaticPublicFilter(join(frontendRoot, "public")),
    });
    await mkdir(buildRoot, { recursive: true });
    await writeGeneratedTestSource(sourceRoot, d1Path);
    const manifest = await prepareDeploymentAssets({
        sourceRoot,
        outputRoot: publicRoot,
        buildId: "generated-e2e-build",
        releaseId: "generated-e2e-release",
        publishedAt: FIXTURE_NOW,
    });
    return { sourceRoot, publicRoot, buildRoot, d1Path, manifest };
}

export function resolveE2EMode(env) {
    const hasPublic = Boolean(env.RAIDGLASS_PUBLIC_DIR);
    const hasBuild = Boolean(env.RAIDGLASS_BUILD_DIR);
    if (hasPublic !== hasBuild) {
        throw new Error("RAIDGLASS_PUBLIC_DIR and RAIDGLASS_BUILD_DIR must be provided together");
    }
    return hasPublic ? "artifact" : "generated";
}
