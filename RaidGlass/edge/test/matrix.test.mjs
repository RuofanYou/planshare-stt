import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    COMP_EXPECTED_COUNT,
    GLOBAL_EXPECTED_COUNT,
    MATRIX_ID,
    SPEC_EXPECTED_COUNT,
    buildRankingMatrix,
} from "../src/matrix.js";

async function readJson(relativePath) {
    return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

test("真实元数据生成唯一 1860+10 排行矩阵并遵守职责指标合同", async () => {
    const [product, roles, specs, season, zones] = await Promise.all([
        readJson("../../frontend/config/product.json"),
        readJson("../../reference/api/roles.json"),
        readJson("../../reference/api/specs.json"),
        readJson("../../reference/api/season_current.json"),
        readJson("../../reference/api/zones.json"),
    ]);

    const matrix = buildRankingMatrix({ product, roles, specs, season, zones });
    const specTargets = matrix.filter((target) => target.kind === "spec");
    const compTargets = matrix.filter((target) => target.kind === "comp");

    assert.equal(MATRIX_ID, "midnight-s1-1870-v3");
    assert.equal(specTargets.length, SPEC_EXPECTED_COUNT);
    assert.equal(compTargets.length, COMP_EXPECTED_COUNT);
    assert.equal(matrix.length, GLOBAL_EXPECTED_COUNT);
    assert.equal(new Set(matrix.map((target) => target.targetKey)).size, matrix.length);
    assert.equal(new Set(matrix.map((target) => target.bossSlug)).size, 10);
    assert.equal(new Set(specTargets.map((target) => target.specSlug)).size, 40);

    const metricsByRole = Object.fromEntries(
        ["mdps", "rdps", "heal", "tank"].map((role) => [
            role,
            [...new Set(specTargets.filter((target) => target.role === role).map((target) => target.metric))].sort(),
        ]),
    );
    assert.deepEqual(metricsByRole, {
        mdps: ["bossdps", "dps"],
        rdps: ["bossdps", "dps"],
        heal: ["bossdps", "dps", "hps"],
        tank: ["bossdps", "dps", "hps"],
    });
});
