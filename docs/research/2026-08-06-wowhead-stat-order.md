# Wowhead 装备属性显示顺序与排序键核验

- 调研时间（Asia/Shanghai）：2026-08-06T14:39:34+08:00
- 数据构建：`12.1.0.69111`（Build ID `69111`，`wowt` 清单序号 `3932866`）
- 范围：核对 Wowhead 12.1 测试服 tooltip 的属性行顺序，为 PlanShare 的属性展示提供可追溯的排序规则。
- 产物性质：研究笔记；用于约束展示层排序，具体实现见 `src/pages/Loot.tsx`。

## 结论

1. 本次访问的 `wowt` 版本清单锁定为 **12.1.0.69111 / Build ID 69111**。[Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions)
2. Wowhead tooltip 的可观察顺序可归纳为：护甲（有该字段时）→格挡（盾牌）→主属性→耐力→次要属性→第三属性。相同类别内保留 tooltip 原始顺序，不能按属性名称重新排序。[头部样本](https://nether.wowhead.com/tooltip/item/275139?bonus=12793&dataEnv=2&locale=0) [项链样本](https://nether.wowhead.com/tooltip/item/268250?bonus=12854&dataEnv=2&locale=0) [盾牌样本](https://nether.wowhead.com/tooltip/item/268262?bonus=12854&dataEnv=2&locale=0) [第三属性样本](https://www.wowhead.com/ptr/item%3D251115/bifurcation-band?bonus=6652%3A12790&ilvl=263)
3. `ItemSparse.StatModifier_bonusStat_*` 的槽位顺序属于 DB2 存储字段，不能直接当作玩家可见顺序。盾牌样本的 DB2 槽位与 tooltip 行顺序已经出现差异，因此展示层应记录并使用 tooltip `sourceOrder`。[Wago `ItemSparse` 12.1.0.69111](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN&filter%5BID%5D=268262)
4. 武器有一组独立的装备结构字段：伤害区间、速度、每秒伤害（DPS）位于主属性之前。它们应作为 `equipmentDetail` 单独排序，或在复刻完整 tooltip 时保留原始位置；将它们追加到属性数组末尾会改变完整 tooltip 的视觉顺序。[武器样本](https://nether.wowhead.com/tooltip/item/274864?bonus=12793&dataEnv=2&locale=0)

## 推荐排序键

属性列表使用稳定的二元排序键：

```text
categoryRank:
  armor    = 10
  block    = 15
  primary  = 20
  stamina  = 30
  secondary = 40
  tertiary = 50
  other    = 60

sortKey = [categoryRank, sourceOrder]
```

- `categoryRank` 决定大类顺序。
- `sourceOrder` 是该物品 tooltip 中的 0-based 原始行序号；同一大类保持它，避免对暴击、急速、精通、全能等字段做字母排序。
- `tertiary` 包括闪避、吸血、加速等第三属性。当前样本显示第三属性排在次要属性之后。[Mantle of Dark Devotion 样本](https://www.wowhead.com/ptr/item%3D251085/mantle-of-dark-devotion?bonus=6652%3A12790&ilvl=263)
- `armor`、`block`、武器伤害/速度/DPS 属于装备结构字段时，建议与“真实属性”列表分开保存；若必须放在同一数组，武器结构字段应使用专门的 `equipmentDetailRank`，置于主属性之前。

## Wowhead tooltip 证据

以下响应均使用 `dataEnv=2`、指定 bonus，并在本次访问日读取。展示文本按 tooltip 原始行记录；`stat*`/`rtg*` 标记用于核对字段类别，不能替代行顺序。

| 物品 | 类型 | tooltip 中的顺序 | 原始字段标记与备注 |
|---|---|---|---|
| [Crown of Fungal Spores](https://nether.wowhead.com/tooltip/item/275139?bonus=12793&dataEnv=2&locale=0) | 头部 | `54 Armor → +94 Intellect → +1,617 Stamina → 91 Critical Strike → +49 Versatility` | `amr → stat5 → stat7 → rtg32 → rtg40`；护甲先于主属性。 |
| [Sentinel’s Vitriolic Chain](https://nether.wowhead.com/tooltip/item/268250?bonus=12854&dataEnv=2&locale=0) | 项链 | `+2,199 Stamina → +95 Critical Strike → +310 Haste` | `stat7 → rtg32 → rtg36`；没有护甲/主属性时从耐力开始。 |
| [Bubblefin Splash Guard](https://nether.wowhead.com/tooltip/item/268262?bonus=12854&dataEnv=2&locale=0) | 盾牌 | `1,274 Armor → 3185 Block → +94 Strength → +289 Intellect → +1,955 Stamina → +33 Haste → +67 Mastery` | `amr → block → stat4 → stat5 → stat7 → rtg36 → rtg49`；结构字段占据前部，主属性保留原始次序。 |
| [Sporebloom Gavel](https://nether.wowhead.com/tooltip/item/274864?bonus=12793&dataEnv=2&locale=0) | 单手锤 | `60–78 Damage → Speed 2.60 → (26.5 damage per second) → +273 Intellect → +809 Stamina → +29 Versatility → +41 Mastery` | 武器伤害、速度、DPS 在主属性前；完整 tooltip 还包含物品等级、绑定、耐久度等非属性行。 |
| [Enchanted Spore](https://nether.wowhead.com/tooltip/item/274890?bonus=12793&dataEnv=2&locale=0) | 饰品 | `+89 [Agility or Strength or Intellect] → +100 Mastery` | 动态主属性先于次要属性；动态占位文本按单个主属性字段处理。 |
| [Bifurcation Band](https://www.wowhead.com/ptr/item%3D251115/bifurcation-band?bonus=6652%3A12790&ilvl=263) | 戒指 | `+749 Stamina → +93 Haste → +158 Mastery → +43 Avoidance` | 第三属性 `Avoidance` 出现在次要属性之后。 |

## 武器与盾牌的结构字段例外

### 武器

武器 tooltip 的伤害区间、速度和 DPS 是装备结构信息，与力量/敏捷/智力、耐力、次要属性属于不同字段组。当前武器样本的顺序为：

```text
damageMinMax → speed → dps → primary → stamina → secondary → tertiary
```

因此，数据模型可采用以下两种等价方案：

```text
equipmentDetail = { damageMin, damageMax, speed, dps }
stats           = [{ category, value, sourceOrder }]
```

或为所有行保留 `lineType + sourceOrder`，由 UI 按完整 tooltip 顺序渲染。现有属性解析若把伤害字段追加到 stats 末尾，只适合“属性摘要”视图，不能声称复刻完整武器 tooltip。

### 盾牌

盾牌的护甲与格挡在属性区前部。`ItemSparse` 里的存储槽位顺序不能作为显示顺序：本次盾牌 `268262` 的 DB2 槽位记录为 `Strength、Stamina、Mastery、Haste、Intellect` 等组合，而 tooltip 展示为 `Armor、Block、Strength、Intellect、Stamina、Haste、Mastery`。[Wago 盾牌记录](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN&filter%5BID%5D=268262) 这说明 `sourceOrder` 必须来自最终 tooltip 行，不能从 `StatModifier_bonusStat_0..n` 推导。

## 主属性组的处理边界

Wowhead 页面存在同一物品同时列出力量、敏捷、智力的情况，例如饰品页面先列出 `+93 Strength → +93 Agility → +93 Intellect`。[Glorious Crusader's Keepsake](https://www.wowhead.com/ptr/item%3D251792/glorious-crusader's-keepsake?bonus=6652%3A12790&ilvl=263&spec=70) 因此主属性组内部同样应保留 `sourceOrder`，不要预设力量、敏捷、智力的全局字母序或固定序。

## 官方 API 路由与证据边界

Blizzard 的 `TooltipInfo` 文档说明 `C_TooltipInfo.GetHyperlink` 返回 `TooltipData`，共享文档定义了物品等级、升级等级、被动效果、描述等 tooltip 行类型。[`TooltipInfoDocumentation.lua`](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoDocumentation.lua) [`TooltipInfoSharedDocumentation.lua`](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoSharedDocumentation.lua) 本报告的具体属性顺序来自上述 Wowhead tooltip 响应；API 文档用于确认客户端可取得结构化 tooltip 行，不能单独证明某一件物品的具体顺序。

## 局限与后续核验

- Wowhead tooltip 是公开网页服务的镜像结果，适合做当前构建的可复现顺序证据；正式客户端上线前仍应以目标客户端 `C_TooltipInfo` 返回的行序复核。
- bonus、升级等级、职业专精和语言环境会影响 tooltip 内容。后续刷新时必须重新记录 URL、构建号、locale、访问时间和原始响应。
- 本报告只定义排序依据，没有修改 `build-loot-12-1-data.py`、`src/data/loot-12-1.json` 或 UI；落地实现时需先确认属性摘要视图与完整 tooltip 视图的字段边界。

## 访问记录

- 2026-08-06T14:39:34+08:00：读取 Blizzard `wowt/versions`，确认 `12.1.0.69111` / Build ID `69111` / 清单序号 `3932866`。
- 2026-08-06：读取 5 个 `nether.wowhead.com/tooltip/item/...` 响应，并读取 Wowhead PTR 页面作为第三属性、动态主属性和多主属性交叉样本。
- 2026-08-06：读取同 build 的 Wago `ItemSparse` CSV，核对属性存储槽位与 tooltip 展示顺序的差异。
- 2026-08-06：读取 `wow-ui-source` beta 的 `TooltipInfo` API 文档，确认结构化 tooltip 行的官方接口入口。
