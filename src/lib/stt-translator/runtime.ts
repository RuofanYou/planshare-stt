import { deflateSync, inflateSync } from 'fflate'
import { to_jsstring, to_luastring } from 'fengari/src/fengaricore'
import * as lauxlib from 'fengari/src/lauxlib'
import * as lua from 'fengari/src/lua'
import { luaopen_base } from 'fengari/src/lbaselib'
import { luaopen_math } from 'fengari/src/lmathlib'
import { luaopen_string } from 'fengari/src/lstrlib'
import { luaopen_table } from 'fengari/src/ltablib'
import {
  sttTranslatorAssets,
  sttTranslatorBundleHash,
  sttTranslatorManifest,
} from '../../generated/sttTranslatorBundle'

export type TranslatorMode = 'auto' | 'nsrt' | 'tr' | 'mrt'

export interface TranslatorFormat {
  id: Exclude<TranslatorMode, 'auto'>
  name: string
  sample: string
}

export interface MrtBossOption {
  value: number
  label: string
}

export interface TranslateInput {
  mode: TranslatorMode
  text: string
  mrtBoss: number
}

export interface TranslateResult {
  ok: boolean
  outputText: string
  formatId?: string
  eventCount: number
  phaseCount: number
  skipped: number
  totalLines: number
  encounterID?: number
  error?: string
}

export interface ExportTRInput {
  sttText: string
  mrtBoss: number
}

export interface ExportTRResult {
  ok: boolean
  outputText: string
  error?: string
}

export interface SttTranslatorAssetManifest {
  hash: string
  files: typeof sttTranslatorManifest
}

interface LuaJsonResult {
  [key: string]: unknown
}

type LuaOpenFunction = (state: unknown) => number

const PRELUDE = String.raw`
unpack = unpack or table.unpack
strmatch = string.match
strfind = string.find
strsub = string.sub
strlen = string.len
strlower = string.lower
strupper = string.upper
strrep = string.rep
strbyte = string.byte
strchar = string.char
strformat = string.format
tinsert = table.insert
tremove = table.remove
tconcat = table.concat
wipe = function(t)
    if type(t) == "table" then
        for k in pairs(t) do t[k] = nil end
    end
    return t
end
UnitName = UnitName or function() return "Player" end
C_Spell = C_Spell or {}

local T = {}
local C = {
    DB = {
        debugMode = true,
        tacticTranslatorMRTBoss = 0,
    },
}
local L = setmetatable({}, {
    __index = function(_, key)
        return tostring(key or "")
    end,
})

function T.debug() end
function T.msg() end
function T.RegisterColdFile(_, loader)
    if type(loader) == "function" then
        loader()
    end
end

T.Assets = {}
function T.Assets:Define(_, spec)
    if type(spec) ~= "table" or type(spec.factory) ~= "function" then
        return
    end
    local target = spec.targetTable or T
    target[spec.targetKey] = spec.factory()
end

_G.__STT_WEB_NS = { T, C, L }
`

const BRIDGE = String.raw`
local T, C = unpack(__STT_WEB_NS)

local LibDeflate = LibStub and LibStub:GetLibrary("LibDeflate", true)
if LibDeflate then
    LibDeflate.CompressDeflate = function(_, text)
        return __STT_WEB_COMPRESS(text)
    end
    LibDeflate.DecompressDeflate = function(_, text)
        return __STT_WEB_DECOMPRESS(text)
    end
end

local function JsonEscape(value)
    local text = tostring(value or "")
    text = text:gsub("\\", "\\\\")
    text = text:gsub('"', '\\"')
    text = text:gsub("\b", "\\b")
    text = text:gsub("\f", "\\f")
    text = text:gsub("\n", "\\n")
    text = text:gsub("\r", "\\r")
    text = text:gsub("\t", "\\t")
    return '"' .. text .. '"'
end

local function IsArray(value)
    if type(value) ~= "table" then return false end
    local max = 0
    local count = 0
    for key in pairs(value) do
        if type(key) ~= "number" or key <= 0 or key % 1 ~= 0 then
            return false
        end
        if key > max then max = key end
        count = count + 1
    end
    return max == count
end

local function JsonValue(value)
    local valueType = type(value)
    if valueType == "nil" then
        return "null"
    elseif valueType == "boolean" then
        return value and "true" or "false"
    elseif valueType == "number" then
        if value ~= value or value == math.huge or value == -math.huge then
            return "null"
        end
        return tostring(value)
    elseif valueType == "string" then
        return JsonEscape(value)
    elseif valueType == "table" then
        local parts = {}
        if IsArray(value) then
            for index = 1, #value do
                parts[#parts + 1] = JsonValue(value[index])
            end
            return "[" .. table.concat(parts, ",") .. "]"
        end
        local keys = {}
        for key in pairs(value) do
            keys[#keys + 1] = tostring(key)
        end
        table.sort(keys)
        for _, key in ipairs(keys) do
            parts[#parts + 1] = JsonEscape(key) .. ":" .. JsonValue(value[key])
        end
        return "{" .. table.concat(parts, ",") .. "}"
    end
    return "null"
end

local function ResultPayload(ok, fields)
    fields = type(fields) == "table" and fields or {}
    fields.ok = ok == true
    fields.outputText = tostring(fields.outputText or "")
    fields.eventCount = tonumber(fields.eventCount) or 0
    fields.phaseCount = tonumber(fields.phaseCount) or 0
    fields.skipped = tonumber(fields.skipped) or 0
    fields.totalLines = tonumber(fields.totalLines) or 0
    return JsonValue(fields)
end

function __STT_WEB_LIST_FORMATS()
    local rows = {}
    if not T.TacticTranslator then
        return "[]"
    end
    for _, def in ipairs(T.TacticTranslator:GetAll()) do
        rows[#rows + 1] = {
            id = def.id,
            name = def.name or def.id,
            sample = def.sample or "",
        }
    end
    return JsonValue(rows)
end

local function HasNextRoundFlag(def)
    if type(def) ~= "table" or type(def.anchors) ~= "table" then
        return false
    end
    for _, rules in pairs(def.anchors) do
        if type(rules) == "table" then
            for _, rule in ipairs(rules) do
                if type(rule) == "table" and rule.nextRound then
                    return true
                end
            end
        end
    end
    return false
end

function __STT_WEB_LIST_MRT_BOSSES()
    local rows = {
        { value = 0, label = "自动 / 朴素直译 (pgN -> pN)" },
    }
    local ids = {}
    for encounterID in pairs(T.PhaseAnchorsS14 or {}) do
        ids[#ids + 1] = tonumber(encounterID) or encounterID
    end
    table.sort(ids, function(a, b)
        return tostring(a) < tostring(b)
    end)
    for _, encounterID in ipairs(ids) do
        local def = T.PhaseAnchorsS14 and T.PhaseAnchorsS14[encounterID]
        local label = def and def.phaseLabels and def.phaseLabels.p1 or tostring(encounterID)
        local bossName = label:match(":%s*(.+)$") or label
        local suffix = HasNextRoundFlag(def) and "轮换 P1/P2" or "级进"
        rows[#rows + 1] = {
            value = encounterID,
            label = string.format("%s (%s)", bossName, suffix),
        }
    end
    return JsonValue(rows)
end

function __STT_WEB_TRANSLATE(mode, text, mrtBoss)
    C.DB.tacticTranslatorMRTBoss = tonumber(mrtBoss) or 0
    local raw = tostring(text or "")
    if raw:gsub("%s+", "") == "" then
        return ResultPayload(true, { outputText = "" })
    end
    if not T.TacticTranslator then
        return ResultPayload(false, { error = "翻译器模块未加载" })
    end

    local result
    local err
    local formatId = tostring(mode or "auto")
    if formatId == "auto" then
        local output, detected, detectedResult = T.TacticTranslator:DetectAndTranslate(raw)
        if not detected then
            return ResultPayload(false, {
                outputText = "",
                error = "未识别输入格式",
            })
        end
        result = detectedResult
        result.stn = output
        formatId = detected
    else
        result, err = T.TacticTranslator:Translate(formatId, raw)
    end

    if not result then
        return ResultPayload(false, {
            error = tostring(err or "翻译失败"),
        })
    end

    return ResultPayload(true, {
        outputText = result.stn or "",
        formatId = formatId,
        eventCount = result.eventCount,
        phaseCount = result.phaseCount,
        skipped = result.skipped,
        totalLines = result.totalLines,
        encounterID = result.encounterID or (result.header and result.header.encounterID),
    })
end

function __STT_WEB_EXPORT_TR(text, mrtBoss)
    C.DB.debugMode = true
    C.DB.tacticTranslatorMRTBoss = tonumber(mrtBoss) or 0
    if not (T.TacticExporterTR and T.TacticExporterTR.Export) then
        return ResultPayload(false, { error = "TR 导出模块未加载" })
    end
    local result, err = T.TacticExporterTR:Export(tostring(text or ""), {
        encounterID = C.DB.tacticTranslatorMRTBoss,
    })
    if not result then
        return ResultPayload(false, {
            error = tostring(err or "导出 TR 失败"),
        })
    end
    return ResultPayload(true, {
        outputText = result,
    })
end
`

export function syncSttTranslatorAssets(): SttTranslatorAssetManifest {
  return {
    hash: sttTranslatorBundleHash,
    files: sttTranslatorManifest,
  }
}

function luaMessage(state: unknown): string {
  const raw = lua.lua_tostring(state, -1)
  return raw ? to_jsstring(raw) : 'Lua runtime error'
}

function runLua(state: unknown, code: string, label: string) {
  const status = lauxlib.luaL_dostring(state, to_luastring(code))
  if (status !== lua.LUA_OK) {
    throw new Error(`${label}: ${luaMessage(state)}`)
  }
}

function openLuaLibrary(state: unknown, name: string, openFn: LuaOpenFunction) {
  lauxlib.luaL_requiref(state, to_luastring(name), openFn, 1)
  lua.lua_pop(state, 1)
}

function openTranslatorLibraries(state: unknown) {
  openLuaLibrary(state, '_G', luaopen_base)
  openLuaLibrary(state, 'table', luaopen_table)
  openLuaLibrary(state, 'string', luaopen_string)
  openLuaLibrary(state, 'math', luaopen_math)
}

function loadLuaAsset(state: unknown, path: string, source: string) {
  const status = lauxlib.luaL_loadbuffer(
    state,
    to_luastring(source),
    null,
    to_luastring(`@${path}`),
  )
  if (status !== lua.LUA_OK) {
    throw new Error(`${path}: ${luaMessage(state)}`)
  }

  lua.lua_pushstring(state, to_luastring('ShengTangTools'))
  lua.lua_getglobal(state, to_luastring('__STT_WEB_NS'))
  const runStatus = lua.lua_pcall(state, 2, 0, 0)
  if (runStatus !== lua.LUA_OK) {
    throw new Error(`${path}: ${luaMessage(state)}`)
  }
}

function bytesFromLua(state: unknown, index: number): Uint8Array {
  const value = lua.lua_tolstring(state, index)
  return value ? new Uint8Array(value) : new Uint8Array()
}

function pushBytes(state: unknown, bytes: Uint8Array) {
  lua.lua_pushlstring(state, bytes, bytes.length)
  return 1
}

function pushNil() {
  return 1
}

function registerDeflateBridge(state: unknown) {
  lua.lua_pushjsfunction(state, (luaState) => {
    try {
      return pushBytes(luaState, deflateSync(bytesFromLua(luaState, 1), { level: 9 }))
    } catch {
      lua.lua_pushnil(luaState)
      return pushNil()
    }
  })
  lua.lua_setglobal(state, to_luastring('__STT_WEB_COMPRESS'))

  lua.lua_pushjsfunction(state, (luaState) => {
    try {
      return pushBytes(luaState, inflateSync(bytesFromLua(luaState, 1)))
    } catch {
      lua.lua_pushnil(luaState)
      return pushNil()
    }
  })
  lua.lua_setglobal(state, to_luastring('__STT_WEB_DECOMPRESS'))
}

function parseJsonResult(value: unknown): LuaJsonResult {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LuaJsonResult
  }
  return {}
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toNumberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toBooleanValue(value: unknown): boolean {
  return value === true
}

function normalizeTranslateResult(value: unknown): TranslateResult {
  const result = parseJsonResult(value)
  const error = toStringValue(result.error)
  return {
    ok: toBooleanValue(result.ok),
    outputText: toStringValue(result.outputText),
    formatId: toStringValue(result.formatId) || undefined,
    eventCount: toNumberValue(result.eventCount),
    phaseCount: toNumberValue(result.phaseCount),
    skipped: toNumberValue(result.skipped),
    totalLines: toNumberValue(result.totalLines),
    encounterID: toNumberValue(result.encounterID) || undefined,
    error: error || undefined,
  }
}

function normalizeExportResult(value: unknown): ExportTRResult {
  const result = parseJsonResult(value)
  const error = toStringValue(result.error)
  return {
    ok: toBooleanValue(result.ok),
    outputText: toStringValue(result.outputText),
    error: error || undefined,
  }
}

export class SttTranslatorRuntime {
  private readonly state: unknown

  constructor() {
    this.state = lauxlib.luaL_newstate()
    openTranslatorLibraries(this.state)
    registerDeflateBridge(this.state)
    runLua(this.state, PRELUDE, 'stt-web-prelude')
    for (const asset of sttTranslatorAssets) {
      loadLuaAsset(this.state, asset.path, asset.source)
    }
    runLua(this.state, BRIDGE, 'stt-web-bridge')
  }

  private callJson(name: string, args: Array<string | number>): unknown {
    lua.lua_getglobal(this.state, to_luastring(name))
    if (lua.lua_isnil(this.state, -1)) {
      lua.lua_pop(this.state, 1)
      throw new Error(`Lua bridge function missing: ${name}`)
    }

    for (const arg of args) {
      if (typeof arg === 'number') {
        lua.lua_pushnumber(this.state, arg)
      } else {
        lua.lua_pushstring(this.state, to_luastring(arg))
      }
    }

    const status = lua.lua_pcall(this.state, args.length, 1, 0)
    if (status !== lua.LUA_OK) {
      throw new Error(luaMessage(this.state))
    }

    const raw = lua.lua_tostring(this.state, -1)
    const text = raw ? to_jsstring(raw) : '{}'
    lua.lua_pop(this.state, 1)
    return JSON.parse(text) as unknown
  }

  listFormats(): TranslatorFormat[] {
    const value = this.callJson('__STT_WEB_LIST_FORMATS', [])
    if (!Array.isArray(value)) return []
    return value
      .map((item) => parseJsonResult(item))
      .map((item) => ({
        id: toStringValue(item.id) as TranslatorFormat['id'],
        name: toStringValue(item.name),
        sample: toStringValue(item.sample),
      }))
      .filter((item): item is TranslatorFormat => ['nsrt', 'tr', 'mrt'].includes(item.id))
  }

  listMrtBossOptions(): MrtBossOption[] {
    const value = this.callJson('__STT_WEB_LIST_MRT_BOSSES', [])
    if (!Array.isArray(value)) return []
    return value.map((item) => {
      const row = parseJsonResult(item)
      return {
        value: toNumberValue(row.value),
        label: toStringValue(row.label),
      }
    })
  }

  translate(input: TranslateInput): TranslateResult {
    return normalizeTranslateResult(
      this.callJson('__STT_WEB_TRANSLATE', [input.mode, input.text, input.mrtBoss]),
    )
  }

  exportTR(input: ExportTRInput): ExportTRResult {
    return normalizeExportResult(
      this.callJson('__STT_WEB_EXPORT_TR', [input.sttText, input.mrtBoss]),
    )
  }
}

let runtime: SttTranslatorRuntime | null = null

export function createSttTranslatorRuntime(): SttTranslatorRuntime {
  if (!runtime) runtime = new SttTranslatorRuntime()
  return runtime
}

export function listFormats(): TranslatorFormat[] {
  return createSttTranslatorRuntime().listFormats()
}

export function listMrtBossOptions(): MrtBossOption[] {
  return createSttTranslatorRuntime().listMrtBossOptions()
}

export function translate(input: TranslateInput): TranslateResult {
  return createSttTranslatorRuntime().translate(input)
}

export function exportTR(input: ExportTRInput): ExportTRResult {
  return createSttTranslatorRuntime().exportTR(input)
}
