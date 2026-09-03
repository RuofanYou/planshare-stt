import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    buildRankingMatrix as buildContractMatrix,
    DIFFICULTIES,
} from "../../../contracts/ranking-matrix.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const productConfig = JSON.parse(await readFile(join(frontendRoot, "config", "product.json"), "utf8"));

export const RANKING_DIFFICULTIES = DIFFICULTIES;
export const PUBLIC_API_ROOT = "https://api2.lorrgs.io";

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

export function publicRankingUrl(target, info = false) {
    const path = `/api/spec_ranking/${target.specSlug}/${target.bossSlug}${info ? "/info" : ""}`;
    const url = new URL(path, PUBLIC_API_ROOT);
    url.search = new URLSearchParams({ difficulty: target.difficulty, metric: target.metric }).toString();
    return url.href;
}

export async function buildRankingMatrix(sourceRoot) {
    const root = resolve(sourceRoot);
    const season = await readJson(join(root, "api", "season_current.json"));
    const zones = await Promise.all((season.raids || []).map(
        (zoneId) => readJson(join(root, "api", "current_season", "zones", `${zoneId}.json`)),
    ));
    return buildContractMatrix({
        product: productConfig,
        roles: await readJson(join(root, "api", "roles.json")),
        specs: await readJson(join(root, "api", "specs.json")),
        season,
        zones,
    })
        .filter((target) => target.kind === "spec")
        .map((target) => ({
            ...target,
            url: publicRankingUrl(target),
            infoUrl: publicRankingUrl(target, true),
        }));
}
