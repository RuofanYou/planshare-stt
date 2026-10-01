import { CASTS_VERSION } from "./wcl-casts.js";
import { WorkerEntrypoint } from "cloudflare:workers";
import product from "../../frontend/config/product.json" with { type: "json" };
import roles from "../../reference/api/roles.json" with { type: "json" };
import season from "../../reference/api/season_current.json" with { type: "json" };
import specs from "../../reference/api/specs.json" with { type: "json" };
import zones from "../../reference/api/zones.json" with { type: "json" };

import { RefreshCoordinator } from "./coordinator.js";
import { buildRankingMatrix } from "./matrix.js";
import { consumeBackfillBatch, handleAdminRequest, runScheduledBackfill, runScheduledRefresh } from "./orchestrator.js";
import { consumeQueueBatch, COORDINATOR_NAME } from "./refresh.js";

const TARGET_MATRIX = buildRankingMatrix({ product, roles, specs, season, zones });
const TARGET_INDEX = new Map(TARGET_MATRIX.map((target) => [target.targetKey, target]));
const BOSS_IDS = new Map(zones.flatMap((zone) => zone.bosses.map((boss) => [boss.full_name_slug, boss.id])));

export { RefreshCoordinator };

export default {
    async scheduled(controller, env) {
        if (env.WCL_ALL_CASTS === "true"
            && new Date(controller.scheduledTime).getUTCHours() % 6 !== 0) {
            return runScheduledBackfill(controller, env);
        }
        await runScheduledRefresh(controller, env, TARGET_MATRIX);
    },

    async queue(batch, env) {
        if (batch.messages[0]?.body?.trigger === "casts_tick") {
            if (env.WCL_ALL_CASTS === "true") await env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME).processCastPage();
            batch.ackAll();
            return;
        }
        if (batch.messages[0]?.body?.trigger === "casts_backfill") {
            return consumeBackfillBatch(batch, env, TARGET_INDEX);
        }
        await consumeQueueBatch(batch, env, { targetIndex: TARGET_INDEX, bossIds: BOSS_IDS });
    },

    async fetch(request, env) {
        return handleAdminRequest(request, env, { targetIndex: TARGET_INDEX });
    },
};

// Only Service Binding RPC exposes this entrypoint; the public fetch handler stays admin-only.
export class CastBackfill extends WorkerEntrypoint {
    async request(targetKey, clientKey = null) {
        const target = TARGET_INDEX.get(targetKey);
        if (target?.kind !== "spec") return { error: "invalid_target", http_status: 400 };
        if (this.env.WCL_ALL_CASTS !== "true") return { error: "backfill_disabled", http_status: 503 };
        const row = await this.env.RANKING_DB.prepare(`SELECT
            json_extract(ranking_json, '$.skill_completion') AS completion,
            json_extract(ranking_json, '$.updated') AS updated,
            json_array_length(ranking_json, '$.reports') AS total
            FROM ranking_targets WHERE target_key=? AND ranking_json IS NOT NULL`).bind(targetKey).first();
        if (!row) return { error: "ranking_unavailable", http_status: 404 };
        const completion = row.completion ? JSON.parse(row.completion) : { version: CASTS_VERSION, complete: 0, total: row.total, failed: 0 };
        const coordinator = this.env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
        const status = clientKey ? await coordinator.registerCasts(target, completion, true, clientKey)
            : await coordinator.castStatus(targetKey, completion);
        if (status.error) return { ...status, http_status: 429 };
        return { target_key: targetKey, skill_completion: status,
            revision: `${row.updated}/${completion.updated_at || ''}/${completion.complete}` };
    }
}
