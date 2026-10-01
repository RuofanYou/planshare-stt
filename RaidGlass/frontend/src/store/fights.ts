import { createSelector } from 'reselect'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { fetch_data } from '../api'
import { MODES } from './ui'
import type { AppDispatch, RootState } from './store'
import type Actor from '../types/actor';
import type Fight from '../types/fight';
import type RawCompRanking from "../types/comp_rankings";
import type {
    RawCompFight,
    RawCompPlayer,
    RawCompReport,
} from "../types/comp_rankings";
import type { SpellDict } from "../types/spell";
import type { SkillCompletion } from "../types/spec_ranking";
import type SpecRanking from "../types/spec_ranking";
import { PRODUCT_CONFIG } from "../config/product";
import { WCL_URL } from "../constants";
import type { RankingMeta } from "../features/timeline-workbench/types";
import {
    assertCompFightComposition,
    buildCompCriteriaCatalog,
    compTargetKey,
    matchesCompFight,
    parseCompCriteria,
    type CompCriteria,
} from "../features/comp-reference/criteria";
import { recordDiagnostic, type DiagnosticDetails } from "../diagnostics";


////////////////////////////////////////////////////////////////////////////////
// Selectors
//

export function get_all_fights(state: RootState): { [key: number]: Fight } {
    return state.fights.fights_by_id
}


export function get_fight_ids(state: RootState) {
    return state.fights.fight_ids
}


export function get_fight_is_loaded(state: RootState, fight_id: number) {
    return state.fights.fights_by_id[fight_id] != undefined;
}


export const get_fights = createSelector(
    get_all_fights,
    (fights_by_id) => {
        return Object.values(fights_by_id)
    }
)


/** Get all specs that occur in any of the fights */
export const get_occuring_specs = createSelector(
    get_fights,
    (fights) => {

        const specs_set = new Set<string>()

        fights.forEach(fight => {
            fight.players.forEach(player => {
                specs_set.add(player.spec_slug)
            });
        })
        return Array.from(specs_set) // Set to Array
    }
)


/** Get all specs that occur in any of the fights
 * returns a list of boss_slugs
 */
export const get_occuring_bosses = createSelector(
    get_fights,
    (fights) => {

        const boss_names = new Set<string>()

        fights.forEach(fight => {
            if (fight.boss?.boss_slug) {
                boss_names.add(fight.boss.boss_slug)
            }
        })
        return Array.from(boss_names)
    }
)


const DIFFICULTY_ID_TO_NAME: Record<number, string> = {
    0: "Unknown",
    1: "LFR",
    3: "Normal",
    4: "Heroic",
    5: "Mythic",
};

export function get_difficulty_name(difficulty_id: number): string {
    return DIFFICULTY_ID_TO_NAME[difficulty_id] ?? "Unknown";
}


const DIFFICULTY_NAME_TO_ID: Record<string, number> = Object.fromEntries(
    Object.entries(DIFFICULTY_ID_TO_NAME).map(([id, name]) => [name.toLowerCase(), Number(id)])
);


export function get_difficulty_id(difficulty: string): number {
    return DIFFICULTY_NAME_TO_ID[difficulty.toLowerCase()] ?? 0;
}


////////////////////////////////////////////////////////////////////////////////
// Slice
//
function _process_actor(actor: Actor): Actor {

    const spell_counter: { [key: number]: number } = {}
    actor.class_slug = actor.class_slug || actor.spec_slug?.split("-")[0] || "other"
    actor.casts = actor.casts || []
    actor.casts.forEach(cast => {
        cast.counter = spell_counter[cast.id] = (spell_counter[cast.id] || 0) + 1
    })
    return actor
}


function is_empty_fight(fight: Fight) {

    if (fight.boss?.casts?.length) {
        return false
    }

    if (fight.players.some(player => player.casts.length > 0)) {
        return false
    }
    // sorry bro
    return true
}


function _process_fight(fight: Fight) {
    if (fight.boss) {
        fight.boss = _process_actor(fight.boss)
        fight.boss.class_slug = "boss"
        fight.boss.spec_slug = fight.boss.name
    }

    if (fight.phases) {
        let phase_id = 2;  // 1 = pull; 2 = first real phase
        fight.phases.forEach(phase => {
            phase.id = phase_id;
            phase.name = `P${phase_id}`
            phase_id++;
        })
    }


    fight.players.forEach(actor => _process_actor(actor))
    return fight
}



function _process_fights(fights: Fight[], keepEmptyFights = false) {
    fights = fights.map(fight => _process_fight(fight))
    if (!keepEmptyFights) {
        fights = fights.filter(fight => !is_empty_fight(fight))
    }
    return fights
}


export interface FightsState {
    fights_by_id: { [key: string]: Fight };
    fight_ids: string[];
    active_request_id: string | null;
    request_target: string | null;
    accepted_target: string | null;
    status: "idle" | "updating" | "ready" | "error";
    error: FightsRequestError | null;
    ranking_meta: RankingMeta | null;
}

export interface FightsRequestError {
    targetKey: string;
    message: string;
}

export function isCurrentFightsRequest(
    state: Pick<FightsState, "active_request_id" | "request_target">,
    request: { requestId: string; targetKey: string },
) {
    return state.active_request_id === request.requestId
        && state.request_target === request.targetKey;
}

const initialState: FightsState = {
    fights_by_id: {},
    fight_ids: [],
    active_request_id: null,
    request_target: null,
    accepted_target: null,
    status: "idle",
    error: null,
    ranking_meta: null,
};

function replaceFights(state: FightsState, sourceFights: Fight[], keepEmptyFights = false) {
    const fights = _process_fights(sourceFights ?? [], keepEmptyFights);
    state.fights_by_id = {};
    state.fight_ids = [];
    fights.forEach((fight) => {
        const player_id = fight.players[0]?.source_id || 0;
        const fight_key = `${fight.report_id}/${fight.fight_id}/${player_id}`;
        state.fights_by_id[fight_key] = fight;
        state.fight_ids.push(fight_key);
    });
}

const SLICE = createSlice({
    name: "fights",

    initialState,

    reducers: {
        set_fights: (state, action: PayloadAction<Fight[]>) => {
            replaceFights(state, action.payload);
            return state
        },
        fightsRequestStarted: (state, action: PayloadAction<{ requestId: string; targetKey: string }>) => {
            state.active_request_id = action.payload.requestId;
            state.request_target = action.payload.targetKey;
            state.status = "updating";
            state.error = null;
        },
        fightsRequestSucceeded: (state, action: PayloadAction<{
            requestId: string;
            targetKey: string;
            fights: Fight[];
            meta: RankingMeta | null;
            extraSpells?: SpellDict;
        }>) => {
            if (!isCurrentFightsRequest(state, action.payload)) {
                return;
            }
            replaceFights(
                state,
                action.payload.fights,
                action.payload.targetKey.startsWith("comp/"),
            );
            state.active_request_id = null;
            state.request_target = null;
            state.accepted_target = action.payload.targetKey;
            state.status = "ready";
            state.error = null;
            state.ranking_meta = action.payload.meta;
        },
        castProgressUpdated: (state, action: PayloadAction<{ targetKey: string; completion: SkillCompletion }>) => {
            if (state.accepted_target !== action.payload.targetKey || state.active_request_id || !state.ranking_meta) return;
            state.ranking_meta.skillCompletion = action.payload.completion;
        },
        castsUpdated: (state, action: PayloadAction<{ targetKey: string; fights: Fight[]; extraSpells?: SpellDict; meta: RankingMeta }>) => {
            if (state.accepted_target !== action.payload.targetKey || state.active_request_id) return;
            for (const fight of action.payload.fights) {
                const key = `${fight.report_id}/${fight.fight_id}/${fight.players[0]?.source_id || 0}`;
                const current = state.fights_by_id[key];
                if (!current) continue;
                for (const player of current.players) {
                    const incoming = fight.players.find(value => value.source_id === player.source_id);
                    if (!incoming) continue;
                    player.casts = _process_actor(incoming).casts;
                    player.casts_complete = incoming.casts_complete;
                }
            }
            state.ranking_meta = action.payload.meta;
        },
        fightsRequestFailed: (state, action: PayloadAction<{
            requestId: string;
            targetKey: string;
            error: string;
        }>) => {
            if (!isCurrentFightsRequest(state, action.payload)) {
                return;
            }
            state.active_request_id = null;
            state.request_target = null;
            state.status = "error";
            state.error = {
                targetKey: action.payload.targetKey,
                message: action.payload.error,
            };
        },
    }, // reducers

}) // slice


export const {
    set_fights,
    fightsRequestStarted,
    fightsRequestSucceeded,
    fightsRequestFailed,
    castProgressUpdated,
    castsUpdated,
} = SLICE.actions
export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

function _pin_first_fight(fights: Fight[]) {
    // little hack to make sure the first fight always remains visible
    if (fights.length == 0) { return fights }

    const [first_fight, ...others] = fights
    first_fight.pinned = true
    if (first_fight.boss) {
        first_fight.boss.pinned = true
    }

    return [first_fight, ...others]
}


async function _load_spec_rankings(
    spec_slug: string,
    boss_slug: string,
    difficulty: string,
    metric: string = "",
    signal?: AbortSignal
): Promise<{ fights: Fight[]; meta: RankingMeta; extraSpells?: SpellDict }> {

    const query = new URLSearchParams({
        difficulty: difficulty,
        metric: metric,
    })

    const url = `/api/spec_ranking/${spec_slug}/${boss_slug}?${query.toString()}`;
    const spec_ranking = await fetch_data<SpecRanking>(url, {}, { signal, cache: "no-store" });
    if (!Array.isArray(spec_ranking.reports)) {
        throw new Error("排行响应缺少 reports");
    }
    if (spec_ranking.edge_top_n !== PRODUCT_CONFIG.rankingTopN) {
        throw new Error(`排行 TopN 合同不一致: ${spec_ranking.edge_top_n ?? "missing"}`);
    }
    if (!spec_ranking.updated) {
        throw new Error("排行响应缺少 updated");
    }
    assertRankingRefresh(spec_ranking.refresh, "specRanking.refresh");

    // unpack the fights
    let fights: Fight[] = []
    spec_ranking.reports.slice(0, PRODUCT_CONFIG.rankingTopN).forEach((report, i) => {
        report.fights?.forEach(fight => {
            fight.report_id = report.report_id
            fight.boss_slug = boss_slug
            fight.start_time = fight.start_time ?? report.start_time
            fight.difficulty = fight.difficulty ?? get_difficulty_id(difficulty);
            fight.region = report.region
            fights.push(fight)
            // insert ranking data
            fight.players.forEach(player => {
                player.rank = i + 1
            })

            if (i > 0) {
                fight.boss = undefined
            }
        })
    })
    fights = _pin_first_fight(fights)
    return {
        fights,
        extraSpells: spec_ranking.extra_spells,
        meta: {
            skillCompletion: spec_ranking.skill_completion,
            updated: spec_ranking.updated,
            edgeTopN: PRODUCT_CONFIG.rankingTopN,
            sourceReportCount: spec_ranking.source_report_count ?? spec_ranking.reports.length,
            refresh: spec_ranking.refresh,
        },
    }
}


type CompLoadReason = "invalid_query" | "request_failed" | "invalid_payload";

const COMP_LOAD_MESSAGES: Record<CompLoadReason, string> = {
    invalid_query: "阵容条件无效",
    request_failed: "阵容数据请求失败",
    invalid_payload: "阵容数据格式无效",
};

class CompLoadError extends Error {
    readonly reason: CompLoadReason;

    constructor(reason: CompLoadReason) {
        super(COMP_LOAD_MESSAGES[reason]);
        this.name = "CompLoadError";
        this.reason = reason;
    }
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${path} 必须是对象`);
    }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${path} 必须是非空字符串`);
    }
}

function assertSafeNonNegativeInteger(value: unknown, path: string): asserts value is number {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw new Error(`${path} 必须是非负安全整数`);
    }
}

function assertIsoString(value: unknown, path: string): asserts value is string {
    assertNonEmptyString(value, path);
    if (Number.isNaN(Date.parse(value))) {
        throw new Error(`${path} 必须是可解析的 ISO 时间`);
    }
}

function assertNullableIsoString(value: unknown, path: string): asserts value is string | null {
    if (value !== null) assertIsoString(value, path);
}

function assertRankingRefresh(value: unknown, path: string) {
    assertRecord(value, path);
    if (value.status !== "fresh" && value.status !== "stale") {
        throw new Error(`${path}.status 必须是 fresh 或 stale`);
    }
    assertIsoString(value.checked_at, `${path}.checked_at`);
    assertNullableIsoString(value.published_at, `${path}.published_at`);
    assertNullableIsoString(value.upstream_updated, `${path}.upstream_updated`);
    if (value.last_error_code !== null && typeof value.last_error_code !== "string") {
        throw new Error(`${path}.last_error_code 必须是字符串或 null`);
    }
}

function assertOptionalSafeNonNegativeInteger(value: unknown, path: string) {
    if (value !== undefined) {
        assertSafeNonNegativeInteger(value, path);
    }
}

function assertCastArray(value: unknown, path: string) {
    if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`);
    value.forEach((rawCast, index) => {
        const castPath = `${path}[${index}]`;
        assertRecord(rawCast, castPath);
        assertSafeNonNegativeInteger(rawCast.id, `${castPath}.id`);
        assertSafeNonNegativeInteger(rawCast.ts, `${castPath}.ts`);
        assertOptionalSafeNonNegativeInteger(rawCast.d, `${castPath}.d`);
        assertOptionalSafeNonNegativeInteger(rawCast.counter, `${castPath}.counter`);
    });
}

function assertEventArray(value: unknown, path: string) {
    if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`);
    value.forEach((rawEvent, index) => {
        const eventPath = `${path}[${index}]`;
        assertRecord(rawEvent, eventPath);
        assertSafeNonNegativeInteger(rawEvent.ts, `${eventPath}.ts`);
        assertOptionalSafeNonNegativeInteger(rawEvent.spell_id, `${eventPath}.spell_id`);
        assertOptionalSafeNonNegativeInteger(rawEvent.source_id, `${eventPath}.source_id`);
    });
}

function assertRawCompPlayer(value: unknown, path: string) {
    assertRecord(value, path);
    assertSafeNonNegativeInteger(value.source_id, `${path}.source_id`);
    assertNonEmptyString(value.name, `${path}.name`);
    assertNonEmptyString(value.class_slug, `${path}.class_slug`);
    assertNonEmptyString(value.spec_slug, `${path}.spec_slug`);
    assertSafeNonNegativeInteger(value.total, `${path}.total`);
    if (value.casts !== undefined) assertCastArray(value.casts, `${path}.casts`);
    if (value.deaths !== undefined) assertEventArray(value.deaths, `${path}.deaths`);
}

function assertRawCompFight(value: unknown, path: string, expectedBoss: string) {
    assertRecord(value, path);
    assertSafeNonNegativeInteger(value.fight_id, `${path}.fight_id`);
    assertIsoString(value.start_time, `${path}.start_time`);
    assertSafeNonNegativeInteger(value.duration, `${path}.duration`);
    assertSafeNonNegativeInteger(value.damage_taken, `${path}.damage_taken`);
    assertSafeNonNegativeInteger(value.deaths, `${path}.deaths`);
    if (!Array.isArray(value.players)) throw new Error(`${path}.players 必须是数组`);
    value.players.forEach((player, index) => (
        assertRawCompPlayer(player, `${path}.players[${index}]`)
    ));
    assertRecord(value.boss, `${path}.boss`);
    if (value.boss.boss_slug !== expectedBoss) {
        throw new Error(`${path}.boss.boss_slug 与请求首领不一致`);
    }
    if (value.boss.casts !== undefined) {
        assertCastArray(value.boss.casts, `${path}.boss.casts`);
    }
    assertCompFightComposition(value);
}

function assertRawCompReport(value: unknown, path: string, expectedBoss: string) {
    assertRecord(value, path);
    assertNonEmptyString(value.report_id, `${path}.report_id`);
    assertIsoString(value.start_time, `${path}.start_time`);
    if (!Array.isArray(value.fights)) throw new Error(`${path}.fights 必须是数组`);
    value.fights.forEach((fight, index) => (
        assertRawCompFight(fight, `${path}.fights[${index}]`, expectedBoss)
    ));
}

function assertRawCompRanking(
    payload: unknown,
    expectedBoss: string,
    expectedTopN: number,
): asserts payload is RawCompRanking {
    assertRecord(payload, "compRanking");
    if (!Array.isArray(payload.reports)) throw new Error("compRanking.reports 必须是数组");
    if (payload.boss_slug !== expectedBoss) {
        throw new Error("compRanking.boss_slug 与请求首领不一致");
    }
    assertIsoString(payload.updated, "compRanking.updated");
    assertSafeNonNegativeInteger(payload.edge_top_n, "compRanking.edge_top_n");
    if (payload.edge_top_n !== expectedTopN) {
        throw new Error("compRanking.edge_top_n 与产品配置不一致");
    }
    assertSafeNonNegativeInteger(payload.source_report_count, "compRanking.source_report_count");
    assertRankingRefresh(payload.refresh, "compRanking.refresh");
    if (
        payload.reports.length > payload.edge_top_n
        || payload.reports.length > payload.source_report_count
    ) {
        throw new Error("compRanking 报告数量合同无效");
    }
    payload.reports.forEach((report, index) => (
        assertRawCompReport(report, `compRanking.reports[${index}]`, expectedBoss)
    ));
}

function normalizeCompPlayer(player: RawCompPlayer): Actor {
    return {
        source_id: player.source_id,
        name: player.name,
        spec_slug: player.spec_slug,
        class_slug: player.class_slug,
        total: player.total,
        casts: (player.casts ?? []).map((cast) => ({ ...cast })),
        deaths: (player.deaths ?? []).map((event) => ({ ...event })),
        resurrects: [],
    };
}

function normalizeCompFight(report: RawCompReport, rawFight: RawCompFight): Fight {
    return {
        fight_id: rawFight.fight_id,
        report_id: report.report_id,
        report_url: `${WCL_URL}/reports/${report.report_id}#fight=${rawFight.fight_id}`,
        start_time: rawFight.start_time,
        duration: rawFight.duration,
        difficulty: 0,
        phases: [],
        players: rawFight.players.map(normalizeCompPlayer),
        boss: {
            name: rawFight.boss.boss_slug,
            boss_slug: rawFight.boss.boss_slug,
            spec_slug: rawFight.boss.boss_slug,
            class_slug: "boss",
            total: 0,
            casts: (rawFight.boss.casts ?? []).map((cast) => ({ ...cast })),
            deaths: [],
            resurrects: [],
        },
        composition: {
            roles: { ...rawFight.composition.roles },
            specs: { ...rawFight.composition.specs },
            classes: { ...rawFight.composition.classes },
        },
    };
}

async function _load_comp_rankings(
    bossSlug: string,
    criteria: CompCriteria,
): Promise<{ fights: Fight[]; meta: RankingMeta }> {
    let payload: unknown;
    try {
        payload = await fetch_data<unknown>(`/api/comp_ranking/${bossSlug}`);
    } catch {
        throw new CompLoadError("request_failed");
    }

    try {
        assertRawCompRanking(payload, bossSlug, PRODUCT_CONFIG.rankingTopN);
        const fights = payload.reports
            .flatMap((report) => report.fights.map((fight) => normalizeCompFight(report, fight)))
            .filter((fight) => matchesCompFight(fight, criteria));
        return {
            fights: _pin_first_fight(fights),
            meta: {
                updated: payload.updated,
                edgeTopN: PRODUCT_CONFIG.rankingTopN,
                sourceReportCount: payload.source_report_count,
                refresh: payload.refresh,
            },
        };
    } catch {
        throw new CompLoadError("invalid_payload");
    }
}


export function load_fights(
    mode: string,
    { boss_slug, spec_slug = "", difficulty = "mythic", metric = "dps", search = "" }: { boss_slug: string, spec_slug?: string, difficulty?: string, metric?: string, search?: string }
) {

    return async (dispatch: AppDispatch, getState: () => RootState) => {
        if (mode !== MODES.SPEC_RANKING && mode !== MODES.COMP_RANKING) {
            return;
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let targetKey: string;
        let compCriteria: CompCriteria | null = null;
        let invalidCompRequest = false;

        if (mode === MODES.SPEC_RANKING) {
            targetKey = `${boss_slug}/${spec_slug}/${difficulty}/${metric}`;
        } else {
            const state = getState();
            const catalog = buildCompCriteriaCatalog(state.roles, state.specs.specs_by_name);
            const parsed = parseCompCriteria(search, catalog);
            targetKey = compTargetKey(boss_slug, parsed.criteria);
            compCriteria = parsed.criteria;
            invalidCompRequest = parsed.errors.length > 0
                || !Object.prototype.hasOwnProperty.call(state.zones.bosses, boss_slug);
        }

        const diagnosticDetails: DiagnosticDetails = mode === MODES.SPEC_RANKING
            ? { request_id: requestId, target: targetKey, mode }
            : { requestId, targetKey, boss: boss_slug };

        dispatch(fightsRequestStarted({ requestId, targetKey }));
        if (mode === MODES.SPEC_RANKING) {
            recordDiagnostic("target_request_started", diagnosticDetails);
        } else {
            recordDiagnostic("comp_search_submitted", diagnosticDetails);
            if (invalidCompRequest) {
                const error = new CompLoadError("invalid_query");
                dispatch(fightsRequestFailed({ requestId, targetKey, error: error.message }));
                recordDiagnostic("comp_search_failed", {
                    ...diagnosticDetails,
                    reason: error.reason,
                });
                return;
            }
        }

        try {
            let result: { fights: Fight[]; meta: RankingMeta };
            if (mode === MODES.SPEC_RANKING) {
                result = await _load_spec_rankings(spec_slug, boss_slug, difficulty, metric);
            } else {
                if (compCriteria === null) throw new CompLoadError("invalid_query");
                result = await _load_comp_rankings(boss_slug, compCriteria);
            }
            const requestState = getState().fights;
            if (!isCurrentFightsRequest(requestState, { requestId, targetKey })) {
                recordDiagnostic(
                    "target_request_discarded",
                    mode === MODES.SPEC_RANKING
                        ? { ...diagnosticDetails, outcome: "succeeded" }
                        : { requestId, targetKey },
                );
                return;
            }

            dispatch(fightsRequestSucceeded({ requestId, targetKey, ...result }));
            if (mode === MODES.SPEC_RANKING) {
                recordDiagnostic("target_request_accepted", {
                    ...diagnosticDetails,
                    count: result.fights.length,
                });
            } else {
                recordDiagnostic(
                    result.fights.length === 0 ? "comp_search_empty" : "comp_search_succeeded",
                    diagnosticDetails,
                );
            }
        } catch (error) {
            const requestState = getState().fights;
            if (!isCurrentFightsRequest(requestState, { requestId, targetKey })) {
                recordDiagnostic(
                    "target_request_discarded",
                    mode === MODES.SPEC_RANKING
                        ? { ...diagnosticDetails, outcome: "failed" }
                        : { requestId, targetKey },
                );
                return;
            }

            if (mode === MODES.SPEC_RANKING) {
                const reason = error instanceof Error ? error.message : String(error);
                dispatch(fightsRequestFailed({ requestId, targetKey, error: reason }));
                recordDiagnostic("target_request_failed", diagnosticDetails);
            } else {
                const compError = error instanceof CompLoadError
                    ? error
                    : new CompLoadError("invalid_payload");
                dispatch(fightsRequestFailed({ requestId, targetKey, error: compError.message }));
                recordDiagnostic("comp_search_failed", {
                    ...diagnosticDetails,
                    reason: compError.reason,
                });
            }
        }
    } // async dispatch
}


export function load_report_fights(report_id: string, search: string = "") {

    return async (dispatch: AppDispatch) => {
        dispatch({ type: "ui/set_loading", payload: { key: "fights", value: true } })

        try {
            const url = `/api/user_reports/${report_id}/fights`;
            const report_data = await fetch_data(url, search)

            // insert report id (for urls)
            report_data.fights?.forEach((fight: Fight) => {
                fight.report_id = report_id
            })

            dispatch(set_fights(report_data.fights))
        } catch {
            dispatch(set_fights([]))
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "fights", value: false } })
        }
    }
}

export function refreshCastDetails(targetKey: string, signal: AbortSignal) {
    return async (dispatch: AppDispatch, getState: () => RootState) => {
        const [boss, spec, difficulty, metric] = targetKey.split("/");
        const result = await _load_spec_rankings(spec, boss, difficulty, metric, signal);
        if (signal.aborted || getState().fights.accepted_target !== targetKey || getState().fights.active_request_id) return;
        // A new leaderboard must go through normal navigation; never label old rows with new completion.
        const keys = result.fights.map(fight => `${fight.report_id}/${fight.fight_id}/${fight.players[0]?.source_id || 0}`);
        if (keys.join("|") !== getState().fights.fight_ids.join("|")) throw new Error("ranking_changed");
        dispatch(castsUpdated({ targetKey, ...result }));
        return result.meta.skillCompletion;
    };
}
