import { describe, expect, it } from "vitest";

import spellNames from "./spellNames.zhCN.json";
import { spellNameZhCN } from "./spellNames";

const HAS_HAN = /[\u3400-\u9fff]/;

describe("技能简体中文名", () => {
    it("读取当前赛季首领技能的官方简中名", () => {
        expect(spellNameZhCN(1249265, "Umbral Collapse")).toBe("幽影坍缩");
        expect(spellNameZhCN(1251361, "Shadow's Advance")).toBe("暗影进军");
        expect(spellNameZhCN(1258880, "Voidfall")).toBe("虚空坠落");
        expect(spellNameZhCN(1260712, "Obliteration's Wrath")).toBe("湮灭之怒");
    });

    it("本地静态映射只包含中文可读名称", () => {
        expect(Object.keys(spellNames).length).toBeGreaterThanOrEqual(795);
        expect(Object.values(spellNames).every((name) => HAS_HAN.test(name))).toBe(true);
    });

    it("未知英文名使用带技能 ID 的中文占位", () => {
        expect(spellNameZhCN(999999999, "Untranslated Spell")).toBe("未知技能（999999999）");
    });

    it("未知但已有中文的名称保持原文", () => {
        expect(spellNameZhCN(999999998, "测试技能")).toBe("测试技能");
    });
});
