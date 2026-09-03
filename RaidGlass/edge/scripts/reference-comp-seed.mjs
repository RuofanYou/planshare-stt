import { access, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARGET_BOSSES = ["lura", "rotmire"];
const TOP_N = 10;

function requireObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} is invalid`);
    }
    return value;
}

function requireArray(value, label) {
    if (!Array.isArray(value)) throw new Error(`${label} is invalid`);
    return value;
}

function requireString(value, label) {
    if (typeof value !== "string" || value.length < 1) throw new Error(`${label} is invalid`);
    return value;
}

function requireCount(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid`);
    return value;
}

function isoFromMilliseconds(value, label) {
    requireCount(value, label);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`);
    return date.toISOString();
}

function normalized(value) {
    return requireString(value, "catalog name").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildSpecIndex(specPayload) {
    const index = new Map();
    for (const spec of requireArray(specPayload.specs, "spec catalog")) {
        const key = `${normalized(spec.class.name)}:${normalized(spec.name)}`;
        index.set(key, {
            classSlug: requireString(spec.class.name_slug, "class slug"),
            role: requireString(spec.role, "spec role"),
            specSlug: requireString(spec.full_name_slug, "spec slug"),
        });
    }
    return index;
}

function valuesById(rows) {
    return new Map(requireArray(rows || [], "summary values").map((row) => [row.id, row]));
}

function deathEventsById(rows) {
    const result = new Map();
    for (const row of requireArray(rows || [], "death events")) {
        const event = { ts: requireCount(row.deathTime, "death timestamp") };
        if (Number.isSafeInteger(row.ability?.guid) && row.ability.guid >= 0) {
            event.spell_id = row.ability.guid;
        }
        const events = result.get(row.id) || [];
        events.push(event);
        result.set(row.id, events);
    }
    return result;
}

function increment(values, key) {
    values[key] = (values[key] || 0) + 1;
}

function buildPlayers(summary, specIndex) {
    const damage = valuesById(summary.damageDone);
    const healing = valuesById(summary.healingDone);
    const deaths = deathEventsById(summary.deathEvents);
    const players = [];
    const composition = { roles: {}, specs: {}, classes: {} };

    for (const actor of requireArray(summary.composition, "fight composition")) {
        const actorSpec = requireObject(requireArray(actor.specs, "actor specs")[0], "actor spec");
        const catalog = specIndex.get(`${normalized(actor.type)}:${normalized(actorSpec.spec)}`);
        if (!catalog) throw new Error(`unknown reference spec: ${actor.type}/${actorSpec.spec}`);
        const total = Math.round(Math.max(
            Number(damage.get(actor.id)?.total || 0),
            Number(healing.get(actor.id)?.total || 0),
        ));
        players.push({
            source_id: requireCount(actor.id, "source id"),
            casts: [],
            name: requireString(actor.name, "player name"),
            class_slug: catalog.classSlug,
            spec_slug: catalog.specSlug,
            total: requireCount(total, "player total"),
            deaths: deaths.get(actor.id) || [],
        });
        increment(composition.roles, catalog.role);
        increment(composition.specs, catalog.specSlug);
        increment(composition.classes, catalog.classSlug);
    }
    if (players.length < 1) throw new Error("reference fight has no players");
    return { composition, players };
}

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function buildBossSeed({ bossSlug, referenceRoot, specIndex, capturedAt }) {
    const rankingPath = resolve(
        referenceRoot,
        "wcl/raw/current_season/fight_rankings",
        `${bossSlug}__page1.json`,
    );
    const rankingPayload = JSON.parse(await readFile(rankingPath, "utf8"));
    const sourceRankings = requireArray(
        rankingPayload?.data?.worldData?.encounter?.fightRankings?.rankings,
        `${bossSlug} fight rankings`,
    );
    const reports = [];

    for (const source of sourceRankings) {
        const reportId = requireString(source?.report?.code, "report id");
        const fightId = requireCount(source?.report?.fightID, "fight id");
        const summaryPath = resolve(
            referenceRoot,
            "wcl/raw/reports",
            reportId,
            "fights",
            `${fightId}__summary.json`,
        );
        if (!(await exists(summaryPath))) continue;
        const summaryPayload = JSON.parse(await readFile(summaryPath, "utf8"));
        const summary = requireObject(
            summaryPayload?.data?.reportData?.report?.summary?.data,
            `${bossSlug} fight summary`,
        );
        const { composition, players } = buildPlayers(summary, specIndex);
        reports.push({
            report_id: reportId,
            start_time: isoFromMilliseconds(source.report.startTime, "report start time"),
            fights: [{
                fight_id: fightId,
                start_time: isoFromMilliseconds(source.startTime, "fight start time"),
                duration: requireCount(source.duration, "fight duration"),
                players,
                boss: { casts: [], boss_slug: bossSlug },
                composition,
                damage_taken: requireCount(source.damageTaken, "damage taken"),
                deaths: requireCount(source.deaths, "fight deaths"),
            }],
        });
        if (reports.length === TOP_N) break;
    }
    if (reports.length < 1) throw new Error(`${bossSlug} has no local reference report`);
    return {
        targetKey: `comp/${bossSlug}`,
        bossSlug,
        ranking: {
            boss_slug: bossSlug,
            reports,
            updated: capturedAt,
            edge_top_n: TOP_N,
            source_report_count: sourceRankings.length,
        },
    };
}

export async function buildReferenceCompSeeds(repoRoot) {
    const referenceRoot = resolve(repoRoot, "Referrence/lorrgs_assets");
    const [statusPayload, specPayload] = await Promise.all([
        readFile(resolve(referenceRoot, "BACKEND_FULL_STATUS.json"), "utf8").then(JSON.parse),
        readFile(resolve(referenceRoot, "api/specs.json"), "utf8").then(JSON.parse),
    ]);
    const capturedAt = requireString(statusPayload.generated_at, "reference capture timestamp");
    if (Number.isNaN(Date.parse(capturedAt))) throw new Error("reference capture timestamp is invalid");
    const specIndex = buildSpecIndex(specPayload);
    const seeds = [];
    for (const bossSlug of TARGET_BOSSES) {
        seeds.push(await buildBossSeed({ bossSlug, referenceRoot, specIndex, capturedAt }));
    }
    return { capturedAt, seeds };
}

function sqlString(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildReferenceCompSeedSql({ capturedAt, seeds }, checkedAt) {
    if (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt))) {
        throw new Error("seed check timestamp is invalid");
    }
    const runId = `reference-seed-${checkedAt.replace(/[^0-9A-Za-z]/g, "")}`;
    const statements = seeds.map(({ targetKey, bossSlug, ranking }) => `
INSERT INTO ranking_targets(
    target_key, kind, boss_slug, spec_slug, role, difficulty, metric,
    ranking_json, refresh_status, checked_at, published_at, upstream_updated,
    last_error_code, last_run_id
) VALUES (
    ${sqlString(targetKey)}, 'comp', ${sqlString(bossSlug)}, NULL, NULL, NULL, NULL,
    ${sqlString(JSON.stringify(ranking))}, 'stale', ${sqlString(checkedAt)},
    ${sqlString(capturedAt)}, ${sqlString(capturedAt)}, 'reference_seed_only', ${sqlString(runId)}
)
ON CONFLICT(target_key) DO UPDATE SET
    ranking_json = excluded.ranking_json,
    refresh_status = excluded.refresh_status,
    checked_at = excluded.checked_at,
    published_at = excluded.published_at,
    upstream_updated = excluded.upstream_updated,
    last_error_code = excluded.last_error_code,
    last_run_id = excluded.last_run_id
WHERE ranking_targets.ranking_json IS NULL;`);
    return `${statements.join("")}\n`;
}

async function main() {
    const outputIndex = process.argv.indexOf("--output");
    const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
    if (!output || !output.startsWith("/")) throw new Error("--output requires an absolute path");
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    const prepared = await buildReferenceCompSeeds(repoRoot);
    const sql = buildReferenceCompSeedSql(prepared, new Date().toISOString());
    await writeFile(output, sql, { flag: "wx" });
    process.stdout.write(`${JSON.stringify({
        event: "reference_comp_seed_prepared",
        reference_captured_at: prepared.capturedAt,
        targets: prepared.seeds.map((seed) => ({
            target_key: seed.targetKey,
            report_count: seed.ranking.reports.length,
            player_count: seed.ranking.reports[0].fights[0].players.length,
        })),
        output: basename(output),
        sql_bytes: Buffer.byteLength(sql),
    })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
