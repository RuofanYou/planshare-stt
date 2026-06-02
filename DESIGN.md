---
version: 2.0.0
name: PlanShare Design System
description: >-
  STT 战术板分享平台前端设计系统单一真相来源。风格 = 2026 Dark Liquid Glass · 魔兽金 · 现代魔兽史诗奇幻。
  气质对标 OpenAI 官网 / Apple visionOS Liquid Glass / Linear-Vercel，并叠加 World of Warcraft / Blizzard
  官网的电影级暗场氛围、史诗排版、克制古金装饰。纯前端 + mock 数据，无后端无持久化。
stack:
  - tailwindcss@^4 + @tailwindcss/vite（Tailwind v4，令牌写在 @theme）
  - framer-motion（进场 / hover / 路由过场 / count-up）
  - three + @react-three/fiber + @react-three/drei（余烬奥术背景）
  - react@18 + react-router-dom@6 + vite + typescript
colors:
  # 暖黑基底（暖黑棕，绝非纯黑/冷蓝；魔兽的体温来自暖黑）
  bg-base: "#0C0B0A"        # 暖近黑，最底层
  bg-raise: "#14110C"       # 抬升面（区块底、表层容器）
  bg-deep: "#16120B"        # 深空径向渐变外圈终点（暖棕红向）
  # 文字（暖白系，绝不冷白）
  ink: "#F6F1E8"            # 暖白主文字
  ink-soft: "#B6AD9D"       # 次文字、元信息、作者名
  ink-faint: "#6F675B"      # 占位、禁用、分隔点、极弱辅助
  # 双金分工（亮金=焦点/激活，奶金=eyebrow/正文级强调）
  gold: "#E8B765"           # 魔兽金，深底上自带发光感（链接、激活、强调）
  gold-bright: "#F2CE86"    # hover 提亮
  gold-deep: "#C8923A"      # 加深（active、描边暗部）
  gold-cream: "#EBDEC2"     # 奶金羊皮（eyebrow 小标签、次级标题、正文级强调）
  gold-glow: "rgba(232,183,101,.30)"  # 金辉（hover 外发光、focus 内衬）
  # 砖红 CTA（对标官网主按钮；克制，仅核心实心按钮用）
  ember: "#B23A2E"          # 魔兽砖红
  ember-bright: "#C8493B"   # 砖红 hover 提亮
  # 功能态
  success: "#65C68A"        # 复制成功
  # 玻璃材质（暖黑棕半透明，blur 后透出暖棕红底）
  glass: "rgba(26,22,16,.55)"
  glass-strong: "rgba(22,18,13,.72)"
  glass-border: "rgba(255,246,230,.10)"
  glass-highlight: "rgba(255,255,255,.14)"
gradients:
  grad-gold: "linear-gradient(135deg,#F4D596,#E0A94B)"   # 大标题金色渐变 background-clip:text
  grad-page: "radial-gradient(120% 120% at 50% 0%,#16120B 0%,#0C0B0A 60%)"  # 深空径向暖黑
  grad-scrim: "linear-gradient(180deg,rgba(8,7,6,0) 0%,rgba(8,7,6,.55) 60%,rgba(8,7,6,.88) 100%)"  # hero 暗角 scrim
typography:
  font-epic: '"Cinzel", "Noto Serif SC", "Songti SC", Georgia, serif'   # 史诗大标题（刻凿衬线 + 思源宋体兜底）
  font-sans: '"Inter", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  font-mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, "PingFang SC", monospace'
  weight-regular: 400
  weight-medium: 500
  weight-semibold: 600   # 史诗标题主力字重（呼应官网 SemiBold）
  weight-bold: 700
rounded:
  sm: "10px"    # 标签、徽标、小图标按钮
  md: "14px"    # 输入、常规按钮、小卡
  lg: "18px"    # 玻璃卡片、弹层
  xl: "20px"    # 大容器、hero 卡、bento 大格
  full: "999px" # 头像、药丸按钮、圆形图标按钮
blur:
  card: "blur(24px) saturate(155%)"     # 卡片玻璃
  nav: "blur(40px) saturate(180%)"      # 导航 / 弹层 / 引流卡（visionOS 强版）
shadow:
  glass: "0 16px 50px rgba(0,0,0,.45)"
  glass-hover: "0 0 0 1px var(--color-gold-glow), 0 14px 50px var(--color-gold-glow)"
  pop: "0 20px 60px rgba(0,0,0,.55)"
motion:
  ease-epic: "cubic-bezier(.22,1,.36,1)"   # 全站主缓动
  dur-fast: "0.18s"
  dur-base: "0.32s"
  dur-slow: "0.6s"
---

# PlanShare 前端设计系统（DESIGN.md）

> 这是 PlanShare 全部页面与组件的**单一真相来源**。任何构建 agent 在写页面前必须先读完本文件，并严格落到这里的令牌、玻璃配方、组件状态与页面规格。所有令牌只在 `src/styles/tokens.css`（CSS 变量）+ `src/styles/tailwind.css`（`@theme`）各定义一次，组件里**禁止硬编码 hex / 字号 / 间距 / blur 数值**。
>
> 风格一句话：**2026 暗色液态玻璃 + 魔兽金，叠一层现代魔兽史诗奇幻氛围**。要做到 OpenAI / visionOS 级高级感，同时有 WoW 官网那种电影级暗场、史诗排版、克制古金的厚重神秘。**绝不能再做成上一版的瑞士极简扁平。**

---

## 1. Overview —— 设计原则与气质参照

**PlanShare 是什么。** STT 战术板分享平台。STT 是已有百万下载量的 WoW 时间轴语音播报 + 战术方案插件。一个「战术板」= 一段可读的战术方案文本（MRT/STN 风格），复制粘贴即用。本站把这些板按 团本 → BOSS 组织，并给作者一个发布舞台。

**目标受众。** ① WoW 团本玩家——想在同一个 BOSS 上「有得选」，对比不同作者的板，复制即用；② 有内容但没渠道的优秀作者——核心激励是「公会引流」：写好板，顺便在作者主页招人。

**气质参照（三条标尺，逐条对齐）。**
1. **OpenAI 官网 / Linear / Vercel**：深色、克制、微妙动态背景、发光描边、精致而不喧闹的动效。暗场不是死黑，是有呼吸的深空。
2. **Apple visionOS / Liquid Glass**：磨砂玻璃面板、空间深度、顶部高光、focus 微缩放（1.02）、Z 轴分层。卡片像悬浮的玻璃片，不是贴在墙上的纸。
3. **World of Warcraft / Blizzard 官网**：电影级暗场氛围（key-art + 暗角 scrim + 一处发光焦点）、史诗排版（金色填充 + 克制投影）、古金装饰（繁复只给 logo，界面骨架极简 1px 暖金 hairline）。

**魔兽体温的来源（吸收自官网实测，务必记牢）。**
- 魔兽的高级感来自**暖黑**而非冷黑/纯黑。基底是暖黑棕 `#0C0B0A → #16120B`，玻璃 blur 后透出的底色也带一点暖棕红，立刻和满大街的冷蓝赛博玻璃拉开档次。
- **双金分工**，别只用一种金：亮金 `#E8B765` 只给「激活态/焦点/强调」（当前选中、hover、关键数字、一根分隔 hairline）；奶金 `#EBDEC2` 给 eyebrow 小标签和正文级强调。
- **CTA = 砖红实心 + 金描边透明**：主按钮用魔兽砖红 `#B23A2E`，次按钮用 1px 金描边的透明玻璃按钮。这套「红实心 + 金描边」直接对标官网。
- **史诗靠字形温度 + 金色填充 + 克制投影**，不靠粗描边/外发光/凿石做旧质感。
- **繁复留给英雄元素（logo/徽章），界面骨架保持现代极简**：section 分隔、激活态一律「1px 暖金 hairline」；卡片用 1px 暖金细描边勾轮廓。
- **材质纹理低调到几乎不可见**：暖黑面板上叠一层极淡（opacity ≈ 0.03–0.05）的羊皮/颗粒纹理给暗场去塑料感，凑近才看得到，不是醒目羊皮纸。

**核心交互价值。** 一键复制（整站第一优先级路径，任何动效都不许干扰它）、有得选（同 BOSS 多板可比较排序）、作者舞台（作者主页 + 公会引流）。

**工程现实约束（重要）。**
- **国内用户优先，禁止把 Google Fonts 当硬依赖。** `Cinzel / Inter` 在国内会卡甚至加载失败。所有字体令牌都**以系统字体栈兜底**（思源宋体/苹方/微软雅黑），断网/字体加载失败时仍然好看。详见 §3。
- **纯前端 + mock 数据，无后端无持久化。** 点赞是本地态（组件内 toggle，不承诺保存）；浏览量是 mock 数字，只读展示。agent 不要为这些生成任何持久化 / 网络请求逻辑。
- **数据模型**以 `src/data/types.ts` 为准（`Raid / Boss / Author / Board`，`difficulty: 'heroic' | 'mythic'`，`bossId` 可为 null）。页面规格里的字段名以该文件为唯一权威。

---

## 2. Colors & Glass —— 颜色与液态玻璃材质令牌

全部语义化命名，在 `tokens.css`（CSS 变量）与 `tailwind.css`（`@theme`）各定义一次。**禁止在任何组件里写裸 hex / 裸 rgba / 裸 blur。**

### 2.1 颜色令牌

| 语义 | CSS 变量 / Tailwind | 值 | 用途 |
|---|---|---|---|
| 暖黑基底 | `--color-bg-base` | `#0C0B0A` | 最底层背景 |
| 抬升面 | `--color-bg-raise` | `#14110C` | 区块底、表层容器（非玻璃处） |
| 深空外圈 | `--color-bg-deep` | `#16120B` | 页面径向渐变外圈（暖棕红向） |
| 暖白主文字 | `--color-ink` | `#F6F1E8` | 标题、正文主文字 |
| 次文字 | `--color-ink-soft` | `#B6AD9D` | 元信息、作者名、说明 |
| 极弱文字 | `--color-ink-faint` | `#6F675B` | 占位、禁用、分隔点 |
| 魔兽金（亮金） | `--color-gold` | `#E8B765` | 链接、激活、强调、关键数字、hairline |
| 亮金 hover | `--color-gold-bright` | `#F2CE86` | hover 提亮 |
| 金加深 | `--color-gold-deep` | `#C8923A` | active、描边暗部 |
| 奶金羊皮 | `--color-gold-cream` | `#EBDEC2` | eyebrow 小标签、次级标题、正文级强调 |
| 金辉 | `--color-gold-glow` | `rgba(232,183,101,.30)` | hover 外发光、focus 内衬 |
| 砖红 CTA | `--color-ember` | `#B23A2E` | 主实心按钮底（核心操作） |
| 砖红 hover | `--color-ember-bright` | `#C8493B` | 主按钮 hover |
| 成功 | `--color-success` | `#65C68A` | 复制成功反馈 |

### 2.2 渐变令牌

```css
--grad-gold:  linear-gradient(135deg, #F4D596, #E0A94B);                  /* 大标题金色文字 background-clip:text */
--grad-page:  radial-gradient(120% 120% at 50% 0%, #16120B 0%, #0C0B0A 60%); /* 页面深空径向暖黑（非纯黑死板） */
--grad-scrim: linear-gradient(180deg, rgba(8,7,6,0) 0%, rgba(8,7,6,.55) 60%, rgba(8,7,6,.88) 100%); /* hero 暗角 scrim */
```

**金色文字配方（史诗标题专用）：**
```css
.text-gold-grad {
  background: var(--grad-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 4px 4px rgba(0,0,0,.15);   /* 仅一层极淡投影，呼应官网；禁止外发光/粗描边 */
}
```

### 2.3 液态玻璃材质令牌（卡片 / 导航 / 引流卡 / 弹层 / 筛选控件都要玻璃）

```css
--glass:            rgba(26,22,16,.55);     /* 普通玻璃填充（暖黑棕） */
--glass-strong:     rgba(22,18,13,.72);     /* 强版玻璃（导航/弹层/引流卡） */
--glass-border:     rgba(255,246,230,.10);  /* 玻璃 1px 描边 */
--glass-highlight:  rgba(255,255,255,.14);  /* 顶部高光 */
--blur-card:        blur(24px) saturate(155%);  /* 卡片模糊 */
--blur-nav:         blur(40px) saturate(180%);  /* 导航/弹层 visionOS 强版 */
--shadow-glass:       0 16px 50px rgba(0,0,0,.45);
--shadow-glass-hover: 0 0 0 1px var(--color-gold-glow), 0 14px 50px var(--color-gold-glow);
--shadow-pop:         0 20px 60px rgba(0,0,0,.55);
```

**玻璃组件类（写进 `tailwind.css`，组件直接 `className="glass"`）：**

```css
/* 普通玻璃卡片 */
.glass {
  position: relative;
  background: var(--glass);
  backdrop-filter: var(--blur-card);
  -webkit-backdrop-filter: var(--blur-card);   /* 必带 webkit 前缀 */
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass);
}
/* 顶部高光（visionOS 玻璃片的关键质感） */
.glass::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 1px 0 0 var(--glass-highlight);
}
/* 强版玻璃（导航/弹层/引流卡） */
.glass-strong {
  background: var(--glass-strong);
  backdrop-filter: var(--blur-nav);
  -webkit-backdrop-filter: var(--blur-nav);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass);
}
```

**玻璃配方两套（对应技能 v2.5.0 双范式，按场景选用）：**
- **VisionOS 配方**（导航/弹层/引流卡/详情大块）：`blur(40px) saturate(180%)` + rgba 玻璃 + depth 阴影 + focus `scale(1.02)`。
- **Glassmorphism 配方**（普通卡片/筛选控件/标签）：`blur(24px) saturate(155%)` + 1px 亮描边 + Z 分层。

**用途约束（双金克制是高级感命脉）。**
- **亮金 `#E8B765` 是稀缺资源**：只点在「激活态 / 焦点 / hover 强调 / 关键数字 / 一根 hairline」。**禁止大面积金底、金色大字满屏**，多了立刻俗。
- **奶金 `#EBDEC2`** 给 eyebrow（小标签如「精选」「按团本浏览」）和正文级强调。
- **CTA 分工**：主操作（复制）= 砖红 `#B23A2E` 实心；次操作 = 1px 金描边透明玻璃按钮（`secondary`）。一屏内砖红实心**最多一个**。
- 链接文字用亮金，hover 变 `gold-bright` 并加一根金 hairline 下划线。
- 难度标签（英雄/史诗）= 玻璃底 + `ink-soft` 文字 + `glass-border` 描边。**严禁给难度上色，靠文字区分。**
- **严禁紫 / 蓝紫 / 彩虹虹彩（iridescent / chromatic）一律禁**。职业色/阵营色只能活在插画 key-art 里，UI 层永远是「暖黑 + 金 + 一点砖红」。
- 本站只有暗色一种模式。

---

## 3. Typography —— 史诗排版

**三套字体栈（令牌名 + 值，照抄到 tokens.css / @theme）。**

```css
--font-epic: "Cinzel", "Noto Serif SC", "Songti SC", Georgia, serif;  /* 史诗大标题 */
--font-sans: "Inter", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
--font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, "PingFang SC", monospace;
```

- **`--font-epic`**：史诗大标题专用。Latin 用 Cinzel（刻凿衬线，有奇幻厚重骨架），CJK 兜底思源宋体/宋体。仅用于 hero 大标题、精选区/页面级 H1、品牌 wordmark、大数字展示。配**金色渐变 + 一层极淡投影**（见 §2.2），呼应 WoW 标题厚重感。**一个页面里 epic 出现次数应是个位数。**
- **`--font-sans`**：UI 与正文默认字体（Inter + 系统/苹方兜底）。绝大多数文字用它。
- **`--font-mono`**：战术文本块、导入码块。保留原始换行与对齐，这是 MRT/STN 文本的可读性命脉。

**史诗标题的正确做法（吸收自官网，必须遵守）。**
- 史诗感靠**字形温度（Cinzel 的古典刻凿骨架）+ 金色渐变填充 + 一层极淡投影**，**不靠粗描边、不靠外发光、不靠做旧石刻质感**——那是十年前山寨魔兽风，显土显廉价。
- 字重主力 `600`（SemiBold，呼应官网），字距略放（`letter-spacing: 0.02em`），大标题常 `text-transform: uppercase`（Latin）/ 中文保持原字。
- 投影只允许 `text-shadow: 0 4px 4px rgba(0,0,0,.15)` 这一层极淡阴影。

**网络字体加载规则（国内现实约束，强制）。**
- **绝不允许**阻塞式 `@import` Google Fonts，也不允许把 `Cinzel/Inter` 设为唯一字体而无系统兜底。
- 若加载网络字体，必须 `<link>` 异步 + `font-display: swap`，上面系统栈完整兜底。**断网时页面必须照常好看**——验收红线。CJK 史诗标题断网时落到思源宋体/宋体，依然厚重耐看。
- v1 直接依赖系统栈不加载网络字体也完全可接受。

**字阶（令牌化，rem，根 16px）。**

| 角色 | 令牌 | 字号 / 行高 | 字重 | 字体 | 用途 |
|---|---|---|---|---|---|
| 电影级 Hero | `--text-hero` | 56px / 1.1 | 600 | epic | 首页 hero 主标题（金色渐变） |
| 展示大标题 | `--text-display` | 40px / 1.15 | 600 | epic | 精选区 / 页面级 H1（金色渐变） |
| 页面标题 H1 | `--text-h1` | 30px / 1.2 | 600 | epic 或 sans | 团本页标题、作者名 |
| 区块标题 H2 | `--text-h2` | 22px / 1.3 | 600 | sans | BOSS 区块标题、详情页板名 |
| 小标题 H3 | `--text-h3` | 18px / 1.4 | 500 | sans | 卡片内板名、分组小标题 |
| 正文 | `--text-body` | 15px / 1.6 | 400 | sans | 描述、简介、说明 |
| 元信息 | `--text-meta` | 13px / 1.5 | 400 | sans | 作者名、浏览量、日期 |
| Eyebrow / 小字 | `--text-caption` | 12px / 1.4 | 500 | sans | 奶金小标签、角标、版本号 |
| 战术文本 | `--text-code` | 14px / 1.7 | 400 | mono | 战术文本块、导入码 |

**字重约束。** 正文区只用 `400`，强调 `500`；史诗标题 `600`；`700` 仅极少数大数字。**层级靠字号 + 留白 + 颜色 + 字体（epic vs sans），不靠堆字重。** 禁止 `800/900`。

**中文排版。** 正文行高 1.6，标题 1.1–1.4。战术文本块**逐字呈现，不做任何重排或美化**。

---

## 4. Layout & Spacing —— 布局与间距

**8px 基准间距阶（令牌化）。** 只允许从这一阶取值，禁止 7px/13px 游离值。

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-6: 24px;  --space-8: 32px;  --space-12: 48px; --space-16: 64px;  --space-24: 96px;
```

**容器与栅格。**
- 内容最大宽度 `--container-max: 1180px`，水平居中，两侧内边距移动端 `--space-4`、桌面 `--space-8`。
- 板子详情正文阅读宽度 `--container-read: 860px`。
- 暗场要靠**大留白 + 深度分层**呼吸，不是把玻璃卡片堆满屏。

**响应式断点（4 档，必测）。**

```css
--bp-sm: 375px;   /* 移动小屏：单列 */
--bp-md: 768px;   /* 平板：网格 2 列 */
--bp-lg: 1024px;  /* 桌面：网格 3 列、详情页可两栏 */
--bp-xl: 1440px;  /* 大屏：维持 container-max 居中，不无限拉宽 */
```

- 移动端（<768）：卡片网格塌成单列；导航精简横排（v1 导航项少，不做汉堡）。
- 桌面（≥1024）：卡片网格 3 列；详情页元信息可右侧栏。
- 大屏（≥1440）：内容保持 `container-max` 居中，**不要拉满全宽**——留白是高级感的灵魂。

**列表/卡片栅格。** 板子列表用 `repeat(auto-fill, minmax(300px, 1fr))`，gap = `--space-6`。Bento 精选区见 §9.1。

---

## 5. Three.js 背景 —— 余烬奥术暗场（+ 降级）

全站铺一层**固定（`position: fixed; inset: 0; z-index: -1`）**的 three.js 画布，营造 WoW 官网首屏那种「暗金 + 微弱奥术雾气 + 缓慢漂浮余烬/尘埃微光（embers/dust motes）」的电影级氛围。**绝非普通抽象渐变。** 组件名 `src/components/EmberBackground.tsx`，用 `@react-three/fiber` + `@react-three/drei`。

**视觉规格（一处发光焦点胜过满屏粒子）。**
- **底色**：画布之上叠 CSS `--grad-page` 深空径向暖黑作底；three 场景背景透明，只画粒子与雾气。
- **余烬粒子**：~ 160–240 个点（`Points` + 自定义 shader 或 `drei` 的 `Points`/`Sparkles`），颜色在金 `#E8B765` ↔ 奶金 `#EBDEC2` 之间随机，尺寸 1–3px，**缓慢向上漂浮**（y 速度极小，类似余烬上升），带轻微水平扰动与 sin 呼吸式 opacity（0.2–0.8）。整体密度低、稀疏，靠暗场衬托。
- **奥术雾气**：1–2 层超大柔焦光斑（径向 alpha 渐变 sprite 或低频 noise plane），暖金色，opacity ≈ 0.06–0.12，极缓慢平移/旋转（周期 ≥ 30s），制造「神秘奥术」呼吸感。
- **暗角 vignette**：画布或外层 CSS 叠一圈径向暗角（四周压暗），保证中心内容区可读、边缘电影感。
- **焦点**：粒子在视口中上部（hero/品牌区）略密、略亮，形成「一处发光焦点」；其余区域稀疏。**禁止满屏粒子乱飞抢可读性。**
- **色彩纪律**：只用暖金/奶金/暖橙，**严禁紫/蓝/彩虹**。

**性能与降级（强制）。**
- 帧率目标 60fps；粒子数与 DPR 上限（`dpr={[1, 1.5]}`）控制开销；`frameloop="always"` 但运动极缓，GPU 负载低。
- 文档不可见时（`document.hidden`）暂停渲染。
- **`prefers-reduced-motion: reduce`**：停止粒子运动，退化为**静态**的金色尘埃点 + 径向暗金渐变（纯 CSS `--grad-page` + 一张静态噪点/光斑图层），不再跑 RAF。
- **WebGL 不可用 / 移动低端 / 首屏未就绪**：降级为纯 CSS 背景——`--grad-page` 深空径向暖黑 + 一层极淡颗粒纹理（`opacity: .04` 的 noise，见 §2 材质纹理）+ CSS 暗角。页面在无 three.js 时**必须依然完整好看**，three 背景是增强而非必需。
- three 背景**绝不承载任何内容/可点元素**，纯氛围；`pointer-events: none`。

---

## 6. Framer Motion —— 动效规格

全站主缓动 `--ease-epic: cubic-bezier(.22,1,.36,1)`。所有动效**尊重 `prefers-reduced-motion`**（reduce 时去掉位移/缩放/光扫，只保留瞬时 opacity 或直接无动画）。**禁止 layout-shift 卡顿**：用 `transform`（translate/scale）+ `opacity`，绝不过渡 `width/height/top/left`。

| 场景 | 规格 |
|---|---|
| **进场 stagger** | 列表/网格用 `staggerChildren: 0.06`（60ms）；每项 `initial={{opacity:0, y:16}} → animate={{opacity:1, y:0}}`，`duration: 0.6`，ease-epic。视口触发用 `whileInView` + `viewport={{ once: true, margin: "-10%" }}`。 |
| **卡片 hover** | 上浮 `y: -4` + 金辉描边（`--shadow-glass-hover`）+ 一道**斜向光扫**（45° 高光从左下扫到右上，`::after` 渐变 + transform，约 0.6s）。visionOS 玻璃片质感。 |
| **focus 微缩放** | 可聚焦玻璃元素 `:focus-visible` / `whileFocus` `scale: 1.02` + focus ring，呼应 visionOS spatial focus。 |
| **路由过场** | `AnimatePresence mode="wait"`，页面 `initial={{opacity:0, y:12}}` / `animate` / `exit={{opacity:0, y:-12}}`，`duration: 0.32`，ease-epic。 |
| **复制成功** | CopyButton 图标 morph 成对勾（路径或交叉淡入）+ 微动（scale 1→1.12→1，0.32s）；同时玻璃 Toast 从底/顶滑入（opacity + y）。 |
| **数字 count-up** | 浏览量大数字 / 点赞数用 count-up（`useMotionValue` + `animate`，约 0.8s ease-out），进视口触发一次。reduce 时直接显示终值。 |
| **奥术呼吸** | hero 品牌徽章可有极缓慢的金辉呼吸（opacity / scale 微幅，周期 ≥ 4s），作为唯一发光焦点。 |

**动效纪律。** 动效服务于「高级感 + 史诗氛围」，绝不干扰「复制即用」核心路径。**禁止 scale 弹跳过度、禁止满屏光效、禁止炫光骨架。** 复制按钮的反馈优先级高于一切装饰动效。

---

## 7. Components —— 组件清单

下列组件即 `src/components/` 应实现的共享组件。每个组件**所有状态都必须实现并可见**。所有可点元素：`cursor: pointer` + 清晰 hover + 可见 focus ring（`outline: 2px solid var(--color-gold); outline-offset: 2px`）+ 玻璃上文字对比度 ≥ 4.5:1。图标一律 inline SVG（Lucide 风格 path，描边色 `currentColor`），**严禁 emoji 当图标**。**所有面板/卡片/控件默认走玻璃**（`.glass` / `.glass-strong`），不做扁平实底。

### 7.1 Button（按钮）

三种变体，对标官网「红实心 + 金描边」。

- **`primary`**：砖红 `ember` 实心 + `ink` 文字，玻璃高光叠层（顶部 `glass-highlight`），用于核心操作。一屏最多一个。
- **`secondary`**：1px 金描边透明玻璃（`.glass` 底 + `gold` 描边 + `gold` 文字），对标官网次级 CTA。
- **`ghost`**：纯文字（透明 + `ink-soft`），用于导航/次要。
- 尺寸：`md`（高 44px，默认，圆角 `--radius-md`）、`sm`（高 36px）；可药丸 `--radius-full`。

| 状态 | primary（砖红实心） | secondary（金描边玻璃） | ghost |
|---|---|---|---|
| default | ember 底 / ink 字 / 顶高光 | 玻璃底 / gold 描边 / gold 字 | 透明 / ink-soft 字 |
| hover | 底 `ember-bright` + 金辉外发光 | 描边 `gold-bright` + `--shadow-glass-hover` + 字 `gold-bright` | 字 `ink` + 玻璃底浮现 |
| active | `scale(.98)`（不位移布局） | 同左 | 同左 |
| focus | focus ring + `scale(1.02)` | focus ring + `scale(1.02)` | focus ring |
| disabled | 玻璃灰底 / `ink-faint` 字 / `cursor:not-allowed` / 无 hover | `ink-faint` 字 / 描边 `glass-border` / 禁用 | `ink-faint` / 禁用 |

### 7.2 Nav（顶部导航）

悬浮在 three 背景之上的**半透明暖黑玻璃条**（`.glass-strong`，`blur(40px)`），对标官网顶部玻璃导航。左 wordmark（epic 字体 + 金色渐变，点击回首页），右侧导航链接。底部一条 1px 暖金 hairline（`gold-glow` 极淡）。

- **变体**：`default`（玻璃条，吸顶 `position: sticky; top: 0`）。
- 状态：链接 default = `ink-soft`；hover = `ink` + 一根金 hairline 下划线；当前页 active = `gold` + 金 hairline 常驻；focus = focus ring。
- 移动端：导航项横向精简排列，不做汉堡。

### 7.3 RaidEntryCard（团本入口卡）

首页/目录页大入口卡（玻璃 `.glass`），点击进团本目录。含：团本名（H3，`ink`）、补丁号（caption，奶金 `gold-cream`）、BOSS 数量/简短描述（meta，`ink-soft`）。卡片左侧或角落可有**极简暗金装饰 hairline**（1px，点到为止，非繁复鎏花）。

- **变体**：`default`、`featured`（精选团本，右上 FeaturedBadge）。
- 状态：default = 玻璃卡；hover = 上浮 `y:-4` + 金辉描边 + 斜向光扫 + 团本名变 `gold`；active = `scale(.98)`；focus = focus ring + `scale(1.02)`。整卡可点（`<a>` 包裹）。

### 7.4 BossListItem（BOSS 列表项）

目录页内某团本下的 BOSS 行/卡（玻璃），点击滚动到该 BOSS 的板列表。含：BOSS 名（H3）、序号（`order`，caption）、该 BOSS 下板数量（meta）。

- **变体**：`row`（桌面行式，左侧 1px 暖金竖线作 order 标记）、`card`（移动卡式）。
- 状态：default / hover（玻璃提亮 + 名变 `gold` + 金 hairline）/ active / focus。

### 7.5 PlanCard（板子卡片）

列表里代表一块战术板的玻璃卡片，点击进详情。含（自上而下）：板名（H3，`ink`）、难度标签（DifficultyBadge）+ 赛季版本（caption，`gold-cream`）、作者署名（AuthorByline 精简版）、一行描述（body，截断 1–2 行）、底部元信息行（ViewBadge 浏览量 + LikeButton 点赞数）。精选板右上挂 FeaturedBadge。卡片 1px 暖金细描边勾轮廓。

- **变体**：`default`、`featured`（带精选角标 + 略强玻璃 + 角落金 hairline 装饰）、`compact`（作者主页列表用，更紧凑）。
- 状态：default / hover（上浮 + 金辉描边 + 斜向光扫，板名变 `gold`）/ active / focus（整卡 focus ring + `scale(1.02)`）/ `loading`（玻璃骨架：低对比玻璃块 + 极轻 shimmer，**不要炫光**）/ 列表 `empty` 由 EmptyState 承担。

### 7.6 PlanTextBlock（可读战术文本块）

详情页主体，呈现 `contentText`。玻璃容器但内层战术文本区用更暗的 `glass-strong` 底保证 mono 文本对比度。

- font-mono（`--text-code`）、玻璃底、圆角 `--radius-lg`、内边距 `--space-4`、`white-space: pre-wrap`（**保留原始换行与空格**）、超长纵向滚动（`max-height` + `overflow-y:auto`），右上角浮 icon 版 CopyButton。
- **变体**：`content`（战术正文）、`importcode`（导入码块，单行可横向滚动 + CopyButton）。
- 状态：default；滚动条系统默认；focus（块可聚焦键盘滚动，focus ring）。**逐字呈现，绝不改写、绝不语法高亮成花哨颜色**（最多 `ink` 单色 + 关键行可奶金）。**玻璃上 mono 文本对比度必须 ≥ 4.5:1**，不达标就加深底。

### 7.7 CopyButton（一键复制按钮）

整站第一优先级交互。

- **变体**：`primary`（详情页主复制，砖红实心，「复制战术」文字 + 复制图标）、`icon`（文本块右上角玻璃小图标按钮）。
- 状态（**copied 成功态必须做**）：
  - `default`：复制图标 + 文字「复制战术」。
  - `hover`：ember → `ember-bright` + 金辉（primary）/ 玻璃提亮（icon）。
  - `active`：`scale(.98)`。
  - `focus`：focus ring + `scale(1.02)`。
  - `copied`（成功态，约 1.5s）：图标 morph 成对勾 + 文字「已复制」+ 颜色 `success` + 微动（见 §6）；随后自动回 default。**核心反馈，必须明确可感知。** 同时触发 Toast（§7.16）。
  - `disabled`：无可复制内容时玻璃灰显（极少见）。

### 7.8 LikeButton（点赞按钮）

本地态切换，**不持久化**（mock）。心形/拇指 SVG + 点赞数。

- **变体**：`default`（带数字）、`compact`（卡片底栏小尺寸）。
- 状态：
  - `idle`（未赞）：图标描边态 `ink-soft`，数字 `ink-soft`。
  - `hover`：图标/数字变 `gold`。
  - `active`（已赞 toggle on）：图标实心 `gold` + 金辉微光，数字 `gold`，数字 +1（仅本地内存，可 count-up）。
  - `focus`：focus ring。
  - 无障碍：`aria-pressed` 表达赞/未赞，不靠纯色传达。
- 点赞数是 mock 起始值，仅当前会话 +1/-1，刷新还原。**不写任何保存逻辑。**

### 7.9 ViewBadge（浏览量徽标）

只读展示。眼睛 SVG + 数字（`ink-soft`，meta 字号）。详情页大数字走 epic 字体 + count-up。

- **变体**：`inline`（卡片底栏）、`large`（详情页元信息区，epic 大数字 + 进场 count-up）。
- 状态：仅 default（非交互）。数字可 `1.2k` 简写，**始终带图标 + 数字文本**，不靠纯色传达。

### 7.10 DifficultyBadge（难度标签）

显示 `heroic`（英雄）/ `mythic`（史诗）。**玻璃中性，禁止彩色。**

- 玻璃底（`.glass` 淡版）+ `ink-soft` 文字 + `glass-border` 描边，圆角 `--radius-sm`，caption 字号。
- **变体**：`heroic`（文字「英雄」）、`mythic`（文字「史诗」）——**仅文字不同，配色完全一致**，靠文字区分难度。
- 状态：仅 default（非交互）。

### 7.11 FeaturedBadge（精选角标）

玻璃底 + 奶金 `gold-cream` 文字 + 1px 暖金描边，圆角 `--radius-sm`，文字「精选」+ 可选星形 SVG（金色，极小）。仅 default 态，非交互。挂精选卡右上角。**不做实心金大色块。**

### 7.12 AuthorByline / AuthorHeader（作者署名 / 作者头部）

- **AuthorByline（行内署名）**：小头像（`--radius-full` 玻璃描边，无图用首字母占位块）+ 作者名（meta，可点，链接色行为）。用在 PlanCard 与详情页。状态：default / hover（名变 `gold`）/ focus。
- **AuthorHeader（作者主页头部）**：大头像（玻璃描边 + 极淡金辉环，作为该页唯一「徽章式发光焦点」）+ 昵称（H1，epic 金色渐变）+ 简介 `bio`（body，`ink-soft`）。仅展示，无图首字母占位。

### 7.13 GuildRecruitCard（公会引流卡）

**只在作者主页出现，绝不在板子详情页出现**（硬规则）。强玻璃 `.glass-strong`。含：公会名 `guildName`（H3）、招募说明 `guildRecruit`（body）、联系方式 `guildContact`（meta，可复制或可点）、一个 `secondary`（金描边玻璃）或 `primary`（砖红）「联系/了解」按钮。

- 视觉上比普通卡片略突出：左侧 4px 暖金竖条 或 卡角一处极简金 hairline 装饰；**仍不用渐变堆叠、不抢战术内容主体**。
- **变体**：`filled`（作者填了公会信息时渲染）。未填则**整卡不渲染**（不显示空壳）。
- 状态：卡片 default；内部按钮走 §7.1。

### 7.14 SortControl（排序控件）

同 BOSS 多板时的排序。固定三档：**点赞 → 浏览量 → 最新**（默认且唯一排序链，见 §9）。玻璃分段控件。

- 形态：玻璃 segmented 控件（`.glass` 容器 + 内部分段）。优先分段按钮（可见、无需展开）。
- 状态：每段 idle = `ghost` 文字态（`ink-soft`）；选中 = `gold` 文字 + 段底浮起玻璃高亮 + 下方 1px 暖金 hairline；hover；focus（focus ring）。`aria-pressed` / `role="radiogroup"` 表达单选。

### 7.15 EmptyState（空态）

列表为空时展示。含：一个克制的 inline SVG 线性图标（非 emoji，单色 `ink-faint`）+ 一行说明（`ink-soft`）+ 可选 `secondary` 按钮。**无炫彩、无插画大图。** 可放在淡玻璃容器内。仅 default 态。

### 7.16 Toast（复制成功提示）

复制成功后从顶/底滑入的玻璃提示条（`.glass-strong` + `--shadow-pop` + 对勾 SVG `success` 色 + 文字「已复制到剪贴板」）。

- 状态：`enter`（opacity + translateY 滑入，0.18–0.32s ease-epic）→ 停留约 1.5s → `exit`（淡出）。**不阻塞操作、不需手动关闭、不堆叠**（同时只显示一条，新触发替换旧的）。
- 只用 opacity + transform，不用 scale 弹跳。

---

## 7B. 组件库（ui/）—— SSOT 原语单一权威

> `src/components/ui/` 是全站**视觉原语的唯一权威**。任何按钮、玻璃卡、标签、头像、统计、骨架、空态、面包屑、区块标题、命名图标，**只能从这里取**，禁止再在页面或业务组件里手写一套。消费方统一从 `src/components/ui/index.ts` 一处导入。
>
> 铁律：原语只用 `tokens.css` / `@theme` 的 `var(--...)`，**零裸值**；动效复用 `src/lib/motion.ts` 的 variants；可点元素 `cursor-pointer` + hover 反馈 + `:focus-visible` 金环（全局基线已给）；图标一律 inline SVG（走 `Icon`），严禁 emoji；只渲染传入的真实数据，占位用中性词。`§7` 的业务组件（BoardCard / CopyButton / LikeButton / GuildCard 等）应在重构阶段改为**基于这些原语组装**，不再各自重复玻璃 chrome / SVG / 首字母块。

### 7B.1 `Icon` —— 命名图标单一来源

- **用途**：收口全站内联重复的 Lucide 风格 SVG，`<Icon name=".." size=.. />` 渲染，各处不再手写 path。
- **变体（name）**：`arrow`（右箭头）/`star`（实心星）/`eye`（浏览）/`heart`（点赞，`filled` 切实心）/`copy`/`check`（对勾）/`chevron`（面包屑分隔）/`empty`（空态线框）/`error`（警示三角）/`author`（作者占位）/`question`（未找到问号）。
- **状态/无障碍**：传 `label` → `role="img"` + `aria-label`（语义图标）；不传 → `aria-hidden`（装饰图标）。描边图标 `currentColor` 跟随父级文字色。
- **替代**：CopyButton 的 Copy/Check、Stat/Home/Detail 的 Eye/Heart、BoardCard/Home 的 Star、Home 的 arrow、Category 的 Chevron/Empty/Error、Author 的 author/empty、Detail 的 question/check —— 全部内联 SVG path 收敛到此一处。

### 7B.2 `Button` —— 权威按钮

- **用途**：整站唯一按钮。`to` → 渲染 react-router `Link`（导航）；不传 `to` → 原生 `<button>`（`onClick`/`disabled`/`type`）。`leadingIcon`/`trailingIcon` 走 `Icon`。
- **变体**：`primary`（砖红渐变材质实心）/`secondary`（金描边玻璃）/`ghost`（透明金字）。
- **尺寸**：`md`（高 44，默认）/`sm`（高 36）；`pill` 切药丸圆角。
- **状态**：default / hover / active / focus（`:focus-visible` 金环）/ disabled（仅 button 形态，玻璃灰显 + `not-allowed`）。
- **primary 材质（已锁定）**：渐变 `linear-gradient(180deg, --ember-grad-top, --ember-grad-bottom)` + 1px 暖边 `--ember-border` + inset 顶高光 `--ember-highlight` + 暖辉 depth `--ember-glow` + 贴地暗影 `--ember-depth`；`::before` 顶部一层柔光 `--ember-sheen` 做玻璃感。hover 渐变提亮（`--ember-grad-*-hover`）+ `translateY(-1px)` + 加金辉；active 落回 `translateY(0)` + 压暗（`--ember-press`）。修掉旧的扁平廉价砖红。
- **替代**：Home 的 `.home-btn--primary/secondary`、Category/Author/Home 各空态里的 `__action` 重试/返回链接、CopyButton 的 primary 实底（重构后 CopyButton 复用本按钮的 primary 材质）。

### 7B.3 `GlassCard` —— 玻璃面板原语

- **用途**：`.glass` / `.glass-strong` 的组件化封装。`tone`（玻璃强度）、`as`（`div`/`article`/`li`/`section` 语义标签）、`interactive`（开启 hover 上浮 + 金辉描边 + 斜向光扫）、`to`（包 `Link` 整卡可点）。
- **状态**：静态玻璃面板，或 `interactive` 交互卡（复用 `cardHover` + `glassSweep`，reduce 时去位移与光扫）。
- **替代**：BoardCard 外壳、Home 团本入口卡 / Hero 浮卡的玻璃 chrome + sweep、GuildCard 外壳、各 EmptyState/Skeleton 的 `.glass` 容器 —— 不再各写一套 background+blur+border+顶高光+depth 阴影+光扫。

### 7B.4 `Tag` —— 小标签 / 徽标原语

- **用途**：小标签 / 徽标，可选前置 `icon`。
- **变体**：`neutral`（中性玻璃 chip，难度/赛季，靠文字不上色）/`gold`（奶金药丸，eyebrow/精选角标，可挂极小金 star）。
- **状态**：仅 default（非交互）。
- **替代**：`DifficultyTag`（英雄/史诗）、BoardCard/Detail 的赛季 `__season` span、BoardCard/Home 的精选角标、各 eyebrow 药丸。难度英雄/史诗**只换文字不换色**。

### 7B.5 `Avatar` —— 首字母玻璃圆

- **用途**：首字母占位圆（暖金描边），`size` 配直径，字号随直径联动。
- **状态**：纯装饰占位（`aria-hidden`），语义由外层链接/作者名承担。
- **替代**：BoardCard `__avatar`、Hero 浮卡 `__card-avatar`、Detail 作者署名 `__avatar`、Author 头部 `__avatar` 四处重复的首字母方块。

### 7B.6 `Stat` —— 图标 + 数字（只读）

- **用途**：浏览/点赞只读展示，`kind`（`view`/`like`）决定图标，`display` 可传 count-up 实时文本（a11y label 始终用终值）。
- **变体/尺寸**：`inline`（卡片底栏紧凑 ink-soft）/`large`（详情侧栏金图标 + epic 大数字）。
- **状态**：仅 default（非交互），始终「图标 + 文本」并存，不靠纯色传达。
- **替代**：旧 `Stat`、Hero 浮卡内联 metric、Detail 侧栏 `ViewCountUp` 的图标+数字结构。

### 7B.7 `Skeleton` —— 加载占位块

- **用途**：玻璃低对比占位。`Skeleton`（`shape`=`line`/`block`/`circle` + `width`/`height`）、`SkeletonText`（多行，末行收窄）、`SkeletonCard`（与板卡同形玻璃占位）。
- **状态**：仅极缓 `opacity` 呼吸（周期 1.8s），**无 shimmer / 无炫光 / 无斜向光扫**；`prefers-reduced-motion` 下呼吸停止。
- **替代**：Home 的 `home-skel*`、Category 的 `ps-skel*`（含 shimmer，统一改为呼吸）、Author 的 `ps-skel*`、Detail 的 `ps-skel-line/block`。

### 7B.8 `EmptyState` —— 空态 / 错误态

- **用途**：线框 `Icon`（单色 ink-faint）+ 一行说明 + 可选 `secondary` 重试 `Button`。`icon` 选 `empty`/`error`/`author`/`question`；`boxed` 控制是否包淡玻璃容器。
- **状态**：仅 default；`role="status"`。无炫彩、无插画大图。
- **替代**：Home 内联 `EmptyState`、Category 的 `EmptyState`（empty/error）、Author 的空态/错误态、Detail 的 `DetailFallback`。

### 7B.9 `Breadcrumb` —— 面包屑

- **用途**：`items: { label, to? }[]`，chevron 分隔；带 `to` 的项是链接（ink-soft → hover 金），末项当前页金色不可点（`aria-current="page"`）。`tone` 选玻璃药丸 / 强玻璃条。
- **状态**：链接 default / hover；当前项金色静态。
- **替代**：Category 的 `ps-cat-crumb`、BoardDetail 的 `ps-detail__crumbs`。

### 7B.10 `SectionHeading` —— 区块标题

- **用途**：奶金 `eyebrow`（前缀暖金 hairline + 奶金小标）+ 大标题，可选 `trailing`（如计数）。`as`（`h1`/`h2`）、`titleId`（供 `aria-labelledby`）、`size`（`display`/`h2`）。
- **状态**：仅 default。
- **替代**：Home 的 `home-section__head`、Category 团本头标题结构、Author 的 `ps-author__boards-head`、Detail 的 `ps-detail__siblings-title` 等重复的「eyebrow + 标题」。

### 7B.11 新增令牌（主按钮材质 + 光扫，已写入 `tokens.css` / `@theme`）

为让 `Button` primary 材质与玻璃光扫**也零裸值**，新增以下令牌（单一权威在 `tokens.css`，`@theme` 同步镜像）：`--ember-grad-top/-bottom`、`--ember-grad-top-hover/-bottom-hover`、`--ember-text`、`--ember-border`、`--ember-highlight`、`--ember-glow`、`--ember-sheen`、`--ember-depth`、`--ember-press`、`--glass-sweep`。

---

## 8. Accessibility —— 可访问性清单

提交前逐项自检：

- **玻璃上对比度 ≥ 4.5:1**：`ink #F6F1E8` on 玻璃/暗场远超标准；`ink-soft #B6AD9D` on `glass` 达 AA；`gold #E8B765` on 暗场达 AA（文字/链接安全）。**战术文本块 mono 文本必须 ≥ 4.5:1**——玻璃透出底色后若不达标，加深 `glass-strong` 底或加暗底板。**不要把正文降到 `ink-faint` 当主文字。**
- **玻璃文字可读红线**：任何玻璃面板上的正文，背后 three 余烬/亮区不得使其低于对比阈值；必要处玻璃下垫一层暗 scrim。
- **可见焦点环**：所有可聚焦元素 `:focus-visible` 必须有 `outline: 2px solid var(--color-gold); outline-offset: 2px`，**禁止 `outline:none` 不给替代**。
- **键盘可达**：CopyButton、LikeButton、SortControl、卡片链接全部 Tab 可达、Enter/Space 可触发；复制键盘触发后同样进 `copied` 态 + Toast。
- **语义与 ARIA**：可点整卡用 `<a href>`；LikeButton 用 `<button aria-pressed>`；SortControl 用 `aria-pressed` / `role="radiogroup"`；CopyButton 成功用 `aria-live="polite"` 宣告「已复制」；装饰 SVG `aria-hidden="true"`，语义图标配 `aria-label`。
- **不靠纯色传达信息**：难度靠文字、浏览量靠图标+数字、点赞靠图标形态+aria-pressed。
- **图标即 SVG**（Lucide 风格），**严禁 emoji**。
- **响应式可用**：375/768/1024/1440 四档下不溢出、不重叠、可点区域 ≥ 44px。
- **尊重 `prefers-reduced-motion`**：three 背景停运动、Framer 动效退化为瞬时/无动画（见 §5、§6）。
- **断网可读**：网络字体失败系统栈兜底；three 不可用降级纯 CSS 暗场，页面完整可读。

---

## 9. Page Specs —— 四个页面级规格

路由：`/` → Home；`/raid/:raidId` → Category；`/board/:boardId` → BoardDetail；`/author/:authorId` → Author。每页配同名样式，**禁止多文件往同一 CSS 追加**。

所有页面通用骨架：固定 three 余烬背景（§5）+ 顶部玻璃 `Nav`（§7.2）+ 主内容区（`container-max` 居中）+ 极简玻璃页脚（站点名 + 一行说明，`ink-faint`）。路由切换走 §6 `AnimatePresence` 过场。

### 9.1 Home（首页）—— `/`

**目标**：第一眼传达「这是个能挑战术板、有作者舞台的地方」，电影级氛围，并把人导向团本目录与精选板。

布局骨架（自上而下）：
1. **电影级 Hero**：three 余烬背景在此处略密、略亮（一处发光焦点）。中央偏上放 epic 字体金色渐变大标题（`--text-hero`，如「找一块顺手的战术板」），上方一行奶金 eyebrow 小标签（`gold-cream`，如「STT 战术板分享」），下方一句副标题（body，`ink-soft`）+ 一个 `primary` 行动按钮（如「按团本浏览」）。Hero 底部叠 `--grad-scrim` 暗角保证文字可读。**非对称电影排版，绝不做居中纹章盾牌+绶带的 fan-made 旗帜风。** 可在标题侧/上放一个发光徽章式品牌图标（金辉呼吸，§6）作为唯一焦点。
2. **精选区（Featured）—— Bento 网格**：奶金 eyebrow「精选」+ epic 区块标题。内容用 **bento 玻璃网格**（大小格混排：1 个大格 + 数个小格，`grid` 跨列跨行）承载 3–6 张精选板（取 `isFeatured===true`），每格是 `PlanCard variant="featured"`（玻璃 + 进场 stagger + hover 斜向光扫）。响应式：桌面 bento、平板 2 列、移动单列。
3. **团本入口区**：奶金 eyebrow「按团本浏览」+ H2。`RaidEntryCard` 玻璃网格（每团本一卡，点击进 `/raid/:raidId`），桌面 3 列 / 平板 2 列 / 移动单列，进场 stagger。

用到组件：`Nav`、`RaidEntryCard`、`PlanCard(featured)`、`FeaturedBadge`、`ViewBadge`、`LikeButton`、`AuthorByline`、`DifficultyBadge`、`EmptyState`（精选为空时）、`EmberBackground`。

### 9.2 Category（分类目录）—— `/raid/:raidId`

**目标**：团本 → BOSS → 板列表三级浏览，让用户在某 BOSS 下「有得选」。

布局骨架：
1. **团本头**：团本名（H1，epic 金色渐变）+ 补丁号 `patch`（caption，奶金）+ 面包屑（首页 / 团本名，`ink-soft`，当前项 `gold`）。
2. **BOSS 分组**：按 `Boss.order` 升序，每 BOSS 一区块：BOSS 标题（H2）+ 该 BOSS 下 `PlanCard` 玻璃列表（grid，进场 stagger）。同 BOSS 多板时列表上方放 `SortControl`（§7.14）。
3. 该 BOSS 无板时显示 `EmptyState`。

**排序规则（硬约束）**：同 BOSS 多板**默认 = 点赞数降序 → 浏览量降序 → 最新（updatedAt 降序）**。`SortControl` 允许切「浏览量」或「最新」主键，默认进入即「点赞」主键。`isHidden===true` 的板不显示。

用到组件：`Nav`、`BossListItem`、`PlanCard`、`SortControl`、`DifficultyBadge`、`ViewBadge`、`LikeButton`、`AuthorByline`、`EmptyState`、`EmberBackground`。

### 9.3 BoardDetail（板子详情）—— `/board/:boardId`

**目标**：让用户**一键复制走人**。复制是这一页的绝对核心。

布局骨架（桌面 ≥1024 两栏，移动单列堆叠）：
- **主体（左/上，`container-read` 宽）**：板名（H2）+ 难度标签 + 赛季版本 + 作者署名（AuthorByline，点击进作者主页）+ 描述（body）。正文块上方放显眼的 **primary `CopyButton`（砖红「复制战术」）**。其下是 **`PlanTextBlock`（战术正文，content）**，右上角 icon 版 CopyButton。若有 `importCode`，额外一个 `PlanTextBlock variant="importcode"` + 复制按钮。
- **元信息（右栏 / 移动端顶部）—— 玻璃信息卡**：`ViewBadge(large)` 浏览量（epic 大数字 count-up）+ `LikeButton` 点赞 + 作者署名/小头像。
- **同 BOSS 其它板（底部区块）**：「同一 BOSS 的其它战术板」标题 + 网格 `PlanCard` 列表（同 §9.2 排序），方便横向对比「有得选」。

**硬约束**：
- **绝不在本页放 `GuildRecruitCard`**（引流卡只属作者主页）。
- **战术文本逐字呈现，不改写、不重排、不语法高亮成彩色。**
- 复制成功 → CopyButton 进 `copied` 态 + Toast。第一优先级路径，任何动效不得干扰。

用到组件：`Nav`、`PlanTextBlock`、`CopyButton(primary/icon)`、`LikeButton`、`ViewBadge(large)`、`AuthorByline`、`DifficultyBadge`、`Toast`、`PlanCard`、`EmberBackground`。

### 9.4 Author（作者主页）—— `/author/:authorId`

**目标**：给作者一个舞台 + 公会引流入口（核心激励）。

布局骨架：
1. **AuthorHeader**：大头像（玻璃描边 + 极淡金辉环，唯一发光焦点）+ 昵称（H1，epic 金色渐变）+ 简介 `bio`。
2. **GuildRecruitCard**：**仅当该作者填了公会信息时渲染**（`guildName` 等存在）；否则整卡不出现。位置在头部下方或侧栏。
3. **该作者的板子列表**：标题「TA 的战术板」+ `PlanCard variant="compact"` 玻璃网格（取 `authorId` 匹配且 `isHidden!==true`），默认最新排序。
4. 作者无板时 `EmptyState`。

用到组件：`Nav`、`AuthorHeader`、`GuildRecruitCard`、`PlanCard(compact)`、`DifficultyBadge`、`ViewBadge`、`LikeButton`、`EmptyState`、`EmberBackground`。

---

## 10. Content & Voice —— 内容与文案规范

- **UI 文案全中文，工具口吻，克制**。短句、动词开头（「复制战术」「按团本浏览」），不卖萌、不感叹号狂欢、不营销腔。史诗氛围靠视觉与排版，不靠文案喊口号。
- **战术文本原文逐字呈现**：`contentText` / `importCode` 是 MRT/STN 权威格式，**任何情况下不改写、不翻译、不重排、不补标点**。这是复制即用的前提。
- **浏览量措辞**：中性，「浏览 1.2k」「1234 次浏览」，不夸张（不写「火爆」「爆款」）。
- **点赞措辞**：本地态，不承诺持久化；叫「赞」/「点赞」，不写「已保存」「已收藏」（收藏不在 v1）。
- **严禁出现竞品插件名**：源码、注释、UI 字符串中不得出现无关第三方插件名；与本生态有正当集成的也用中性词（「导入码」「战术文本」）。STT 自身名称可出现。

---

## 11. Do's and Don'ts —— 反模式（硬约束，违反即不合格）

### Do（必须）
- 卡片/导航/引流卡/弹层/筛选控件**全部走玻璃**（`.glass`/`.glass-strong`），带顶部高光 + 1px 暖金描边 + depth 阴影 + hover 金辉。
- 基底用**暖黑棕**（`#0C0B0A → #16120B` 深空径向），玻璃透出暖棕红底。
- **双金分工**：亮金只点激活/焦点/强调，奶金给 eyebrow/正文级强调；CTA 砖红实心 + 金描边玻璃次按钮。
- 史诗大标题用 Cinzel/思源宋体 + 金色渐变 + 一层极淡投影；史诗靠字形温度，不靠描边发光。
- three 余烬奥术暗场作氛围，一处发光焦点（hero/徽章），其余靠暗角与稀疏粒子。
- Framer Motion 进场 stagger + hover 上浮金辉光扫 + 路由过场 + count-up，全部 ease-epic 且尊重 reduced-motion。
- 战术文本块 mono + 原始换行（`white-space: pre-wrap`），逐字呈现，玻璃上对比度 ≥ 4.5:1。
- 复制成功明确反馈（CopyButton `copied` + Toast + `aria-live`）。
- 同 BOSS 多板默认排序：点赞 → 浏览量 → 最新。
- 全站令牌从 tokens.css / @theme 读取，组件不写裸值。
- 图标用 inline SVG（Lucide 风格）；大屏留白居中不拉满。
- 字体系统栈兜底、three 降级纯 CSS，断网/无 WebGL 也好看。

### Don't（禁止）
- **禁止扁平无材质**（上一版的错）：不要纯色实底卡片、不要无玻璃无深度的瑞士极简纸面。
- **禁止纯黑 `#000` / 冷钢蓝 navy 玻璃做基底**——会变通用科技/赛博风，丢掉魔兽暖金体温。基底必须暖黑棕。
- **禁止紫 / 蓝紫（#7C3AED 一族）/ 虹彩 iridescent / chromatic 彩光**——一律禁。职业色/阵营色只活在插画，不当 UI 主题色铺。
- **禁止满屏 blur 糊一脸**：玻璃要透出底色与层次，不是把整页磨成一团；玻璃上文字看不清（< 4.5:1）即不合格。
- **禁止廉价糊玻璃**：必带 1px 暖金描边 + 顶部高光 + depth 阴影 + 透出暖底，缺一项就是塑料糊玻璃。
- **禁止粗描边 + 强外发光 + 凿石/做旧石刻质感史诗字**——十年前山寨魔兽风，显土显廉价。史诗靠字形 + 金色 + 极淡投影。
- **禁止繁复鎏金浮雕 / 金属拉丝大面积铺装 / 四角包铜钉 / 整块羊皮纸背景 / 卷草雕花边框铺满**——繁复只给一处英雄元素（hero 徽章），界面骨架一律 1px 暖金 hairline + 细描边。
- **禁止金色用得太多太满**（大面积金底、金色大字满屏）——亮金只点激活/焦点/强调。
- **禁止粒子/余烬/光效堆满屏乱飞**——只在 hero/徽章一处做发光焦点，其余靠暗角与景深；特效过载廉价且抢可读性。
- **禁止居中对称纹章盾牌 + 绶带 + 大字套版首屏**——那是 fan-made 旗帜风；首屏是非对称电影排版 + 暗角 scrim。
- **禁止 layout-shift 卡顿动画**：只用 transform/opacity，不过渡 width/height/top/left；不做 scale 弹跳过度。
- **禁止 emoji 当图标**：一律 inline SVG。
- **禁止把 Google Fonts 当硬依赖**：不阻塞加载、不省略系统兜底栈。
- **禁止给难度标签上色**：英雄/史诗一律玻璃中性，靠文字区分。
- **禁止在板子详情页放公会引流卡**：引流卡只属作者主页。
- **禁止改写战术文本**：不翻译、不重排、不补标点、不彩色语法高亮。
- **禁止为 v1 未做功能预留可见入口**：无评论/收藏/全文搜索/登录注册/fork/版本历史的按钮或占位。
- **禁止给 mock 数据写持久化逻辑**：点赞本地态、浏览量只读，无后端无网络请求。
- **禁止裸 hex / 裸 rgba / 裸 blur / 裸字号 / 游离间距值**：全部走令牌。
