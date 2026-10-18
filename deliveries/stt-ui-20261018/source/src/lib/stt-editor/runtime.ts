import { to_jsstring, to_luastring } from 'fengari/src/fengaricore'
import * as lua from 'fengari/src/lua'
// @ts-ignore Lua debug metadata is used only by this temporary diagnosis probe.
import {luaopen_debug as luaopenDebug} from 'fengari/src/ldblib'
import * as lauxlib from 'fengari/src/lauxlib'
import { luaopen_base } from 'fengari/src/lbaselib'
import { luaopen_math } from 'fengari/src/lmathlib'
import { luaopen_string } from 'fengari/src/lstrlib'
import { luaopen_table } from 'fengari/src/ltablib'
import { luaopen_js } from 'fengari-interop'
import { editorAssets, editorBundleHash } from '../../generated/sttEditorBundle'
import {editorAtlases} from '../../generated/sttEditorMedia'
import prelude from './prelude.lua?raw'
import {displayText} from './display-text'
import bridge from './bridge.lua?raw'
import {createWasmoonRuntime} from './wasmoon'

export interface UiNode {
  id: number; kind: string; name?: string; label: string; x: number; y: number; width: number; height: number; z: number; alpha: number;
  text?: string; font?: [string, number, string]; textColor?: number[]; shadowColor?: number[]; shadowOffset?: number[]; justifyH?: string; justifyV?: string; wordWrap?: boolean;
  texture?: string | number; atlas?: string; color?: number[]; texCoord?: number[]; vertexColor?: number[]; rotation?: number; blendMode?: string;
  gradient?:{direction:string;low:number[];high:number[]};vertexOffsets?:number[][];desaturated?:boolean;desaturation?:number;
  masks?:{texture?:string|number;texCoord?:number[];x:number;y:number;width:number;height:number}[];
  nativeTextRegion?:boolean;spacing?:number;composing?:boolean;
  backdrop?: {bgFile?: string; edgeFile?: string; edgeSize?: number; insets?: {left:number;right:number;top:number;bottom:number}};
  backdropColor?: number[]; backdropBorderColor?: number[]; clip?: {left:number;top:number;right:number;bottom:number};
  mouse: boolean; mouseWheel: boolean; dragButtons?:string[]; enabled: boolean; checked: boolean; multiLine: boolean; numeric: boolean;
  value?:number;minValue?:number;maxValue?:number;valueStep?:number;orientation?:string;
  textInsets?:number[];hitRectInsets?:number[];focused:boolean;cursor?:number;highlight?:number[];maxLetters?:number;isEditorText?:boolean;
  lines?:{text:string;color:number[];wrap?:boolean}[];
}
export interface UiTree {width:number;height:number;nodes:UiNode[];hidden:number[];delta:boolean;revision:number}
export interface EditorView {
  appearance?:{mode:'legacy'|'glass';palette:string;explicit:boolean};
  text:string;document:{bossKeyText:string;difficulty:string;scope:'team'|'personal'};updateNext?:boolean;
  documents?:Record<string,string>;references?:Record<string,{text?:string;hidden?:boolean}>;storageChanged?:boolean;message?:string;ui:UiTree;mode:string;wclRequested?:boolean;
}
type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value }

// Public protocol shared by the original Fengari runtime and Wasmoon adapter.
export interface EditorRuntimeHandle {
  readonly engine?: 'wasmoon' | 'fengari'
  readonly hash: string
  dispose(): void
  call<Result = EditorView>(action: string, args?: Record<string, Value>): Result
}

export class EditorRuntime implements EditorRuntimeHandle {
  // Keep construction synchronous and backward-compatible for cached callers.
  // New callers await create(); failure to load or initialize WASM uses Fengari.
  static async create(): Promise<EditorRuntimeHandle> {
    // Explicit standalone QA route; this does not simulate a WASM failure.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('engine') === 'fengari') {
      return new EditorRuntime()
    }
    try {
      const runtime = await createWasmoonRuntime({
        assets: editorAssets, prelude, bridge, atlases: editorAtlases,
        hash: editorBundleHash, displayText,
        encodeLuaString: to_luastring, decodeLuaString: to_jsstring,
      })
      return Object.assign(runtime, {engine: 'wasmoon' as const})
    } catch (error) {
      console.warn('[STT runtime fallback]', error instanceof Error ? error.message : String(error))
      return new EditorRuntime()
    }
  }

  readonly engine = 'fengari' as const
  readonly hash = editorBundleHash
  private readonly state = lauxlib.luaL_newstate()
  constructor() {
    const canvas = document.createElement('canvas').getContext('2d')!
    lua.lua_pushjsfunction(this.state,state=>{lua.lua_pushnumber(state,performance.now());return 1})
    lua.lua_setglobal(this.state,to_luastring('__STT_WEB_NOW_MS'))
    lua.lua_pushjsfunction(this.state, state => {
      const text = to_jsstring(lua.lua_tostring(state, 1)!)
      const size = lua.lua_tonumber(state, 3) || 12
      const width = lua.lua_tonumber(state, 5)
      const wrap = lua.lua_toboolean(state, 6)
      canvas.font = `${size}px "STT Dragonflight"`
      const plain = displayText(text).text
      let measured = 0, lines = 0
      for (const line of plain.split('\n')) {
        if (!wrap || width <= 0) { measured = Math.max(measured, canvas.measureText(line).width); lines++; continue }
        const chars=Array.from(line)
        if(!chars.length){lines++;continue}
        let start=0
        while(start<chars.length){
          let low=start+1,high=chars.length,fit=start
          while(low<=high){
            const middle=(low+high)>>1
            if(canvas.measureText(chars.slice(start,middle).join('')).width<=width){fit=middle;low=middle+1}
            else high=middle-1
          }
          if(fit===start)fit=start+1
          measured=Math.max(measured,canvas.measureText(chars.slice(start,fit).join('')).width)
          lines++;start=fit
        }
      }
      lua.lua_pushnumber(state, measured);lua.lua_pushnumber(state, Math.max(1,lines)*size)
      return 2
    })
    lua.lua_setglobal(this.state, to_luastring('__STT_WEB_MEASURE_TEXT'))
    for (const [name, open] of [['_G', luaopen_base], ['math', luaopen_math], ['string', luaopen_string], ['table', luaopen_table]] as const) {
      lauxlib.luaL_requiref(this.state, to_luastring(name), open, 1)
      lua.lua_pop(this.state, 1)
    }
    lauxlib.luaL_requiref(this.state, to_luastring('js'), luaopen_js, 1)
    lua.lua_pop(this.state, 1)
    // @ts-ignore temporary line-info probe
    lauxlib.luaL_requiref(this.state, to_luastring('debug'), luaopenDebug, 1)
    lua.lua_pop(this.state, 1)
    lua.lua_pushjsfunction(this.state, state => { console.debug('[STT Lua]', to_jsstring(lua.lua_tostring(state, 1)!)); return 0 })
    lua.lua_setglobal(this.state, to_luastring('__STT_WEB_LOG'))
    this.push(editorAtlases);lua.lua_setglobal(this.state,to_luastring('__STT_WEB_ATLAS'))
    this.run(prelude, 'editor-host')
    for (const asset of editorAssets) {
      this.run(`local f = function(...)\n${asset.source}\nend\nf('${asset.path.split('/')[0]}', __STT_WEB_NS)`, asset.path)
      if (asset.path === 'STT/core/init.lua') this.run('__STT_EDITOR_HOST()', 'host-bind')
    }
    this.run('__STT_EDITOR_AFTER_LOAD()', 'host-after-load')
    this.run(bridge, 'editor-bridge')
  }
  dispose() { lua.lua_close(this.state) }
  private error() {
    const raw = lua.lua_tostring(this.state, -1)
    return new Error(raw ? to_jsstring(raw) : 'Lua 编辑失败')
  }
  private run(source: string, name: string) {
    if (lauxlib.luaL_loadbuffer(this.state, to_luastring(source), null, to_luastring(name)) !== lua.LUA_OK
      || lua.lua_pcall(this.state, 0, 0, 0) !== lua.LUA_OK) throw this.error()
  }
  private read(index: number, depth = 0): Value {
    if(!lua.lua_checkstack(this.state,4))throw new Error('Lua 返回值空间不足')
    const type = lua.lua_type(this.state, index)
    if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tostring(this.state, index)!)
    if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(this.state, index)
    if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(this.state, index)
    if (type !== lua.LUA_TTABLE || depth > 64) return null
    const absolute = lua.lua_absindex(this.state, index)
    const entries: [string | number, Value][] = []
    lua.lua_pushnil(this.state)
    while (lua.lua_next(this.state, absolute)) {
      const key = this.read(-2, depth + 1) as string | number
      entries.push([key, this.read(-1, depth + 1)])
      lua.lua_pop(this.state, 1)
    }
    if (entries.every(([key]) => typeof key === 'number' && key >= 1 && key <= entries.length)) {
      return entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([, value]) => value)
    }
    return Object.fromEntries(entries)
  }
  call<Result = EditorView>(action: string, args: Record<string, Value> = {}): Result {
    const stack = lua.lua_gettop(this.state)
    const traceID = crypto.randomUUID()
    const started = performance.now()
    const quiet = ['snapshot', 'frame', 'pointer', 'spellIDs'].includes(action) || (action === 'uiEvent' && ['OnCursorChanged','OnEnter','OnLeave'].includes(String(args.event)))
    if (!quiet) console.info('[STT editor]', { traceID, action, event: typeof args.event === 'string' ? args.event : undefined, stage: 'start', textLength: typeof args.text === 'string' ? args.text.length : undefined })
    try {
      lua.lua_getglobal(this.state, to_luastring('__STT_EDITOR_CALL'))
      this.push(action); this.push({ now: performance.now()/1000, epoch: Math.floor(Date.now()/1000), ...args, traceID })
      if (lua.lua_pcall(this.state, 2, 1, 0) !== lua.LUA_OK) throw this.error()
      const result = this.read(-1) as Result
      if (!quiet) console.info('[STT editor]', { traceID, action, event: typeof args.event === 'string' ? args.event : undefined, stage: 'end', result: 'ok', elapsedMs: Math.round(performance.now() - started) })
      return result
    } catch (error) {
      console.error('[STT editor]', { traceID, action, event: typeof args.event === 'string' ? args.event : undefined, stage: 'end', result: 'failed', reason: String(error) })
      throw error
    } finally { lua.lua_settop(this.state, stack) }
  }
  private push(value: Value) {
    if (value == null) lua.lua_pushnil(this.state)
    else if (typeof value === 'boolean') lua.lua_pushboolean(this.state, value)
    else if (typeof value === 'number') lua.lua_pushnumber(this.state, value)
    else if (typeof value === 'string') lua.lua_pushstring(this.state, to_luastring(value))
    else {
      lua.lua_createtable(this.state, Array.isArray(value) ? value.length : 0, 0)
      for (const [key, item] of Object.entries(value)) {
        this.push(Array.isArray(value) ? Number(key) + 1 : key); this.push(item)
        lua.lua_settable(this.state, -3)
      }
    }
  }
}
