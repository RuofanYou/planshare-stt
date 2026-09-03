import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    buildReferenceCompSeedSql,
    buildReferenceCompSeeds,
} from "../scripts/reference-comp-seed.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

test("两项缺失阵容可由保留的 WCL 证据生成过期种子", async () => {
    const prepared = await buildReferenceCompSeeds(repoRoot);
    assert.deepEqual(prepared.seeds.map((seed) => seed.targetKey), ["comp/lura", "comp/rotmire"]);
    assert.ok(Date.parse(prepared.capturedAt));

    for (const seed of prepared.seeds) {
        assert.equal(seed.ranking.boss_slug, seed.bossSlug);
        assert.equal(seed.ranking.edge_top_n, 10);
        assert.equal(seed.ranking.source_report_count, 50);
        assert.ok(seed.ranking.reports.length >= 1 && seed.ranking.reports.length <= 10);
        const fight = seed.ranking.reports[0].fights[0];
        assert.equal(fight.boss.boss_slug, seed.bossSlug);
        assert.ok(fight.players.length >= 15);
        assert.equal(
            Object.values(fight.composition.roles).reduce((sum, value) => sum + value, 0),
            fight.players.length,
        );
        assert.equal(
            Object.values(fight.composition.specs).reduce((sum, value) => sum + value, 0),
            fight.players.length,
        );
        assert.equal(
            Object.values(fight.composition.classes).reduce((sum, value) => sum + value, 0),
            fight.players.length,
        );
    }
});

test("种子 SQL 只填补尚无排行字节的目标", async () => {
    const prepared = await buildReferenceCompSeeds(repoRoot);
    const sql = buildReferenceCompSeedSql(prepared, "2026-08-09T16:00:00.000Z");
    assert.match(sql, /'comp\/lura'/);
    assert.match(sql, /'comp\/rotmire'/);
    assert.match(sql, /'reference_seed_only'/);
    assert.match(sql, /WHERE ranking_targets\.ranking_json IS NULL;/);
    assert.doesNotMatch(sql, /\/Users\//);
    assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT|SAVEPOINT)\b/);
});
