# WoW 12.1 武僧武器类型核验

- 访问日期：2026-08-12
- 核验范围：Blizzard 当前职业页、Wago DB2 当前 12.1 构建、本机正式服 KeystoneLoot

## 结论

WoW 12.1 武僧可用武器为：**拳套、单手斧、单手锤、单手剑、长柄武器、法杖**。

**武僧不可使用匕首。** 双手斧、双手锤、双手剑、战刃及远程武器同样不在武僧可用范围内。PlanShare 当前“从武僧职业筛选中排除匕首”的规则与 Blizzard 页面及 12.1 客户端 DB2 一致，无需撤销。

## 证据

### 1. Blizzard 当前武僧职业页

- URL：https://worldofwarcraft.blizzard.com/en-us/game/classes/monk
- 页面 `Available Weapons` 明列：`Fist Weapons, One-Handed Axes, One-Handed Maces, One-Handed Swords, Polearms, Staves`。
- 页面未列匕首；三个专精的 `Preferred Weapon(s)` 也均未包含匕首。

### 2. Wago DB2 当前 12.1 构建

- 当前构建页：https://wago.tools/db2/ChrClasses
- 本次页面显示的当前版本：`12.1.0.69273`。
- 技能名称表：https://wago.tools/db2/SkillLine/csv?build=12.1.0.69273&locale=enUS
- 职业/种族技能资格表：https://wago.tools/db2/SkillRaceClassInfo/csv?build=12.1.0.69273&locale=enUS

武僧的职业 ID 为 10，对应 `ClassMask` 位 `1 << 9 = 512`。对 `SkillRaceClassInfo` 做位检查：

| 武器技能 | SkillID | ClassMask | `ClassMask & 512` | 结论 |
| --- | ---: | ---: | ---: | --- |
| 单手剑 | 43 | 23471 | 512 | 可用 |
| 单手斧 | 44 | 23151 | 512 | 可用 |
| 单手锤 | 54 | 22139 | 512 | 可用 |
| 法杖 | 136 | 22485 | 512 | 可用 |
| 匕首 | 173 | 24029 | 0 | **不可用** |
| 长柄武器 | 229 | 17959 | 512 | 可用 |
| 拳套 | 473 | 24141 | 512 | 可用 |

补充核对：双手剑（SkillID 55，mask 20519）、双手锤（160，21603）、双手斧（172，20583）的武僧位均为 0。

注意：`SkillLineAbility` 中匕首法术 1180 的 `ClassMask` 会包含武僧位，单独读取该表会得出错误结论。武器技能的职业可获得资格应读取 `SkillRaceClassInfo`；其结果与 Blizzard 当前职业页一致。

### 3. 本机正式服 KeystoneLoot

- 插件目录（只读）：`/Applications/World of Warcraft/_retail_/Interface/AddOns/KeystoneLoot/`
- TOC：`/Applications/World of Warcraft/_retail_/Interface/AddOns/KeystoneLoot/KeystoneLoot.toc`
  - `## Version: 2.11.0`
  - `## Interface: 120007`
- 生成数据：`/Applications/World of Warcraft/_retail_/Interface/AddOns/KeystoneLoot/data/items.lua`
  - 文件头标记 `KeystoneLoot Updater v2.0.3`
  - 数据构建为 `12.0.7 (68232)`，生成时间 `2026-06-17 05:35:13`
- 筛选实现：`/Applications/World of Warcraft/_retail_/Interface/AddOns/KeystoneLoot/modules/query.lua`
  - `GetDungeonItems()` 在 147–168 行读取 `filters.specId`、`filters.classId`，先检查 `item.classes[classId]`，再检查预生成的专精 ID 数组。
  - `GetRaidItems()` 在 222–247 行使用同一套 `item.classes[classId]` + 专精 ID 逻辑。
  - `GetItemInfo()` 在 354–355 行直接读取 `KeystoneLoot.ItemDatabase[itemId]`。

因此，KeystoneLoot 运行时不会按武器子类重新判断职业熟练度；它完全信任 `data/items.lua` 的预生成职业/专精映射。该插件本机数据仍属 12.0.7，适合核验筛选机制，不应作为 12.1 武器资格的当前数据源。

## 对 PlanShare 的明确建议

保留 `scripts/build-loot-12-1-data.py` 中 `OFFICIAL_WEAPON_CLASS_EXCLUSIONS = {"匕首": {"武僧"}}`，并保留对应校验与 E2E 断言。若未来要消除手工排除项，应以指定构建的 `SkillRaceClassInfo` 生成职业武器资格，避免使用 `SkillLineAbility` 的 `ClassMask` 或仅复制第三方插件的预生成结果。
