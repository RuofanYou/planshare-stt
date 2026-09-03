import { ZH_CN } from "../../localization/zhCN";
import type RankingRefresh from "../../types/ranking_refresh";

export function rankingRefreshPresentation(refresh: RankingRefresh) {
    return refresh.status === "stale"
        ? { key: "stale" as const, label: ZH_CN.workbench.stale }
        : { key: "fresh" as const, label: ZH_CN.workbench.fresh };
}
