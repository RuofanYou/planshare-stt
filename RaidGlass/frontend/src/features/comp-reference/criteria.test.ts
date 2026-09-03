import { describe, expect, it } from "vitest";

import type Fight from "../../types/fight";
import {
    assertCompFightComposition,
    buildCompCriteriaCatalog,
    buildCompReferencePath,
    compTargetKey,
    matchesCompFight,
    parseCompCriteria,
    parseCompTargetKey,
    serializeCompCriteria,
    type CompCriteria,
    type CompOperator,
} from "./criteria";

const catalog = buildCompCriteriaCatalog(
    {
        tank: { code: "tank" },
        heal: { code: "heal" },
        mdps: { code: "mdps" },
        rdps: { code: "rdps" },
    },
    {
        "mage-fire": { full_name_slug: "mage-fire" },
        "paladin-holy": { full_name_slug: "paladin-holy" },
    },
);

const compFight: Fight = {
    fight_id: 15,
    report_id: "report-1",
    report_url: "https://www.warcraftlogs.com/reports/report-1#fight=15",
    duration: 287_000,
    difficulty: 0,
    phases: [],
    players: [],
    composition: {
        roles: { tank: 2, heal: 4, mdps: 4, rdps: 10 },
        specs: { "mage-fire": 1 },
        classes: { mage: 1 },
    },
};

describe("buildCompCriteriaCatalog", () => {
    it("以 bootstrap role/spec 目录的键为唯一允许集合", () => {
        const result = buildCompCriteriaCatalog(
            { tank: { code: "ignored-field-value" }, heal: {} },
            { "mage-fire": { full_name_slug: "ignored-field-value" } },
        );

        expect([...result.roleKeys]).toEqual(["tank", "heal"]);
        expect([...result.specKeys]).toEqual(["mage-fire"]);
        expect(result.roleKeys.has("ignored-field-value")).toBe(false);
        expect(result.specKeys.has("ignored-field-value")).toBe(false);
    });
});

describe("parseCompCriteria", () => {
    it("解析所有允许操作符并保留零人数条件", () => {
        const operators: CompOperator[] = ["eq", "lt", "gt", "lte", "gte"];

        operators.forEach((op) => {
            const result = parseCompCriteria(`?role=tank.${op}.0`, catalog);

            expect(result).toEqual({
                criteria: {
                    counts: [{ group: "role", key: "tank", op, count: 0 }],
                    killtimeMinSeconds: null,
                    killtimeMaxSeconds: null,
                },
                errors: [],
            });
        });
    });

    it("拒绝未知参数、操作符和目录外的键", () => {
        const result = parseCompCriteria(
            "?role=tank.ne.2&role=unknown.eq.1&spec=missing.eq.0&token=x",
            catalog,
        );

        expect(result.errors).toEqual([
            "role 条件格式无效: tank.ne.2",
            "未知职责条件: unknown",
            "未知专精条件: missing",
            "未知阵容参数: token",
        ]);
        expect(result.criteria.counts).toEqual([]);
    });

    it("拒绝同组重复键和重复时长参数，保留首个合法值", () => {
        const result = parseCompCriteria(
            "?role=tank.eq.2&role=tank.gte.1"
            + "&spec=mage-fire.eq.1&spec=mage-fire.lt.2"
            + "&killtime_min=200&killtime_min=250"
            + "&killtime_max=300&killtime_max=350",
            catalog,
        );

        expect(result.errors).toEqual([
            "重复阵容条件: role.tank",
            "重复阵容条件: spec.mage-fire",
            "重复阵容参数: killtime_min",
            "重复阵容参数: killtime_max",
        ]);
        expect(result.criteria).toEqual({
            counts: [
                { group: "role", key: "tank", op: "eq", count: 2 },
                { group: "spec", key: "mage-fire", op: "eq", count: 1 },
            ],
            killtimeMinSeconds: 200,
            killtimeMaxSeconds: 300,
        });
    });

    it.each(["-1", "1.5", "NaN", "9007199254740992"])(
        "拒绝非安全非负整数的人数 %s",
        (count) => {
            const value = `tank.eq.${count}`;

            expect(parseCompCriteria(`?role=${value}`, catalog).errors).toEqual([
                `role 条件格式无效: ${value}`,
            ]);
        },
    );

    it.each(["-1", "1.5", "NaN", "9007199254740992"])(
        "拒绝非安全非负整数的击杀时长 %s",
        (seconds) => {
            expect(parseCompCriteria(`?killtime_min=${seconds}`, catalog).errors).toEqual([
                "killtime_min 必须是非负整数秒",
            ]);
        },
    );

    it("接受零秒作为空边界，不把它序列化为有效筛选", () => {
        const result = parseCompCriteria("?killtime_min=0&killtime_max=0", catalog);

        expect(result).toEqual({
            criteria: {
                counts: [],
                killtimeMinSeconds: null,
                killtimeMaxSeconds: null,
            },
            errors: [],
        });
        expect(serializeCompCriteria(result.criteria)).toBe("");
    });

    it("拒绝最短时长大于最长时长", () => {
        const result = parseCompCriteria("?killtime_min=400&killtime_max=300", catalog);

        expect(result.errors).toEqual(["最短击杀时间不能大于最长击杀时间"]);
        expect(result.criteria.killtimeMinSeconds).toBe(400);
        expect(result.criteria.killtimeMaxSeconds).toBe(300);
    });
});

describe("serializeCompCriteria", () => {
    it("按 group、key、operator、count 稳定排序，且不改写输入", () => {
        const criteria: CompCriteria = {
            counts: [
                { group: "spec", key: "mage-fire", op: "gte", count: 1 },
                { group: "role", key: "tank", op: "eq", count: 2 },
                { group: "role", key: "heal", op: "lt", count: 5 },
            ],
            killtimeMinSeconds: 280,
            killtimeMaxSeconds: 300,
        };
        const originalCounts = [...criteria.counts];

        expect(serializeCompCriteria(criteria)).toBe(
            "role=heal.lt.5&role=tank.eq.2&spec=mage-fire.gte.1&killtime_min=280&killtime_max=300",
        );
        expect(criteria.counts).toEqual(originalCounts);
    });
});

describe("matchesCompFight", () => {
    it("按秒和人数执行全部条件，并把缺失键视为零", () => {
        const accepted = parseCompCriteria(
            "?role=tank.eq.2&spec=paladin-holy.eq.0&killtime_min=280&killtime_max=300",
            catalog,
        ).criteria;
        const rejectedByCount = parseCompCriteria("?role=tank.gt.2", catalog).criteria;
        const rejectedByDuration = parseCompCriteria("?killtime_max=280", catalog).criteria;

        expect(matchesCompFight(compFight, accepted)).toBe(true);
        expect(matchesCompFight(compFight, rejectedByCount)).toBe(false);
        expect(matchesCompFight(compFight, rejectedByDuration)).toBe(false);
    });

    it.each([
        undefined,
        { roles: {}, specs: {}, classes: undefined },
        { roles: { tank: -1 }, specs: {}, classes: {} },
        { roles: {}, specs: { "mage-fire": 1.5 }, classes: {} },
        { roles: {}, specs: {}, classes: { mage: Number.NaN } },
    ])("拒绝缺失或坏 composition: %j", (composition) => {
        const malformed = { ...compFight, composition } as Fight;

        expect(() => assertCompFightComposition(malformed))
            .toThrow("阵容样本 composition 无效");
        expect(() => matchesCompFight(malformed, parseCompCriteria("", catalog).criteria))
            .toThrow("阵容样本 composition 无效");
    });
});

describe("阵容路径与 target key", () => {
    const criteria = parseCompCriteria(
        "?spec=mage-fire.gte.1&role=tank.eq.2",
        catalog,
    ).criteria;
    const bossKeys = new Set(["vorasius", "vaelgor-&-ezzorak"]);

    it("生成固定排序的相对路径和 target key，保留目录中的首领 slug", () => {
        expect(buildCompReferencePath("vorasius", criteria)).toBe(
            "/comp_ranking/vorasius?role=tank.eq.2&spec=mage-fire.gte.1",
        );
        expect(compTargetKey("vorasius", criteria)).toBe(
            "comp/vorasius?role=tank.eq.2&spec=mage-fire.gte.1",
        );
        expect(buildCompReferencePath("vaelgor-&-ezzorak", criteria)).toBe(
            "/comp_ranking/vaelgor-&-ezzorak?role=tank.eq.2&spec=mage-fire.gte.1",
        );
        expect(buildCompReferencePath("vorasius", parseCompCriteria("", catalog).criteria)).toBe(
            "/comp_ranking/vorasius",
        );
        expect(compTargetKey("vorasius", parseCompCriteria("", catalog).criteria)).toBe(
            "comp/vorasius",
        );
    });

    it("对规范 target key 做精确往返", () => {
        const targetKey = compTargetKey("vaelgor-&-ezzorak", criteria);

        expect(parseCompTargetKey(targetKey, catalog, bossKeys)).toEqual({
            bossSlug: "vaelgor-&-ezzorak",
            criteria,
        });
        expect(parseCompTargetKey("comp/vorasius", catalog, bossKeys)).toEqual({
            bossSlug: "vorasius",
            criteria: parseCompCriteria("", catalog).criteria,
        });
    });

    it.each([
        "spec/mage-fire/vorasius/mythic/dps",
        "comp/unknown?role=tank.eq.2",
        "comp/vorasius?spec=mage-fire.gte.1&role=tank.eq.2",
        "comp/vorasius?role=tank.ne.2",
        "comp/vorasius?role=tank.eq.2&role=tank.gte.1",
        "comp/vorasius?token=x",
        "comp/vorasius?",
        "comp/vorasius?killtime_min=0",
    ])("拒绝非规范或无效 target key: %s", (targetKey) => {
        expect(parseCompTargetKey(targetKey, catalog, bossKeys)).toBeNull();
    });
});
