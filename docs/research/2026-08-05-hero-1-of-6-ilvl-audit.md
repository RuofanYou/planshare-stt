# 12.1 Hero 1/6 与物品等级 259：构建期审计记录

- 调研日期：2026-08-05（Asia/Shanghai）
- 用途：为本次 12.1 装备数据生成提供可回溯的等级轨道断言。
- 范围：只读检查本机正式服目录与公开 Wowhead PTR 页面；本记录没有改动 UI、数据、脚本、Worker、API 或 translator。

## 可复核结论

本次数据生成使用的断言为：**Hero 1/6 = item level 259**。它适用于本次 12.1 大秘境赛季数据的等级轨道标注；单件物品的中文名、掉落首领和属性仍须分别由地下城手册与固定 build 的 DB2 快照核验，见 [12.1 数据核验路线](./2026-08-05-wow-12-1-data-verification.md)。

## 证据链

| 证据 | 2026-08-05 读数 | 审计作用 |
|---|---|---|
| 本机正式服参考 `/Applications/World of Warcraft/_retail_/Interface/AddOns/KeystoneLoot/` | `KeystoneLoot.toc` 为 `2.10.4`；`data/upgrade_tracks.lua` 的 `dungeon.hero` 首项为 `ilvl=259`、`bonusId=12793`；`data/keystone_mapping.lua` 将 `+6`、`+7` 的赛后奖励映射到 Hero 首档。 | 本地只读交叉检查，确认数据脚本采用的数值与升级轨道组合。上游项目：[KeystoneLoot](https://github.com/Wolkenschutz/KeystoneLoot)。 |
| [Wowhead PTR：Domanaar's Dire Treads](https://www.wowhead.com/ptr/item=251121/domanaars-dire-treads?ilvl=259&bonus=12793%3A13440%3A6652%3A13577%3A12699&spec=104) | 实测该 PTR 物品提示含 `Item Level 259` 与 `Upgrade Level: Hero 1/6`。URL 显式传入 `ilvl=259`，同时保留匹配本地参考的 `bonus=12793`。 | 对实际网页 tooltip 变体的独立复核。`ilvl` 用于选择等级；完整 bonus 组合用于锁定该物品变体。 |
| [Wowhead PTR：The Great Vault](https://www.wowhead.com/ptr/guide/systems/the-great-vault) | 12.1 页面的大秘境表将 `+6`、`+7` 赛后奖励列为 `259 / Hero 1/6`。 | 对赛后奖励语义的公开交叉检查。 |

本机文件指纹，便于在正式服目录更新后判断参考是否变化：

```text
KeystoneLoot.toc                   sha256 8767b34c8e4e0275b18363e2720d71ef66c79614e2337c5c3f00c32959569843
data/upgrade_tracks.lua            sha256 d584e5404165e267a61846d1ccfaa4027ae3e22fe68ad0e5e7f8d8b0280e9e88
data/keystone_mapping.lua          sha256 45a4b5e8a4c017b2263cee22af5013ef20e64f19c0b2a5866015de64cd0fbc2f
```

## 使用边界

- 本记录只证明本次 `Hero 1/6 ↔ 259` 轨道断言，不能单独证明任意 `itemID` 的来源、名称、属性或最终可获得性。
- 数据脚本的审计可检查这条断言与上述链接、日期和本机文件指纹；参考文件一旦变更，须重新读取后再沿用结论。
- 这些来源只供构建期审计。最终网页不展示 KeystoneLoot、Wowhead PTR 或本记录的来源信息；最终页面没有 Wowhead 外链，也没有对 KeystoneLoot、Wowhead 的运行时依赖。
