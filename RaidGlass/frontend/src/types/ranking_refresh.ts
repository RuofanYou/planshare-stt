export type RankingRefreshStatus = "fresh" | "stale";

export default interface RankingRefresh {
    status: RankingRefreshStatus;
    checked_at: string;
    published_at: string | null;
    upstream_updated: string | null;
    last_error_code: string | null;
}
