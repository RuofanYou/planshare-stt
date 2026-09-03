# WoW 12.1 装备与中文名称数据核验路线

- 调研时间（Asia/Shanghai）：2026-08-05T17:17:36+08:00
- 范围：12.1 测试数据中的装备 `itemID`、`zhCN` 名称、副本及首领正式中文名称。
- 产物性质：研究笔记；未修改应用代码，未执行部署，也未读取任何 Battle.net API 密钥。

## 结论

1. 本次访问时，Blizzard 公开版本清单的 `wowt` 轨道为 **12.1.0.69111**（Build ID `69111`，清单序号 `3929871`）。同一清单里的 `wow` 轨道为 `12.0.7.68974`，两条轨道不可混用。[Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions) [Blizzard `wow` 版本清单](http://us.patch.battle.net:1119/wow/versions)
2. 对“当前 12.1 掉落装备清单”，应以 **zhCN 客户端的地下城手册（Encounter Journal）查询结果**为权威：它直接给出 `itemID`、本地化 `name`、`encounterID`、`link` 与装备槽位语义。`itemID` 作为唯一键，`itemLink` 单独记录实际变体。
3. 对可复现的离线批量核验，Wago DB2 已提供同一构建 `12.1.0.69111` 的 `zhCN` CSV：物品用 `ItemSparse.ID + Display_lang`，副本/首领用 `JournalInstance.Name_lang` 与 `JournalEncounter.Name_lang`，通过 `JournalEncounter.JournalInstanceID = JournalInstance.ID` 关联。
4. Blizzard Game Data API 适合已发布的静态物品复查：请求中使用 `locale=zh_CN` 可取得官方本地化 `name`。该 API 需要 OAuth，且其静态命名空间没有本次调研中可验证的 PTR 构建锁定能力；在 12.1 测试期不得把它当成测试服掉落目录的唯一来源。[官方 Game Data API 文档](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)
5. 中文名称一律读取上述 `zhCN` 字段或中文客户端 API 返回值。不得先取英文名再人工翻译。

## 构建号与数据新鲜度

| 证据 | 本次读数 | 结论 |
|---|---:|---|
| [Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions) | `12.1.0.69111` / Build ID `69111` | 当前 12.1 测试数据基线。清单逐行同时列出 `us`、`eu`、`cn`、`kr`、`tw`、`sg` 与 `xx`。 |
| [Wago `ItemSparse` 12.1.0.69111 zhCN CSV](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN) | 下载文件名为 `ItemSparse.12.1.0.69111.csv` | 离线 DB2 核验可锁定同一 build。 |
| 本机 `/Applications/World of Warcraft/.build.info` | `wowt` 为 `12.1.0.68914` | 本机已安装元数据落后于 CDN，不可据此宣称当前 build。 |
| 仓内 `Referrence/API/12.1.0.68675/` | `12.1.0.68675` | 可用于 API 接口回溯；不能作为当前内容、名称或掉落的依据。 |

版本检查命令仅读取公开清单，不携带凭证：

```sh
curl -fsSL http://us.patch.battle.net:1119/wowt/versions
```

`wowt` 清单为匿名公开版本信息，使用时只读取版本行；OAuth token、账号信息和玩家数据都不应发送给该地址。每次生成或刷新 12.1 数据前先执行该检查，再将其输出的完整版本号写入数据快照。

## 来源分层与适用边界

| 优先级 | 来源 | 最适合回答的问题 | 可用性限制 |
|---|---|---|---|
| S | 中文游戏客户端与地下城手册 | “某个当前难度、某个首领实际列出了哪些物品？”、“游戏中显示的中文名是什么？” | 需要运行对应 build 的 zhCN 客户端；物品信息可异步加载。 |
| S | Blizzard Game Data API | “某个已知 `itemID` 的官方静态资料和 `zh_CN` 名称是什么？” | OAuth client credentials 必需；静态命名空间的发布时间与测试服 build 可能不同。 |
| A | Blizzard `wowt` 版本清单 | “当前测试数据应锁定到哪个 build？” | 只给产品轨道和版本，不给物品、掉落或本地化表。 |
| B | Wago DB2 `zhCN` 快照 | “能否在固定 build 中批量复查物品、实例、首领中文字段？” | 社区数据服务，可能有同步延迟或临时不可用；每次必须检查 build 参数与返回文件名。 |
| B | [`wow-ui-source` beta API 文档](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/ItemDocumentation.lua) | “客户端 API 返回字段、可空性和事件是什么？” | 它说明接口形状，不承载具体中文数据值；当前分支必须按访问日期复查。 |

## 路线 A：当前游戏数据（掉落目录与正式中文名）

这是 12.1 测试期的推荐主路线。地下城手册已经把“副本 → 首领 → 掉落”关系组织为当前客户端数据，避免从全量物品表猜测哪些条目属于本赛季装备。

### 需要读取的 API 数据

1. 选择目标副本和难度：`EJ_SelectInstance(journalInstanceID)`、`EJ_SetDifficulty(difficultyID)`。
2. 副本标题：`EJ_GetInstanceInfo()` 的首个返回值，来自当前客户端语言。
3. 首领列表：循环 `EJ_GetEncounterInfoByIndex(index)`；其中首个返回值是首领名，第三个返回值为 `encounterID`。
4. 选择首领后，读取 `EJ_GetNumLoot()`，再循环 `C_EncounterJournal.GetLootInfoByIndex(index)`。
5. 对每个 `EncounterJournalItemInfo` 至少保存：`itemID`、`name`、`encounterID`、`itemQuality`、`slot`、`link`、`displaySeasonID`。该结构及其 `itemID`/`name` 字段由客户端 API 文档定义。[`GetLootInfoByIndex` 与返回结构](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/EncounterJournalDocumentation.lua#L90-L104) [`EncounterJournalItemInfo` 字段](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/EncounterJournalDocumentation.lua#L320-L342)
6. 当手册条目 `name` 暂时为空时，用 `C_Item.GetItemNameByID(itemID)` 或 `C_Item.GetItemInfo(itemID)` 补查；`C_Item.GetItemInfo` 允许无返回，等待 `GET_ITEM_INFO_RECEIVED` 后再重试。[`C_Item.GetItemInfo` 返回字段](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/ItemDocumentation.lua#L589-L620) [`C_Item.GetItemNameByID`](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/ItemDocumentation.lua#L809-L821)

### 必须保存的快照字段

```text
build
observed_at
locale = zhCN
journal_instance_id
journal_instance_name_zhCN
encounter_id
encounter_name_zhCN
difficulty_id
item_id
item_name_zhCN
item_link
item_quality
slot
display_season_id
source = encounter_journal_runtime
```

`item_id` 是目录去重键。`item_link` 只保存本次手册给出的物品实例展示信息；难度、升级、附加属性、插槽或奖励 ID 都可能让相同 `itemID` 出现不同链接。用链接替代主键会制造重复条目。

### 运行时限制

- 地下城手册选择 API 会改变手册当前选中项；扫描器应避开玩家正在浏览手册的时段，或在查询后恢复原选择。
- 物品缓存尚未到位时，名称可能为 `nil`。必须将“等待 `GET_ITEM_INFO_RECEIVED` 后重试”当作正常状态，并记录未解析的 `itemID`。
- 掉落与难度有关。快照必须带 `difficulty_id`，同一 `itemID` 在多个首领或难度出现时保留所有来源关系。
- 装备目录应以地下城手册的掉落条目为集合。只靠 `ExpansionID`、`InventoryType` 或物品等级筛全量 DB2 会混入制造、任务、旧内容或尚未开放条目。

## 路线 B：Blizzard Game Data API（官方静态物品复查）

官方入口：[World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)，认证说明见 [Client Credentials Flow](https://community.developer.battle.net/documentation/guides/using-oauth/client-credentials-flow)。

可复现的请求模板：

```sh
# 在服务端或受保护的运维环境执行；不要把 client secret 放进网页前端。
TOKEN="$(curl -fsS -u "$BLIZZARD_CLIENT_ID:$BLIZZARD_CLIENT_SECRET" \
  -d grant_type=client_credentials https://oauth.battle.net/token | jq -r .access_token)"

curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "https://us.api.blizzard.com/data/wow/item/$ITEM_ID?namespace=static-us&locale=zh_CN"
```

需要读取的核心字段：`id`、`name`、`level`、`item_class`、`item_subclass`、`inventory_type`、`is_equippable` 和 `media`。其中 `id` 应与地下城手册的 `itemID` 相等，`name` 是 `locale=zh_CN` 返回的官方本地化文本。

限制与使用方式：

- token 有有效期，`client_secret` 只能驻留在服务端密钥管理或本地受保护环境。
- `namespace` 与 API 区域必须匹配；示例用 `us + static-us`。调用其他区域前应按官方文档重新核对。
- 本次没有持有 OAuth 凭证，因此没有对该端点做有凭证响应抓取。路径、认证方式和字段选择来自官方文档与客户端接口对照。
- 该 API 很适合在内容进入正式静态数据后复查单个 `itemID`。它没有在本次调研中可验证的 `build=12.1.0.69111` 参数，不能替代测试 build 的手册快照。

## 路线 C：Wago DB2 `zhCN` 批量核验

所有下面的 URL 都锁定本次 CDN 构建 `12.1.0.69111`，字符集为 UTF-8。Wago 的参数名是 `locale=zhCN`，与 Blizzard API 的 `locale=zh_CN` 拼写不同。

| 数据目标 | 固定 build 的 CSV | 核心字段 | 关联方式 |
|---|---|---|---|
| 物品名与装备属性 | [ItemSparse](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=zhCN) | `ID`、`Display_lang`、`ItemLevel`、`InventoryType`、`ExpansionID`、`OverallQualityID` | `ID = itemID`；中文名取 `Display_lang`。 |
| 物品分类辅助 | [Item](https://wago.tools/db2/Item/csv?build=12.1.0.69111&locale=zhCN) | `ID`、`ClassID`、`SubclassID`、`InventoryType` | `Item.ID = ItemSparse.ID`。 |
| 副本正式名 | [JournalInstance](https://wago.tools/db2/JournalInstance/csv?build=12.1.0.69111&locale=zhCN) | `ID`、`Name_lang`、`MapID` | `JournalInstance.ID = JournalEncounter.JournalInstanceID`。 |
| 首领正式名与排序 | [JournalEncounter](https://wago.tools/db2/JournalEncounter/csv?build=12.1.0.69111&locale=zhCN) | `ID`、`Name_lang`、`JournalInstanceID`、`DungeonEncounterID`、`OrderIndex`、`DifficultyMask` | 按 `JournalInstanceID` 分组、`OrderIndex` 排序。 |
| 地图名交叉检查 | [Map](https://wago.tools/db2/Map/csv?build=12.1.0.69111&locale=zhCN) | `ID`、`MapName_lang`、`InstanceType` | `Map.ID = JournalInstance.MapID`；手册标题仍优先 `JournalInstance.Name_lang`。 |

本次实际读取到的字段样本证明 `zhCN` 数据已经返回中文：

| 表 | 构建 | 样本 | 读取字段 |
|---|---|---|---|
| `ItemSparse` | `12.1.0.69111` | `ID=25` | `Display_lang=破损的短剑` |
| `JournalInstance` | `12.1.0.69111` | `ID=1312` | `Name_lang=至暗之夜` |
| `JournalEncounter` | `12.1.0.69111` | `JournalInstanceID=1312` | `OrderIndex=1..4` 的 `Name_lang` 依次为 `鲁阿夏尔`、`索姆贝兰`、`普雷达萨斯`、`克拉格平` |

这些样本只验证字段、locale 与关联关系。是否已在某个正式难度开放，仍要回到同 build 的中文客户端地下城手册确认。

## `wow-ui-source` 的角色

[`ItemDocumentation.lua` beta](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/ItemDocumentation.lua) 明确了 `C_Item.GetItemInfo`、`C_Item.GetItemNameByID` 的返回值与可空性；[`EncounterJournalDocumentation.lua` beta](https://github.com/Gethe/wow-ui-source/blob/beta/Interface/AddOns/Blizzard_APIDocumentationGenerated/EncounterJournalDocumentation.lua) 明确了 `C_EncounterJournal.GetLootInfoByIndex` 的索引和结构。它应承担 API 调用形状核验，不能代替 `zhCN` 数据来源。

仓内旧快照 `Referrence/API/12.1.0.68675/` 同样适合离线查看 API，但当前 build 已提升到 `12.1.0.69111`，实施前必须再读 beta 分支和运行时返回。

## 推荐的实际核验流程

1. 读取 [Blizzard `wowt` 版本清单](http://us.patch.battle.net:1119/wowt/versions)，保存 `VersionsName`、`BuildId`、`BuildConfig` 与访问时间。
2. 只使用与该 build 相同的 zhCN 客户端打开地下城手册；按副本和难度枚举首领与掉落，形成运行时快照。
3. 用 `C_Item.GetItemNameByID(itemID)` 复查每一个物品的中文名称；缓存未命中时等待事件重试并保留失败日志。
4. 下载相同 build 的 Wago `ItemSparse`、`JournalInstance` 与 `JournalEncounter` CSV，按上表字段交叉核对。build 不相等时停止合并，先刷新或等待数据服务同步。
5. 已发布内容可额外用 Blizzard Game Data API 的 `locale=zh_CN` 复查 `id/name/inventory_type`。API 名称与当前 zhCN 客户端名称不一致时，记录 build、区域和时间，再以目标客户端实际返回值作为玩家展示文本。
6. 产出时保留 `build + locale + source + observed_at`。只有 `itemID + 名称` 的无版本表无法追溯后续改名、重做或测试服热修。

## 实施前门禁

- [ ] 版本来源是 `wowt`，且当前 build 已写入快照。
- [ ] Wago URL 中的 `build` 与版本清单完全相同，`locale=zhCN`。
- [ ] 游戏内测试客户端语言为简体中文，获取到的 `name` 直接存储。
- [ ] 每条掉落记录带副本、首领与难度来源，不把全量 DB2 物品直接发布为赛季装备目录。
- [ ] `itemID` 作为唯一物品键；`itemLink`、难度与来源为附加字段。
- [ ] 前端代码和仓库文案都没有人工英文翻译结果；所有显示名都有可追溯数据源。

## 访问记录

- 2026-08-05T17:17:36+08:00：Blizzard `wowt/versions` 返回 `12.1.0.69111` / `69111`。
- 同次调研：Wago `ItemSparse`、`JournalInstance`、`JournalEncounter` 的 `build=12.1.0.69111&locale=zhCN` CSV 均返回可读 UTF-8 数据。
- 同次调研：本机 `.build.info` 与仓内 12.1 API 快照均早于 CDN 当前 build，因此仅作历史接口参考。

## 2026-08-05：查询页全量来源、职业与属性补全

生成器读取原表 `total!A2:K578` 的 577 行，并以同一 build 的 DB2 做交叉核验。发布数据保留每行的原始行号、原始 route 和原始来源；页面只使用归一后的筛选字段。

| 页面来源 | 原表 `掉落途径` | 记录数 |
|---|---|---:|
| 团本 | `The Venomous Abyss`、`The Tidebound Grotto` | 101 |
| 大秘境 | `史诗钥石` | 205 |
| 地下堡 | `地下堡` | 95 |
| 其它 | `套装`、`狩猎` | 176 |

掉落关系优先通过 [JournalEncounterItem](https://wago.tools/db2/JournalEncounterItem/csv?build=12.1.0.69111&locale=enUS) → [JournalEncounter](https://wago.tools/db2/JournalEncounter/csv?build=12.1.0.69111&locale=zhCN) → [JournalInstance](https://wago.tools/db2/JournalInstance/csv?build=12.1.0.69111&locale=zhCN) 复核。团本 101 条中 92 条有首领直连关系，另 9 条原表标为小怪掉落；大秘境 205 条均能连接到地下城手册实例。地下堡、套装和狩猎继续保留原表来源字段及行号。

职业筛选使用当前 DB2 的可复现规则：

1. [ItemSparse](https://wago.tools/db2/ItemSparse/csv?build=12.1.0.69111&locale=enUS) 的 `AllowableClass` 有显式值时优先使用。117 条职业套装均为单职业掩码，并与原表职业字段逐条一致。
2. 普通布甲、皮甲、锁甲、板甲按 [ChrClasses](https://wago.tools/db2/ChrClasses/csv?build=12.1.0.69111&locale=zhCN) 的 `ArmorTypeMask` 生成主护甲职业集合。布甲包含牧师、法师、术士。
3. 武器与盾牌按 [SkillLine](https://wago.tools/db2/SkillLine/csv?build=12.1.0.69111&locale=enUS) 和 [SkillLineAbility](https://wago.tools/db2/SkillLineAbility/csv?build=12.1.0.69111&locale=enUS) 的 `ClassMask` 生成职业集合；计算时只保留 13 个玩家职业位。
4. [ItemSpecOverride](https://wago.tools/db2/ItemSpecOverride/csv?build=12.1.0.69111&locale=enUS) 与 [ChrSpecialization](https://wago.tools/db2/ChrSpecialization/csv?build=12.1.0.69111&locale=zhCN) 对 31 件饰品提供了显式专精职业覆写，生成器优先应用该关系。

原表 `属性组合`、`主属性`、`暴击`、`精通`、`急速`、`全能` 已完整写入每条静态记录。字段非空数量依次为 `576`、`536`、`286`、`288`、`280`、`193`；空值保持为空，不补造属性。

## 2026-08-05：地下城手册首领顺序与用户可见 M 序号

范围为当前 12.1 掉落资料中，能经 `JournalEncounterItem.JournalEncounterID` 关联到地下城手册的 10 个实例。访问 [JournalInstance](https://wago.tools/db2/JournalInstance/csv?build=12.1.0.69111&locale=zhCN)、[JournalEncounter](https://wago.tools/db2/JournalEncounter/csv?build=12.1.0.69111&locale=zhCN) 与 [JournalEncounterItem](https://wago.tools/db2/JournalEncounterItem/csv?build=12.1.0.69111&locale=enUS) 的日期为 **2026-08-05**。

用户可见的 `M1`、`M2`……应取同一 `JournalInstanceID` 内按数值 `OrderIndex` 升序后的 **1-based 名次**；裸 `OrderIndex` 仅作为排序输入。当前数据既有从 `0` 起始的实例，也有跳号，因此直接显示它会产生 `M0` 或跳过 M 序号。

| 类别 | 实例（`JournalInstanceID`） | `OrderIndex` 升序后的用户可见顺序 |
|---|---|---|
| 团本 | 烈毒之渊（1320） | M1 盘魂者内克扎莉（1）→ M2 陵寝哨兵（2）→ M3 迷失的探险者（3）→ M4 万毒邪祟者瓦什尼克（4）→ M5 斯索拉克（5）→ **M6 双子毒牙（6）**→ M7 盘卷祭坛（7）→ M8 乌拉特克（8） |
| 团本 | 潮缚石窟（1317） | M1 尼姆瑞莎·唤波者（0） |
| 大秘境 | 毒牙祭坛（1322） | M1 拉维（1）→ M2 扭缠盘蛇（2）→ M3 祖尔加（3） |
| 大秘境 | 夺目谷（1309） | M1 光明众花（1）→ M2 圣光猎手伊库兹（2）→ M3 护光者鲁伊亚（3）→ M4 兹欧凯特（4） |
| 大秘境 | 红玉新生法池（1202） | M1 梅莉杜莎·寒妆（1）→ M2 柯姬雅·焰蹄（2）→ M3 基拉卡与厄克哈特·风脉（3） |
| 大秘境 | 密谋小径（1304） | **M1 凯斯媞亚·魔力之心（0）→ M2 赞恩·刃悲（1）→ M3 歼灭者萨祖克斯（3）→ M4 利希尔·烬怒（4）** |
| 大秘境 | 纳洛拉克的洞穴（1311） | M1 囤宝狂人（1）→ M2 寒冬哨兵（2）→ M3 纳洛拉克（3） |
| 大秘境 | 塞塔里斯神庙（1030） | M1 阿德里斯和阿斯匹克斯（1）→ M2 米利克萨（2）→ M3 加瓦兹特（3）→ M4 塞塔里斯的化身（4） |
| 大秘境 | 虚空之痕竞技场（1313） | M1 塔兹拉尔（1）→ M2 阿特洛苏斯（2）→ M3 煞戎努斯（3） |
| 大秘境 | 诸王之眠（1041） | M1 黄金风蛇（1）→ M2 殓尸者姆沁巴（2）→ M3 部族议会（3）→ M4 始皇达萨（4） |

字段职责：`JournalEncounter.JournalInstanceID` 将首领归属到 `JournalInstance.ID`；`JournalEncounter.OrderIndex` 提供该实例内部的排序依据；`JournalInstance.MapID` 只用于地图交叉核验。`JournalEncounter.ID`、`DungeonEncounterID` 是首领身份与关联键，`DifficultyMask` 用于难度筛选，均不应用于首领顺序。客户端层最终展示可再以 `EJ_GetEncounterInfoByIndex` 的实际枚举结果复核。
