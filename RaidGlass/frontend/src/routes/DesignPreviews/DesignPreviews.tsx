import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FaArrowRight, FaBolt, FaCircleNodes, FaLayerGroup, FaRegGem } from "react-icons/fa6";
import { useTitle } from "react-use";
import { assetUrl } from "../../constants";

import styles from "./DesignPreviews.module.scss";

type PreviewTone =
    | "sunwell"
    | "gemini"
    | "linear"
    | "raycast"
    | "vercel"
    | "atlas"
    | "bento"
    | "holo"
    | "forge"
    | "dock";

type Preview = {
    id: string;
    name: string;
    source: string;
    tone: PreviewTone;
    promise: string;
    reactBits: string[];
    layout: string;
    risk: string;
    boss: string;
    spec: string;
    accent: string;
};

type MatureTone = "app" | "command" | "data" | "motion" | "game" | "material";
type TemplateVisual =
    | "appShell"
    | "dashboard"
    | "studioAdmin"
    | "shadcnFlow"
    | "command"
    | "linearList"
    | "analytics"
    | "motionBeams"
    | "spotlight"
    | "landing"
    | "darkBlocks"
    | "controls"
    | "horizon"
    | "tailAdmin"
    | "softFlow"
    | "liquidNav"
    | "gamingHud"
    | "artStage"
    | "bitsCommand"
    | "magicSpotlight"
    | "twentyFirst"
    | "originControl"
    | "animateMotion"
    | "hoverFocus"
    | "kokonutConsole"
    | "cultShift"
    | "eldoraFoil"
    | "heroAccessible"
    | "motionPrimitive"
    | "glinGlass"
    | "obsidianAtelier"
    | "ivoryCodex"
    | "googleAura"
    | "mythicLedger"
    | "arcaneTerminal"
    | "crystalObservatory";

type MatureTemplate = {
    id: string;
    name: string;
    source: string;
    sourceUrl: string;
    tone: MatureTone;
    promise: string;
    fit: string;
    take: string[];
    caution: string;
    accent: string;
};

type SelectionOption = Pick<Preview | MatureTemplate, "id" | "name" | "source" | "promise">;

const bossArts = [
    assetUrl("assets/images/spells/inv_120_raid_voidspire_salhadaar.jpg"),
    assetUrl("assets/images/spells/inv_120_raid_marchonqueldanas_lura.jpg"),
    assetUrl("assets/images/spells/inv_120_raid_voidspire_alleria.jpg"),
    assetUrl("assets/images/spells/inv_120_raid_voidspire_kaiju.jpg"),
];

const templateVisualById: Record<string, TemplateVisual> = {
    M01: "appShell",
    M02: "dashboard",
    M03: "studioAdmin",
    M04: "shadcnFlow",
    M05: "command",
    M06: "linearList",
    M07: "analytics",
    M08: "motionBeams",
    M09: "spotlight",
    M10: "landing",
    M11: "darkBlocks",
    M12: "controls",
    M13: "horizon",
    M14: "tailAdmin",
    M15: "softFlow",
    M16: "liquidNav",
    M17: "gamingHud",
    M18: "artStage",
    M19: "bitsCommand",
    M20: "magicSpotlight",
    M21: "twentyFirst",
    M22: "originControl",
    M23: "animateMotion",
    M24: "hoverFocus",
    M25: "kokonutConsole",
    M26: "cultShift",
    M27: "eldoraFoil",
    M28: "heroAccessible",
    M29: "motionPrimitive",
    M30: "glinGlass",
    M31: "obsidianAtelier",
    M32: "ivoryCodex",
    M33: "googleAura",
    M34: "mythicLedger",
    M35: "arcaneTerminal",
    M36: "crystalObservatory",
};

const visualClassByType: Record<TemplateVisual, string> = {
    appShell: styles.visualAppShell,
    dashboard: styles.visualDashboard,
    studioAdmin: styles.visualStudioAdmin,
    shadcnFlow: styles.visualShadcnFlow,
    command: styles.visualCommand,
    linearList: styles.visualLinearList,
    analytics: styles.visualAnalytics,
    motionBeams: styles.visualMotionBeams,
    spotlight: styles.visualSpotlight,
    landing: styles.visualLanding,
    darkBlocks: styles.visualDarkBlocks,
    controls: styles.visualControls,
    horizon: styles.visualHorizon,
    tailAdmin: styles.visualTailAdmin,
    softFlow: styles.visualSoftFlow,
    liquidNav: styles.visualLiquidNav,
    gamingHud: styles.visualGamingHud,
    artStage: styles.visualArtStage,
    bitsCommand: styles.visualBitsCommand,
    magicSpotlight: styles.visualMagicSpotlight,
    twentyFirst: styles.visualTwentyFirst,
    originControl: styles.visualOriginControl,
    animateMotion: styles.visualAnimateMotion,
    hoverFocus: styles.visualHoverFocus,
    kokonutConsole: styles.visualKokonutConsole,
    cultShift: styles.visualCultShift,
    eldoraFoil: styles.visualEldoraFoil,
    heroAccessible: styles.visualHeroAccessible,
    motionPrimitive: styles.visualMotionPrimitive,
    glinGlass: styles.visualGlinGlass,
    obsidianAtelier: styles.visualObsidianAtelier,
    ivoryCodex: styles.visualIvoryCodex,
    googleAura: styles.visualGoogleAura,
    mythicLedger: styles.visualMythicLedger,
    arcaneTerminal: styles.visualArcaneTerminal,
    crystalObservatory: styles.visualCrystalObservatory,
};

const previews: Preview[] = [
    {
        id: "A",
        name: "日井透镜",
        source: "React Bits GlassSurface + Apple Liquid Glass",
        tone: "sunwell",
        promise: "保留 D4 羊皮纸和金色魔幻感，把玻璃只放在导航和主操作层。",
        reactBits: ["GlassSurface", "SpotlightCard", "AnimatedContent"],
        layout: "左 Boss 图鉴，中专精，右作业确认",
        risk: "最低，最接近当前方向",
        boss: "节点女亲王凯威扎",
        spec: "火焰法师",
        accent: "#0d91a0",
    },
    {
        id: "B",
        name: "Gemini 灵流",
        source: "Google Gemini gradients + React Bits Aurora restraint",
        tone: "gemini",
        promise: "用柔和渐变引导视线，重点突出下一步点击，不做满屏彩虹。",
        reactBits: ["GradientText", "BlobCursor 禁用", "FadeContent"],
        layout: "大圆角选择流，Boss 和专精连成一步一步的引导",
        risk: "中等，魔兽味会变轻",
        boss: "诸界吞噬者迪门修斯",
        spec: "奥术法师",
        accent: "#5c7cfa",
    },
    {
        id: "C",
        name: "Linear 暗域",
        source: "Linear product shell + React Bits BorderGlow",
        tone: "linear",
        promise: "暗色高对比，信息噪音最少，适合长时间查时间轴。",
        reactBits: ["BorderGlow", "AnimatedList", "CountUp"],
        layout: "左侧上下文栏，中心大列表，右侧固定启动器",
        risk: "中等，D4 魔幻感需要用图标和材质补",
        boss: "萨尔哈达尔",
        spec: "冰霜法师",
        accent: "#8b5cf6",
    },
    {
        id: "D",
        name: "Raycast 命令台",
        source: "Raycast command UX + React Bits Dock",
        tone: "raycast",
        promise: "像命令面板一样快，键盘和鼠标都能少点几次。",
        reactBits: ["Dock", "PillNav", "Magnet"],
        layout: "顶部命令条，下面是搜索优先的 Boss 与专精结果",
        risk: "中高，需要后续补键盘导航",
        boss: "露拉",
        spec: "火焰法师",
        accent: "#ff5a7a",
    },
    {
        id: "E",
        name: "Vercel 黑白碑",
        source: "Vercel product grid + React Bits ShinyText",
        tone: "vercel",
        promise: "黑白强秩序，适合把 RaidGlass 做成更像高端工具官网。",
        reactBits: ["ShinyText", "SpotlightCard", "Reveal"],
        layout: "单列强标题，下方模块化黑白卡片",
        risk: "中等，游戏风会明显降低",
        boss: "法力熔炉欧米伽",
        spec: "奥术法师",
        accent: "#ffffff",
    },
    {
        id: "F",
        name: "霜晶图册",
        source: "Next.js showcase media grid + React Bits GlareHover",
        tone: "atlas",
        promise: "Boss 图片成为第一视觉，选择体验更像翻图鉴。",
        reactBits: ["GlareHover", "ChromaGrid", "FadeContent"],
        layout: "大图册横向扫 Boss，专精浮在右侧玻璃栏",
        risk: "中等，对素材质量要求最高",
        boss: "熔炉编织者阿拉兹",
        spec: "冰霜法师",
        accent: "#38bdf8",
    },
    {
        id: "G",
        name: "秘法 Bento",
        source: "2026 bento grid + React Bits MagicBento",
        tone: "bento",
        promise: "让 Boss、职业、刷新策略变成一组可扫读的异形网格。",
        reactBits: ["MagicBento", "CountUp", "SpotlightCard"],
        layout: "非等分 bento，主目标卡最大，其余动作围绕它",
        risk: "中等，必须严控层级",
        boss: "唤魂者埃佐拉克",
        spec: "火焰法师",
        accent: "#f59e0b",
    },
    {
        id: "H",
        name: "星图全息",
        source: "React Bits Iridescence restraint + gaming HUD",
        tone: "holo",
        promise: "更酷的高端游戏 HUD，适合强调 Top 玩家时间线的科技感。",
        reactBits: ["Iridescence 背景禁用", "ElectricBorder", "AnimatedList"],
        layout: "中心作战星图，Boss 和专精围绕主时间轴入口",
        risk: "较高，容易过度炫技",
        boss: "集能哨兵",
        spec: "奥术法师",
        accent: "#22d3ee",
    },
    {
        id: "I",
        name: "卷轴锻炉",
        source: "D4 parchment + React Bits ScrollStack idea",
        tone: "forge",
        promise: "更强魔幻叙事感，打开页面像展开一张工匠卷轴。",
        reactBits: ["ScrollStack", "GlareHover", "ClickSpark"],
        layout: "纵向卷轴分段，先选 Boss，再选职业，最后打开时间轴",
        risk: "中高，桌面长屏体验更好",
        boss: "凋魂之壳",
        spec: "冰霜法师",
        accent: "#b7791f",
    },
    {
        id: "J",
        name: "水晶 Dock",
        source: "Mac dock metaphor + React Bits Dock",
        tone: "dock",
        promise: "把职业专精做成底部水晶 Dock，主区只保留 Boss 和确认。",
        reactBits: ["Dock", "GlassIcons", "AnimatedContent"],
        layout: "Boss 大画面加底部专精 Dock，右上角小确认面板",
        risk: "中等，专精很多时要做分组",
        boss: "奥蕾莉亚",
        spec: "火焰法师",
        accent: "#14b8a6",
    },
];

const matureTemplates: MatureTemplate[] = [
    {
        id: "M01",
        name: "Catalyst 应用壳",
        source: "Tailwind Catalyst",
        sourceUrl: "https://tailwindcss.com/plus/ui-kit",
        tone: "app",
        promise: "用官方应用 UI Kit 的壳重做 RaidGlass，先解决控件秩序和布局成熟度。",
        fit: "最适合把首页、时间轴页、设置页统一成专业工具。",
        take: ["应用级 topbar", "侧栏/面包屑", "表单和选择器", "稳定 spacing"],
        caution: "需要把魔幻材质作为主题层叠进去，否则会偏普通 SaaS。",
        accent: "#2563eb",
    },
    {
        id: "M02",
        name: "Tailwind UI Dashboard",
        source: "Tailwind UI Application UI",
        sourceUrl: "https://tailwindcss.com/plus/ui-kit",
        tone: "app",
        promise: "直接借成熟 dashboard 结构，让 Boss、专精、排行榜、导入报告各有固定区块。",
        fit: "适合做长期维护的数据产品，不会显得业余。",
        take: ["dashboard shell", "列表筛选", "tabs", "empty/loading/error"],
        caution: "视觉惊艳度不高，需要额外做品牌化。",
        accent: "#0f766e",
    },
    {
        id: "M03",
        name: "Studio Admin",
        source: "Vercel shadcn Admin Template",
        sourceUrl: "https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard",
        tone: "data",
        promise: "完整后台模板感，适合把 WCL 数据、刷新状态、排名入口做成一个控制台。",
        fit: "适合把 RaidGlass 做成“高手作业数据库”，不局限单页导航。",
        take: ["多 dashboard", "主题预设", "布局控制", "认证页结构"],
        caution: "如果照搬后台感，玩家第一眼会觉得少了游戏味。",
        accent: "#111827",
    },
    {
        id: "M04",
        name: "shadcn 官方骨架",
        source: "shadcn/ui",
        sourceUrl: "https://ui.shadcn.com/",
        tone: "app",
        promise: "用 shadcn 的 Command、Tabs、Sheet、Card 重做选择流程。",
        fit: "适合把“选 Boss + 选专精 + 打开作业”变成低点击产品流。",
        take: ["Command palette", "Tabs", "Sheet", "Card"],
        caution: "我们当前不是 Tailwind 项目，需要转写为 CSS Modules 或引入 Tailwind。",
        accent: "#18181b",
    },
    {
        id: "M05",
        name: "Command 作业台",
        source: "Raycast + shadcn Command",
        sourceUrl: "https://www.raycast.com/",
        tone: "command",
        promise: "首页默认就是命令面板：输入 Boss、专精或玩家，结果即时出现。",
        fit: "最能解决你说的 UX 不舒服和点击多。",
        take: ["搜索优先", "快捷键", "结果分组", "最近选择"],
        caution: "需要补键盘导航和搜索索引，工程量比纯换皮大。",
        accent: "#ff4f6d",
    },
    {
        id: "M06",
        name: "Linear 工具流",
        source: "Linear",
        sourceUrl: "https://linear.app/",
        tone: "command",
        promise: "暗色、低噪音、强层级，把所有选择变成可连续扫描的工作流。",
        fit: "适合高频玩家长期查作业，视觉不会累。",
        take: ["暗色壳", "低噪音列表", "状态行", "细边界"],
        caution: "需要用职业色和 Boss 图标拉回魔兽语境。",
        accent: "#8b5cf6",
    },
    {
        id: "M07",
        name: "Tremor 数据层",
        source: "Tremor",
        sourceUrl: "https://www.tremor.so/",
        tone: "data",
        promise: "把榜单、刷新状态、样本量、报告新鲜度做成可解释的数据面板。",
        fit: "适合时间轴页和后台监控，不适合单独作为首页风格。",
        take: ["metric cards", "charts", "ranking tables", "filters"],
        caution: "太 B2B，需要和 D4 视觉分层使用。",
        accent: "#3b82f6",
    },
    {
        id: "M08",
        name: "Magic UI Motion",
        source: "Magic UI",
        sourceUrl: "https://magicui.design/",
        tone: "motion",
        promise: "在成熟应用壳上补高级入场、闪光边框和按钮反馈。",
        fit: "适合让主站看起来更 2026，但不改变布局骨架。",
        take: ["animated beam", "magic card", "number ticker", "marquee 禁用"],
        caution: "只能局部用，堆满会变成 AI 味展示站。",
        accent: "#7c3aed",
    },
    {
        id: "M09",
        name: "Aceternity 交互层",
        source: "Aceternity UI",
        sourceUrl: "https://ui.aceternity.com/",
        tone: "motion",
        promise: "借它的 Hover、Spotlight、Background 思路做高端交互。",
        fit: "适合做 Boss 卡 hover、时间轴入口和空状态。",
        take: ["spotlight card", "hover border", "background beams", "text reveal"],
        caution: "不适合作为整站模板，容易炫技过头。",
        accent: "#06b6d4",
    },
    {
        id: "M10",
        name: "Launch UI 产品页",
        source: "Launch UI",
        sourceUrl: "https://www.launchuicomponents.com/",
        tone: "app",
        promise: "用现代产品页的首屏和卡片结构，做一个更像正式产品的 RaidGlass。",
        fit: "适合首页和介绍页，能提升第一眼可信度。",
        take: ["hero shell", "feature blocks", "rounded nav", "proof cards"],
        caution: "核心查询页仍然要用应用壳，不能停留在 landing。",
        accent: "#6366f1",
    },
    {
        id: "M11",
        name: "Tailark Dusk",
        source: "Tailark Blocks",
        sourceUrl: "https://github.com/tailark/blocks",
        tone: "motion",
        promise: "偏暗色营销块，适合把 RaidGlass 做得更有发布感。",
        fit: "适合产品介绍、特性区、作业策略说明。",
        take: ["dark blocks", "pricing-like sections", "hero variations", "testimonials 禁用"],
        caution: "对核心选择 UX 帮助有限。",
        accent: "#4f46e5",
    },
    {
        id: "M12",
        name: "Origin UI 控件库",
        source: "Origin UI",
        sourceUrl: "https://shadcn.io/template/origin-space-originui",
        tone: "app",
        promise: "大量可复制控件，适合替换当前粗糙的小控件。",
        fit: "适合 Select、Menu、Tooltip、Popover、快捷过滤器。",
        take: ["forms", "menus", "data display", "feedback"],
        caution: "它是零件库，仍然需要我们定主布局。",
        accent: "#0ea5e9",
    },
    {
        id: "M13",
        name: "Horizon 明暗后台",
        source: "Horizon UI",
        sourceUrl: "https://horizon-ui.com/",
        tone: "data",
        promise: "更现代的 dashboard 观感，可以作为管理端和数据页候选。",
        fit: "适合刷新队列、WCL 抓取状态和管理员页面。",
        take: ["light/dark dashboard", "side nav", "stat cards", "tables"],
        caution: "主站会偏通用后台，需要强品牌化。",
        accent: "#4318ff",
    },
    {
        id: "M14",
        name: "TailAdmin 控制台",
        source: "TailAdmin React",
        sourceUrl: "https://tailadmin.com/react",
        tone: "data",
        promise: "开源后台模板，信息密度成熟，适合快速建立完整产品后台。",
        fit: "适合后台，不适合直接做玩家首页。",
        take: ["admin sidebar", "tables", "forms", "settings"],
        caution: "视觉普通，但工程结构稳定。",
        accent: "#465fff",
    },
    {
        id: "M15",
        name: "Gemini Canvas 轻流",
        source: "Google Gemini",
        sourceUrl: "https://design.google/library/gemini-ai-visual-design",
        tone: "material",
        promise: "柔和、圆润、可亲，减少现在页面的硬边框和压迫感。",
        fit: "适合首页选择器，尤其是 Boss/专精一步步引导。",
        take: ["soft gradients", "rounded containers", "state motion", "friendly labels"],
        caution: "魔幻感会下降，需要保留游戏素材作为主视觉。",
        accent: "#4285f4",
    },
    {
        id: "M16",
        name: "Apple 玻璃导航",
        source: "Apple Liquid Glass",
        sourceUrl: "https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/",
        tone: "material",
        promise: "只把导航和操作层做成玻璃，内容区保持清晰。",
        fit: "适合修掉边框套边框的问题。",
        take: ["floating nav", "control layer", "adaptive contrast", "reduced motion"],
        caution: "不能把所有卡片都做玻璃，读数会变差。",
        accent: "#0f9ab7",
    },
    {
        id: "M17",
        name: "Gaming Dashboard",
        source: "ThemeForest gaming dashboard",
        sourceUrl: "https://themeforest.net/search/gaming%20dashboard",
        tone: "game",
        promise: "更接近游戏 HUD 的情绪，但保留 dashboard 可读性。",
        fit: "适合想要更游戏风的版本。",
        take: ["hud panels", "rank cards", "dark contrast", "neon restraint"],
        caution: "很多模板过时，需要只借气氛。",
        accent: "#22d3ee",
    },
    {
        id: "M18",
        name: "Awwwards Dark UI",
        source: "Awwwards dark mode collection",
        sourceUrl: "https://www.awwwards.com/awwwards/collections/dark-mode/",
        tone: "game",
        promise: "更大胆的暗色视觉，用于做一次高端艺术方向探索。",
        fit: "适合探索版，不适合直接落地为唯一主站。",
        take: ["dark depth", "large imagery", "scroll motion", "asymmetric layout"],
        caution: "必须回到玩家任务流，否则会好看但不好用。",
        accent: "#f97316",
    },
    {
        id: "M19",
        name: "React Bits 命令流",
        source: "React Bits",
        sourceUrl: "https://reactbits.dev/",
        tone: "command",
        promise: "把 M05 的命令面板升级成带微交互的搜索台，点击、hover、列表入场都更顺。",
        fit: "最适合首页第一步，把 Boss、专精、玩家名搜索合到同一个入口。",
        take: ["animated list", "spotlight card", "click feedback", "background restraint"],
        caution: "动效只服务选择反馈，不能把背景动画做成主角。",
        accent: "#7dd3fc",
    },
    {
        id: "M20",
        name: "Magic UI 聚光作业",
        source: "Magic UI",
        sourceUrl: "https://magicui.design/",
        tone: "motion",
        promise: "延续 M09 的聚光卡思路，Boss 卡和打开时间轴按钮有更明确的高级感。",
        fit: "适合当前主站，能在固定布局上快速提升质感。",
        take: ["magic card", "border beam", "animated beam", "shine button"],
        caution: "禁用大面积跑马灯，保留局部边框和按钮反馈。",
        accent: "#38bdf8",
    },
    {
        id: "M21",
        name: "21st.dev 组件市场",
        source: "21st.dev",
        sourceUrl: "https://21st.dev/",
        tone: "app",
        promise: "用社区成熟组件的组合逻辑，做更像真实产品的选择器和过滤器。",
        fit: "适合继续扩展导入报告、最近查看、收藏作业。",
        take: ["component registry", "template blocks", "filters", "agent-friendly UI"],
        caution: "模板来源很分散，落地时要统一设计 token。",
        accent: "#f59e0b",
    },
    {
        id: "M22",
        name: "Origin 控件秩序",
        source: "Origin UI",
        sourceUrl: "https://coss.com/origin",
        tone: "app",
        promise: "把 M05 的快速选择做成成熟控件语言，少装饰，多可用。",
        fit: "适合替换当前小按钮、tabs、tooltip、popover 和选择菜单。",
        take: ["command", "tabs", "select", "popover"],
        caution: "视觉冲击不强，优势在控件成熟度。",
        accent: "#0ea5e9",
    },
    {
        id: "M23",
        name: "Animate UI 轻动效",
        source: "Animate UI",
        sourceUrl: "https://animate-ui.com/",
        tone: "motion",
        promise: "在 M05 的效率感上叠一层克制动效，让切换和展开显得更自然。",
        fit: "适合首页到时间轴页之间的状态切换。",
        take: ["animated primitives", "state motion", "shadcn registry", "reduced motion"],
        caution: "需要逐个交互定义动效目的，避免全站乱动。",
        accent: "#a78bfa",
    },
    {
        id: "M24",
        name: "Hover.dev 触感卡",
        source: "Hover.dev",
        sourceUrl: "https://www.hover.dev/",
        tone: "motion",
        promise: "强调鼠标悬停的触感，Boss 图和专精行会更像可按的高级界面。",
        fit: "适合桌面端玩家，能让大量可点元素更清楚。",
        take: ["hover cards", "tilt restraint", "focus reveal", "button physics"],
        caution: "移动端收益低，桌面 hover 要有稳定 fallback。",
        accent: "#fb7185",
    },
    {
        id: "M25",
        name: "Kokonut 暗色控制台",
        source: "Kokonut UI",
        sourceUrl: "https://kokonutui.com/",
        tone: "command",
        promise: "更硬朗的暗色产品壳，比 M05 更像专业工具，比 M09 更少炫光。",
        fit: "适合主站长期使用，暗色和紧凑密度对高频玩家友好。",
        take: ["dark shell", "compact cards", "motion controls", "shadcn style"],
        caution: "需要用职业色和 Boss 图补游戏识别度。",
        accent: "#22c55e",
    },
    {
        id: "M26",
        name: "Cult Shift 卡片",
        source: "Cult UI",
        sourceUrl: "https://www.cult-ui.com/",
        tone: "motion",
        promise: "借 Shift Card 的信息展开思路，让 Boss 卡 hover 后露出排名和刷新信息。",
        fit: "适合后续做 Top10 预览、样本量、最后刷新时间。",
        take: ["shift card", "animated bento", "detail reveal", "AI patterns 禁用"],
        caution: "第一阶段只借卡片信息层，不引入 AI agent 叙事。",
        accent: "#e879f9",
    },
    {
        id: "M27",
        name: "Eldora 宝石动效",
        source: "Eldora UI",
        sourceUrl: "https://www.eldoraui.site/",
        tone: "game",
        promise: "保留魔幻宝石感，同时让卡片和按钮有更现代的 shimmer 反馈。",
        fit: "适合你要的游戏风和 D4 羊皮纸之间的折中方向。",
        take: ["spotlight card", "shimmer", "animated cards", "template blocks"],
        caution: "宝石光效要少量使用，否则会变廉价。",
        accent: "#facc15",
    },
    {
        id: "M28",
        name: "HeroUI 精致产品",
        source: "HeroUI",
        sourceUrl: "https://www.heroui.com/",
        tone: "material",
        promise: "用可访问性更强的现代组件质感，减少边框套边框和硬角问题。",
        fit: "适合要长期做成正式产品的版本。",
        take: ["accessible controls", "smooth details", "compound components", "polished states"],
        caution: "游戏风较弱，需要主题层补魔幻素材。",
        accent: "#006fee",
    },
    {
        id: "M29",
        name: "Motion Primitives 状态流",
        source: "Motion Primitives",
        sourceUrl: "https://motion-primitives.com/",
        tone: "motion",
        promise: "以状态切换为主，不追求花哨背景，让选择流程显得更顺滑。",
        fit: "适合 Boss、难度、专精、时间轴打开之间的连续交互。",
        take: ["layout transition", "animated tabs", "disclosure", "text morph"],
        caution: "需要把每段 motion 限定在真实状态变化上。",
        accent: "#14b8a6",
    },
    {
        id: "M30",
        name: "Glin 玻璃命令台",
        source: "Glin UI",
        sourceUrl: "https://github.com/glincker/glinui",
        tone: "material",
        promise: "把 M05 的命令台和 iOS 26 玻璃材质合并，但保留清晰文本层。",
        fit: "适合你最初要的液态玻璃方向，同时比全玻璃页面更能读。",
        take: ["glass surfaces", "glass elevation", "dark mode", "command defaults"],
        caution: "Web 端只能做玻璃近似，必须保留实体背景和足够对比。",
        accent: "#67e8f9",
    },
    {
        id: "M31",
        name: "黑曜石作业台",
        source: "Raycast + Linear + WoW Mythic",
        sourceUrl: "https://www.raycast.com/",
        tone: "command",
        promise: "压低色彩和装饰，只保留黑曜石材质、蓝白火花和极清晰的主按钮。",
        fit: "适合真正落地的高端暗色主站，长时间查作业也不会累。",
        take: ["large dark canvas", "single accent", "pressed controls", "image as evidence"],
        caution: "需要后续把职业色作为细节点缀，避免整站过冷。",
        accent: "#7dd3fc",
    },
    {
        id: "M32",
        name: "日冕手稿",
        source: "D4 Codex + luxury editorial",
        sourceUrl: "https://diablo4.blizzard.com/",
        tone: "game",
        promise: "重做羊皮纸方向，去掉廉价金边，改成厚纸、压印、低饱和金和大留白。",
        fit: "适合你之前要的 D4 魔幻风，但会比当前版本更稳、更贵。",
        take: ["embossed paper", "quiet gold", "large type", "soft image wash"],
        caution: "图片素材必须换成真正同风格 Boss 图，不然质感会掉。",
        accent: "#b88a3d",
    },
    {
        id: "M33",
        name: "Gemini 水晶厅",
        source: "Google Gemini + Apple glass",
        sourceUrl: "https://design.google/library/gemini-ai-visual-design",
        tone: "material",
        promise: "保留浅色高级感，使用大面积柔光、水晶蓝绿和透明操作层。",
        fit: "适合更现代、更大厂官网感的方向。",
        take: ["soft prism", "liquid control", "clear hierarchy", "no heavy border"],
        caution: "要用魔兽图像压住产品感，否则会像通用 AI 工具。",
        accent: "#29b6f6",
    },
    {
        id: "M34",
        name: "神话账本",
        source: "premium parchment + command UX",
        sourceUrl: "https://ui.aceternity.com/",
        tone: "game",
        promise: "把抄作业做成一本会发光的神话账本，左侧图鉴更重，右侧动作更像仪式按钮。",
        fit: "适合游戏风最强的方向，仍然保持可点击、可扫读。",
        take: ["codex panels", "ornament restraint", "hero image weight", "ritual CTA"],
        caution: "装饰只能在边缘和按钮上出现，内容区保持干净。",
        accent: "#d7a84f",
    },
    {
        id: "M35",
        name: "秘法终端",
        source: "Raycast command + React Bits",
        sourceUrl: "https://reactbits.dev/",
        tone: "command",
        promise: "把页面变成高级命令终端，适合键盘流和高频查询玩家。",
        fit: "适合后续做搜索、最近选择、快捷键和玩家报告导入。",
        take: ["command rail", "mono metadata", "compact density", "active row glow"],
        caution: "需要补键盘导航才算完整，不然只是一层视觉。",
        accent: "#22d3ee",
    },
    {
        id: "M36",
        name: "水晶观测站",
        source: "Aceternity spotlight + Motion Primitives",
        sourceUrl: "https://motion-primitives.com/",
        tone: "motion",
        promise: "更像一块高端游戏设备的观测屏，Boss 图像、专精列表和按钮都有空间层次。",
        fit: "适合最惊艳的展示方向，也能服务玩家查榜。",
        take: ["depth glass", "spotlight focus", "floating panels", "state transition"],
        caution: "最终主站要控制 GPU 成本，动画只做 hover 和切换。",
        accent: "#5eead4",
    },
];

function templateNumber(template: MatureTemplate) {
    return Number(template.id.slice(1));
}

const showcaseTemplates = matureTemplates.filter((template) => templateNumber(template) >= 31);
const focusedTemplates = matureTemplates.filter((template) => templateNumber(template) >= 19 && templateNumber(template) <= 30);
const foundationTemplates = matureTemplates.filter((template) => templateNumber(template) < 19);

function PreviewMiniApp({ preview }: { preview: Preview }) {
    const artIndex = preview.id.charCodeAt(0) % bossArts.length;
    const style = { "--preview-accent": preview.accent } as CSSProperties;

    return (
        <div className={`${styles.miniApp} ${styles[preview.tone]}`} style={style}>
            <div className={styles.miniTopbar}>
                <span className={styles.logoMark}><FaRegGem /></span>
                <span>RaidGlass</span>
                <i>Top10 每小时</i>
            </div>

            <div className={styles.miniHero}>
                <div>
                    <small>{preview.id} 方案</small>
                    <strong>{preview.name}</strong>
                    <span>{preview.promise}</span>
                </div>
                <div className={styles.targetPill}>
                    <b>{preview.boss}</b>
                    <span>{preview.spec}</span>
                </div>
            </div>

            <div className={styles.miniWorkspace}>
                <div className={styles.bossPreview}>
                    <img src={bossArts[artIndex]} alt="" />
                    <span>{preview.boss}</span>
                </div>

                <div className={styles.specPreview}>
                    <button>火法</button>
                    <button>奥法</button>
                    <button>冰法</button>
                    <button>术士</button>
                </div>

                <div className={styles.launchPreview}>
                    <span>M</span>
                    <b>打开时间轴</b>
                    <FaArrowRight />
                </div>
            </div>
        </div>
    );
}

function PreviewCard({
    preview,
    active,
    onSelect,
}: {
    preview: Preview;
    active: boolean;
    onSelect: (preview: Preview) => void;
}) {
    return (
        <article
            className={`${styles.previewCard} ${active ? styles.active : ""}`}
            style={{ "--preview-accent": preview.accent } as CSSProperties}
        >
            <button type="button" className={styles.previewButton} onClick={() => onSelect(preview)}>
                <PreviewMiniApp preview={preview} />
            </button>

            <div className={styles.previewMeta}>
                <div>
                    <span>{preview.id}</span>
                    <h2>{preview.name}</h2>
                </div>
                <p>{preview.source}</p>
                <ul>
                    {preview.reactBits.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
                <dl>
                    <div>
                        <dt>布局</dt>
                        <dd>{preview.layout}</dd>
                    </div>
                    <div>
                        <dt>风险</dt>
                        <dd>{preview.risk}</dd>
                    </div>
                </dl>
            </div>
        </article>
    );
}

function TemplateMini({
    template,
    visual,
    featured = false,
}: {
    template: MatureTemplate;
    visual: TemplateVisual;
    featured?: boolean;
}) {
    const visualClass = visualClassByType[visual];

    return (
        <div
            className={`${styles.templateMini} ${featured ? styles.showcaseMini : ""} ${styles[template.tone]} ${visualClass}`}
            style={{ "--template-accent": template.accent } as CSSProperties}
        >
            <LockedHomeSkin template={template} />
        </div>
    );
}

function LockedHomeSkin({ template }: { template: MatureTemplate }) {
    return (
        <div className={styles.lockedHome}>
            <nav className={styles.lockedNav}>
                <strong>RaidGlass</strong>
                <span>抄作业</span>
                <span>阵容</span>
                <span>报告</span>
                <i>Top10</i>
            </nav>

            <header className={styles.lockedHero}>
                <div>
                    <small>{template.id} 视觉套用</small>
                    <b>选择目标，打开 Top 时间轴</b>
                    <span>{template.name}</span>
                </div>
                <aside>
                    <small>当前目标</small>
                    <b>Imperator</b>
                    <span>Fire Mage</span>
                </aside>
            </header>

            <main className={styles.lockedGrid}>
                <section className={styles.lockedBoss}>
                    <header>
                        <b>Boss</b>
                        <span>当前赛季首领</span>
                    </header>
                    <div>
                        {bossArts.slice(0, 4).map((art, index) => (
                            <article key={art} className={index === 0 ? styles.selectedBoss : ""}>
                                <img src={art} alt="" />
                                <span>{index === 0 ? "Imperator" : "Salhadaar"}</span>
                            </article>
                        ))}
                    </div>
                </section>

                <section className={styles.lockedSpec}>
                    <header>
                        <b>专精</b>
                        <span>职业与职责</span>
                    </header>
                    <div className={styles.lockedTabs}>
                        <span>Mage</span>
                        <span>Paladin</span>
                        <span>Rogue</span>
                    </div>
                    <div className={styles.lockedSpecRows}>
                        <article>
                            <b>Fire Mage</b>
                            <span>火焰 · 远程</span>
                        </article>
                        <article>
                            <b>Arcane</b>
                            <span>奥术 · 远程</span>
                        </article>
                    </div>
                </section>

                <aside className={styles.lockedAction}>
                    <header>
                        <b>作业</b>
                        <span>排名时间轴</span>
                    </header>
                    <div className={styles.lockedToggle}>
                        <span>M</span>
                        <span>H</span>
                    </div>
                    <dl>
                        <div>
                            <dt>Boss</dt>
                            <dd>Imperator</dd>
                        </div>
                        <div>
                            <dt>专精</dt>
                            <dd>Fire Mage</dd>
                        </div>
                    </dl>
                    <button type="button">
                        打开时间轴
                        <FaArrowRight />
                    </button>
                </aside>
            </main>
        </div>
    );
}

function TemplateCard({
    template,
    active,
    onSelect,
    featured = false,
}: {
    template: MatureTemplate;
    active: boolean;
    onSelect: (template: MatureTemplate) => void;
    featured?: boolean;
}) {
    const visual = templateVisualById[template.id] ?? "appShell";
    const visualClass = visualClassByType[visual];

    return (
        <article
            className={`${styles.templateCard} ${featured ? styles.showcaseCard : ""} ${visualClass} ${active ? styles.active : ""}`}
            style={{ "--template-accent": template.accent } as CSSProperties}
        >
            <button type="button" className={styles.templateButton} onClick={() => onSelect(template)}>
                <TemplateMini template={template} visual={visual} featured={featured} />
            </button>

            <div className={styles.templateMeta}>
                <div className={styles.templateHeader}>
                    <span>{template.id}</span>
                    <h2>{template.name}</h2>
                </div>
                <p>{template.promise}</p>
                <ul>
                    {template.take.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
                <dl>
                    <div>
                        <dt>适配</dt>
                        <dd>{template.fit}</dd>
                    </div>
                    <div>
                        <dt>注意</dt>
                        <dd>{template.caution}</dd>
                    </div>
                </dl>
                <a href={template.sourceUrl} target="_blank" rel="noreferrer">
                    查看来源
                </a>
            </div>
        </article>
    );
}

export default function DesignPreviews() {
    useTitle("RaidGlass: 46 个视觉方向预览");
    const [selectedId, setSelectedId] = useState("M32");
    const selected = useMemo<SelectionOption>(() => {
        const allOptions: SelectionOption[] = [...previews, ...matureTemplates];
        return allOptions.find((item) => item.id === selectedId) ?? matureTemplates[0];
    }, [selectedId]);

    return (
        <section className={styles.page}>
            <header className={styles.hero}>
                <div>
                    <span className={styles.kicker}>React Bits + 成熟模板池</span>
                    <h1>先选风格，再套主站</h1>
                    <p>
                        顶部新增 6 个高定大预览。它们固定 RaidGlass 首页结构，但各自使用独立材质、按钮语言、图片处理和信息层级，优先解决“小卡换皮”的问题。
                    </p>
                </div>

                <aside className={styles.selectionBox}>
                    <span>当前选择</span>
                    <strong>{selected.id}. {selected.name}</strong>
                    <em>{selected.source}</em>
                    <p>{selected.promise}</p>
                </aside>
            </header>

            <div className={styles.researchStrip}>
                <span><FaBolt /> React Bits: 组件级动效</span>
                <span><FaLayerGroup /> Next/Vercel: 成熟产品壳</span>
                <span><FaCircleNodes /> Gemini/Apple: 流动材质</span>
            </div>

            <div className={styles.sectionIntro}>
                <span>第一组</span>
                <h2>高定主视觉 M31-M36</h2>
                <p>这组只保留 6 个方向，直接看它们套到当前首页布局后的主站观感。</p>
            </div>

            <div className={styles.showcaseGrid}>
                {showcaseTemplates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        active={template.id === selectedId}
                        featured
                        onSelect={(nextTemplate) => {
                            setSelectedId(nextTemplate.id);
                            console.info("[DesignPreview] showcase selected", {
                                id: nextTemplate.id,
                                name: nextTemplate.name,
                                source: nextTemplate.source,
                                url: nextTemplate.sourceUrl,
                            });
                        }}
                    />
                ))}
            </div>

            <div className={styles.sectionIntro}>
                <span>第二组</span>
                <h2>概念方向 A-J</h2>
                <p>这组用于判断氛围和情绪，适合快速筛掉不喜欢的视觉路线。</p>
            </div>

            <div className={styles.grid}>
                {previews.map((preview) => (
                    <PreviewCard
                        key={preview.id}
                        preview={preview}
                        active={preview.id === selectedId}
                        onSelect={(nextPreview) => {
                            setSelectedId(nextPreview.id);
                            console.info("[DesignPreview] selected", {
                                id: nextPreview.id,
                                name: nextPreview.name,
                                source: nextPreview.source,
                            });
                        }}
                    />
                ))}
            </div>

            <div className={styles.sectionIntro}>
                <span>第三组</span>
                <h2>M05/M09 延伸 M19-M30</h2>
                <p>这组固定同一个首页布局，只比较命令台、聚光卡、触感动效、暗色工具壳和玻璃材质的真实差异。</p>
            </div>

            <div className={styles.templateGrid}>
                {focusedTemplates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        active={template.id === selectedId}
                        onSelect={(nextTemplate) => {
                            setSelectedId(nextTemplate.id);
                            console.info("[DesignPreview] template selected", {
                                id: nextTemplate.id,
                                name: nextTemplate.name,
                                source: nextTemplate.source,
                                url: nextTemplate.sourceUrl,
                            });
                        }}
                    />
                ))}
            </div>

            <div className={styles.sectionIntro}>
                <span>第四组</span>
                <h2>原成熟模板池 M01-M18</h2>
                <p>这组作为基准参考，保留旧模板池，方便和新增方向横向比较。</p>
            </div>

            <div className={styles.templateGrid}>
                {foundationTemplates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        active={template.id === selectedId}
                        onSelect={(nextTemplate) => {
                            setSelectedId(nextTemplate.id);
                            console.info("[DesignPreview] template selected", {
                                id: nextTemplate.id,
                                name: nextTemplate.name,
                                source: nextTemplate.source,
                                url: nextTemplate.sourceUrl,
                            });
                        }}
                    />
                ))}
            </div>
        </section>
    );
}
