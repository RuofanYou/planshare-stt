type BossLike = {
    full_name?: string;
    full_name_slug?: string;
    boss_slug?: string;
    name?: string;
} | null | undefined;

import { ZH_CN } from "./zhCN";

function normalizeBossKey(value = "") {
    return value
        .trim()
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/\s*&\s*/g, "-")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function bossKey(boss: BossLike) {
    if (!boss) {
        return "";
    }
    return normalizeBossKey(boss.full_name_slug || boss.boss_slug || boss.full_name || boss.name || "");
}

export function bossDisplayName(boss: BossLike) {
    if (!boss) {
        return "等待首领数据";
    }
    const key = bossKey(boss);
    return ZH_CN.bossNames[key] || boss.full_name || boss.name || "等待首领数据";
}

export function bossShortName(boss: BossLike) {
    if (!boss) {
        return "首领";
    }
    const key = bossKey(boss);
    return ZH_CN.bossShortNames[key] || ZH_CN.bossNames[key] || boss.full_name || boss.name || "首领";
}
