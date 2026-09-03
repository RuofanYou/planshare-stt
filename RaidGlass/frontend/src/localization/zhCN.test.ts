import { describe, expect, it } from "vitest";

import { bossDisplayName } from "./bossNames";
import { specDisplayName, ZH_CN } from "./zhCN";

describe("简体中文文案权威", () => {
    it("包含核心作业台文案", () => {
        expect(ZH_CN.workbench.copyTop10).toBe("复制 Top10 作业");
        expect(ZH_CN.workbench.updating).toBe("正在更新");
        expect(ZH_CN.workbench.crossTargetLoading("目标 B", "目标 A"))
            .toBe("正在载入 目标 B；当前继续显示 目标 A");
        expect(ZH_CN.workbench.loadTargetFailed("目标 B", "请求失败"))
            .toBe("载入 目标 B失败：请求失败");
        expect(ZH_CN.settings.timeline).toBe("时间轴");
        expect(ZH_CN.settings.spells).toBe("技能选择");
        expect(ZH_CN.settings.region).toBe("地区");
        expect(ZH_CN.settings.killtime).toBe("击杀时间");
        expect(ZH_CN.settings.dateRange).toBe("日期范围");
        expect(ZH_CN.shell.skipToMain).toBe("跳到主要内容");
        expect(ZH_CN.footer.versionBuild("release", "build")).toBe("版本 release · 构建 build");
        expect(ZH_CN.workbench.metricNames.dps).toBe("伤害");
        expect(ZH_CN.comp.countCriterion("坦克", ZH_CN.comp.criteriaOperators.gte, 2))
            .toBe("坦克 至少2人");
        expect(ZH_CN.comp.killtimeRange("1:30", "2:00")).toBe("击杀时间 1:30–2:00");
        expect(ZH_CN.timelineText.fightSummary(1, "CN", "1:30.0", "https://example.test/report"))
            .toContain("报告地址 https://example.test/report");
        expect(ZH_CN.timelineText.actorIdentity("boss", "沃拉修斯", null, "0"))
            .toBe("首领 沃拉修斯");
        expect(ZH_CN.timelineText.actorIdentity("player", "玩家甲", 1, "100k"))
            .toBe("玩家 玩家甲，排名 1，数值 100k");
    });

    it("首领和专精读取同一中文源", () => {
        expect(bossDisplayName({ full_name_slug: "imperator-averzian" })).toBe("阿维兹安大帝");
        expect(specDisplayName({ full_name_slug: "deathknight-blood", full_name: "Blood Death Knight" })).toBe("鲜血死亡骑士");
    });
});
