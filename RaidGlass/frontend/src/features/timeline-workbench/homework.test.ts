import { describe, expect, it } from "vitest";

import { buildTimelineVisibility } from "../../filter_logic";
import { createDefaultFilters } from "../../store/ui";
import type Fight from "../../types/fight";
import type { SpellDict } from "../../types/spell";
import {
    buildHomeworkExport,
    buildHomeworkSnapshot,
    buildTimelineTextSnapshot,
} from "./homework";
import type { TimelineTarget } from "./types";

const target: TimelineTarget = {
    bossSlug: "imperator-averzian",
    bossName: "帝国大帝阿维兹安",
    specSlug: "deathknight-blood",
    specName: "鲜血死亡骑士",
    difficulty: "mythic",
    metric: "dps",
};

function makeFights(count: number): Fight[] {
    return Array.from({ length: count }, (_, index) => ({
        fight_id: index + 1,
        report_id: `report-${index + 1}`,
        report_url: `https://www.warcraftlogs.com/reports/report-${index + 1}`,
        duration: 90_000,
        difficulty: 5,
        phases: [],
        players: [{
            name: `玩家${index + 1}`,
            rank: index + 1,
            spec_slug: "deathknight-blood",
            class_slug: "deathknight",
            total: 100_000,
            casts: [{ id: 12345, ts: 10_000 }],
            deaths: [],
            resurrects: [],
        }],
    }));
}

const spells = {
    12345: {
        spell_id: 12345,
        spell_type: "deathknight-blood",
        name: "反魔法护罩",
        color: "#ffffff",
        cooldown: 60,
        duration: 5,
        icon: "spell.jpg",
        icon_path: "/spell.jpg",
        show: true,
    },
} satisfies SpellDict;

function homeworkSnapshot(spellDisplay: Record<number, boolean | undefined> = {}) {
    const visibility = buildTimelineVisibility(
        makeFights(12),
        createDefaultFilters(),
        spellDisplay,
    );
    return buildHomeworkSnapshot({
        target,
        visibility,
        spellDisplay,
        spells,
        updated: "2026-07-18T00:00:00.000Z",
    });
}

describe("buildHomeworkExport", () => {
    it("复制内容固定为 Top10 且使用中文字段", () => {
        const snapshot = homeworkSnapshot();
        const text = buildHomeworkExport(snapshot);

        expect(snapshot.fights).toHaveLength(10);
        expect(snapshot.fights[0]).toMatchObject({ rank: 1, region: "未标注" });
        expect(snapshot.fights[0].actors[0]).toMatchObject({
            kind: "player",
            rank: 1,
            name: "玩家1",
            value: 100_000,
        });
        expect(snapshot.fights[0].actors[0].events[0]).toMatchObject({
            spellId: 12345,
            spellName: "反魔法护罩",
            timeMs: 10_000,
            timeLabel: "00:10.0",
        });
        expect(text).toContain("RaidGlass Top10 时间轴作业");
        expect(text).not.toContain("高手时间轴");
        expect(text).toContain("首领：帝国大帝阿维兹安");
        expect(text).toContain("专精：鲜血死亡骑士");
        expect(text).toContain("难度：史诗");
        expect(text).toContain("#10 玩家10");
        expect(text).not.toContain("Boss:");
        expect(text).not.toContain("#11 玩家11");
    });

    it("隐藏的技能不会进入复制文本", () => {
        const text = buildHomeworkExport(homeworkSnapshot({ 12345: false }));

        expect(text).not.toContain("{spell:12345}");
    });

    it("阵容文字摘要规范化首领与全部可见玩家事件", () => {
        const sourceFight = makeFights(1)[0];
        sourceFight.region = "CN";
        sourceFight.boss = {
            name: "vorasius",
            boss_slug: "vorasius",
            spec_slug: "vorasius",
            class_slug: "boss",
            total: 0,
            casts: [{ id: 12345, ts: 5_000 }],
            deaths: [],
            resurrects: [],
        };
        delete (sourceFight.boss as { total?: number }).total;
        sourceFight.players.push({
            name: "玩家乙",
            spec_slug: "priest-holy",
            class_slug: "priest",
            total: 80_000,
            casts: [{ id: 12345, ts: 20_000 }],
            deaths: [],
            resurrects: [],
        });
        const visibility = buildTimelineVisibility(
            [sourceFight],
            createDefaultFilters(),
            {},
        );
        const snapshot = buildTimelineTextSnapshot({
            title: "沃拉修斯",
            context: "坦克 2人；治疗至少4人",
            visibility,
            spellDisplay: {},
            spells,
            updated: "2026-07-18T00:00:00.000Z",
        });

        expect(snapshot.title).toBe("沃拉修斯");
        expect(snapshot.fights[0].actors.map(({ name }) => name)).toEqual([
            "沃拉修斯",
            "玩家1",
            "玩家乙",
        ]);
        expect(snapshot.fights[0].actors[0].value).toBe(0);
        expect(snapshot.fights[0].actors.flatMap(({ events }) => events)).toHaveLength(3);
        expect(JSON.stringify(snapshot)).not.toContain("vorasius");
    });
});
