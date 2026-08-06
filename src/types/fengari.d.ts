declare module 'fengari/src/fengaricore' {
  export function to_luastring(value: string): Uint8Array
  export function to_jsstring(value: Uint8Array): string
}

declare module 'fengari/src/lua' {
  export const LUA_OK: number
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
