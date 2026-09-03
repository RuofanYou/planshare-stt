import type Cast from "./cast";
import type Event from "./event";
import type { FightComposition } from "./fight";
import type RankingRefresh from "./ranking_refresh";

export interface RawCompPlayer {
    source_id: number;
    casts?: Cast[];
    name: string;
    class_slug: string;
    spec_slug: string;
    total: number;
    deaths?: Event[];
}

export interface RawCompBoss {
    casts?: Cast[];
    boss_slug: string;
}

export interface RawCompFight {
    fight_id: number;
    start_time: string;
    duration: number;
    players: RawCompPlayer[];
    boss: RawCompBoss;
    composition: FightComposition;
    damage_taken: number;
    deaths: number;
}

export interface RawCompReport {
    report_id: string;
    start_time: string;
    fights: RawCompFight[];
}

export interface RawCompRanking {
    boss_slug: string;
    reports: RawCompReport[];
    updated: string;
    edge_top_n: number;
    source_report_count: number;
    refresh: RankingRefresh;
}

export default RawCompRanking;
