
import type { SpellDict } from "./spell";
import type Report from "./report";
import type RankingRefresh from "./ranking_refresh";

export default interface SpecRanking {
    spec_slug: string;
    boss_slug: string;
    difficulty: string;
    metric: string;

    extra_spells?: SpellDict;
    skill_completion?: SkillCompletion;
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

export interface SkillCompletion {
    version: number; complete: number; total: number; failed: number;
    status?: "queued" | "collecting" | "budget_wait" | "failed" | "complete";
    retry_at?: string | null;
    updated_at?: string;
}
