import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const dataPath = resolve(projectRoot, 'src/data/loot-12-1.json')
const metadataPath = resolve(projectRoot, 'src/data/loot-12-1.meta.json')
const auditPath = resolve(projectRoot, 'reports/loot-12-1-input-audit.json')
const variantReportPath = resolve(projectRoot, 'reports/loot-12-1-variant-report.json')
const trinketEffectsPath = resolve(projectRoot, 'reports/loot-12-1-trinket-effects.json')
const unresolvedPath = resolve(projectRoot, 'reports/loot-12-1-unresolved.json')
const publicDir = resolve(projectRoot, 'public')
const expectedCounts = { 团本: 218, 大秘境: 205, 地下堡: 95, 其它: 59 }
const expectedClassOrder = ['战士', '圣骑士', '猎人', '潜行者', '牧师', '死亡骑士', '萨满祭司', '法师', '术士', '武僧', '德鲁伊', '恶魔猎手', '唤魔师']
const expectedSlotOrder = ['头部', '颈部', '肩部', '背部', '胸部', '腕部', '手部', '腰部', '腿部', '脚部', '手指', '饰品', '单手', '主手', '副手', '双手', '远程', '盾牌']

const [records, metadata, audit, variantReport, trinketEffects, unresolved] = await Promise.all(
  [dataPath, metadataPath, auditPath, variantReportPath, trinketEffectsPath, unresolvedPath]
    .map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
)

assert.ok(Array.isArray(records), '公开掉落数据必须是数组')
assert.equal(records.length, 577, '公开掉落数据必须完整覆盖 577 条输入')
assert.equal(metadata.schemaVersion, 5, '掉落数据结构版本必须为 5')
assert.equal(metadata.attribution, '数据整理参考：12.1 DropSheet (by Ango)', '内部元数据必须保留 DropSheet 归属')
assert.equal(metadata.input.recordRows, 577, '元数据输入行数必须是 577')
assert.equal(metadata.input.sheet, 'total', '元数据输入工作表必须是 total')
assert.equal(metadata.input.range, 'A1:K578', '元数据输入范围必须是 total!A1:K578')
assert.match(metadata.input.sha256, /^[a-f0-9]{64}$/, '元数据必须记录 XLSX SHA-256')
assert.equal(audit.schemaVersion, 1, '输入审计报告结构版本错误')
assert.equal(audit.input.recordRows, 577, '审计报告输入行数必须是 577')
assert.equal(audit.input.sha256, metadata.input.sha256, '审计报告与公开元数据的 XLSX 指纹不一致')
assert.equal(audit.records.length, 577, '审计报告必须保留 577 条输入行')
assert.equal(variantReport.schemaVersion, 1, '变体证据报告结构版本错误')
assert.equal(variantReport.result.records, 577, '变体证据报告必须覆盖 577 条')
assert.equal(variantReport.result.verifiedRecords, 577, '变体证据报告必须全部 verified')
assert.equal(metadata.result.unresolvedRows, 0, '正式发布数据不允许 unresolved')
assert.deepEqual(unresolved, [], 'unresolved 报告必须为空')
assert.equal(trinketEffects.schemaVersion, 1, '饰品效果报告结构版本错误')
assert.equal(trinketEffects.gameBuild, '12.1.0.69111', '饰品效果报告构建号错误')
assert.deepEqual(trinketEffects.result, { trinketRecords: 44, effectRecords: 43, staticOnlyRecords: 1, unresolved: 0 }, '饰品效果统计必须为 44/43/1/0')
assert.deepEqual(metadata.filters.sourceTypes, ['团本', '大秘境', '地下堡', '其它'], '来源筛选枚举错误')
assert.deepEqual(metadata.filters.classes, expectedClassOrder, '职业筛选顺序必须沿用权威顺序')
assert.deepEqual(metadata.filters.slots, expectedSlotOrder, '部位筛选顺序必须沿用权威顺序')
assert.deepEqual(metadata.quality.sourceCategoryCounts, expectedCounts, '来源分类统计错误')
assert.equal(metadata.quality.verifiedRecords, 577, 'verified 记录数必须是 577')
assert.equal(metadata.quality.parserVersion, 2, '数值属性解析器版本必须为 2')
assert.equal(metadata.quality.staleRefreshed, 132, '旧缓存的 nether 属性刷新数量错误')
assert.equal(metadata.quality.ssrRechecked, 445, '缺少 SSR default bonus 与未缓存项的复核数量错误')
assert.equal(metadata.quality.setRecordsReclassifiedToRaid, 117, '套装归团本数量错误')
assert.equal(metadata.quality.priestSetRecordsInRaid, 9, '牧师套装归团本数量错误')
assert.equal(metadata.quality.trinketEffectRecords, 43, '已解析饰品效果数量错误')
assert.equal(metadata.quality.trinketStaticOnlyRecords, 1, '无效果文本饰品数量错误')
assert.equal(metadata.quality.weaponClassCorrections, 17, '武僧匕首职业校正数量错误')

const auditByRow = new Map(audit.records.map((row) => [row.sourceRow, row]))
const evidenceByItemId = new Map(variantReport.records.map((row) => [row.itemId, row]))
const trinketEffectByItemId = new Map(trinketEffects.records.map((row) => [row.itemId, row]))
const keys = new Set()
const itemIds = new Set()
const sourceRows = new Set()
const sourceCounts = new Map(Object.keys(expectedCounts).map((sourceType) => [sourceType, 0]))
const iconPaths = new Set()
let exactTargetRecords = 0

for (const record of records) {
  assert.ok(Number.isInteger(record.itemId) && record.itemId > 0, `无效 itemID: ${record.key}`)
  assert.ok(typeof record.key === 'string' && record.key.trim(), `空稳定键: ${record.itemId}`)
  assert.ok(!keys.has(record.key), `重复稳定键: ${record.key}`)
  keys.add(record.key)
  assert.ok(!itemIds.has(record.itemId), `重复 itemID: ${record.itemId}`)
  itemIds.add(record.itemId)
  assert.ok(typeof record.name === 'string' && record.name.trim(), `空中文名称: ${record.itemId}`)
  assert.ok(Array.isArray(record.classes) && record.classes.length > 0, `空职业列表: ${record.itemId}`)
  assert.equal(new Set(record.classes).size, record.classes.length, `职业列表重复: ${record.itemId}`)
  assert.ok(Object.hasOwn(record, 'trace') && Number.isInteger(record.trace?.sourceRow), `缺少输入行审计: ${record.itemId}`)
  assert.ok(!Object.hasOwn(record, 'attributes'), `公开 JSON 不得残留旧 attributes: ${record.itemId}`)
  assert.ok(sourceCounts.has(record.sourceType), `未知来源分类: ${record.itemId}/${record.sourceType}`)
  sourceCounts.set(record.sourceType, sourceCounts.get(record.sourceType) + 1)
  assert.ok(!sourceRows.has(record.trace.sourceRow), `重复输入行: ${record.trace.sourceRow}`)
  sourceRows.add(record.trace.sourceRow)

  const auditRow = auditByRow.get(record.trace.sourceRow)
  assert.ok(auditRow, `输入行未保留在审计报告: ${record.trace.sourceRow}`)
  assert.equal(auditRow.rawName, record.trace.rawName, `审计名称不一致: ${record.itemId}`)
  assert.equal(auditRow.rawRoute, record.trace.rawRoute, `审计途径不一致: ${record.itemId}`)
  assert.equal(auditRow.rawSource, record.trace.rawSource, `审计来源不一致: ${record.itemId}`)
  assert.equal(auditRow.inputFields.sourceRow, record.trace.sourceRow, `XLSX sourceRow 不一致: ${record.itemId}`)
  assert.equal(auditRow.inputFields.名称, record.trace.rawName, `XLSX 名称不一致: ${record.itemId}`)
  assert.equal(auditRow.inputFields.掉落途径, record.trace.rawRoute, `XLSX 途径不一致: ${record.itemId}`)
  assert.equal(auditRow.inputFields.掉落来源, record.trace.rawSource, `XLSX 来源不一致: ${record.itemId}`)
  assert.ok(auditRow.inputAttributes && typeof auditRow.inputAttributes === 'object', `旧属性审计缺失: ${record.itemId}`)

  const variant = record.displayVariant
  assert.ok(variant && typeof variant === 'object', `缺少 displayVariant: ${record.itemId}`)
  assert.ok(Number.isInteger(variant.itemLevel) && variant.itemLevel > 0, `物等异常: ${record.itemId}`)
  assert.ok(typeof variant.track === 'string' && variant.track.trim(), `轨道为空: ${record.itemId}`)
  assert.ok(Number.isInteger(variant.rank) && Number.isInteger(variant.maxRank), `rank 类型异常: ${record.itemId}`)
  assert.ok(variant.rank >= 0 && variant.maxRank >= 0 && variant.rank <= variant.maxRank, `rank 范围异常: ${record.itemId}`)
  assert.ok(Array.isArray(variant.stats), `stats 必须为数组: ${record.itemId}`)
  for (const statEntry of variant.stats) {
    assert.ok(typeof statEntry?.label === 'string' && /[\u4e00-\u9fff]/.test(statEntry.label), `属性标签必须是中文: ${record.itemId}`)
    assert.ok(typeof statEntry.value === 'number' && Number.isFinite(statEntry.value) && statEntry.value > 0, `属性数值异常: ${record.itemId}/${statEntry.label}`)
  }
  assert.match(variant.icon, /^\/loot-icons\/[a-z0-9_]+\.jpg$/, `本地图标路径异常: ${record.itemId}`)
  assert.equal(variant.verified, true, `未验证变体不得发布: ${record.itemId}`)
  iconPaths.add(variant.icon)
  await access(resolve(publicDir, `.${variant.icon}`))
  assert.ok((await stat(resolve(publicDir, `.${variant.icon}`))).size > 32, `图标为空: ${record.itemId}`)

  const evidence = evidenceByItemId.get(record.itemId)
  assert.ok(evidence, `缺少变体证据: ${record.itemId}`)
  assert.deepEqual(evidence.displayVariant, variant, `证据与公开变体不一致: ${record.itemId}`)
  if (record.slot === '饰品') {
    const effectReport = trinketEffectByItemId.get(record.itemId)
    assert.ok(effectReport, `缺少饰品效果证据: ${record.itemId}`)
    assert.ok(record.trinketEffect && record.trinketEffect.verified === true, `饰品效果必须已验证: ${record.itemId}`)
    const expectedText = effectReport.effects.map((effect) => effect.text.trim()).join('\n\n')
    assert.equal(record.trinketEffect.text, expectedText, `公开饰品效果与报告不一致: ${record.itemId}`)
    assert.equal(record.trinketEffect.staticOnly, effectReport.staticOnly, `饰品 staticOnly 不一致: ${record.itemId}`)
    assert.equal(evidence.trinketEffect?.text, record.trinketEffect.text, `变体证据缺少饰品效果: ${record.itemId}`)
    assert.equal(evidence.trinketEffect?.staticOnly, record.trinketEffect.staticOnly, `变体证据饰品状态不一致: ${record.itemId}`)
    assert.ok(!record.trinketEffect.text.includes('$') && !/[A-Za-z]/.test(record.trinketEffect.text), `饰品效果仍含英文或占位符: ${record.itemId}`)
  } else {
    assert.equal(Object.hasOwn(record, 'trinketEffect'), false, `非饰品记录不得带饰品效果: ${record.itemId}`)
    assert.equal(Object.hasOwn(evidence, 'trinketEffect'), false, `非饰品证据不得带饰品效果: ${record.itemId}`)
  }
  assert.match(evidence.evidence.pageUrl, /^https:\/\/www\.wowhead\.com\/ptr\/item=\d+$/, `页面证据 URL 异常: ${record.itemId}`)
  assert.match(evidence.evidence.pageSha256, /^[a-f0-9]{64}$/, `页面证据 SHA-256 异常: ${record.itemId}`)
  assert.ok(Array.isArray(evidence.evidence.ssrBonusOptionIds) && evidence.evidence.ssrBonusOptionIds.length > 0, `缺少 SSR bonusOptions: ${record.itemId}`)
  assert.ok(Array.isArray(evidence.evidence.attempts), `缺少 tooltip 尝试证据: ${record.itemId}`)
  assert.equal(evidence.evidence.statsParserVersion, 2, `属性解析器证据版本错误: ${record.itemId}`)
  const selectedDefaultNoBonus = evidence.evidence.selectedDefaultNoBonus === true
  assert.ok(Array.isArray(evidence.evidence.selectedBonusIds), `已选择 SSR bonus 缺失: ${record.itemId}`)
  if (selectedDefaultNoBonus) {
    assert.equal(evidence.evidence.selectedBonusToken, '', `默认无 bonus token 必须为空: ${record.itemId}`)
    assert.deepEqual(evidence.evidence.selectedBonusIds, [], `默认无 bonus 不得伪造 bonus ID: ${record.itemId}`)
    assert.equal(evidence.evidence.ssrDefaultBonus, '', `默认无 bonus 必须由 SSR 明确声明: ${record.itemId}`)
    assert.deepEqual(evidence.evidence.ssrDefaultBonusIds, [], `默认无 bonus 的 SSR ID 列表必须为空: ${record.itemId}`)
    assert.ok(evidence.evidence.selectionReason?.includes('SSR 默认无 bonus'), `默认无 bonus 缺少选择理由: ${record.itemId}`)
  } else {
    assert.match(evidence.evidence.selectedBonusToken, /^\d+(?::\d+)*$/, `已选择 SSR bonus token 异常: ${record.itemId}`)
    assert.ok(evidence.evidence.selectedBonusIds.length > 0, `已选择 SSR bonus 缺失: ${record.itemId}`)
    assert.deepEqual(
      evidence.evidence.selectedBonusIds.map(String).join(':'),
      evidence.evidence.selectedBonusToken,
      `SSR bonus token 与 ID 列表不一致: ${record.itemId}`,
    )
  }
  assert.ok(
    evidence.evidence.attempts.some((attempt) => (
      attempt?.bonusToken === evidence.evidence.selectedBonusToken
      && JSON.stringify(attempt?.bonusIds) === JSON.stringify(evidence.evidence.selectedBonusIds)
      && attempt?.tooltipSha256 === evidence.evidence.selectedTooltipSha256
    )),
    `已选择 tooltip 缺少当前解析证据: ${record.itemId}`,
  )
  assert.match(evidence.evidence.selectedTooltipUrl, /^https:\/\/nether\.wowhead\.com\/tooltip\/item\/\d+\?/, `tooltip 证据 URL 异常: ${record.itemId}`)
  assert.match(evidence.evidence.selectedTooltipSha256, /^[a-f0-9]{64}$/, `tooltip 证据 SHA-256 异常: ${record.itemId}`)
  assert.ok(typeof evidence.evidence.selectionReason === 'string' && evidence.evidence.selectionReason.trim(), `缺少选择理由: ${record.itemId}`)

  if (variant.itemLevel === 259 && variant.track === '英雄' && variant.rank === 1 && variant.maxRank === 6) {
    exactTargetRecords += 1
    assert.equal(evidence.evidence.selectedBonusIds.length, 1, `目标变体必须有单一 bonus 证据: ${record.itemId}`)
    assert.ok(evidence.evidence.targetCandidateBonusIds.includes(evidence.evidence.selectedBonusIds[0]), `目标 bonus 不属于 SSR 候选: ${record.itemId}`)
  } else if (selectedDefaultNoBonus) {
    assert.equal(variant.track, '无升级轨道', `默认无 bonus 不得声明升级轨道: ${record.itemId}`)
    assert.equal(variant.rank, 0, `默认无 bonus rank 必须为 0: ${record.itemId}`)
    assert.equal(variant.maxRank, 0, `默认无 bonus maxRank 必须为 0: ${record.itemId}`)
  } else if (evidence.evidence.selectionReason.includes('SSR tooltip default bonus')) {
    assert.match(evidence.evidence.ssrDefaultBonus, /^\d+(?::\d+)*$/, `default bonus 证据异常: ${record.itemId}`)
    assert.deepEqual(evidence.evidence.ssrDefaultBonusIds.map(String).join(':'), evidence.evidence.ssrDefaultBonus, `default bonus ID 列表异常: ${record.itemId}`)
    assert.equal(evidence.evidence.selectedBonusToken, evidence.evidence.ssrDefaultBonus, `默认变体必须使用 SSR tooltip default bonus: ${record.itemId}`)
  } else {
    assert.equal(evidence.evidence.selectedBonusIds.length, 1, `升级回退变体必须有单一 bonus 证据: ${record.itemId}`)
    assert.ok(evidence.evidence.fallbackCandidateBonusIds.includes(evidence.evidence.selectedBonusIds[0]), `回退 bonus 不属于 SSR 候选: ${record.itemId}`)
  }
}

assert.equal(keys.size, 577, '稳定键数量必须是 577')
assert.equal(itemIds.size, 577, 'itemID 数量必须是 577')
assert.equal(sourceRows.size, 577, '输入行数量必须是 577')
assert.deepEqual(Object.fromEntries(sourceCounts), expectedCounts, '发布数据来源统计错误')
assert.equal(exactTargetRecords, metadata.quality.targetMatchedRecords, '目标变体统计错误')
assert.equal(577 - exactTargetRecords, metadata.quality.fallbackRecords, '回退变体统计错误')
assert.equal(iconPaths.size, metadata.quality.iconAssets, '图标资产统计错误')

const priestRaid = records.filter((record) => record.sourceType === '团本' && record.classes.includes('牧师'))
assert.equal(priestRaid.length, 50, '团本+牧师必须包含 50 条，含 9 套装件')
assert.ok(priestRaid.some((record) => record.instance === '烈毒之渊' && record.equipmentType === '布甲'), '团本+牧师必须包含烈毒之渊布甲')
const setRecords = records.filter((record) => record.trace.rawRoute === '套装')
assert.equal(setRecords.length, 117, '套装记录数错误')
assert.ok(setRecords.every((record) => record.sourceType === '团本' && record.instance === '套装' && record.boss === null), '套装必须归团本，且不得虚构首领')
assert.equal(setRecords.filter((record) => record.classes.includes('牧师')).length, 9, '牧师套装数量错误')
const monkDaggers = records.filter((record) => record.equipmentType === '匕首' && record.classes.includes('武僧'))
assert.deepEqual(monkDaggers, [], '武僧不可用匕首，职业筛选不得收录匕首')

const auditHash = createHash('sha256').update(JSON.stringify(audit.records)).digest('hex')
console.log(`[loot-verify] inputRows=${metadata.input.recordRows} publishedRecords=${records.length} verifiedRecords=${metadata.quality.verifiedRecords} targetMatched=${exactTargetRecords} fallback=${metadata.quality.fallbackRecords} iconAssets=${iconPaths.size} auditRowsSha256=${auditHash}`)
