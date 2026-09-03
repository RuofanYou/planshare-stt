import { describe, expect, it } from "vitest";

import FILTERS, {
    buildTimelineVisibility,
    is_fight_content_visible,
} from "./filter_logic";
import type { FilterValues } from "./store/ui";
import type Actor from "./types/actor";
import type Fight from "./types/fight";

function filters(overrides: Partial<FilterValues> = {}): FilterValues {
    return {
        killtime: { min: null, max: null },
        log_date: { from: null, to: null },
        role: {},
        spec: {},
        class: {},
        region: {},
        hide_empty_rows: false,
        ...overrides,
    };
}

function actor(overrides: Partial<Actor> = {}): Actor {
    return {
        name: "玩家",
        spec_slug: "mage-fire",
        class_slug: "mage",
        role: "rdps",
        total: 100,
        casts: [{ id: 100, ts: 1_000 }],
        deaths: [],
        resurrects: [],
        ...overrides,
    };
}

function fight(overrides: Partial<Fight> = {}): Fight {
    return {
        fight_id: 1,
        report_id: "report-1",
        report_url: "https://www.warcraftlogs.com/reports/report-1",
        duration: 90_000,
        difficulty: 5,
        phases: [],
        players: [actor()],
        region: "EU",
        start_time: "2026-07-10T12:00:00.000Z",
        ...overrides,
    };
}

describe("战斗内容筛选", () => {
    it("固定标记只影响时间轴视觉，不绕过内容匹配", () => {
        const pinnedFight = fight({ pinned: true, players: [] });
        const pinnedPlayer = fight({
            players: [actor({ pinned: true, class_slug: "mage" })],
        });
        const pinnedBoss = fight({
            boss: actor({ pinned: true, class_slug: "boss", spec_slug: "boss" }),
            players: [],
        });

        expect(FILTERS.is_fight_visible(pinnedFight, filters(), {})).toBe(true);
        expect(is_fight_content_visible(pinnedFight, filters(), {})).toBe(false);

        const hiddenMage = filters({ class: { mage: false } });
        expect(FILTERS.is_fight_visible(pinnedPlayer, hiddenMage, {})).toBe(true);
        expect(is_fight_content_visible(pinnedPlayer, hiddenMage, {})).toBe(false);

        expect(FILTERS.is_fight_visible(pinnedBoss, filters(), {})).toBe(true);
        expect(is_fight_content_visible(pinnedBoss, filters(), {})).toBe(false);
    });

    it("只以玩家命中决定内容可见", () => {
        const bossOnly = fight({
            boss: actor({ class_slug: "boss", spec_slug: "boss" }),
            players: [],
        });

        expect(is_fight_content_visible(bossOnly, filters(), {})).toBe(false);
        expect(is_fight_content_visible(fight(), filters(), {})).toBe(true);
    });

    it("hide_empty_rows 使用调用方传入的 spellDisplay", () => {
        const hideEmpty = filters({ hide_empty_rows: true });
        const source = fight();

        expect(is_fight_content_visible(source, hideEmpty, { 100: false })).toBe(false);
        expect(is_fight_content_visible(source, hideEmpty, { 100: true })).toBe(true);
        expect(is_fight_content_visible(source, hideEmpty, {})).toBe(true);
    });

    it.each([
        ["最短击杀时间", filters({ killtime: { min: 100, max: null } })],
        ["最长击杀时间", filters({ killtime: { min: null, max: 80 } })],
        ["地区", filters({ region: { EU: false } })],
        ["开始日期", filters({ log_date: { from: "2026-07-11", to: null } })],
        ["结束日期", filters({ log_date: { from: null, to: "2026-07-09" } })],
        ["职责", filters({ role: { rdps: false } })],
        ["职业", filters({ class: { mage: false } })],
        ["专精", filters({ spec: { "mage-fire": false } })],
    ])("内容匹配执行%s筛选", (_name, currentFilters) => {
        expect(is_fight_content_visible(fight(), currentFilters, {})).toBe(false);
    });

    it("战斗级筛选全部通过时保留玩家内容", () => {
        const matching = filters({
            killtime: { min: 80, max: 100 },
            log_date: { from: "2026-07-10", to: "2026-07-10" },
            region: { EU: true },
            role: { rdps: true },
            class: { mage: true },
            spec: { "mage-fire": true },
            hide_empty_rows: true,
        });

        expect(is_fight_content_visible(fight(), matching, { 100: true })).toBe(true);
    });

    it("用同一 Fight 和 Actor 引用生成首领在前的可见行", () => {
        const boss = actor({
            name: "vorasius",
            boss_slug: "vorasius",
            spec_slug: "vorasius",
            class_slug: "boss",
            role: undefined,
            casts: [],
        });
        const visiblePlayer = actor({ name: "可见玩家", casts: [{ id: 100, ts: 1_000 }] });
        const spellHiddenPlayer = actor({
            name: "技能隐藏玩家",
            spec_slug: "priest-holy",
            class_slug: "priest",
            role: "heal",
            casts: [{ id: 200, ts: 2_000 }],
        });
        const classHiddenPlayer = actor({
            name: "职业隐藏玩家",
            spec_slug: "rogue-outlaw",
            class_slug: "rogue",
            role: "mdps",
            casts: [{ id: 300, ts: 3_000 }],
        });
        const sourceFight = fight({
            boss,
            players: [visiblePlayer, spellHiddenPlayer, classHiddenPlayer],
        });
        const visibility = buildTimelineVisibility(
            [sourceFight],
            filters({
                killtime: { min: 80, max: 100 },
                region: { EU: true },
                class: { rogue: false },
                hide_empty_rows: true,
            }),
            { 100: true, 200: false, 300: true },
        );

        expect(visibility.fights).toHaveLength(1);
        expect(visibility.fights[0].fight).toBe(sourceFight);
        expect(visibility.fights[0].actors).toEqual([
            { actor: boss, kind: "boss" },
            { actor: visiblePlayer, kind: "player" },
        ]);
        expect(visibility.fights[0].actors[0].actor).toBe(boss);
        expect(visibility.fights[0].actors[1].actor).toBe(visiblePlayer);
        expect(visibility.hiddenPlayerCount).toBe(2);
    });

    it("首领可见时仍以玩家内容决定战斗是否可见", () => {
        const boss = actor({
            name: "vorasius",
            boss_slug: "vorasius",
            spec_slug: "vorasius",
            class_slug: "boss",
            role: undefined,
        });
        const sourceFight = fight({ boss, players: [actor()] });
        const visibility = buildTimelineVisibility(
            [sourceFight],
            filters({ class: { mage: false } }),
            { 100: true },
        );

        expect(visibility.fights).toEqual([]);
        expect(visibility.hiddenPlayerCount).toBe(1);
    });
});
