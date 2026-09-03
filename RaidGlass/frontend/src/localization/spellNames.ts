import spellNames from "./spellNames.zhCN.json";

const HAS_HAN = /[\u3400-\u9fff]/;

/**
 * 当前 RaidGlass 技能集合的简体中文名称权威。
 *
 * 数据源：Wago Tools SpellName DB2，构建 12.1.0.68629，zhCN，访问日期 2026-07-11。
 * 该静态快照由人工更新，线上刷新链不访问 Wago。
 */
export const SPELL_NAMES_ZH_CN: Readonly<Record<string, string>> = spellNames;

export function spellNameZhCN(spellId: number, fallback = "") {
    const officialName = SPELL_NAMES_ZH_CN[String(spellId)];
    if (officialName && HAS_HAN.test(officialName)) {
        return officialName;
    }
    if (HAS_HAN.test(fallback)) {
        return fallback;
    }
    return `未知技能（${spellId}）`;
}
