/**
 * PlanShare React Query hooks：唯一的数据获取入口。
 * 页面 / 组件只用这里的 hook，不直接调 client.ts，也不再读本地 mock。
 *
 * queryKey 约定：['raids'] / ['raid', id] / ['boards', params] /
 *   ['board', id] / ['authors'] / ['author', id]。
 * 失效策略：点赞 / 新建后让受影响的列表与详情 key 失效（invalidate），
 *   由 React Query 自动重拉，保证计数与排序与后端一致。
 */
import { useCallback, useMemo, useState } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import * as api from './client'
import type { BoardsParams } from './client'
import { getToken, setToken, clearToken, UnauthorizedError } from './adminAuth'
import {
  getCreatorToken,
  setCreatorToken,
  clearCreatorToken,
  CreatorUnauthorizedError,
} from './creatorAuth'
import type {
  Raid,
  Boss,
  Author,
  UpdateBoardInput,
  AuthorInput,
  UpdateAuthorInput,
  CreateSubmissionInput,
  ApproveSubmissionInput,
  CreatorProfileInput,
  CreatorBoardInput,
  UpdateCreatorBoardInput,
} from '../data/types'

/* ============================ 团本 ============================ */

/** 全部团本（含 boardCount）。 */
export function useRaids() {
  return useQuery({ queryKey: ['raids'], queryFn: api.getRaids })
}

/** 单个团本详情：{ raid, bosses }。 */
export function useRaid(raidId: string | undefined) {
  return useQuery({
    queryKey: ['raid', raidId],
    queryFn: () => api.getRaid(raidId as string),
    enabled: !!raidId,
  })
}

/* ============================ 战术板 ============================ */

/** 板列表（后端已排序、已排除隐藏）。params 进 queryKey，筛选条件变化自动重拉。 */
export function useBoards(params: BoardsParams = {}) {
  return useQuery({
    queryKey: ['boards', params],
    queryFn: () => api.getBoards(params),
  })
}

/** 精选板列表（等价于 useBoards({ featured: true }) 的语义封装）。 */
export function useFeaturedBoards() {
  return useBoards({ featured: true })
}

/** 单板详情：{ board, raid, boss, author }（命中即触发后端 viewCount += 1）。 */
export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: () => api.getBoard(boardId as string),
    enabled: !!boardId,
  })
}

/* ============================ 作者 ============================ */

/** 全部作者。 */
export function useAuthors() {
  return useQuery({ queryKey: ['authors'], queryFn: api.getAuthors })
}

/** 单作者详情：{ author, boards }。 */
export function useAuthor(authorId: string | undefined) {
  return useQuery({
    queryKey: ['author', authorId],
    queryFn: () => api.getAuthor(authorId as string),
    enabled: !!authorId,
  })
}

/* ============================ 变更（mutation） ============================ */

/**
 * 点赞：后端持久化 +1。成功后失效所有 boards 列表与该板详情，
 * 让点赞数与排序由后端真值重算（不本地猜测）。
 */
export function useLikeBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => api.likeBoard(boardId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['board', result.id] })
    },
  })
}

/** 游客投稿：成功后不影响公开列表，只进入后台审核队列。 */
export function useCreateSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSubmissionInput) => api.createSubmission(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
    },
  })
}

/**
 * 新建板（后台上稿用）：成功后失效列表 / 团本（boardCount 会变） / 作者，
 * 触发各处重拉。
 */
export function useCreateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createBoard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['admin', 'boards'] })
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
    },
  })
}

/* ============================ 管理员会话 ============================ */

/**
 * 管理员登录态：基于 localStorage token + 一个 React state（让登入/登出能触发重渲染）。
 * - login(token)：写 token 并置为已登录；
 * - logout()：清 token 并置为未登录；
 * 配合 client.ts：admin 请求收到 401 会自动 clearToken，组件捕获 UnauthorizedError 后调 logout()
 *   即可回到登录态（这里也导出 isUnauthorized 便于判定）。
 */
export function useAdminSession() {
  const qc = useQueryClient()
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const login = useCallback((newToken: string) => {
    setToken(newToken)
    setTokenState(newToken)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    // 登出后丢弃后台缓存，避免残留数据闪现
    qc.removeQueries({ queryKey: ['admin'] })
  }, [qc])

  return {
    isAuthed: !!token,
    token,
    login,
    logout,
    /** 判定某个 error 是否为鉴权失效（401），用于在调用处触发 logout()。 */
    isUnauthorized: (error: unknown) => error instanceof UnauthorizedError,
  }
}

/* ============================ 管理员（受保护） ============================ */

/** 管理员登录：成功后由调用方拿 token 调 useAdminSession().login(token)。 */
export function useAdminLogin() {
  return useMutation({
    mutationFn: (password: string) => api.adminLogin(password),
  })
}

/* ============================ 创作者会话 ============================ */

export function useCreatorSession() {
  const qc = useQueryClient()
  const [token, setTokenState] = useState<string | null>(() => getCreatorToken())

  const login = useCallback((newToken: string) => {
    setCreatorToken(newToken)
    setTokenState(newToken)
  }, [])

  const logout = useCallback(() => {
    void api.creatorLogout().catch(() => {})
    clearCreatorToken()
    setTokenState(null)
    qc.removeQueries({ queryKey: ['creator'] })
  }, [qc])

  const isUnauthorized = useCallback(
    (error: unknown) => error instanceof CreatorUnauthorizedError,
    [],
  )

  return {
    isAuthed: !!token,
    token,
    login,
    logout,
    isUnauthorized,
  }
}

export function useCreatorMe(enabled: boolean) {
  return useQuery({
    queryKey: ['creator', 'me'],
    queryFn: api.getCreatorMe,
    enabled,
  })
}

export function useCreatorLogin() {
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.creatorLogin(username, password),
  })
}

export function useUpdateCreatorProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatorProfileInput) => api.updateCreatorProfile(input),
    onSuccess: (result) => {
      qc.setQueryData(['creator', 'me'], result)
      if (result.author) {
        qc.invalidateQueries({ queryKey: ['author', result.author.id] })
        qc.invalidateQueries({ queryKey: ['authors'] })
      }
    },
  })
}

export function useCreatorBoards(enabled: boolean) {
  return useQuery({
    queryKey: ['creator', 'boards'],
    queryFn: api.getCreatorBoards,
    enabled,
  })
}

export function useCreateCreatorBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatorBoardInput) => api.createCreatorBoard(input),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ['creator', 'boards'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['author', board.authorId] })
    },
  })
}

export function useUpdateCreatorBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCreatorBoardInput }) =>
      api.updateCreatorBoard(id, patch),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ['creator', 'boards'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['board', board.id] })
      qc.invalidateQueries({ queryKey: ['author', board.authorId] })
    },
  })
}

export function useDeleteCreatorBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCreatorBoard(id),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: ['creator', 'boards'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['board', id] })
    },
  })
}

/** 后台全部板（含隐藏，按 updatedAt 倒序）。 */
export function useAdminBoards() {
  return useQuery({ queryKey: ['admin', 'boards'], queryFn: api.getAdminBoards })
}

/** 后台全部作者（带 boardCount）。 */
export function useAdminAuthors() {
  return useQuery({ queryKey: ['admin', 'authors'], queryFn: api.getAdminAuthors })
}

/** 投稿审核队列（pending 排最前，含已处理记录）。 */
export function useAdminSubmissions() {
  return useQuery({ queryKey: ['admin', 'submissions'], queryFn: api.getAdminSubmissions })
}

/** 创作者账号列表（用于后台人工账号救援）。 */
export function useAdminCreatorAccounts() {
  return useQuery({
    queryKey: ['admin', 'creator-accounts'],
    queryFn: api.getAdminCreatorAccounts,
  })
}

/** 管理员重置创作者密码；成功后刷新账号列表并让创作者端重新拉身份。 */
export function useResetCreatorPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.resetCreatorPassword(id, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'creator-accounts'] })
      qc.invalidateQueries({ queryKey: ['creator'] })
    },
  })
}

/** 通过投稿：创建正式板并更新投稿状态。 */
export function useApproveSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApproveSubmissionInput }) =>
      api.approveSubmission(id, input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
      qc.invalidateQueries({ queryKey: ['admin', 'boards'] })
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['board', result.board.id] })
      qc.invalidateQueries({ queryKey: ['author', result.author.id] })
      qc.invalidateQueries({ queryKey: ['creator'] })
    },
  })
}

/** 驳回投稿：只更新审核队列。 */
export function useRejectSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.rejectSubmission(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
    },
  })
}

/** 标记垃圾投稿：只更新审核队列。 */
export function useMarkSubmissionSpam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.markSubmissionSpam(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
    },
  })
}

/** 更新板：成功后失效后台列表、公开列表、团本、该板详情（隐藏/精选/归属变化都可能影响）。 */
export function useUpdateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBoardInput }) =>
      api.updateBoard(id, patch),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ['admin', 'boards'] })
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['board', board.id] })
    },
  })
}

/** 删除板：成功后失效后台列表、公开列表、团本、作者（boardCount 会变）。 */
export function useDeleteBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteBoard(id),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: ['admin', 'boards'] })
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['raids'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['board', id] })
    },
  })
}

/** 新建作者：成功后失效后台作者列表与公开作者列表。 */
export function useCreateAuthor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AuthorInput) => api.createAuthor(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
    },
  })
}

/** 更新作者：成功后失效后台作者列表、公开作者列表与该作者详情。 */
export function useUpdateAuthor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAuthorInput }) =>
      api.updateAuthor(id, patch),
    onSuccess: (author) => {
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['author', author.id] })
    },
  })
}

/** 删除作者：成功后失效后台作者列表与公开作者列表（名下有板时后端 409，会抛错）。 */
export function useDeleteAuthor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAuthor(id),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: ['admin', 'authors'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['author', id] })
    },
  })
}

/* ============================ 派生查询表（给 BoardCard 等列表卡用） ============================ */

/**
 * 团本 id -> Raid 映射。
 * BoardCard 只拿到 raidId，需要团本名；复用 ['raids'] 这一份缓存即可，
 * 避免每张卡各发一次请求。
 */
export function useRaidsMap(): Map<string, Raid> {
  const { data } = useRaids()
  return useMemo(() => {
    const map = new Map<string, Raid>()
    for (const raid of data ?? []) map.set(raid.id, raid)
    return map
  }, [data])
}

/** 作者 id -> Author 映射（同理复用 ['authors'] 缓存）。 */
export function useAuthorsMap(): Map<string, Author> {
  const { data } = useAuthors()
  return useMemo(() => {
    const map = new Map<string, Author>()
    for (const author of data ?? []) map.set(author.id, author)
    return map
  }, [data])
}

/**
 * 取某团本下某 BOSS 名（按 raidId 拉该团本 bosses，再按 bossId 命中）。
 * 同一团本的多张卡共享 ['raid', raidId] 缓存，不会重复请求。
 * raidId / bossId 任一为空时返回 undefined。
 */
export function useBossName(
  raidId: string | undefined,
  bossId: string | null | undefined,
): string | undefined {
  const { data } = useRaid(bossId ? raidId : undefined)
  if (!bossId) return undefined
  const list: Boss[] = data?.bosses ?? []
  return list.find((b) => b.id === bossId)?.name
}

export type { UseQueryResult }
