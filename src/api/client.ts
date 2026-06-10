/**
 * PlanShare API 客户端：对后端 /api/* 端点的 fetch 封装。
 * 单一权威：所有网络请求只经此层；返回值用 data/types.ts 的契约类型。
 * 默认走相对路径（dev 由 Vite proxy 反代到 3001，CloudBase 生产同源）。
 * 静态托管到第三方域名时，可用 VITE_API_BASE 指向 CloudBase API 源站。
 */
import type {
  Raid,
  Author,
  Board,
  RaidDetail,
  BoardDetail,
  AuthorDetail,
  LikeResult,
  CreateBoardInput,
  AdminBoard,
  AdminAuthor,
  AdminCreatorAccount,
  UpdateBoardInput,
  AuthorInput,
  UpdateAuthorInput,
  AdminLoginResult,
  CreateSubmissionInput,
  AdminSubmission,
  ApproveSubmissionInput,
  ApproveSubmissionResult,
  CreatorMeResult,
  CreatorSubmission,
  CreatorAuthResult,
  CreatorProfileInput,
  CreatorBoard,
  CreatorBoardInput,
  UpdateCreatorBoardInput,
  ResetCreatorPasswordResult,
  ReportReason,
  BoardReport,
  AuditLog,
  Boss,
} from '../data/types'
import { getToken, clearToken, UnauthorizedError } from './adminAuth'
import {
  getCreatorToken,
  clearCreatorToken,
  CreatorUnauthorizedError,
} from './creatorAuth'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

/** 统一 JSON 请求：非 2xx 抛错，带上后端的错误文案（若有）。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init?.headers }
      : init?.headers,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body?.error ?? ''
    } catch {
      // 响应体非 JSON 时忽略，仅用状态码
    }
    throw new Error(detail || `请求失败（${res.status}）：${path}`)
  }
  return res.json() as Promise<T>
}

/**
 * 带管理员鉴权的请求：自动附 Authorization: Bearer <token>，
 * 收到 401 时清 token 并抛 UnauthorizedError（调用方据此回到登录态）。
 */
async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body?.error ?? ''
    } catch {
      // 忽略
    }
    throw new UnauthorizedError(detail || '登录已失效，请重新登录')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body?.error ?? ''
    } catch {
      // 忽略
    }
    throw new Error(detail || `请求失败（${res.status}）：${path}`)
  }
  return res.json() as Promise<T>
}

/** 创作者鉴权请求：自动附 Creator token，401 时清登录态。 */
async function creatorRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getCreatorToken()
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    clearCreatorToken()
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body?.error ?? ''
    } catch {
      // 忽略
    }
    throw new CreatorUnauthorizedError(detail || '创作者登录已失效，请重新登录')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body?.error ?? ''
    } catch {
      // 忽略
    }
    throw new Error(detail || `请求失败（${res.status}）：${path}`)
  }
  return res.json() as Promise<T>
}

/** 拼查询串：跳过 undefined / null / 空串；featured 用 1 表达。 */
function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, value === true ? '1' : String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** 板列表筛选参数（全部可选）。 */
export interface BoardsParams {
  raidId?: string
  bossId?: string
  authorId?: string
  featured?: boolean
}

/* ============================ 读取 ============================ */

/** GET /api/raids -> Raid[] */
export function getRaids(): Promise<Raid[]> {
  return request<Raid[]>('/api/raids')
}

/** GET /api/raids/:id -> { raid, bosses } */
export function getRaid(raidId: string): Promise<RaidDetail> {
  return request<RaidDetail>(`/api/raids/${encodeURIComponent(raidId)}`)
}

/** GET /api/boards?raidId=&bossId=&authorId=&featured=1 -> Board[]（后端已排序、已排除隐藏） */
export function getBoards(params: BoardsParams = {}): Promise<Board[]> {
  return request<Board[]>(`/api/boards${buildQuery({ ...params })}`)
}

/** GET /api/boards/:id -> { board, raid, boss, author }（副作用：viewCount += 1） */
export function getBoard(boardId: string): Promise<BoardDetail> {
  return request<BoardDetail>(`/api/boards/${encodeURIComponent(boardId)}`)
}

/** GET /api/authors -> Author[] */
export function getAuthors(): Promise<Author[]> {
  return request<Author[]>('/api/authors')
}

/** GET /api/authors/:id -> { author, boards } */
export function getAuthor(authorId: string): Promise<AuthorDetail> {
  return request<AuthorDetail>(`/api/authors/${encodeURIComponent(authorId)}`)
}

/* ============================ 写入 ============================ */

/** POST /api/boards/:id/like -> { id, likeCount }（持久化 +1） */
export function likeBoard(boardId: string): Promise<LikeResult> {
  return request<LikeResult>(`/api/boards/${encodeURIComponent(boardId)}/like`, {
    method: 'POST',
  })
}

/** POST /api/boards/:id/reports -> 举报公开板。 */
export function reportBoard(
  boardId: string,
  input: { reason: ReportReason; detail?: string },
): Promise<BoardReport> {
  return request<BoardReport>(`/api/boards/${encodeURIComponent(boardId)}/reports`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** POST /api/submissions -> 游客投稿，进入审核队列，不直接公开。 */
export function createSubmission(input: CreateSubmissionInput): Promise<AdminSubmission> {
  const creatorToken = getCreatorToken()
  return request<AdminSubmission>('/api/submissions', {
    method: 'POST',
    headers: creatorToken ? { Authorization: `Bearer ${creatorToken}` } : undefined,
    body: JSON.stringify(input),
  })
}

/** POST /api/boards -> 新建 Board（受保护：需管理员 token；后端生成 id / 时间戳 / 计数） */
export function createBoard(input: CreateBoardInput): Promise<Board> {
  return adminRequest<Board>('/api/boards', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ============================ 管理员（受保护） ============================ */

/** POST /api/admin/login -> { token }（密码错 -> 401）。不带 token。 */
export function adminLogin(password: string): Promise<AdminLoginResult> {
  return request<AdminLoginResult>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

/* ============================ 创作者登录 ============================ */

export function creatorLogin(username: string, password: string): Promise<CreatorAuthResult> {
  return request<CreatorAuthResult>('/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

/** GET /api/creator/me -> 当前创作者身份与绑定作者。 */
export function getCreatorMe(): Promise<CreatorMeResult> {
  return creatorRequest<CreatorMeResult>('/api/creator/me')
}

export function getCreatorSubmissions(): Promise<CreatorSubmission[]> {
  return creatorRequest<CreatorSubmission[]>('/api/creator/submissions')
}

export function updateCreatorProfile(input: CreatorProfileInput): Promise<CreatorMeResult> {
  return creatorRequest<CreatorMeResult>('/api/creator/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function creatorLogout(): Promise<{ ok: true }> {
  return creatorRequest<{ ok: true }>('/api/creator/logout', {
    method: 'POST',
  })
}

export function getCreatorBoards(): Promise<CreatorBoard[]> {
  return creatorRequest<CreatorBoard[]>('/api/creator/boards')
}

export function createCreatorBoard(input: CreatorBoardInput): Promise<CreatorBoard> {
  return creatorRequest<CreatorBoard>('/api/creator/boards', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCreatorBoard(
  id: string,
  patch: UpdateCreatorBoardInput,
): Promise<CreatorBoard> {
  return creatorRequest<CreatorBoard>(`/api/creator/boards/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export function deleteCreatorBoard(id: string): Promise<{ ok: true }> {
  return creatorRequest<{ ok: true }>(`/api/creator/boards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** GET /api/admin/boards -> AdminBoard[]（全部，含隐藏；按 updatedAt 倒序） */
export function getAdminBoards(): Promise<AdminBoard[]> {
  return adminRequest<AdminBoard[]>('/api/admin/boards')
}

/** GET /api/admin/authors -> AdminAuthor[]（全部，每个带 boardCount） */
export function getAdminAuthors(): Promise<AdminAuthor[]> {
  return adminRequest<AdminAuthor[]>('/api/admin/authors')
}

/** GET /api/admin/submissions -> 投稿审核队列。 */
export function getAdminSubmissions(): Promise<AdminSubmission[]> {
  return adminRequest<AdminSubmission[]>('/api/admin/submissions')
}

/** GET /api/admin/creator-accounts -> 创作者账号列表。 */
export function getAdminCreatorAccounts(): Promise<AdminCreatorAccount[]> {
  return adminRequest<AdminCreatorAccount[]>('/api/admin/creator-accounts')
}

export function getAdminReports(): Promise<BoardReport[]> {
  return adminRequest<BoardReport[]>('/api/admin/reports')
}

export function getAdminAuditLogs(): Promise<AuditLog[]> {
  return adminRequest<AuditLog[]>('/api/admin/audit-logs')
}

export function hideBoardFromReport(id: string, note?: string): Promise<BoardReport> {
  return adminRequest<BoardReport>(`/api/admin/reports/${encodeURIComponent(id)}/hide-board`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function dismissReport(id: string, note?: string): Promise<BoardReport> {
  return adminRequest<BoardReport>(`/api/admin/reports/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function createRaid(input: { id?: string; name: string; patch: string }): Promise<Raid> {
  return adminRequest<Raid>('/api/admin/raids', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRaid(id: string, patch: { name?: string; patch?: string }): Promise<Raid> {
  return adminRequest<Raid>(`/api/admin/raids/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export function deleteRaid(id: string): Promise<{ ok: true }> {
  return adminRequest<{ ok: true }>(`/api/admin/raids/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function createBoss(input: { id?: string; raidId: string; name: string; order: number }): Promise<Boss> {
  return adminRequest<Boss>('/api/admin/bosses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateBoss(
  id: string,
  patch: { raidId?: string; name?: string; order?: number },
): Promise<Boss> {
  return adminRequest<Boss>(`/api/admin/bosses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export function deleteBoss(id: string): Promise<{ ok: true }> {
  return adminRequest<{ ok: true }>(`/api/admin/bosses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** POST /api/admin/creator-accounts/:id/reset-password -> 管理员重置创作者密码。 */
export function resetCreatorPassword(
  id: string,
  password: string,
): Promise<ResetCreatorPasswordResult> {
  return adminRequest<ResetCreatorPasswordResult>(
    `/api/admin/creator-accounts/${encodeURIComponent(id)}/reset-password`,
    {
      method: 'POST',
      body: JSON.stringify({ password }),
    },
  )
}

/** POST /api/admin/submissions/:id/approve -> 通过投稿并发布正式板。 */
export function approveSubmission(
  id: string,
  body: ApproveSubmissionInput,
): Promise<ApproveSubmissionResult> {
  return adminRequest<ApproveSubmissionResult>(
    `/api/admin/submissions/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

/** POST /api/admin/submissions/:id/reject -> 驳回投稿。 */
export function rejectSubmission(id: string, note?: string): Promise<AdminSubmission> {
  return adminRequest<AdminSubmission>(`/api/admin/submissions/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

/** POST /api/admin/submissions/:id/spam -> 标记垃圾。 */
export function markSubmissionSpam(id: string, note?: string): Promise<AdminSubmission> {
  return adminRequest<AdminSubmission>(`/api/admin/submissions/${encodeURIComponent(id)}/spam`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

/** PUT /api/boards/:id -> 更新后的最新 Board（patch 为任意子集） */
export function updateBoard(id: string, patch: UpdateBoardInput): Promise<Board> {
  return adminRequest<Board>(`/api/boards/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

/** DELETE /api/boards/:id -> { ok: true } */
export function deleteBoard(id: string): Promise<{ ok: true }> {
  return adminRequest<{ ok: true }>(`/api/boards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** POST /api/authors -> 新建 Author（后端生成 id=a-xxx） */
export function createAuthor(body: AuthorInput): Promise<Author> {
  return adminRequest<Author>('/api/authors', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** PUT /api/authors/:id -> 更新后的 Author（patch 为 AuthorInput 子集） */
export function updateAuthor(id: string, patch: UpdateAuthorInput): Promise<Author> {
  return adminRequest<Author>(`/api/authors/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

/** DELETE /api/authors/:id -> { ok: true }（名下仍有板 -> 409 抛错） */
export function deleteAuthor(id: string): Promise<{ ok: true }> {
  return adminRequest<{ ok: true }>(`/api/authors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
