/**
 * 创作者 token 的本地存储工具：单一权威地读写 localStorage。
 * 微信回调把 token 放在 URL fragment，Creator 页面读取后只写这里。
 */
export const CREATOR_TOKEN_KEY = 'planshare_creator_token'

export class CreatorUnauthorizedError extends Error {
  constructor(message = '创作者登录已失效，请重新登录') {
    super(message)
    this.name = 'CreatorUnauthorizedError'
  }
}

export function getCreatorToken(): string | null {
  try {
    return localStorage.getItem(CREATOR_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setCreatorToken(token: string): void {
  try {
    localStorage.setItem(CREATOR_TOKEN_KEY, token)
  } catch {
    // localStorage 不可用时忽略；后续请求会因无 token 收到 401
  }
}

export function clearCreatorToken(): void {
  try {
    localStorage.removeItem(CREATOR_TOKEN_KEY)
  } catch {
    // ignore
  }
}
