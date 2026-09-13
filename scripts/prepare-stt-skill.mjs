import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { lua, lauxlib, lualib, to_jsstring, to_luastring } = require('fengari')

const scriptDir = dirname(fileURLToPath(import.meta.url))
const planShareRoot = resolve(scriptDir, '..')
const repoRoot = resolve(planShareRoot, '..')
const skillSource = join(planShareRoot, 'skill', 'stt-plan-writer')
const outputRoot = join(planShareRoot, 'dist', 'skill')
const referencesRoot = join(outputRoot, 'references')

const luaSources = [
  'STT/STT_TacticsEditor/data/class_spells.lua',
  'STT/STT/core/boss_catalog.lua',
  'STT/STT_Tactics/data/season_catalog_121.lua',
  'STT/STT_TacticsEditor/data/season_plans_s2.lua',
]

const classLabels = {
  DEATHKNIGHT: '死亡骑士', DEMONHUNTER: '恶魔猎手', DRUID: '德鲁伊', EVOKER: '唤魔师',
  HUNTER: '猎人', MAGE: '法师', MONK: '武僧', PALADIN: '圣骑士', PRIEST: '牧师',
  ROGUE: '潜行者', SHAMAN: '萨满祭司', WARLOCK: '术士', WARRIOR: '战士',
}

const specLabels = {
  GENERAL: '通用', BLOOD: '鲜血', FROST: '冰霜', UNHOLY: '邪恶', HAVOC: '浩劫',
  VENGEANCE: '复仇', DEVOURER: '噬灭', BALANCE: '平衡', FERAL: '野性', GUARDIAN: '守护',
  RESTORATION: '恢复', DEVASTATION: '湮灭', PRESERVATION: '恩护', AUGMENTATION: '增辉',
  BEAST_MASTERY: '野兽控制', MARKSMANSHIP: '射击', SURVIVAL: '生存', ARCANE: '奥术',
  FIRE: '火焰', BREWMASTER: '酒仙', MISTWEAVER: '织雾', WINDWALKER: '踏风',
  HOLY: '神圣', PROTECTION: '防护', RETRIBUTION: '惩戒', DISCIPLINE: '戒律',
  SHADOW: '暗影', ASSASSINATION: '奇袭', OUTLAW: '狂徒', SUBTLETY: '敏锐',
  ELEMENTAL: '元素', ENHANCEMENT: '增强', AFFLICTION: '痛苦', DEMONOLOGY: '恶魔学识',
  DESTRUCTION: '毁灭', ARMS: '武器', FURY: '狂怒',
}

const difficultyLabels = { mythic: '史诗', heroic: '英雄', normal: '普通', mplus: '大秘境' }

const prelude = String.raw`
unpack = unpack or table.unpack
local T = { Data = {} }
local C = { DB = {} }
local L = setmetatable({}, { __index = function(_, key) return tostring(key or "") end })
T.Assets = {}
function T.Assets:Define(_, spec)
    assert(type(spec) == "table" and type(spec.factory) == "function", "invalid asset spec")
    local target = spec.targetTable or T
    target[spec.targetKey] = spec.factory()
end
_G.__STT_SKILL_NS = { T, C, L }
`

function luaMessage(state) {
  const raw = lua.lua_tostring(state, -1)
  return raw ? to_jsstring(raw) : 'Lua runtime error'
}

function runLua(state, code, label) {
  const status = lauxlib.luaL_dostring(state, to_luastring(code))
  if (status !== lua.LUA_OK) throw new Error(`${label}: ${luaMessage(state)}`)
}

function loadLuaSource(state, relativePath) {
  const source = readFileSync(join(repoRoot, relativePath), 'utf8')
  const status = lauxlib.luaL_loadbuffer(
    state,
    to_luastring(source),
    null,
    to_luastring(`@${relativePath}`),
  )
  if (status !== lua.LUA_OK) throw new Error(`${relativePath}: ${luaMessage(state)}`)
  lua.lua_pushstring(state, to_luastring('ShengTangTools'))
  lua.lua_getglobal(state, to_luastring('__STT_SKILL_NS'))
  const runStatus = lua.lua_pcall(state, 2, 0, 0)
  if (runStatus !== lua.LUA_OK) throw new Error(`${relativePath}: ${luaMessage(state)}`)
}

function luaValue(state, index) {
  const type = lua.lua_type(state, index)
  if (type === lua.LUA_TNIL) return null
  if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(state, index)
  if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(state, index)
  if (type === lua.LUA_TSTRING) {
    const raw = lua.lua_tostring(state, index)
    return raw ? to_jsstring(raw) : ''
  }
  if (type !== lua.LUA_TTABLE) return undefined

  const absoluteIndex = lua.lua_absindex(state, index)
  const entries = []
  lua.lua_pushnil(state)
  while (lua.lua_next(state, absoluteIndex) !== 0) {
    entries.push([luaValue(state, -2), luaValue(state, -1)])
    lua.lua_pop(state, 1)
  }

  const numericKeys = entries.map(([key]) => key)
  const isArray = numericKeys.length > 0
    && numericKeys.every((key) => Number.isInteger(key) && key > 0)
    && Math.max(...numericKeys) === numericKeys.length
  if (isArray) {
    const result = new Array(entries.length)
    for (const [key, value] of entries) result[key - 1] = value
    return result
  }

  return Object.fromEntries(entries
    .filter(([key, value]) => key !== undefined && value !== undefined)
    .map(([key, value]) => [String(key), value]))
}

function loadAuthorityData() {
  const state = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(state)
  runLua(state, prelude, 'stt-skill-prelude')
  for (const relativePath of luaSources) loadLuaSource(state, relativePath)
  runLua(state, String.raw`
local T = __STT_SKILL_NS[1]
_G.__STT_SKILL_EXPORT = {
    classSpellsVersion = T.Data.ClassSpellsVersion,
    classSpells = T.Data.ClassSpells,
    catalog = T.SeasonData,
    plansS2Version = T.SemanticBuiltinPlansVersionS2,
    plansS2 = T.SemanticBuiltinPlansS2,
}
`, 'stt-skill-export')
  lua.lua_getglobal(state, to_luastring('__STT_SKILL_EXPORT'))
  const result = luaValue(state, -1)
  lua.lua_pop(state, 1)
  return result
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`)
}

function cleanText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function tableText(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function planVariants(key, value) {
  if (typeof value === 'string') {
    return { [key.startsWith('dungeon:') ? 'mplus' : 'mythic']: value }
  }
  return Object.fromEntries(Object.entries(value || {}).filter(([, text]) => typeof text === 'string'))
}

function structuredTemplate(name, body) {
  return [
    '[方案]',
    `名称 = ${name}`,
    '作者 = STT',
    '',
    '[人员]',
    '',
    '[时间轴]',
    normalizeBossAudience(body),
  ].join('\n')
}

function normalizeBossAudience(body) {
  const reserved = /^(?:BOSS|boss|所有人|全团|all|everyone|坦克|tank|治疗|healer|heal|输出|dps|dd|damager|近战|melee|远程|ranged|g[1-8]|spell:|ct:|sr:|dur:|bar:|tl:|to:|board:|@)/i
  return cleanText(body).split('\n').map((line) => line.replace(
    /^(\s*\{time:[^}]+\}\s*)\{([^}]+)\}/,
    (full, prefix, audience) => reserved.test(audience.trim()) || /[+,]/.test(audience)
      ? full
      : `${prefix}{BOSS}`,
  )).join('\n')
}

function buildS2Metadata(catalog) {
  const result = {}
  for (const instanceType of ['raid', 'dungeon']) {
    for (const instance of catalog.instances?.[instanceType] || []) {
      for (const encounter of instance.encounters || []) {
        const key = `${instanceType}:${instance.instanceID}:${encounter.encounterID}`
        result[key] = {
          instanceType,
          instanceID: instance.instanceID,
          instanceName: instance.name,
          instanceNameZh: instance.nameZh,
          encounterID: encounter.encounterID,
          encounterName: encounter.name,
          encounterNameZh: encounter.nameZh,
          journalOrder: encounter.journalOrder,
        }
      }
    }
  }
  return result
}

function buildTemplatePages(data) {
  const templatesRoot = join(referencesRoot, 'templates')
  const s2Meta = buildS2Metadata(data.catalog)
  const sources = [
    { season: 2, version: data.plansS2Version, plans: data.plansS2, meta: s2Meta },
  ]
  const rows = []
  const counts = { bosses: 0, mplus: 0, heroic: 0, mythic: 0 }

  for (const source of sources) {
    const planEntries = Object.entries(source.plans || {})
    counts.bosses = planEntries.length
    for (const [key, value] of planEntries) {
      const meta = source.meta?.[key]
      assert.ok(meta, `模板缺少 Boss 元数据: ${key}`)
      const encounterName = meta.encounterNameZh || meta.encounterName || key
      const instanceName = meta.instanceNameZh || meta.instanceName || String(meta.instanceID || '')
      for (const [difficulty, body] of Object.entries(planVariants(key, value))) {
        assert.ok(difficultyLabels[difficulty], `未知模板难度: ${key}#${difficulty}`)
        assert.ok(cleanText(body), `空模板: ${key}#${difficulty}`)
        if (difficulty === 'mplus') counts.mplus += 1
        if (difficulty === 'heroic') counts.heroic += 1
        if (difficulty === 'mythic') counts.mythic += 1
        const filename = `${key.replaceAll(':', '-')}-${difficulty}.md`
        const title = `${encounterName} · ${difficultyLabels[difficulty]}`
        write(join(templatesRoot, filename), [
          `# ${title}`,
          '',
          `- 副本：${instanceName}`,
          `- Boss Key：\`${key}\``,
          `- 内置模板版本：\`${source.version}\``,
          '- 用途：Boss 时间和 Spell ID 的事实底稿；人员、分工和提醒文案需要按团队调整。',
          '- 生成说明：Boss/NPC 展示行已统一使用正式 `{BOSS}` 受众。',
          '',
          '```stt',
          structuredTemplate(encounterName, body),
          '```',
        ].join('\n'))
        rows.push({ source, key, meta, encounterName, instanceName, difficulty, filename })
      }
    }
  }

  assert.deepEqual(counts, { bosses: 37, mplus: 28, heroic: 9, mythic: 9 })
  rows.sort((a, b) => b.source.season - a.source.season
    || String(a.meta.instanceType || a.key.split(':')[0]).localeCompare(String(b.meta.instanceType || b.key.split(':')[0]))
    || Number(a.meta.instanceID || a.key.split(':')[1]) - Number(b.meta.instanceID || b.key.split(':')[1])
    || Number(a.meta.journalOrder || a.meta.encounterID || 0) - Number(b.meta.journalOrder || b.meta.encounterID || 0)
    || a.difficulty.localeCompare(b.difficulty))

  const index = [
    '# STT 12.1 内置模板索引',
    '',
    '先按 Boss 和难度读取一个模板。模板提供时间与 Spell ID 底稿，不代表已经完成团队分工。',
    '',
    `- 12.1 S2 模板版本：\`${data.plansS2Version}\``,
    `- 当前范围：${counts.mplus} 个大秘境 Boss，${counts.heroic} 个英雄团本 Boss，${counts.mythic} 个史诗团本 Boss。`,
    '',
    '| 赛季 | 副本 | Boss | 难度 | 模板 |',
    '|---|---|---|---|---|',
    ...rows.map((row) => `| S${row.source.season} | ${tableText(row.instanceName)} | ${tableText(row.encounterName)} | ${difficultyLabels[row.difficulty]} | [读取](https://zhaobanzi.pages.dev/skill/references/templates/${row.filename}) |`),
  ]
  write(join(templatesRoot, 'index.md'), index.join('\n'))
  return { pages: rows.length, counts }
}

function buildClassPages(data) {
  const classesRoot = join(referencesRoot, 'classes')
  const classes = Object.entries(data.classSpells || {}).sort(([a], [b]) => a.localeCompare(b))
  assert.equal(classes.length, 13, '职业数量必须为 13')
  const indexRows = []
  let spellRows = 0

  for (const [classKey, buckets] of classes) {
    assert.ok(classLabels[classKey], `缺少职业名称: ${classKey}`)
    const filename = `${classKey.toLowerCase()}.md`
    const lines = [
      `# ${classLabels[classKey]}技能参考`,
      '',
      `数据版本：\`${data.classSpellsVersion}\`。技能是否已学习、天赋是否选择、当前是否可施放仍由玩家确认。`,
    ]
    const bucketEntries = Object.entries(buckets || {}).sort(([a], [b]) => {
      if (a === 'GENERAL') return -1
      if (b === 'GENERAL') return 1
      return a.localeCompare(b)
    })
    for (const [bucketKey, spells] of bucketEntries) {
      assert.ok(specLabels[bucketKey], `缺少专精名称: ${classKey}.${bucketKey}`)
      lines.push('', `## ${specLabels[bucketKey]}（${bucketKey}）`, '', '| Spell ID | 名称 | 分类 | 持续 | 冷却 |', '|---:|---|---|---:|---:|')
      const entries = Object.entries(spells || {})
        .filter(([, spell]) => cleanText(spell?.name))
        .sort(([a], [b]) => Number(a) - Number(b))
      for (const [spellID, spell] of entries) {
        spellRows += 1
        lines.push(`| ${spellID} | ${tableText(spell.name)} | ${tableText(spell.category)} | ${spell.dur ?? ''} | ${spell.cooldown ?? ''} |`)
      }
    }
    write(join(classesRoot, filename), lines.join('\n'))
    indexRows.push(`| ${classLabels[classKey]} | \`${classKey}\` | [读取](https://zhaobanzi.pages.dev/skill/references/classes/${filename}) |`)
  }

  assert.ok(spellRows > 500, `职业技能条目异常: ${spellRows}`)
  write(join(classesRoot, 'index.md'), [
    '# STT 职业技能索引',
    '',
    `数据版本：\`${data.classSpellsVersion}\`。需要安排团队技能或个人技能时，只读取相关职业页面。`,
    '',
    '| 职业 | Class Token | 技能参考 |',
    '|---|---|---|',
    ...indexRows,
  ].join('\n'))
  return { classes: classes.length, spellRows }
}

function main() {
  console.info(JSON.stringify({ chain: 'stt-skill-build', stage: 'started', sources: luaSources.length }))
  const data = loadAuthorityData()
  assert.ok(data && typeof data === 'object', '未读取到 STT 权威数据')
  cpSync(skillSource, outputRoot, { recursive: true, force: true })
  mkdirSync(referencesRoot, { recursive: true })
  cpSync(join(repoRoot, 'docs', '战术方案编写指南.md'), join(referencesRoot, 'writing-guide.md'), { force: true })
  const templates = buildTemplatePages(data)
  const classes = buildClassPages(data)
  console.info(JSON.stringify({
    chain: 'stt-skill-build',
    stage: 'completed',
    templatePages: templates.pages,
    classes: classes.classes,
    spellRows: classes.spellRows,
  }))
}

try {
  main()
} catch (error) {
  console.error(JSON.stringify({
    chain: 'stt-skill-build',
    stage: 'failed',
    reason: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
}
