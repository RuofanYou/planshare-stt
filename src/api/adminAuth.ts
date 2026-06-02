/**
 * 管理员 token 的本地存储工具：单一权威地读写 localStorage。
 * client.ts 取 token 拼 Authorization 头；hooks 的会话 hook 也只经此读写，
 * 不在别处直接碰 localStorage 这个键。
 */

/** localStorage 键名（前后端约定） */
export const ADMIN_TOKEN_KEY = 'planshare_admin_token'

/** 401 等鉴权失败时抛出的可识别错误：调用方据此判定“需重新登录”。 */
export class UnauthorizedError extends Error {
  constructor(message = '登录已失效，请重新登录') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/** 取当前 token；无则 null。SSR / 无 localStorage 环境下安全返回 null。 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

/** 写入 token（登录成功后）。 */
export function setToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  } catch {
    // localStorage 不可用时忽略；后续请求会因无 token 收到 401，走重新登录
  }
}

/** 清除 token（登出 / 收到 401 时）。 */
export function clearToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    // 忽略
  }
}
