import product from "../../frontend/config/product.json" with { type: "json" };
import roles from "../../reference/api/roles.json" with { type: "json" };
import season from "../../reference/api/season_current.json" with { type: "json" };
import specs from "../../reference/api/specs.json" with { type: "json" };
import zones from "../../reference/api/zones.json" with { type: "json" };

import { RefreshCoordinator } from "./coordinator.js";
import { buildRankingMatrix } from "./matrix.js";
import { consumeBackfillBatch, handleAdminRequest, runScheduledBackfill, runScheduledRefresh } from "./orchestrator.js";
import { consumeQueueBatch } from "./refresh.js";

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
        if (batch.messages[0]?.body?.trigger === "casts_backfill") {
            return consumeBackfillBatch(batch, env, TARGET_INDEX);
        }
        await consumeQueueBatch(batch, env, { targetIndex: TARGET_INDEX, bossIds: BOSS_IDS });
    },

    async fetch(request, env) {
        return handleAdminRequest(request, env, { targetIndex: TARGET_INDEX });
    },
};
