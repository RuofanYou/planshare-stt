
import type Report from "./report";
import type RankingRefresh from "./ranking_refresh";

export default interface SpecRanking {
    spec_slug: string;
    boss_slug: string;
    difficulty: string;
    metric: string;

    reports?: Report[];
    updated?: string;
    edge_top_n?: number;
    source_report_count?: number;
    refresh: RankingRefresh;
}

/** Metadata from GET /api/spec_ranking/{spec}/{boss}/info (reports stripped). */
export interface SpecRankingInfo {
    spec_slug: string;
    boss_slug: string;
    difficulty: string;
    metric: string;
    updated?: string;
    dirty?: boolean;
    refresh: RankingRefresh;
}
