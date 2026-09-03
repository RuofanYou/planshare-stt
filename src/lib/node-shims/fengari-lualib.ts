export function lua_assert(condition: unknown) {
  if (!condition) {
    throw new Error('lua_assert failed')
  }
}

export default {
  lua_assert,
}
