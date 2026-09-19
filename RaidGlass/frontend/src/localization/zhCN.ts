type SpecLike = {
    full_name_slug?: string;
    full_name?: string;
} | null | undefined;

export const ZH_CN = Object.freeze({
    shell: {
        brand: "RaidGlass",
        brandHome: "RaidGlass 首页",
        tagline: "顶榜时间轴参考库",
        timeline: "Top10 时间轴",
        comp: "阵容参考",
        primaryNavigation: "主导航",
        mainContent: "主要内容",
        skipToMain: "跳到主要内容",
    },
    footer: {
        sourcePrefix: "数据来自",
        rights: "图标与游戏素材版权归对应权利方所有。",
        supportNavigation: "辅助导航",
        help: "使用帮助",
        versionBuild: (releaseId: string, buildId: string) => (
            `版本 ${releaseId} · 构建 ${buildId}`
        ),
        published: "发布",
    },
    workbench: {
        title: "Top10 技能时间轴",
        eyebrow: "顶榜实战参考",
        pageDescription: "选择首领与专精，拖动时间轴查看顶榜玩家的关键技能节奏。",
        timelineHint: "拖动或 ← → 平移 · Ctrl/⌘ + 滚轮缩放 · + / − 缩放 · 0 重置",
        currentTarget: "当前目标",
        dataTime: "数据时间",
        reportCount: "来源报告",
        visiblePlayers: "当前可见玩家",
        updating: "正在更新",
        loading: "正在加载数据",
        retry: "重试",
        copyTop10: "复制 Top10 作业",
        copied: "Top10 作业已复制",
        copiedShort: "已复制",
        copyFailed: "复制失败，请稍后重试",
        timelineLoadFailed: "时间轴加载失败",
        initialLoading: (target: string) => `正在载入 ${target}`,
        crossTargetLoading: (request: string, accepted: string) => (
            `正在载入 ${request}；当前继续显示 ${accepted}`
        ),
        refreshingTarget: (target: string) => `正在更新 ${target}`,
        refreshTargetFailed: (target: string, reason: string) => `更新 ${target}失败：${reason}`,
        loadTargetFailed: (target: string, reason: string) => `载入 ${target}失败：${reason}`,
        targetEmpty: "当前目标暂无 Top10 样本",
        filterEmpty: "当前筛选隐藏了全部玩家",
        clearFilters: "清除筛选",
        timelineTextLabel: "Top10 时间轴文字摘要",
        fresh: "数据正常",
        stale: "数据已过期",
        status: "状态",
        metricNames: {
            dps: "伤害",
            bossdps: "首领伤害",
            hps: "治疗",
        },
    },
    selector: {
        currentTargetAndDifficulty: "当前目标与难度",
        boss: "首领",
        class: "职业",
        spec: "专精",
        difficulty: "难度",
        mythic: "史诗难度",
        heroic: "英雄难度",
    },
    settings: {
        advanced: "筛选与显示",
        advancedDescription: "调整时间轴显示和样本筛选。",
        timeline: "时间轴",
        spells: "技能选择",
        region: "地区",
        killtime: "击杀时间",
        dateRange: "日期范围",
        spellIcons: "技能图标",
        castTime: "释放时间",
        duration: "持续时间",
        cooldown: "冷却时间",
        deaths: "死亡",
        phases: "阶段",
        zoomIn: "放大",
        zoomOut: "缩小",
        zoomReset: "重置视图",
        timelineTools: "时间轴工具",
        panControls: "时间轴移动",
        zoomControls: "时间轴缩放",
        panLeft: "向左平移",
        panRight: "向右平移",
        fromDate: "开始日期",
        toDate: "结束日期",
        datePlaceholder: "年/月/日",
        allSpells: "全部技能",
        damageSpells: "伤害技能",
        defensiveSpells: "防御技能",
        tankSpells: "坦克技能",
        healingSpells: "治疗技能",
        movementSpells: "位移技能",
        dynamicCooldown: "该技能显示的冷却时间为估算值。",
    },
    timelineText: {
        actorIdentity: (
            kind: "boss" | "player",
            name: string,
            rank: number | null,
            value: string,
        ) => {
            if (kind === "boss") return `首领 ${name}`;
            const rankLabel = rank === null ? "" : `，排名 ${rank}`;
            return `玩家 ${name}${rankLabel}，数值 ${value}`;
        },
        fightSummary: (rank: number, region: string, duration: string, reportUrl: string) => (
            `第 ${rank} 场 · 地区 ${region} · 击杀时长 ${duration} · 报告地址 ${reportUrl}`
        ),
        dataTime: (updated: string) => `数据时间 ${updated}`,
        hiddenPlayers: (count: number) => `已隐藏 ${count} 名玩家`,
        updateSummary: (fightCount: number, hiddenPlayerCount: number) => (
            `时间轴摘要已更新：显示 ${fightCount} 场，隐藏 ${hiddenPlayerCount} 名玩家`
        ),
    },
    copyNote: {
        title: "复制单人作业",
        close: "关闭复制作业",
        playerName: "玩家姓名",
        playerNamePlaceholder: "姓名或昵称（可选）",
        text: "作业文本",
        copy: "复制 STT 格式",
        copied: "已复制",
        copyFailed: "复制失败，请重试。",
    },
    comp: {
        title: "阵容参考",
        introTitle: "三步找到合适的团队阵容",
        introDescription: "先选首领，再添加常用职责条件；专精和击杀时长按需展开。",
        chooseBoss: "选择首领",
        chooseBossDescription: "按副本查看当前可用的首领，每次只选一个。",
        criteriaTitle: "设置阵容条件",
        criteriaDescription: "人数条件全部可选，留空时查看该首领的所有公开阵容。",
        roleCounts: "职责人数",
        moreFilters: "更多筛选",
        specCounts: "专精人数",
        killtime: "击杀时间",
        resultTitle: "确认并查看结果",
        resultDescription: "检查当前摘要，然后前往公开阵容结果。",
        boss: "首领",
        criteria: "阵容条件",
        anyComp: "不限阵容",
        criteriaOperators: {
            eq: "",
            lt: "少于",
            gt: "多于",
            lte: "最多",
            gte: "至少",
        } as Record<"eq" | "lt" | "gt" | "lte" | "gte", string>,
        countCriterion: (name: string, operator: string, count: number) => (
            `${name} ${operator}${count}人`
        ),
        killtimeRange: (min: string, max: string) => `击杀时间 ${min}–${max}`,
        killtimeAtLeast: (min: string) => `击杀时间至少 ${min}`,
        killtimeAtMost: (max: string) => `击杀时间最多 ${max}`,
        changeCriteria: "修改条件",
        loadingTitle: "正在载入阵容参考",
        loadingDescription: "正在读取当前首领与阵容条件的公开 Top10 样本。",
        switchingDescription: "正在载入新条件，当前继续显示已接收的阵容参考。",
        emptyTitle: "没有匹配的阵容",
        emptyDescription: "当前公开 Top10 样本中没有符合条件的阵容",
        errorTitle: "阵容参考载入失败",
        errorDescription: "阵容数据暂时无法读取，请重试。",
        retry: "重试",
        timelineSettingsTitle: "时间轴设置",
        timelineSettingsDescription: "调整阵容时间轴的显示内容与技能开关。",
        openTimelineSettings: "时间轴设置",
        timelinePanelLabel: "阵容时间轴",
        timelineTextLabel: "阵容时间轴文字摘要",
        dataSummary: (updated: string | null, reportCount: number | null) => {
            const time = updated || "时间待更新";
            const reports = reportCount === null ? "报告数待更新" : `来源报告 ${reportCount}`;
            return `${time} · ${reports}`;
        },
        submit: "查看阵容参考",
        submitDescription: "将带着当前条件打开公开阵容结果；未填写的条件不会参与筛选。",
        roles: {
            tank: "坦克",
            heal: "治疗",
            mdps: "近战输出",
            rdps: "远程输出",
        } as Record<string, string>,
    },
    regionNames: {
        US: "美服",
        EU: "欧服",
        KR: "韩服",
        TW: "台服",
        CN: "国服",
    } as Record<string, string>,
    classNames: {
        deathknight: "死亡骑士",
        demonhunter: "恶魔猎手",
        druid: "德鲁伊",
        evoker: "唤魔师",
        hunter: "猎人",
        mage: "法师",
        monk: "武僧",
        paladin: "圣骑士",
        priest: "牧师",
        rogue: "潜行者",
        shaman: "萨满祭司",
        warlock: "术士",
        warrior: "战士",
    } as Record<string, string>,
    specNames: {
        "deathknight-blood": "鲜血死亡骑士",
        "deathknight-frost": "冰霜死亡骑士",
        "deathknight-unholy": "邪恶死亡骑士",
        "demonhunter-havoc": "浩劫恶魔猎手",
        "demonhunter-devourer": "吞噬恶魔猎手",
        "demonhunter-vengeance": "复仇恶魔猎手",
        "druid-balance": "平衡德鲁伊",
        "druid-feral": "野性德鲁伊",
        "druid-guardian": "守护德鲁伊",
        "druid-restoration": "恢复德鲁伊",
        "evoker-augmentation": "增辉唤魔师",
        "evoker-devastation": "湮灭唤魔师",
        "evoker-preservation": "恩护唤魔师",
        "hunter-beastmastery": "野兽控制猎人",
        "hunter-marksmanship": "射击猎人",
        "hunter-survival": "生存猎人",
        "mage-arcane": "奥术法师",
        "mage-fire": "火焰法师",
        "mage-frost": "冰霜法师",
        "monk-brewmaster": "酒仙武僧",
        "monk-mistweaver": "织雾武僧",
        "monk-windwalker": "踏风武僧",
        "paladin-holy": "神圣圣骑士",
        "paladin-protection": "防护圣骑士",
        "paladin-retribution": "惩戒圣骑士",
        "priest-discipline": "戒律牧师",
        "priest-holy": "神圣牧师",
        "priest-shadow": "暗影牧师",
        "rogue-assassination": "奇袭潜行者",
        "rogue-outlaw": "狂徒潜行者",
        "rogue-subtlety": "敏锐潜行者",
        "shaman-elemental": "元素萨满祭司",
        "shaman-enhancement": "增强萨满祭司",
        "shaman-restoration": "恢复萨满祭司",
        "warlock-affliction": "痛苦术士",
        "warlock-demonology": "恶魔学识术士",
        "warlock-destruction": "毁灭术士",
        "warrior-arms": "武器战士",
        "warrior-fury": "狂怒战士",
        "warrior-protection": "防护战士",
        "other-externals": "外部技能",
        "other-potions": "药水",
        "other-trinkets": "饰品",
        "racials": "种族技能",
        "other": "其他技能",
    } as Record<string, string>,
    bossNames: {
        "imperator-averzian": "阿维兹安大帝",
        "vorasius": "沃拉修斯",
        "fallenking-salhadaar": "殒落之王萨哈达尔",
        "vaelgor-&-ezzorak": "瓦尔戈与艾佐拉克",
        "lightblinded-vanguard": "盲光先锋",
        "crown-of-the-cosmos": "宇宙之冠",
        "chimaerus-the-undreamt-god": "无梦之神奇美拉斯",
        "beloren-child-of-alar": "阿拉尔之子贝洛伦",
        "belo-ren-child-of-alar": "阿拉尔之子贝洛伦",
        "lura": "鲁拉",
        "l-ura": "鲁拉",
        "rotmire": "腐泥",
        "nymrissa-wavecaller": "尼姆瑞莎·唤波者",
        "nekzali-the-soulcoiler": "盘魂者内克扎莉",
        "entombed-sentinels": "陵寝哨兵",
        "vashnik-the-malignant": "万毒邪祟者瓦什尼克",
        "the-lost-explorers": "迷失的探险者",
        "sszorak": "斯索拉克",
        "the-twin-fangs": "双子毒牙",
        "the-coiled-altar": "盘卷祭坛",
        "ulatek": "乌拉特克",
    } as Record<string, string>,
    bossShortNames: {
        "imperator-averzian": "阿维兹安",
        "fallenking-salhadaar": "萨哈达尔",
        "vaelgor-&-ezzorak": "瓦尔戈",
        "lightblinded-vanguard": "盲光先锋",
        "crown-of-the-cosmos": "宇宙之冠",
        "chimaerus-the-undreamt-god": "奇美拉斯",
        "beloren-child-of-alar": "贝洛伦",
        "belo-ren-child-of-alar": "贝洛伦",
        "nymrissa-wavecaller": "尼姆瑞莎",
        "nekzali-the-soulcoiler": "内克扎莉",
        "entombed-sentinels": "陵寝哨兵",
        "vashnik-the-malignant": "瓦什尼克",
        "the-lost-explorers": "迷失的探险者",
        "sszorak": "斯索拉克",
        "the-twin-fangs": "双子毒牙",
        "the-coiled-altar": "盘卷祭坛",
        "ulatek": "乌拉特克",
    } as Record<string, string>,
});

export function specDisplayName(spec: SpecLike) {
    if (!spec) {
        return "等待专精数据";
    }
    return ZH_CN.specNames[spec.full_name_slug || ""] || spec.full_name || "等待专精数据";
}

export function classDisplayName(classSlug: string, fallback = "") {
    return ZH_CN.classNames[classSlug.replaceAll("-", "")] || fallback;
}

type CombatantLike = {
    name?: string;
    full_name?: string;
    name_slug?: string;
    full_name_slug?: string;
    role?: string;
    class?: { name_slug?: string };
} | null | undefined;

export function combatantDisplayName(combatant: CombatantLike) {
    if (!combatant) return "等待技能数据";
    const slug = combatant.full_name_slug || combatant.name_slug || "";
    if (combatant.role === "boss") {
        return ZH_CN.bossNames[slug] || combatant.full_name || combatant.name || "首领技能";
    }
    if (combatant.full_name_slug) {
        return ZH_CN.specNames[slug] || combatant.full_name || combatant.name || "专精技能";
    }
    return classDisplayName(slug, combatant.name || "职业技能");
}

export function combatantClassSlug(combatant: CombatantLike) {
    return combatant?.class?.name_slug || combatant?.name_slug || "other";
}
