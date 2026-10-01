export type TimelineDifficulty = "mythic" | "heroic";
export type TimelineMetric = "dps" | "bossdps" | "hps";

export interface TimelineTarget {
    bossSlug: string;
    bossName: string;
    specSlug: string;
    specName: string;
    difficulty: TimelineDifficulty;
    metric: TimelineMetric;
}

export interface RankingMeta {
    skillCompletion?: import("../../types/spec_ranking").SkillCompletion;
    updated: string;
    edgeTopN: 10;
    sourceReportCount: number;
    refresh: RankingRefresh;
}

export function timelineTargetKey(target: TimelineTarget) {
    return [
        target.bossSlug,
        target.specSlug,
        target.difficulty,
        target.metric,
    ].join("/");
}
import type RankingRefresh from "../../types/ranking_refresh";
