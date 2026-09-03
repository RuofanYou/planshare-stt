# 12.1 itemID 274890「附魔孢子」正式简中功能描述核验

- 调研时间（Asia/Shanghai）：2026-08-06T12:13:35+08:00
- 目标构建：`12.1.0.69111`（Blizzard Build ID `69111`，`wowt` 清单序号 `3932866`）
- 目标物品：`itemID=274890`，英文名 `Enchanted Spore`，正式简中名 `附魔孢子`
- 调研范围：只读核对构建、简中 DB2 字段、物品效果关联和物品提示；没有修改 `src/data`、脚本或 UI，也没有执行 Git 操作。

## 结论

在目标构建中，**附魔孢子没有额外的主动使用、装备触发或被动功能描述**。简中 `ItemSparse.Description_lang` 为空，`ItemXItemEffect` 没有 `ItemID=274890` 关联记录；选定的 Hero 1/6 物品提示也没有 Use/被动效果行，`itemEffects` 数量为 `0`。

这与仓内[12.1 饰品效果简中来源核验](./2026-08-05-12-1-trinket-effect-zhcn-sources.md)对 44 件饰品的全量结果一致：`274890` 在同一构建中被归为 `staticOnly`，本报告补充了该条目的单独证据和中文落地口径。

因此，PlanShare 的功能描述字段应保持空值（或按现有数据约定保留 `staticOnly=true`），不要把英文提示人工翻译后写入效果字段。玩家可见的属性区可以单独展示该物品档位的属性：

> `+89 敏捷/力量/智力`；`+100 精通`

上面的数值对应 `bonus=12793` 的 **Hero 1/6、物品等级 259** 变体。它们是档位属性，不应被误写成额外功能文本；基础 `ItemSparse` 模板的 `ItemLevel=100` 是另一层数据。

## 证据

### 1. Blizzard `wowt` 构建锁定

[Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions) 在本次访问返回：

```text
## seqn = 3932866
us|...|...||69111|12.1.0.69111|...
eu|...|...||69111|12.1.0.69111|...
cn|...|...||69111|12.1.0.69111|...
```

所有区域的 `BuildId` 均为 `69111`，`VersionsName` 均为 `12.1.0.69111`。Wago 查询均使用这个完整版本号，避免把 12.0.7 或其他 PTR 构建的数据混入本次判断。

### 2. Wago DB2 `ItemSparse`（简中）

来源：[ItemSparse CSV，12.1.0.69111，locale=zhCN，过滤 ID 274890](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN&filter%5BID%5D=274890)

该行关键字段如下：

| 字段 | 值 | 含义 |
|---|---|---|
| `ID` | `274890` | 物品 ID |
| `Display_lang` | `附魔孢子` | 正式简中物品名 |
| `Description_lang` | 空字符串 | 没有物品描述文本 |
| `ItemLevel` | `100` | 基础模板等级；不等同于选定奖励档位 |
| `RequiredLevel` | `80` | 基础模板所需等级 |
| `InventoryType` | `12` | 饰品 |
| `StatModifier_bonusStat_0` | `71` | 第一主属性组（提示按角色显示敏捷/力量/智力） |
| `StatModifier_bonusStat_1` | `49` | 精通 |

`ItemSparse` 的简中描述字段为空，不能从该表生成任何“使用”或“装备后”文案。

### 3. Wago DB2 `ItemXItemEffect`（效果关联）

来源：[ItemXItemEffect CSV，12.1.0.69111，过滤 ItemID 274890](https://wago.tools/db2/ItemXItemEffect/csv?build=12.1.0.69111&filter%5BItemID%5D=274890)

过滤请求返回空内容。进一步读取[同构建完整 ItemXItemEffect CSV](https://wago.tools/db2/ItemXItemEffect/csv?build=12.1.0.69111)并按 `ItemID=274890` 过滤，匹配行数仍为 `0`。因此没有可继续关联到 `ItemEffect`/`Spell` 的物品效果 ID。

本次完整 CSV 复核读数：文件大小 `1,166,953` 字节，匹配行 `0`，SHA-256 `013fcf1f9afb7b91ff92df6701adb5bdd73caf6219aac027dcbb38270c75cae0`。

### 4. 物品提示（只用于档位与效果结构复核）

来源：[Wowhead PTR 物品页](https://www.wowhead.com/ptr/item=274890)；选定变体的[tooltip 接口](https://nether.wowhead.com/tooltip/item/274890?bonus=12793&dataEnv=2&locale=0)。

`bonus=12793` 返回的 Hero 1/6 物品等级 259 提示正文包含：

```text
Enchanted Spore
Item Level 259
Upgrade Level: Hero 1/6
+89 [Agility or Strength or Intellect]
+100 Mastery
<!--itemEffects:0-->
```

这里的 endpoint 使用 `locale=0`，英文只用于确认变体、数值和效果行数量；本报告没有把英文句子当作简中翻译来源。`<!--itemEffects:0-->` 表明该提示没有可展示的物品效果行。

### 5. 中文客户端直读边界

本次没有运行同构建的简体中文客户端去保存 `C_TooltipInfo.GetHyperlink(itemLink)` 返回的 `tooltipData.lines` 快照。该接口的调用形状可由 [Blizzard `TooltipInfoDocumentation.lua`](https://raw.githubusercontent.com/Gethe/wow-ui-source/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoDocumentation.lua) 复核；客户端快照仍是玩家可见文案的最强证据。

因此，本报告对“无额外功能描述”的判断来自同构建 `ItemSparse.Description_lang` 为空、`ItemXItemEffect` 无关联和 PTR tooltip 的 `itemEffects:0` 三条证据。若后续发布门禁要求客户端直读快照，应在同一 `12.1.0.69111`、`zhCN` 客户端中补抓 `itemLink`，并把快照的 `build`、`locale`、`itemLink`、`tooltipLines` 一起归档；在补抓之前不要凭空添加效果文本。

### 6. Blizzard Game Data API 的边界

官方接口说明见 [World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)。该接口需要 OAuth 凭证，静态命名空间也没有本次可验证的 `12.1.0.69111` PTR 构建锁定参数；本次没有使用凭证请求它。构建期内容以 Blizzard `wowt` 版本清单锁定，物品中文字段和效果关联以同构建 Wago DB2 复核，提示结构以 PTR tooltip 交叉检查。

## 推荐落地口径

| PlanShare 字段/区域 | 建议值 | 依据 |
|---|---|---|
| 功能描述 `trinketEffect.text` | 空字符串 | 简中 `Description_lang` 为空，`ItemXItemEffect` 无关联，tooltip 无效果行 |
| `trinketEffect.staticOnly` | `true` | 当前物品只有静态属性，没有可解析的功能效果 |
| 属性区（Hero 1/6、259） | `+89 敏捷/力量/智力`、`+100 精通` | 选定 `bonus=12793` tooltip |
| 中文物品名 | `附魔孢子` | Wago `ItemSparse.Display_lang` |

不要把“仅提供属性”扩写成一条虚构的主动技能或触发说明；若页面需要解释空效果，可在通用 UI 中显示“暂无额外功能描述”，并将这句话标为产品界面提示，不标为 Blizzard 物品效果原文。

## 访问记录

- 2026-08-06T12:13:35+08:00：读取 Blizzard `wowt/versions`，确认 `12.1.0.69111` / Build `69111`。
- 2026-08-06：读取 Wago `ItemSparse` 的 `zhCN` 行，确认 `Display_lang=附魔孢子`、`Description_lang` 为空。
- 2026-08-06：读取 Wago `ItemXItemEffect` 过滤结果及完整 CSV，确认 `ItemID=274890` 匹配行数为 `0`。
- 2026-08-06：读取 Wowhead PTR `bonus=12793` tooltip，确认 Hero 1/6、物品等级 259、两条属性以及 `itemEffects:0`。
