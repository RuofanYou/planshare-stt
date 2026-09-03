import { describe, expect, it } from "vitest";

import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import { timelineTargetKey, type TimelineTarget } from "./types";
import {
    resolveTimelineTargetRoute,
    timelineTargetFromKey,
    timelineTargetUrl,
    type TimelineCatalogs,
} from "./targetRouting";

const catalogs: TimelineCatalogs = {
    bosses: {
        "imperator-averzian": {
            full_name_slug: "imperator-averzian",
            full_name: "Imperator Averzian",
        } as Boss,
        lura: {
            full_name_slug: "lura",
            full_name: "L'ura",
        } as Boss,
    },
    specs: {
        "deathknight-blood": {
            full_name_slug: "deathknight-blood",
            full_name: "Blood Death Knight",
            role: "tank",
        } as Spec,
        "priest-holy": {
            full_name_slug: "priest-holy",
            full_name: "Holy Priest",
            role: "heal",
        } as Spec,
    },
};

const damageTarget: TimelineTarget = {
    bossSlug: "imperator-averzian",
    bossName: "阿维兹安大帝",
    specSlug: "deathknight-blood",
    specName: "鲜血死亡骑士",
    difficulty: "mythic",
    metric: "dps",
};

describe("timelineTargetUrl", () => {
    it("按 difficulty、metric 的固定顺序序列化规范地址", () => {
        expect(timelineTargetUrl(damageTarget)).toBe(
            "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps",
        );
    });
});

describe("resolveTimelineTargetRoute", () => {
    it("接受完整且规范的目标地址", () => {
        expect(resolveTimelineTargetRoute({
            pathname: "/spec_ranking/deathknight-blood/imperator-averzian",
            search: "?difficulty=mythic&metric=dps",
            catalogs,
        })).toEqual({ kind: "valid", target: damageTarget });
    });

    it("为非治疗专精补齐 mythic 与 dps，并要求 replace 到规范地址", () => {
        expect(resolveTimelineTargetRoute({
            pathname: "/spec_ranking/deathknight-blood/imperator-averzian",
            search: "",
            catalogs,
        })).toEqual({
            kind: "redirect",
            target: damageTarget,
            to: "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps",
        });
    });

    it("为治疗专精补齐 hps，同时保留有效难度", () => {
        expect(resolveTimelineTargetRoute({
            pathname: "/spec_ranking/priest-holy/lura",
            search: "?difficulty=heroic",
            catalogs,
        })).toEqual({
            kind: "redirect",
            target: {
                bossSlug: "lura",
                bossName: "鲁拉",
                specSlug: "priest-holy",
                specName: "神圣牧师",
                difficulty: "heroic",
                metric: "hps",
            },
            to: "/spec_ranking/priest-holy/lura?difficulty=heroic&metric=hps",
        });
    });

    it("移除额外查询键并恢复固定查询顺序", () => {
        expect(resolveTimelineTargetRoute({
            pathname: "/spec_ranking/deathknight-blood/imperator-averzian",
            search: "?metric=dps&utm_source=legacy&difficulty=mythic",
            catalogs,
        })).toEqual({
            kind: "redirect",
            target: damageTarget,
            to: "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps",
        });
    });

    it.each([
        ["无效难度", "?difficulty=normal&metric=dps"],
        ["无效指标", "?difficulty=mythic&metric=damage"],
    ])("%s 返回 not-found", (_name, search) => {
        expect(resolveTimelineTargetRoute({
            pathname: "/spec_ranking/deathknight-blood/imperator-averzian",
            search,
            catalogs,
        })).toEqual({
            kind: "not-found",
            address: `/spec_ranking/deathknight-blood/imperator-averzian${search}`,
        });
    });

    it.each([
        ["未知首领", "/spec_ranking/deathknight-blood/unknown-boss"],
        ["未知专精", "/spec_ranking/unknown-spec/imperator-averzian"],
    ])("%s 返回 not-found", (_name, pathname) => {
        expect(resolveTimelineTargetRoute({
            pathname,
            search: "?difficulty=mythic&metric=dps",
            catalogs,
        })).toEqual({
            kind: "not-found",
            address: `${pathname}?difficulty=mythic&metric=dps`,
        });
    });

    it("目录尚未加载时让根路由等待", () => {
        expect(resolveTimelineTargetRoute({ pathname: "/", search: "", catalogs: null }))
            .toEqual({ kind: "pending" });
    });

    it("目录加载后让根路由 replace 到第一个规范目标", () => {
        expect(resolveTimelineTargetRoute({ pathname: "/", search: "", catalogs })).toEqual({
            kind: "redirect",
            target: damageTarget,
            to: "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps",
        });
    });
});

describe("timelineTargetFromKey", () => {
    it("与 timelineTargetKey 的 boss/spec/difficulty/metric 格式精确往返", () => {
        const targetKey = timelineTargetKey(damageTarget);

        expect(targetKey).toBe("imperator-averzian/deathknight-blood/mythic/dps");
        expect(timelineTargetFromKey(targetKey, catalogs)).toEqual(damageTarget);
    });

    it.each([
        "imperator-averzian/deathknight-blood/mythic",
        "unknown-boss/deathknight-blood/mythic/dps",
        "imperator-averzian/deathknight-blood/normal/dps",
        "imperator-averzian/deathknight-blood/mythic/damage",
    ])("拒绝无法解析的目标键 %s", (targetKey) => {
        expect(timelineTargetFromKey(targetKey, catalogs)).toBeNull();
    });
});
