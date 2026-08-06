# 12.1 饰品效果简中来源核验

- 调研日期：2026-08-05（Asia/Shanghai）
- 目标构建：`12.1.0.69111`（Build ID `69111`）
- 范围：当前 `src/data/loot-12-1.json` 中 `slot="饰品"` 的 44 个 `itemId`。
- 产物性质：构建期研究与核验记录；网页发布数据由同构建报告驱动，Worker、D1、API 和 translator 未纳入本次变更。

## 结论

可发布的官方简中效果文本优先来自**同构建、简体中文客户端实际渲染的物品提示**。当前构建脚本以 Wago DB2 的 `zhCN` 法术模板和关联键为中文权威，按模板语义解析占位符，再以已选 Wowhead PTR tooltip 提供对应档位数值；结果必须通过无 `$` 占位符、无英文残留和物品关联一致性门禁。Wowhead PTR tooltip 只用于定位 `itemId`、`bonus` 变体、数值和效果结构，不承担简中翻译。

本次未找到无需凭证且直接返回“已渲染 zhCN 物品 tooltip”的公开 Web 端点。本机 `wowt` 客户端记录为 `12.1.0.68914`，低于目标构建；构建过程没有把它当作 `69111` 的客户端快照来源，目标数据以 Wago `12.1.0.69111` 模板和构建期数值解析报告留证。

## 来源分工

| 来源 | 能提供的内容 | 发布用途 | 边界 |
|---|---|---|---|
| 简中客户端 `C_EncounterJournal.GetLootInfoByIndex` → `C_TooltipInfo.GetHyperlink(itemLink)` | 该难度/奖励变体的 `link` 与已展开 tooltip `lines`；其中 `SpellDescription` 为效果正文行类型 | 唯一可发布文本来源 | 客户端语言、Build、`itemLink` 必须一起留证；接口可空，缓存未就绪时重试。 |
| Wago DB2 `ItemXItemEffect` → `ItemEffect` → `Spell` | `itemID → ItemEffectID → SpellID`，以及 `Spell.Description_lang`、`AuraDescription_lang` 原始中文模板 | 中文效果模板、离线关联和完整性核验 | 模板含 `$s1`、`$d`、`$@spelldesc…`、`$?…`、角色条件等客户端语法；发布前由确定性解析器展开并经过残留字符门禁。 |
| Wago DB2 `ItemSparse` | `Display_lang` 中文物品名；`Description_lang` 常为风味文字或空值 | 名称交叉核验 | `Description_lang` 不能当作饰品功能说明。 |
| Wowhead PTR 页面与 tooltip | `itemId`、`bonus`、物等、升级轨道、英文 tooltip 的结构和数值候选 | 变体定位与数值结构复核 | 不读取其英文文案作为简中翻译来源；`locale=0` 响应禁止写入玩家可见中文效果。 |
| Blizzard Game Data API | 已发布静态物品的官方 `id/name` 等复查能力 | 内容上线后的附加核验 | 需 OAuth；本次未验证存在锁定 `wowt 12.1.0.69111` 且输出完整渲染 tooltip 的接口。 |

## 已核验的 Wago 表与字段

目标 44 件饰品在 `12.1.0.69111` 快照中的实测结果：43 个 `itemId` 有 `ItemXItemEffect` 关联，共 60 条效果绑定；60 个关联法术均能在 `Spell` 表找到，45 条有非空 `Description_lang`，18 条有非空 `AuraDescription_lang`。45 条描述中 42 条含 `$` 占位符，4 条含跨法术引用，14 条含角色或条件语法。`274890`（附魔孢子）没有 `ItemXItemEffect` 记录。

| 表 | 关键字段 | URL |
|---|---|---|
| `ItemXItemEffect` | `ItemID`、`ItemEffectID` | [CSV](https://wago.tools/db2/ItemXItemEffect/csv?build=12.1.0.69111) |
| `ItemEffect` | `ID`、`TriggerType`、`SpellID`、`LegacySlotIndex`、`ChrSpecializationID`、`PlayerConditionID` | [CSV](https://wago.tools/db2/ItemEffect/csv?build=12.1.0.69111) |
| `Spell` | `ID`、`Description_lang`、`AuraDescription_lang` | [zhCN CSV](https://wago.tools/db2/Spell/csv?build=12.1.0.69111&locale=zhCN) |
| `SpellName` | `ID`、`Name_lang` | [zhCN CSV](https://wago.tools/db2/SpellName/csv?build=12.1.0.69111&locale=zhCN) |
| `SpellDescriptionVariables` | `ID`、`Variables` | [zhCN CSV](https://wago.tools/db2/SpellDescriptionVariables/csv?build=12.1.0.69111&locale=zhCN) |
| `SpellEffect` | `SpellID`、`EffectBasePointsF`、`ScalingClass` 等数值字段 | [CSV](https://wago.tools/db2/SpellEffect/csv?build=12.1.0.69111) |
| `ItemSparse` | `ID`、`Display_lang`、`Description_lang` | [zhCN CSV](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN) |

`ItemEffect` 的当前 CSV 没有可直接使用的 `ParentItemID` 列，关联必须经过 `ItemXItemEffect`。同一物品也可能有多条效果记录；例如 270170 映射到两条效果，其中仅一条法术描述非空。因此不得采用“第一条非空 `Spell.Description_lang`”的选择规则。

## 客户端抓取路线

1. 先以 [Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions) 确认目标 Build，Wago URL 的 `build` 必须完全相同。
2. 使用 `locale=zhCN` 的同 Build 客户端，在地下城手册读取 `C_EncounterJournal.GetLootInfoByIndex` 返回的 `itemInfo.link`。官方 API 文档列出该结构的 `itemID`、`name`、`slot`、`link` 字段：[EncounterJournalDocumentation.lua](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/EncounterJournalDocumentation.lua)。
3. 用该精确 `itemLink` 调用 `C_TooltipInfo.GetHyperlink`；仅有裸 `itemID` 时，`GetItemByID(itemID[, quality])` 只能生成默认提示，不能声明数值与目标变体一致。[TooltipInfoDocumentation.lua](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoDocumentation.lua)
4. 保存 tooltip `lines` 的原顺序、`type`、`leftText`、`rightText`。官方枚举定义了 `SpellName`、`SpellPassive`、`SpellDescription` 行类型，客户端处理器也逐条读取 `tooltipData.lines` 并消费 `leftText/rightText`：[TooltipInfoSharedDocumentation.lua](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoSharedDocumentation.lua)、[TooltipDataHandler.lua](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_SharedXMLGame/Tooltip/TooltipDataHandler.lua)。

建议把客户端快照至少保存为：`build`、`locale`、`observedAt`、`itemId`、`itemLink`、`itemLinkHash`、`tooltipLines`、`effectText`、`source=client-tooltip-zhCN`。玩家页面仅使用 `effectText`；审计记录保留其余字段。

## 构建期门禁与不可发布情形

- Build、语言或 `itemLink` 缺失时停止发布；`C_TooltipInfo` 返回空值时等待物品缓存事件后重试，仍失败则记为未解析。
- `itemLink` 解析出的 `itemId` 必须等于掉落记录的 `itemId`，且截图/快照中存在至少一条实际效果行。
- 任一候选文本仍含 `$` 占位符、未解析跨法术引用或角色条件时，禁止以 Wago 模板替代客户端结果。
- 仅有 `GetItemByID` 的默认提示时，禁止发布带数值的效果说明；升级轨道和 bonus 会改变数值。
- `274890` 及今后缺少 `ItemXItemEffect` 关联的条目，必须取得同 Build 客户端 tooltip；未取得前保持无效果文本。
- 多效果、空描述、按专精/条件变化的条目必须以实际 tooltip 行为准，不能按 DB2 行号挑选。
- Wowhead URL 可用于补充变体定位：`https://www.wowhead.com/ptr/item={itemId}` 与 `https://nether.wowhead.com/tooltip/item/{itemId}?bonus={bonusToken}&dataEnv=2&locale=0`；其英文 tooltip 禁止进入简中发布字段。

## 访问记录

- 2026-08-05：Blizzard `wowt` 版本清单返回 `12.1.0.69111` / Build `69111`。
- 2026-08-05：上表列出的 Wago CSV 均以 `build=12.1.0.69111` 读取；`Spell` 的 zhCN 文本已验证为中文原始模板。
- 2026-08-05：本机 `/Applications/World of Warcraft/.build.info` 的 `wowt` 条目为 `12.1.0.68914`，不能替代目标构建的客户端验证。
- 2026-08-05：官方 API 源码链接按上述 URL 访问，确认 tooltip 读取接口与 `SpellDescription` 行类型。
