import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../diagnostics";
import type { DiagnosticDetails, DiagnosticEvent } from "../diagnostics";
import type { RawCompFight, RawCompRanking } from "../types/comp_rankings";
import type Fight from "../types/fight";
import { catalogsAccepted, type CatalogsAcceptedPayload } from "./catalogCommit";
import reducer, {
    fightsRequestFailed,
    fightsRequestStarted,
    fightsRequestSucceeded,
    load_fights,
    load_report_fights,
    set_fights,
} from "./fights";
import { appReducer } from "./store";
import { MODES } from "./ui";

const acceptedTarget = "imperator-averzian/deathknight-blood/mythic/dps";
const requestTarget = "plexus-sentinel/mage-fire/mythic/dps";
const refresh = {
    status: "fresh" as const,
    checked_at: "2026-07-10T08:00:00.000Z",
    published_at: "2026-07-10T07:15:00.000Z",
    upstream_updated: "2026-07-10T07:15:00.000Z",
    last_error_code: null,
};
const meta = {
    updated: "2026-07-10T07:15:00.000Z",
    edgeTopN: 10 as const,
    sourceReportCount: 10,
    refresh,
};

function fight(name: string, id: number, spellId = 12_345): Fight {
    return {
        fight_id: id,
        report_id: `report-${id}`,
        report_url: `https://www.warcraftlogs.com/reports/report-${id}`,
        duration: 90_000,
        difficulty: 5,
        phases: [],
        players: [{
            name,
            spec_slug: "deathknight-blood",
            class_slug: "deathknight",
            total: 100_000,
            casts: [{ id: spellId, ts: 10_000 }],
            deaths: [],
            resurrects: [],
        }],
    };
}

function readyState() {
    const loading = reducer(undefined, fightsRequestStarted({
        requestId: "seed",
        targetKey: acceptedTarget,
    }));
    return reducer(loading, fightsRequestSucceeded({
        requestId: "seed",
        targetKey: acceptedTarget,
        fights: [fight("已接收玩家", 1)],
        meta,
    }));
}

function rankingPayload(name: string, id: number, spellId: number) {
    return {
        edge_top_n: 10,
        updated: "2026-07-10T07:15:00.000Z",
        source_report_count: 1,
        refresh,
        reports: [{
            report_id: `report-${id}`,
            zone_id: 46.1,
            start_time: "2026-07-10T07:15:00.000Z",
            players: [],
            fights: [fight(name, id, spellId)],
        }],
    };
}

function compCatalogs(bossSlugs = ["vorasius", "boss-a", "boss-b"]): CatalogsAcceptedPayload {
    return {
        classes: {
            deathknight: {
                name: "Death Knight",
                name_slug: "deathknight",
                color: "#C41E3A",
                specs: ["deathknight-blood"],
                spec_ids: [250],
            },
            mage: {
                name: "Mage",
                name_slug: "mage",
                color: "#3FC7EB",
                specs: ["mage-fire"],
                spec_ids: [63],
            },
        },
        roles: [
            {
                id: 1,
                code: "tank",
                name: "Tank",
                specs: ["deathknight-blood"],
                spec_ids: [250],
                metrics: ["dps"],
            },
            {
                id: 4,
                code: "rdps",
                name: "Ranged DPS",
                specs: ["mage-fire"],
                spec_ids: [63],
                metrics: ["dps"],
            },
        ],
        specs: [
            {
                id: 250,
                index: 1,
                class: { name: "Death Knight", name_slug: "deathknight" },
                role: "tank",
                name: "Blood",
                full_name: "Blood Death Knight",
                full_name_slug: "deathknight-blood",
            },
            {
                id: 63,
                index: 1,
                class: { name: "Mage", name_slug: "mage" },
                role: "rdps",
                name: "Fire",
                full_name: "Fire Mage",
                full_name_slug: "mage-fire",
            },
        ],
        seasons: {
            name: "测试赛季",
            slug: "test-season",
            raids: [46.1],
        },
        bosses: [{
            id: 46.1,
            name: "测试副本",
            name_slug: "test-raid",
            bosses: bossSlugs.map((bossSlug, index) => ({
                id: 1_000 + index,
                name: bossSlug,
                full_name: bossSlug,
                full_name_slug: bossSlug,
                icon: `${bossSlug}.jpg`,
                phase_type: "static" as const,
            })),
        }],
    };
}

function makeCompStore(bossSlugs?: string[]) {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(catalogsAccepted(compCatalogs(bossSlugs)));
    return store;
}

function rawCompFight(fightId: number, tankCount: number, duration = 287_000): RawCompFight {
    const tanks = Array.from({ length: tankCount }, (_, index) => ({
        source_id: index + 1,
        casts: [{ id: 48_765 + index, ts: 10_000 + index }],
        name: `坦克 ${fightId}-${index + 1}`,
        class_slug: "deathknight",
        spec_slug: "deathknight-blood",
        total: 800_000 - index,
        deaths: [],
    }));
    const players = [
        ...tanks,
        {
            source_id: 100 + fightId,
            casts: [{ id: 12_345 + fightId, ts: 20_000 }],
            name: `远程 ${fightId}`,
            class_slug: "mage",
            spec_slug: "mage-fire",
            total: 1_200_000,
            deaths: [],
        },
    ];

    return {
        fight_id: fightId,
        start_time: `2026-07-10T07:${String(10 + fightId).padStart(2, "0")}:00.000Z`,
        duration,
        players,
        boss: {
            casts: [{ id: 90_000 + fightId, ts: 30_000 }],
            boss_slug: "vorasius",
        },
        composition: {
            roles: {
                ...(tankCount > 0 ? { tank: tankCount } : {}),
                rdps: 1,
            },
            specs: {
                ...(tankCount > 0 ? { "deathknight-blood": tankCount } : {}),
                "mage-fire": 1,
            },
            classes: {
                ...(tankCount > 0 ? { deathknight: tankCount } : {}),
                mage: 1,
            },
        },
        damage_taken: 100_000 + fightId,
        deaths: 0,
    };
}

function compPayload(
    bossSlug = "vorasius",
    fights: RawCompFight[] = [rawCompFight(1, 2)],
): RawCompRanking {
    return {
        boss_slug: bossSlug,
        updated: "2026-07-10T07:15:00.000Z",
        edge_top_n: 10,
        source_report_count: 10,
        refresh,
        reports: fights.map((rawFight) => ({
            report_id: `report-${rawFight.fight_id}`,
            start_time: rawFight.start_time,
            fights: [rawFight],
        })),
    };
}

function payloadWithFirstFight(fightValue: unknown): unknown {
    const payload = compPayload();
    return {
        ...payload,
        reports: [{
            ...payload.reports[0],
            fights: [fightValue],
        }],
    };
}

function invalidCompPayloads(): Array<[string, unknown]> {
    const missingSourceCount = structuredClone(compPayload()) as Partial<RawCompRanking>;
    delete missingSourceCount.source_report_count;

    const missingFights = structuredClone(compPayload()) as unknown as {
        reports: Array<{ fights?: RawCompFight[] }>;
    };
    delete missingFights.reports[0].fights;

    const missingReportStart = structuredClone(compPayload()) as unknown as {
        reports: Array<{ start_time?: string }>;
    };
    delete missingReportStart.reports[0].start_time;

    const missingComposition = structuredClone(rawCompFight(1, 2)) as Partial<RawCompFight>;
    delete missingComposition.composition;

    const nullPlayerCasts = structuredClone(rawCompFight(1, 2)) as unknown as {
        players: Array<{ casts: unknown }>;
    };
    nullPlayerCasts.players[0].casts = null;

    const badCastDuration = structuredClone(rawCompFight(1, 2)) as unknown as {
        players: Array<{ casts: Array<{ d?: unknown }> }>;
    };
    badCastDuration.players[0].casts[0].d = "bad";

    const badCastCounter = structuredClone(rawCompFight(1, 2)) as unknown as {
        players: Array<{ casts: Array<{ counter?: unknown }> }>;
    };
    badCastCounter.players[0].casts[0].counter = null;

    const badEventSpellId = structuredClone(rawCompFight(1, 2)) as unknown as {
        players: Array<{ deaths: unknown[] }>;
    };
    badEventSpellId.players[0].deaths = [{ ts: 10_000, spell_id: "bad" }];

    const badEventSourceId = structuredClone(rawCompFight(1, 2)) as unknown as {
        players: Array<{ deaths: unknown[] }>;
    };
    badEventSourceId.players[0].deaths = [{ ts: 10_000, source_id: null }];

    const badReportStart = structuredClone(compPayload());
    badReportStart.reports[0].start_time = "not-an-iso-date";

    const sourceBelowReports = { ...compPayload(), source_report_count: 0 };
    const overTopN = compPayload(
        "vorasius",
        Array.from({ length: 11 }, (_, index) => rawCompFight(index + 1, 2)),
    );
    overTopN.source_report_count = 11;

    return [
        ["null 顶层", null],
        ["错误首领身份", { ...compPayload(), boss_slug: "other-boss" }],
        ["缺少 source_report_count", missingSourceCount],
        ["缺少 report.fights", missingFights],
        ["缺少 report.start_time", missingReportStart],
        ["坏 report.start_time", badReportStart],
        ["缺少 composition", payloadWithFirstFight(missingComposition)],
        ["player.casts 不是数组", payloadWithFirstFight(nullPlayerCasts)],
        ["cast.d 类型错误", payloadWithFirstFight(badCastDuration)],
        ["cast.counter 类型错误", payloadWithFirstFight(badCastCounter)],
        ["event.spell_id 类型错误", payloadWithFirstFight(badEventSpellId)],
        ["event.source_id 类型错误", payloadWithFirstFight(badEventSourceId)],
        ["source_report_count 小于 reports 数量", sourceBelowReports],
        ["reports 超过 edge_top_n", overTopN],
    ];
}

function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function deferredResponse() {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((next) => {
        resolve = next;
    });
    return { promise, resolve };
}

afterEach(() => {
    setDiagnosticSinkForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("通用战斗请求 reducer", () => {
    it("发起新目标时写入请求所有权并保留已接收数据", () => {
        const previous = readyState();
        const loading = reducer(previous, fightsRequestStarted({
            requestId: "next",
            targetKey: requestTarget,
        }));

        expect(loading.active_request_id).toBe("next");
        expect(loading.request_target).toBe(requestTarget);
        expect(loading.accepted_target).toBe(acceptedTarget);
        expect(loading.fights_by_id).toBe(previous.fights_by_id);
        expect(loading.fight_ids).toBe(previous.fight_ids);
        expect(loading.ranking_meta).toBe(previous.ranking_meta);
        expect(loading.status).toBe("updating");
        expect(loading.error).toBeNull();
    });

    it("成功必须同时匹配请求 ID 与目标键", () => {
        const loading = reducer(readyState(), fightsRequestStarted({
            requestId: "next",
            targetKey: requestTarget,
        }));
        const payload = {
            requestId: "next",
            targetKey: requestTarget,
            fights: [fight("新玩家", 2)],
            meta,
        };

        expect(reducer(loading, fightsRequestSucceeded({ ...payload, requestId: "stale" }))).toBe(loading);
        expect(reducer(loading, fightsRequestSucceeded({ ...payload, targetKey: acceptedTarget }))).toBe(loading);

        const ready = reducer(loading, fightsRequestSucceeded(payload));
        expect(Object.values(ready.fights_by_id)[0].players[0].name).toBe("新玩家");
        expect(ready.accepted_target).toBe(requestTarget);
        expect(ready.ranking_meta).toEqual(meta);
        expect(ready.active_request_id).toBeNull();
        expect(ready.request_target).toBeNull();
        expect(ready.status).toBe("ready");
    });

    it("失败必须同时匹配所有权，并保留上一份战斗、元信息与目标", () => {
        const previous = readyState();
        const loading = reducer(previous, fightsRequestStarted({
            requestId: "next",
            targetKey: requestTarget,
        }));
        const payload = { requestId: "next", targetKey: requestTarget, error: "网络请求失败" };

        expect(reducer(loading, fightsRequestFailed({ ...payload, requestId: "stale" }))).toBe(loading);
        expect(reducer(loading, fightsRequestFailed({ ...payload, targetKey: acceptedTarget }))).toBe(loading);

        const failed = reducer(loading, fightsRequestFailed(payload));
        expect(failed.fights_by_id).toBe(previous.fights_by_id);
        expect(failed.fight_ids).toBe(previous.fight_ids);
        expect(failed.ranking_meta).toBe(previous.ranking_meta);
        expect(failed.accepted_target).toBe(acceptedTarget);
        expect(failed.error).toEqual({ targetKey: requestTarget, message: "网络请求失败" });
        expect(failed.active_request_id).toBeNull();
        expect(failed.request_target).toBeNull();
        expect(failed.status).toBe("error");
    });

    it("阵容空结果以 meta null 原子清除旧战斗", () => {
        const loading = reducer(readyState(), fightsRequestStarted({
            requestId: "comp",
            targetKey: "comp/imperator-averzian?role=healer",
        }));
        const ready = reducer(loading, fightsRequestSucceeded({
            requestId: "comp",
            targetKey: "comp/imperator-averzian?role=healer",
            fights: [],
            meta: null,
        }));

        expect(ready.fight_ids).toEqual([]);
        expect(ready.fights_by_id).toEqual({});
        expect(ready.ranking_meta).toBeNull();
        expect(ready.accepted_target).toBe("comp/imperator-averzian?role=healer");
        expect(ready.status).toBe("ready");
    });
});

describe("通用战斗请求 thunk", () => {
    it("缺少 refresh 合同的专精排行必须拒绝", async () => {
        const { refresh: _missingRefresh, ...payload } = rankingPayload("玩家 A", 1, 11_111);
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload)));
        const store = configureStore({ reducer: appReducer });

        await store.dispatch(load_fights(MODES.SPEC_RANKING, {
            boss_slug: "boss-a",
            spec_slug: "spec-a",
        }));

        expect(store.getState().fights.status).toBe("error");
        expect(store.getState().fights.ranking_meta).toBeNull();
    });

    it("后发目标先完成后，旧成功被丢弃且战斗与技能都保持新目标", async () => {
        const requestA = deferredResponse();
        const requestB = deferredResponse();
        vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            return url.includes("/spec-a/") ? requestA.promise : requestB.promise;
        }));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = configureStore({ reducer: appReducer });

        const pendingA = store.dispatch(load_fights(MODES.SPEC_RANKING, {
            boss_slug: "boss-a",
            spec_slug: "spec-a",
        }));
        const pendingB = store.dispatch(load_fights(MODES.SPEC_RANKING, {
            boss_slug: "boss-b",
            spec_slug: "spec-b",
        }));

        requestB.resolve(jsonResponse(rankingPayload("玩家 B", 2, 22_222)));
        await pendingB;
        requestA.resolve(jsonResponse(rankingPayload("玩家 A", 1, 11_111)));
        await pendingA;

        const state = store.getState();
        expect(state.fights.accepted_target).toBe("boss-b/spec-b/mythic/dps");
        expect(Object.values(state.fights.fights_by_id)[0].players[0].name).toBe("玩家 B");
        expect(state.spells.used_spell_ids).toEqual([22_222]);
        expect(diagnostics.filter(({ event }) => event === "target_request_accepted")).toHaveLength(1);
        expect(diagnostics.find(({ event }) => event === "target_request_accepted")?.details.target)
            .toBe("boss-b/spec-b/mythic/dps");
        expect(diagnostics.filter(({ event }) => event === "target_request_discarded")).toHaveLength(1);
        expect(diagnostics.find(({ event }) => event === "target_request_discarded")?.details.target)
            .toBe("boss-a/spec-a/mythic/dps");
        expect(Object.hasOwn(state.ui._loading, "fights")).toBe(false);
    });

    it("当前 Top10 失败归属目标，诊断不泄露接口 URL、玩家名或响应对象", async () => {
        const secretUrl = "https://www.warcraftlogs.com/reports/SECRET";
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
            detail: `玩家 SecretPlayer 的 ${secretUrl} 请求失败`,
            response: { players: [{ name: "SecretPlayer" }] },
        }, 500)));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = configureStore({ reducer: appReducer });

        await store.dispatch(load_fights(MODES.SPEC_RANKING, {
            boss_slug: "boss-failed",
            spec_slug: "spec-failed",
        }));

        expect(store.getState().fights.error?.targetKey).toBe("boss-failed/spec-failed/mythic/dps");
        const failed = diagnostics.filter(({ event }) => event === "target_request_failed");
        expect(failed).toHaveLength(1);
        const serialized = JSON.stringify(failed[0].details);
        expect(serialized).not.toContain(secretUrl);
        expect(serialized).not.toContain("SecretPlayer");
        expect(serialized).not.toContain("players");
        expect(Object.hasOwn(store.getState().ui._loading, "fights")).toBe(false);
    });

    it("阵容请求读取静态快照，在客户端过滤并原子接收规范目标", async () => {
        const fetchMock = vi.fn(async () => jsonResponse(compPayload(
            "vorasius",
            [rawCompFight(1, 2), rawCompFight(2, 1)],
        )));
        vi.stubGlobal("fetch", fetchMock);
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?spec=mage-fire.gte.1&role=tank.eq.2",
        }));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/log/api/comp_ranking/vorasius");
        expect(store.getState().fights.accepted_target).toBe(
            "comp/vorasius?role=tank.eq.2&spec=mage-fire.gte.1",
        );
        expect(store.getState().fights.ranking_meta).toEqual({
            updated: "2026-07-10T07:15:00.000Z",
            edgeTopN: 10,
            sourceReportCount: 10,
            refresh,
        });
        expect(store.getState().fights.status).toBe("ready");
        const loaded = Object.values(store.getState().fights.fights_by_id);
        expect(loaded).toHaveLength(1);
        expect(loaded[0]).toMatchObject({
            fight_id: 1,
            report_id: "report-1",
            report_url: "https://www.warcraftlogs.com/reports/report-1#fight=1",
            start_time: "2026-07-10T07:11:00.000Z",
            duration: 287_000,
            difficulty: 0,
            phases: [],
            composition: {
                roles: { tank: 2, rdps: 1 },
                specs: { "deathknight-blood": 2, "mage-fire": 1 },
                classes: { deathknight: 2, mage: 1 },
            },
        });
        expect(loaded[0].players[0].resurrects).toEqual([]);
        expect(Object.hasOwn(loaded[0].players[0], "rank")).toBe(false);
        expect(loaded[0].boss).toMatchObject({
            name: "vorasius",
            boss_slug: "vorasius",
            class_slug: "boss",
            total: 0,
            deaths: [],
            resurrects: [],
        });
        expect(Object.hasOwn(store.getState().ui._loading, "fights")).toBe(false);
        const requestId = diagnostics[0]?.details.requestId;
        expect(typeof requestId).toBe("string");
        expect(diagnostics).toEqual([
            {
                event: "comp_search_submitted",
                details: {
                    requestId,
                    targetKey: "comp/vorasius?role=tank.eq.2&spec=mage-fire.gte.1",
                    boss: "vorasius",
                },
            },
            {
                event: "comp_search_succeeded",
                details: {
                    requestId,
                    targetKey: "comp/vorasius?role=tank.eq.2&spec=mage-fire.gte.1",
                    boss: "vorasius",
                },
            },
        ]);
    });

    it("合法条件无匹配时接收真实 meta 并记录 empty", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(compPayload())));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?role=tank.eq.9",
        }));

        expect(store.getState().fights.fight_ids).toEqual([]);
        expect(store.getState().fights.ranking_meta?.sourceReportCount).toBe(10);
        const requestId = diagnostics[0]?.details.requestId;
        expect(diagnostics).toEqual([
            {
                event: "comp_search_submitted",
                details: {
                    requestId,
                    targetKey: "comp/vorasius?role=tank.eq.9",
                    boss: "vorasius",
                },
            },
            {
                event: "comp_search_empty",
                details: {
                    requestId,
                    targetKey: "comp/vorasius?role=tank.eq.9",
                    boss: "vorasius",
                },
            },
        ]);
    });

    it("源样本少于 TopN 且施法为空时仍接收合法阵容", async () => {
        const emptyCastFight = rawCompFight(1, 2);
        emptyCastFight.boss.casts = [];
        emptyCastFight.players.forEach((player) => {
            player.casts = [];
        });
        const payload = compPayload("vorasius", [emptyCastFight]);
        payload.source_report_count = 1;
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload)));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: "vorasius" }));

        expect(store.getState().fights.status).toBe("ready");
        expect(store.getState().fights.fight_ids).toHaveLength(1);
        expect(store.getState().fights.ranking_meta).toEqual({
            updated: "2026-07-10T07:15:00.000Z",
            edgeTopN: 10,
            sourceReportCount: 1,
            refresh,
        });
        expect(diagnostics.map(({ event }) => event)).toEqual([
            "comp_search_submitted",
            "comp_search_succeeded",
        ]);
    });

    it("上游省略空施法与死亡数组时规范为空数组", async () => {
        const compactFight = rawCompFight(1, 2);
        delete compactFight.boss.casts;
        compactFight.players.forEach((player) => {
            delete player.casts;
            delete player.deaths;
        });
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(
            compPayload("vorasius", [compactFight]),
        )));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: "vorasius" }));

        const state = store.getState().fights;
        expect(state.status).toBe("ready");
        const fight = state.fights_by_id[state.fight_ids[0]];
        expect(fight.boss?.casts).toEqual([]);
        expect(fight.players.every((player) => (
            player.casts.length === 0 && player.deaths.length === 0
        ))).toBe(true);
    });

    it.each([
        "?role=tank.ne.2",
        "?role=unknown.eq.1",
        "?spec=missing.eq.0",
        "?token=x",
    ])("非法阵容查询 %s 不发请求并分类为 invalid_query", async (search) => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search,
        }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(store.getState().fights.status).toBe("error");
        expect(store.getState().fights.error).toEqual({
            targetKey: "comp/vorasius",
            message: "阵容条件无效",
        });
        const requestId = diagnostics[0]?.details.requestId;
        const details = {
            requestId,
            targetKey: "comp/vorasius",
            boss: "vorasius",
        };
        expect(diagnostics).toEqual([
            { event: "comp_search_submitted", details },
            { event: "comp_search_failed", details: { ...details, reason: "invalid_query" } },
        ]);
    });

    it("目录外首领不发请求并分类为 invalid_query", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore(["vorasius"]);

        await store.dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: "unknown-boss" }));

        expect(fetchMock).not.toHaveBeenCalled();
        const requestId = diagnostics[0]?.details.requestId;
        const details = {
            requestId,
            targetKey: "comp/unknown-boss",
            boss: "unknown-boss",
        };
        expect(diagnostics).toEqual([
            { event: "comp_search_submitted", details },
            { event: "comp_search_failed", details: { ...details, reason: "invalid_query" } },
        ]);
    });

    it.each(invalidCompPayloads())("坏阵容载荷：%s 分类为 invalid_payload", async (_label, payload) => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload)));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: "vorasius" }));

        expect(store.getState().fights.error).toEqual({
            targetKey: "comp/vorasius",
            message: "阵容数据格式无效",
        });
        const requestId = diagnostics[0]?.details.requestId;
        const details = {
            requestId,
            targetKey: "comp/vorasius",
            boss: "vorasius",
        };
        expect(diagnostics).toEqual([
            { event: "comp_search_submitted", details },
            { event: "comp_search_failed", details: { ...details, reason: "invalid_payload" } },
        ]);
    });

    it("阵容接口失败分类为 request_failed 且不泄露响应正文", async () => {
        const secret = "SecretPlayer https://www.warcraftlogs.com/reports/SECRET";
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: secret }, 500)));
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        await store.dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: "vorasius" }));

        expect(store.getState().fights.error).toEqual({
            targetKey: "comp/vorasius",
            message: "阵容数据请求失败",
        });
        const requestId = diagnostics[0]?.details.requestId;
        const details = {
            requestId,
            targetKey: "comp/vorasius",
            boss: "vorasius",
        };
        expect(diagnostics).toEqual([
            { event: "comp_search_submitted", details },
            { event: "comp_search_failed", details: { ...details, reason: "request_failed" } },
        ]);
        expect(JSON.stringify(diagnostics)).not.toContain(secret);
        expect(diagnostics.some(({ event }) => event === "target_request_failed")).toBe(false);
    });

    it("同首领不同查询并发时，过期成功只发通用 discarded", async () => {
        const requestA = deferredResponse();
        const requestB = deferredResponse();
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => requestA.promise)
            .mockImplementationOnce(() => requestB.promise);
        vi.stubGlobal("fetch", fetchMock);
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        const pendingA = store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?role=tank.eq.2",
        }));
        const pendingB = store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?role=tank.eq.1",
        }));
        requestB.resolve(jsonResponse(compPayload("vorasius", [rawCompFight(2, 1)])));
        await pendingB;
        requestA.resolve(jsonResponse(compPayload("vorasius", [rawCompFight(1, 2)])));
        await pendingA;

        expect(diagnostics.filter(({ event }) => event === "comp_search_submitted")).toHaveLength(2);
        expect(diagnostics.filter(({ event, details }) => (
            (event === "comp_search_succeeded"
                || event === "comp_search_empty"
                || event === "comp_search_failed")
            && details.targetKey === "comp/vorasius?role=tank.eq.2"
        ))).toEqual([]);
        expect(diagnostics.filter(({ event, details }) => (
            event === "comp_search_succeeded" && details.targetKey === "comp/vorasius?role=tank.eq.1"
        ))).toHaveLength(1);
        expect(diagnostics.filter(({ event, details }) => (
            event === "target_request_discarded" && details.targetKey === "comp/vorasius?role=tank.eq.2"
        ))).toHaveLength(1);
        expect(store.getState().fights.accepted_target).toBe("comp/vorasius?role=tank.eq.1");
        expect(Object.values(store.getState().fights.fights_by_id)[0].composition?.roles.tank).toBe(1);
    });

    it("同首领不同查询并发时，过期失败不记录 comp 终态", async () => {
        const requestA = deferredResponse();
        const requestB = deferredResponse();
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => requestA.promise)
            .mockImplementationOnce(() => requestB.promise);
        vi.stubGlobal("fetch", fetchMock);
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const store = makeCompStore();

        const pendingA = store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?role=tank.eq.2",
        }));
        const pendingB = store.dispatch(load_fights(MODES.COMP_RANKING, {
            boss_slug: "vorasius",
            search: "?role=tank.eq.9",
        }));
        requestB.resolve(jsonResponse(compPayload()));
        await pendingB;
        requestA.resolve(jsonResponse({ detail: "SecretPlayer 失败" }, 500));
        await pendingA;

        expect(diagnostics.filter(({ event, details }) => (
            (event === "comp_search_succeeded"
                || event === "comp_search_empty"
                || event === "comp_search_failed")
            && details.targetKey === "comp/vorasius?role=tank.eq.2"
        ))).toEqual([]);
        expect(diagnostics.filter(({ event, details }) => (
            event === "comp_search_empty" && details.targetKey === "comp/vorasius?role=tank.eq.9"
        ))).toHaveLength(1);
        expect(diagnostics.filter(({ event, details }) => (
            event === "target_request_discarded"
            && details.targetKey === "comp/vorasius?role=tank.eq.2"
        ))).toHaveLength(1);
        expect(JSON.stringify(diagnostics)).not.toContain("SecretPlayer");
    });

    it("报告旧路径不进入目标诊断链", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
            fights: [fight("报告玩家", 6, 66_666)],
        })));
        const diagnostics: DiagnosticEvent[] = [];
        setDiagnosticSinkForTests((event) => diagnostics.push(event));
        const store = configureStore({ reducer: appReducer });

        await store.dispatch(load_report_fights("REPORT-6"));

        expect(Object.values(store.getState().fights.fights_by_id)[0].report_id).toBe("REPORT-6");
        expect(store.getState().spells.used_spell_ids).toEqual([66_666]);
        expect(diagnostics).toEqual([]);
    });

    it("未知模式零请求且不改变状态", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const store = configureStore({ reducer: appReducer });
        store.dispatch(set_fights([fight("保留玩家", 9)]));
        const previous = store.getState();

        await store.dispatch(load_fights("unknown", { boss_slug: "boss" }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(store.getState()).toBe(previous);
    });
});
