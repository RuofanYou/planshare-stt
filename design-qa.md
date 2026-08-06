# `/loot` 现代装备库视觉验收

- 参考图：`/var/folders/x4/rvs_jc093_z5twzfp9k35g3w0000gn/T/codex-clipboard-541d99d8-3804-4b45-92fc-342d066d83d3.jpg`
- 本地截图：`output/loot-ui/loot-modern-desktop.png`、`output/loot-ui/loot-modern-cards.png`、`output/loot-ui/loot-modern-mobile.png`、`output/loot-ui/loot-modern-motion.png`
- 验收状态：通过
- 验收视口：桌面 1440×900；手机 390×844

## 对照结果

1. 筛选项按分类分组，职业、装备部位、武器类型、护甲类型、其它类型和属性均使用标签按钮。
2. 每组都有“全部”入口，选中项使用金色高亮，文字与背景对比满足可读性要求。
3. 桌面端标签横向换行，移动端按容器宽度自然换行，没有横向溢出。
4. 无结果选项自动禁用，来源切换会清理失效的组合筛选。
5. 筛选结果继续按来源、副本、首领分组；桌面端使用三列装备卡片，移动端使用单列卡片。
6. 饰品详情、真实属性、档位和物品 ID 在卡片内同一信息层级直接展示，无需展开收起。
7. 顶部 Remotion 索引层以低速轨道和呼吸光点提供氛围动效，结果内容仍由普通 DOM 呈现。
