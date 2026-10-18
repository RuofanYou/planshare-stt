declare module 'fengari/src/fengaricore' {
  export function to_luastring(value: string): Uint8Array
  export function to_jsstring(value: Uint8Array): string
}

declare module 'fengari/src/lua' {
  export const LUA_OK: number
  export const LUA_TTABLE: number
  export const LUA_TSTRING: number
  export const LUA_TNUMBER: number
  export const LUA_TBOOLEAN: number
  export function lua_gettop(state: unknown): number
  export function lua_checkstack(state: unknown, extra: number): boolean
  export function lua_settop(state: unknown, index: number): void
  export function lua_absindex(state: unknown, index: number): number
  export function lua_type(state: unknown, index: number): number
  export function lua_tonumber(state: unknown, index: number): number
  export function lua_toboolean(state: unknown, index: number): boolean
  export function lua_next(state: unknown, index: number): number
  export function lua_createtable(state: unknown, narr: number, nrec: number): void
  export function lua_settable(state: unknown, index: number): void
  export function lua_pushboolean(state: unknown, value: boolean): void
  export function lua_close(state: unknown): void
  export function lua_getglobal(state: unknown, name: Uint8Array): number
  export function lua_isnil(state: unknown, index: number): boolean
  export function lua_pcall(state: unknown, nargs: number, nresults: number, msgh: number): number
  export function lua_pop(state: unknown, count: number): void
  export function lua_pushjsfunction(state: unknown, fn: (state: unknown) => number): void
  export function lua_pushlstring(state: unknown, value: Uint8Array, length: number): void
  export function lua_pushnil(state: unknown): void
  export function lua_pushnumber(state: unknown, value: number): void
  export function lua_pushstring(state: unknown, value: Uint8Array): void
  export function lua_setglobal(state: unknown, name: Uint8Array): void
  export function lua_tolstring(state: unknown, index: number): Uint8Array | null
  export function lua_tostring(state: unknown, index: number): Uint8Array | null
}

declare module 'fengari/src/lauxlib' {
  export function luaL_dostring(state: unknown, code: Uint8Array): number
  export function luaL_loadbuffer(
    state: unknown,
    code: Uint8Array,
    size: number | null,
    name: Uint8Array,
  ): number
  export function luaL_newstate(): unknown
  export function luaL_requiref(
    state: unknown,
    moduleName: Uint8Array,
    openFn: (state: unknown) => number,
    global: number,
  ): void
}

declare module 'fengari-interop' {
  export function push(state: unknown, value: unknown): void
  export function luaopen_js(state: unknown): number
}

declare module 'fengari/src/lbaselib' {
  export function luaopen_base(state: unknown): number
}

declare module 'fengari/src/lmathlib' {
  export function luaopen_math(state: unknown): number
}

declare module 'fengari/src/lstrlib' {
  export function luaopen_string(state: unknown): number
}

declare module 'fengari/src/ltablib' {
  export function luaopen_table(state: unknown): number
}
