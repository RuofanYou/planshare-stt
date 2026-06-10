import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type {
  AdminBoard,
  AdminSubmission,
  AdminAuthor,
  AdminCreatorAccount,
  ApproveSubmissionInput,
  AuthorInput,
  Boss,
  CreateBoardInput,
  Difficulty,
  Raid,
  UpdateBoardInput,
} from '../data/types'
import {
  useAdminSession,
  useAdminLogin,
  useAdminBoards,
  useAdminAuthors,
  useAdminCreatorAccounts,
  useAdminReports,
  useAdminSubmissions,
  useRaids,
  useRaid,
  useCreateRaid,
  useDeleteRaid,
  useCreateBoss,
  useDeleteBoss,
  useCreateBoard,
  useUpdateBoard,
  useDeleteBoard,
  useCreateAuthor,
  useUpdateAuthor,
  useDeleteAuthor,
  useApproveSubmission,
  useRejectSubmission,
  useMarkSubmissionSpam,
  useResetCreatorPassword,
  useHideBoardFromReport,
  useDismissReport,
} from '../api/hooks'
import { difficultyLabel, formatDate } from '../lib/format'
import { staggerContainer, staggerItem, fadeUp } from '../lib/motion'
import {
  Avatar,
  Button,
  EmptyState,
  GlassCard,
  SectionHeading,
  Skeleton,
  Stat,
  Tag,
} from '../components/ui'
import './Admin.css'

/** 难度可选项：仅 英雄 / 史诗（靠文字区分，不靠颜色） */
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

/* ============================================================
   /admin —— 完整管理台
   未登录：玻璃登录卡（密码 + 登录）。
   已登录：战术板管理（列表 + 新增/编辑表单）与作者管理（列表 + 新增/编辑），
           顶部 SectionHeading + 退出登录。
   全部走 ui/ 原语；风格沿用全站：深色液态玻璃 · 魔兽金 · 现代无衬线。
   ============================================================ */
export default function Admin() {
  const session = useAdminSession()
  // 未登录：只显示登录门
  if (!session.isAuthed) {
    return <LoginGate onLoggedIn={session.login} />
  }
  // 已登录：完整管理台
  return <Console onLogout={session.logout} isUnauthorized={session.isUnauthorized} />
}

/* ============================================================
   登录门：玻璃登录卡
   ============================================================ */
function LoginGate({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const reduce = useReducedMotion()
  const [password, setPassword] = useState('')
  const login = useAdminLogin()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || login.isPending) return
    login.mutate(password, {
      onSuccess: (result) => onLoggedIn(result.token),
    })
  }

  return (
    <div className="container ps-admin ps-admin--login">
      <motion.div
        className="ps-admin__login-wrap"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <GlassCard tone="glass-strong" className="ps-admin__login-card">
          <SectionHeading
            eyebrow="管理台"
            title="登录后台"
            as="h1"
            size="display"
          />
          <p className="ps-admin__lead">输入管理员密码进入战术板与作者管理。</p>

          <form className="ps-admin__login-form" onSubmit={handleSubmit} noValidate>
            <div className="ps-admin__field">
              <label className="ps-admin__label" htmlFor="ps-admin-pwd">
                管理员密码
              </label>
              <input
                id="ps-admin-pwd"
                className="ps-admin__input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                autoFocus
              />
            </div>

            {login.isError && (
              <p className="ps-admin__error" role="alert">
                {(login.error as Error)?.message ?? '密码错误，请重试。'}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={!password || login.isPending}
            >
              {login.isPending ? '登录中…' : '登录'}
            </Button>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  )
}

/* ============================================================
   管理台主体（已登录）
   ============================================================ */
type Tab = 'boards' | 'authors' | 'submissions' | 'reports' | 'resources'

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-'

function generateTemporaryPassword(length = 14) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => TEMP_PASSWORD_CHARS[byte % TEMP_PASSWORD_CHARS.length]).join('')
}

function Console({
  onLogout,
  isUnauthorized,
}: {
  onLogout: () => void
  isUnauthorized: (error: unknown) => boolean
}) {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<Tab>('boards')

  return (
    <div className="container ps-admin">
      {/* ---------- 页头：标题 + 退出登录 ---------- */}
      <motion.header
        className="ps-admin__head"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <SectionHeading
          eyebrow="管理台"
          title="后台管理"
          as="h1"
          size="display"
        />
        <Button variant="secondary" size="sm" onClick={onLogout}>
          退出登录
        </Button>
      </motion.header>

      {/* ---------- 分区切换 ---------- */}
      <motion.div
        className="ps-admin__tabs glass"
        role="tablist"
        aria-label="管理分区"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'boards'}
          className={tab === 'boards' ? 'ps-admin__tab is-active' : 'ps-admin__tab'}
          onClick={() => setTab('boards')}
        >
          战术板
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'authors'}
          className={tab === 'authors' ? 'ps-admin__tab is-active' : 'ps-admin__tab'}
          onClick={() => setTab('authors')}
        >
          创作者
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'submissions'}
          className={tab === 'submissions' ? 'ps-admin__tab is-active' : 'ps-admin__tab'}
          onClick={() => setTab('submissions')}
        >
          投稿审核
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reports'}
          className={tab === 'reports' ? 'ps-admin__tab is-active' : 'ps-admin__tab'}
          onClick={() => setTab('reports')}
        >
          举报
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'resources'}
          className={tab === 'resources' ? 'ps-admin__tab is-active' : 'ps-admin__tab'}
          onClick={() => setTab('resources')}
        >
          团本
        </button>
      </motion.div>

      {tab === 'boards' ? (
        <BoardsSection isUnauthorized={isUnauthorized} onLogout={onLogout} />
      ) : tab === 'authors' ? (
        <CreatorsSection isUnauthorized={isUnauthorized} onLogout={onLogout} />
      ) : tab === 'submissions' ? (
        <SubmissionsSection isUnauthorized={isUnauthorized} onLogout={onLogout} />
      ) : tab === 'reports' ? (
        <ReportsSection isUnauthorized={isUnauthorized} onLogout={onLogout} />
      ) : (
        <ResourcesSection isUnauthorized={isUnauthorized} onLogout={onLogout} />
      )}
    </div>
  )
}

/* ============================================================
   战术板管理：列表 + 新增/编辑表单
   ============================================================ */
function BoardsSection({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const boardsQuery = useAdminBoards()
  const authorsQuery = useAdminAuthors()
  const raidsQuery = useRaids()

  // 正在编辑的板（null = 新增模式）
  const [editing, setEditing] = useState<AdminBoard | null>(null)
  const [search, setSearch] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const updateBoard = useUpdateBoard()
  const deleteBoard = useDeleteBoard()

  // 收到 401 即回登录态
  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  // 加载态：表单 + 列表骨架
  if (boardsQuery.isLoading || authorsQuery.isLoading || raidsQuery.isLoading) {
    return <ListSkeleton />
  }

  // 错误态
  if (boardsQuery.isError || authorsQuery.isError || raidsQuery.isError) {
    const message =
      (boardsQuery.error as Error | undefined)?.message ??
      (authorsQuery.error as Error | undefined)?.message ??
      (raidsQuery.error as Error | undefined)?.message ??
      '数据加载失败，请稍后重试。'
    guard(boardsQuery.error ?? authorsQuery.error ?? raidsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={message}
        actionLabel="重新加载"
        onAction={() => {
          boardsQuery.refetch()
          authorsQuery.refetch()
          raidsQuery.refetch()
        }}
      />
    )
  }

  const boards = boardsQuery.data ?? []
  const authors = authorsQuery.data ?? []
  const raids = raidsQuery.data ?? []
  const authorNameById = new Map(authors.map((a) => [a.id, a.name]))
  const raidNameById = new Map(raids.map((r) => [r.id, r.name]))
  const normalizedSearch = search.trim().toLowerCase()
  const visibleCount = boards.filter((board) => !board.isHidden).length
  const hiddenCount = boards.length - visibleCount
  const filteredBoards = boards.filter((board) => {
    const authorName = authorNameById.get(board.authorId) ?? ''
    const raidName = raidNameById.get(board.raidId) ?? ''
    const matchesSearch =
      normalizedSearch === '' ||
      [
        board.title,
        board.description,
        board.seasonVersion,
        raidName,
        authorName,
        board.id,
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    const matchesAuthor = authorFilter === '' || board.authorId === authorFilter
    const matchesVisibility =
      visibilityFilter === 'all' ||
      (visibilityFilter === 'visible' ? !board.isHidden : board.isHidden)
    return matchesSearch && matchesAuthor && matchesVisibility
  })

  return (
    <div className="ps-admin__section">
      {/* ---------- 新增/编辑表单 ---------- */}
      <BoardForm
        key={editing?.id ?? 'new'}
        editing={editing}
        raids={raids}
        authors={authors}
        onDone={() => setEditing(null)}
        onGuard={guard}
      />

      {/* ---------- 列表 ---------- */}
      <section className="ps-admin__list-block" aria-label="全部战术板">
        <SectionHeading
          eyebrow="全站战术板管理"
          title="所有战术板"
          size="h2"
          trailing={boards.length > 0 ? `${boards.length} 块` : undefined}
        />

        <div className="ps-admin__resource-note glass">
          管理员在这里管理全站所有战术板；作者登录页只管理本人发布的板。
          删除会真正移除数据；不确定时优先用“下架”保留回滚空间。
        </div>

        <div className="ps-admin__toolbar glass" aria-label="战术板筛选">
          <label className="ps-admin__field ps-admin__toolbar-search" htmlFor="ps-board-search">
            <span className="ps-admin__label">搜索</span>
            <input
              id="ps-board-search"
              className="ps-admin__input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="标题、作者、团本、版本"
            />
          </label>

          <label className="ps-admin__field" htmlFor="ps-board-author-filter">
            <span className="ps-admin__label">作者</span>
            <div className="ps-admin__select-wrap">
              <select
                id="ps-board-author-filter"
                className="ps-admin__select"
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
              >
                <option value="">全部作者</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </label>

          <label className="ps-admin__field" htmlFor="ps-board-visibility-filter">
            <span className="ps-admin__label">状态</span>
            <div className="ps-admin__select-wrap">
              <select
                id="ps-board-visibility-filter"
                className="ps-admin__select"
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)}
              >
                <option value="all">全部状态</option>
                <option value="visible">已上架</option>
                <option value="hidden">已下架</option>
              </select>
              <SelectChevron />
            </div>
          </label>

          <div className="ps-admin__toolbar-stats" aria-label="战术板数量">
            <span>{visibleCount} 上架</span>
            <span>{hiddenCount} 下架</span>
          </div>
        </div>

        {boards.length === 0 ? (
          <EmptyState icon="empty" text="还没有任何战术板，先用上面的表单新增一块。" />
        ) : filteredBoards.length === 0 ? (
          <EmptyState
            icon="empty"
            text="没有匹配筛选条件的战术板。"
            actionLabel="清空筛选"
            onAction={() => {
              setSearch('')
              setAuthorFilter('')
              setVisibilityFilter('all')
            }}
          />
        ) : (
          <motion.ul
            className="ps-admin__rows"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            animate="show"
          >
            {filteredBoards.map((board) => (
              <motion.li
                key={board.id}
                variants={reduce ? undefined : staggerItem}
              >
                <BoardRow
                  board={board}
                  authorName={authorNameById.get(board.authorId) ?? '未知作者'}
                  raidName={raidNameById.get(board.raidId) ?? board.raidId}
                  isEditing={editing?.id === board.id}
                  onEdit={() => {
                    setEditing(board)
                    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
                  }}
                  onToggleFeatured={() =>
                    updateBoard.mutate(
                      { id: board.id, patch: { isFeatured: !board.isFeatured } },
                      { onError: guard },
                    )
                  }
                  onToggleHidden={() =>
                    updateBoard.mutate(
                      { id: board.id, patch: { isHidden: !board.isHidden } },
                      { onError: guard },
                    )
                  }
                  onDelete={() =>
                    deleteBoard.mutate(board.id, {
                      onSuccess: () => {
                        if (editing?.id === board.id) setEditing(null)
                      },
                      onError: guard,
                    })
                  }
                  busy={
                    (updateBoard.isPending &&
                      updateBoard.variables?.id === board.id) ||
                    (deleteBoard.isPending && deleteBoard.variables === board.id)
                  }
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </div>
  )
}

/* ============================================================
   单块战术板行：信息 + 操作（编辑 / 精选 / 上下架 / 删除）
   下架、删除走行内玻璃二次确认。
   ============================================================ */
function BoardRow({
  board,
  authorName,
  raidName,
  isEditing,
  onEdit,
  onToggleFeatured,
  onToggleHidden,
  onDelete,
  busy,
}: {
  board: AdminBoard
  authorName: string
  raidName: string
  isEditing: boolean
  onEdit: () => void
  onToggleFeatured: () => void
  onToggleHidden: () => void
  onDelete: () => void
  busy: boolean
}) {
  // 行内确认：'hide' 下架确认 / 'delete' 删除确认 / null 无
  const [confirm, setConfirm] = useState<'hide' | 'delete' | null>(null)

  return (
    <GlassCard
      tone="glass"
      as="div"
      className={
        board.isHidden ? 'ps-admin__row-card is-hidden' : 'ps-admin__row-card'
      }
    >
      <div className="ps-admin__row-main">
        {/* 标记区：精选 / 已下架 */}
        <div className="ps-admin__row-flags">
          {board.isFeatured && (
            <Tag variant="gold" icon="star">
              精选
            </Tag>
          )}
          {board.isHidden && <Tag variant="neutral">已下架</Tag>}
        </div>

        {/* 标题 + 路径 */}
        <p className="ps-admin__row-title">{board.title}</p>
        <p className="ps-admin__row-path">
          {raidName} · {difficultyLabel(board.difficulty)} · {board.seasonVersion}
        </p>

        {/* 作者 + 统计 */}
        <div className="ps-admin__row-meta">
          <span className="ps-admin__row-author">
            <Avatar name={authorName} size={20} />
            {authorName}
          </span>
          <Stat kind="view" value={board.viewCount} label="浏览量" />
          <Stat kind="like" value={board.likeCount} label="点赞数" />
        </div>
      </div>

      {/* 操作区 */}
      <div className="ps-admin__row-actions">
        {confirm ? (
          <div className="ps-admin__confirm glass-strong" role="alertdialog">
            <span className="ps-admin__confirm-text">
              {confirm === 'delete'
                ? `确认删除「${board.title}」？删除后不可恢复。`
                : `确认下架「${board.title}」？下架后公开列表不再显示。`}
            </span>
            <div className="ps-admin__confirm-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (confirm === 'delete') onDelete()
                  else onToggleHidden()
                  setConfirm(null)
                }}
                disabled={busy}
              >
                {confirm === 'delete' ? '删除' : '下架'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant={isEditing ? 'primary' : 'secondary'}
              size="sm"
              onClick={onEdit}
            >
              {isEditing ? '编辑中' : '编辑'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon="star"
              onClick={onToggleFeatured}
              disabled={busy}
            >
              {board.isFeatured ? '取消精选' : '设为精选'}
            </Button>
            {board.isHidden ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleHidden}
                disabled={busy}
              >
                上架
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm('hide')}
                disabled={busy}
              >
                下架
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm('delete')}
              disabled={busy}
            >
              删除
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  )
}

/* ============================================================
   战术板表单（新增 / 编辑复用）
   editing=null -> 新增（useCreateBoard）
   editing=board -> 预填（useUpdateBoard，提交全字段）
   ============================================================ */
function BoardForm({
  editing,
  raids,
  authors,
  onDone,
  onGuard,
}: {
  editing: AdminBoard | null
  raids: { id: string; name: string; patch: string }[]
  authors: AdminAuthor[]
  onDone: () => void
  onGuard: (error: unknown) => void
}) {
  const reduce = useReducedMotion()
  const isEdit = editing !== null

  const [title, setTitle] = useState(editing?.title ?? '')
  const [raidId, setRaidId] = useState(editing?.raidId ?? '')
  const [bossId, setBossId] = useState(editing?.bossId ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(
    editing?.difficulty ?? 'mythic',
  )
  const [seasonVersion, setSeasonVersion] = useState(editing?.seasonVersion ?? '')
  const [authorId, setAuthorId] = useState(editing?.authorId ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [isFeatured, setIsFeatured] = useState(editing?.isFeatured ?? false)
  const [contentText, setContentText] = useState(editing?.contentText ?? '')

  // 依所选团本拉 BOSS
  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []

  const createBoard = useCreateBoard()
  const updateBoard = useUpdateBoard()
  const pending = createBoard.isPending || updateBoard.isPending
  const error = createBoard.error ?? updateBoard.error

  const canSubmit =
    title.trim() !== '' &&
    raidId !== '' &&
    bossId !== '' &&
    seasonVersion.trim() !== '' &&
    authorId !== '' &&
    description.trim() !== '' &&
    contentText.trim() !== '' &&
    !pending

  function resetForm() {
    setTitle('')
    setRaidId('')
    setBossId('')
    setDifficulty('mythic')
    setSeasonVersion('')
    setAuthorId('')
    setDescription('')
    setIsFeatured(false)
    setContentText('')
  }

  function handleRaidChange(next: string) {
    setRaidId(next)
    setBossId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (isEdit) {
      const patch: UpdateBoardInput = {
        title: title.trim(),
        raidId,
        bossId,
        difficulty,
        seasonVersion: seasonVersion.trim(),
        contentText,
        description: description.trim(),
        authorId,
        isFeatured,
      }
      updateBoard.mutate(
        { id: editing!.id, patch },
        { onSuccess: () => onDone(), onError: onGuard },
      )
    } else {
      const input: CreateBoardInput = {
        title: title.trim(),
        raidId,
        bossId,
        difficulty,
        seasonVersion: seasonVersion.trim(),
        contentText,
        description: description.trim(),
        authorId,
        isFeatured,
      }
      createBoard.mutate(input, {
        onSuccess: () => resetForm(),
        onError: onGuard,
      })
    }
  }

  return (
    <motion.form
      className="ps-admin__form glass"
      onSubmit={handleSubmit}
      variants={reduce ? undefined : staggerContainer}
      initial="hidden"
      animate="show"
      noValidate
    >
      <motion.div
        className="ps-admin__form-head"
        variants={reduce ? undefined : staggerItem}
      >
        <SectionHeading
          eyebrow={isEdit ? '编辑战术板' : '新增战术板'}
          title={isEdit ? `编辑「${editing!.title}」` : '发布一块战术板'}
          size="h2"
        />
        {isEdit && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            取消编辑
          </Button>
        )}
      </motion.div>

      {/* 标题 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-bf-title">
          标题
        </label>
        <input
          id="ps-bf-title"
          className="ps-admin__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：至暗之夜降临 · M"
          maxLength={80}
        />
      </motion.div>

      {/* 团本 + BOSS（联动） */}
      <motion.div className="ps-admin__row-grid" variants={reduce ? undefined : staggerItem}>
        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-bf-raid">
            团本
          </label>
          <div className="ps-admin__select-wrap">
            <select
              id="ps-bf-raid"
              className="ps-admin__select"
              value={raidId}
              onChange={(e) => handleRaidChange(e.target.value)}
            >
              <option value="" disabled>
                选择团本
              </option>
              {raids.map((raid) => (
                <option key={raid.id} value={raid.id}>
                  {raid.name}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-bf-boss">
            BOSS
          </label>
          <div className="ps-admin__select-wrap">
            <select
              id="ps-bf-boss"
              className="ps-admin__select"
              value={bossId ?? ''}
              onChange={(e) => setBossId(e.target.value)}
              disabled={!raidId || raidDetailQuery.isLoading}
            >
              <option value="" disabled>
                {!raidId
                  ? '先选团本'
                  : raidDetailQuery.isLoading
                    ? '加载中…'
                    : '选择 BOSS'}
              </option>
              {bosses.map((boss) => (
                <option key={boss.id} value={boss.id}>
                  {boss.order}. {boss.name}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
      </motion.div>

      {/* 难度 + 赛季 */}
      <motion.div className="ps-admin__row-grid" variants={reduce ? undefined : staggerItem}>
        <div className="ps-admin__field">
          <span className="ps-admin__label" id="ps-bf-diff-label">
            难度
          </span>
          <div
            className="ps-admin__seg glass"
            role="radiogroup"
            aria-labelledby="ps-bf-diff-label"
          >
            {DIFFICULTY_OPTIONS.map((opt) => {
              const active = opt.value === difficulty
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    active ? 'ps-admin__seg-btn is-active' : 'ps-admin__seg-btn'
                  }
                  onClick={() => setDifficulty(opt.value)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-bf-season">
            赛季
          </label>
          <input
            id="ps-bf-season"
            className="ps-admin__input"
            type="text"
            value={seasonVersion}
            onChange={(e) => setSeasonVersion(e.target.value)}
            placeholder="例如：S3"
            maxLength={20}
          />
        </div>
      </motion.div>

      {/* 作者 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-bf-author">
          作者
        </label>
        <div className="ps-admin__select-wrap">
          <select
            id="ps-bf-author"
            className="ps-admin__select"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
          >
            <option value="" disabled>
              选择作者
            </option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
      </motion.div>

      {/* 一行描述 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-bf-desc">
          一行描述
        </label>
        <input
          id="ps-bf-desc"
          className="ps-admin__input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="一句话说明这块板适用什么场景"
          maxLength={120}
        />
      </motion.div>

      {/* 是否精选 */}
      <motion.div
        className="ps-admin__field ps-admin__field--switch"
        variants={reduce ? undefined : staggerItem}
      >
        <span className="ps-admin__switch-info">
          <span className="ps-admin__label" id="ps-bf-featured-label">
            是否精选
          </span>
          <span className="ps-admin__switch-hint">精选板会出现在首页精选区。</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isFeatured}
          aria-labelledby="ps-bf-featured-label"
          className={isFeatured ? 'ps-admin__switch is-on' : 'ps-admin__switch'}
          onClick={() => setIsFeatured((v) => !v)}
        >
          <motion.span
            className="ps-admin__switch-knob"
            aria-hidden="true"
            layout={!reduce}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        </button>
      </motion.div>

      {/* 战术正文 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-bf-content">
          战术正文
        </label>
        <textarea
          id="ps-bf-content"
          className="ps-admin__textarea glass-strong"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder="逐字粘贴 STT 战术方案，原样保留换行与对齐。"
          rows={14}
          spellCheck={false}
        />
      </motion.div>

      {error && (
        <motion.p
          className="ps-admin__error"
          role="alert"
          variants={reduce ? undefined : staggerItem}
        >
          {(error as Error)?.message ??
            (isEdit ? '保存失败，请重试。' : '上稿失败，请重试。')}
        </motion.p>
      )}

      <motion.div className="ps-admin__actions" variants={reduce ? undefined : staggerItem}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {pending
            ? isEdit
              ? '保存中…'
              : '提交中…'
            : isEdit
              ? '保存修改'
              : '提交上稿'}
        </Button>
      </motion.div>
    </motion.form>
  )
}

/* ============================================================
   投稿审核：游客投稿队列 + 发布/驳回/垃圾
   ============================================================ */
function SubmissionsSection({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const submissionsQuery = useAdminSubmissions()
  const authorsQuery = useAdminAuthors()
  const approveSubmission = useApproveSubmission()
  const rejectSubmission = useRejectSubmission()
  const markSpam = useMarkSubmissionSpam()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [authorBySubmission, setAuthorBySubmission] = useState<Record<string, string>>({})

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (submissionsQuery.isLoading || authorsQuery.isLoading) {
    return <ListSkeleton />
  }

  if (submissionsQuery.isError || authorsQuery.isError) {
    const message =
      (submissionsQuery.error as Error | undefined)?.message ??
      (authorsQuery.error as Error | undefined)?.message ??
      '投稿审核队列加载失败。'
    guard(submissionsQuery.error ?? authorsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={`加载失败：${message}`}
        actionLabel="重试"
        onAction={() => {
          submissionsQuery.refetch()
          authorsQuery.refetch()
        }}
      />
    )
  }

  const submissions = submissionsQuery.data ?? []
  const authors = authorsQuery.data ?? []
  const pendingCount = submissions.filter((item) => item.status === 'pending').length

  function approve(id: string, input: ApproveSubmissionInput) {
    approveSubmission.mutate(
      { id, input },
      {
        onSuccess: () => setExpandedId(null),
        onError: guard,
      },
    )
  }

  function selectedAuthor(id: string) {
    return authorBySubmission[id] ?? ''
  }

  return (
    <div className="ps-admin__section">
      <section className="ps-admin__list-block" aria-label="投稿审核队列">
        <SectionHeading
          eyebrow="投稿审核"
          title="待处理投稿"
          size="h2"
          trailing={pendingCount > 0 ? `${pendingCount} 条待处理` : undefined}
        />

        {submissions.length === 0 ? (
          <EmptyState icon="empty" text="暂无投稿" />
        ) : (
          <motion.div
            className="ps-admin__rows"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            animate="show"
          >
            {submissions.map((submission) => {
              const isExpanded = expandedId === submission.id
              const isPending = submission.status === 'pending'
              const busy =
                (approveSubmission.isPending && approveSubmission.variables?.id === submission.id) ||
                (rejectSubmission.isPending && rejectSubmission.variables?.id === submission.id) ||
                (markSpam.isPending && markSpam.variables?.id === submission.id)

              return (
                <motion.article
                  key={submission.id}
                  className={
                    isPending
                      ? 'ps-admin__row-card glass'
                      : 'ps-admin__row-card ps-admin__row-card--handled glass'
                  }
                  variants={reduce ? undefined : staggerItem}
                >
                  <div className="ps-admin__row-main">
                    <div className="ps-admin__row-flags">
                      <Tag variant={isPending ? 'gold' : 'neutral'}>
                        {submissionStatusLabel(submission.status)}
                      </Tag>
                      {submission.wantsCreatorProfile && <Tag variant="neutral">申请创作者</Tag>}
                    </div>
                    <p className="ps-admin__row-title">{submission.title}</p>
                    <p className="ps-admin__row-path">
                      {submission.raidId} · {difficultyLabel(submission.difficulty)} ·{' '}
                      {submission.seasonVersion}
                    </p>
                    <p className="ps-admin__row-meta">
                      署名：{submission.submitterName} · 提交于 {formatDate(submission.createdAt)}
                    </p>
                    {submission.contact && (
                      <p className="ps-admin__row-meta">联系方式：{submission.contact}</p>
                    )}
                  </div>

                  <div className="ps-admin__row-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                    >
                      {isExpanded ? '收起' : '查看'}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="ps-admin__submission-detail">
                      <pre className="ps-admin__submission-code glass-strong">
                        {submission.contentText}
                      </pre>

                      {submission.wantsCreatorProfile && (
                        <div className="ps-admin__submission-profile">
                          {submission.creatorBio && <p>简介：{submission.creatorBio}</p>}
                          {submission.creatorGuildName && <p>公会：{submission.creatorGuildName}</p>}
                          {submission.creatorGuildRecruit && (
                            <p>招募：{submission.creatorGuildRecruit}</p>
                          )}
                          {submission.creatorGuildContact && (
                            <p>公会联系方式：{submission.creatorGuildContact}</p>
                          )}
                        </div>
                      )}

                      {isPending ? (
                        <div className="ps-admin__submission-review">
                          <div className="ps-admin__select-wrap">
                            <select
                              className="ps-admin__select"
                              value={selectedAuthor(submission.id)}
                              onChange={(e) =>
                                setAuthorBySubmission((current) => ({
                                  ...current,
                                  [submission.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">选择已有作者</option>
                              {authors.map((author) => (
                                <option key={author.id} value={author.id}>
                                  {author.name}
                                </option>
                              ))}
                            </select>
                            <SelectChevron />
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!selectedAuthor(submission.id) || busy}
                            onClick={() =>
                              approve(submission.id, {
                                mode: 'existingAuthor',
                                authorId: selectedAuthor(submission.id),
                              })
                            }
                          >
                            绑定已有作者发布
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => approve(submission.id, { mode: 'createAuthor' })}
                          >
                            创建作者并发布
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => approve(submission.id, { mode: 'plainAuthor' })}
                          >
                            作为普通投稿发布
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              rejectSubmission.mutate(
                                { id: submission.id, note: '后台驳回' },
                                { onError: guard },
                              )
                            }
                          >
                            驳回
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              markSpam.mutate(
                                { id: submission.id, note: '后台标记垃圾' },
                                { onError: guard },
                              )
                            }
                          >
                            标记垃圾
                          </Button>
                        </div>
                      ) : (
                        <p className="ps-admin__row-meta">
                          已处理：{submissionStatusLabel(submission.status)}
                          {submission.boardId ? ` · 板子 ${submission.boardId}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </motion.article>
              )
            })}
          </motion.div>
        )}

        {(approveSubmission.error || rejectSubmission.error || markSpam.error) && (
          <p className="ps-admin__error" role="alert">
            {((approveSubmission.error ?? rejectSubmission.error ?? markSpam.error) as Error)?.message ??
              '审核操作失败，请重试。'}
          </p>
        )}
      </section>
    </div>
  )
}

function submissionStatusLabel(status: AdminSubmission['status']) {
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已发布'
  if (status === 'rejected') return '已驳回'
  return '垃圾'
}

/* ============================================================
   举报队列：隐藏板 / 驳回举报
   ============================================================ */
function ReportsSection({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const reportsQuery = useAdminReports()
  const hideBoard = useHideBoardFromReport()
  const dismissReport = useDismissReport()

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (reportsQuery.isLoading) return <ListSkeleton />
  if (reportsQuery.isError) {
    guard(reportsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={(reportsQuery.error as Error)?.message ?? '举报队列加载失败。'}
        actionLabel="重试"
        onAction={() => reportsQuery.refetch()}
      />
    )
  }

  const reports = reportsQuery.data ?? []
  const pendingCount = reports.filter((report) => report.status === 'pending').length

  return (
    <div className="ps-admin__section">
      <section className="ps-admin__list-block" aria-label="举报队列">
        <SectionHeading
          eyebrow="内容治理"
          title="举报队列"
          size="h2"
          trailing={pendingCount > 0 ? `${pendingCount} 条待处理` : undefined}
        />
        {reports.length === 0 ? (
          <EmptyState icon="empty" text="暂无举报" />
        ) : (
          <motion.ul
            className="ps-admin__rows"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            animate="show"
          >
            {reports.map((report) => {
              const isPending = report.status === 'pending'
              const busy =
                (hideBoard.isPending && hideBoard.variables?.id === report.id) ||
                (dismissReport.isPending && dismissReport.variables?.id === report.id)
              return (
                <motion.li key={report.id} variants={reduce ? undefined : staggerItem}>
                  <GlassCard tone="glass" as="div" className={isPending ? 'ps-admin__row-card' : 'ps-admin__row-card ps-admin__row-card--handled'}>
                    <div className="ps-admin__row-main">
                      <div className="ps-admin__row-flags">
                        <Tag variant={isPending ? 'gold' : 'neutral'}>
                          {reportStatusLabel(report.status)}
                        </Tag>
                        <Tag variant="neutral">{reportReasonLabel(report.reason)}</Tag>
                      </div>
                      <p className="ps-admin__row-title">战术板 {report.boardId}</p>
                      <p className="ps-admin__row-meta">
                        提交于 {formatDate(report.createdAt)}
                        {report.detail ? ` · ${report.detail}` : ''}
                      </p>
                    </div>
                    <div className="ps-admin__row-actions">
                      <Button to={`/board/${report.boardId}`} variant="secondary" size="sm">
                        查看板
                      </Button>
                      {isPending && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              hideBoard.mutate(
                                { id: report.id, note: '后台处理举报隐藏' },
                                { onError: guard },
                              )
                            }
                          >
                            隐藏板
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              dismissReport.mutate(
                                { id: report.id, note: '后台驳回举报' },
                                { onError: guard },
                              )
                            }
                          >
                            驳回举报
                          </Button>
                        </>
                      )}
                    </div>
                  </GlassCard>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </section>
    </div>
  )
}

function reportStatusLabel(status: string) {
  if (status === 'pending') return '待处理'
  if (status === 'hidden') return '已隐藏'
  return '已驳回'
}

function reportReasonLabel(reason: string) {
  if (reason === 'spam') return '垃圾内容'
  if (reason === 'abuse') return '违规内容'
  if (reason === 'wrong-info') return '内容有误'
  if (reason === 'copyright') return '版权问题'
  return '其它'
}

/* ============================================================
   团本 / BOSS 管理
   ============================================================ */
function ResourcesSection({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const raidsQuery = useRaids()
  const createRaid = useCreateRaid()
  const deleteRaid = useDeleteRaid()
  const [raidId, setRaidId] = useState('')
  const [raidName, setRaidName] = useState('')
  const [raidPatch, setRaidPatch] = useState('')

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  function submitRaid(e: React.FormEvent) {
    e.preventDefault()
    if (!raidName.trim() || !raidPatch.trim()) return
    createRaid.mutate(
      {
        id: raidId.trim() || undefined,
        name: raidName.trim(),
        patch: raidPatch.trim(),
      },
      {
        onSuccess: () => {
          setRaidId('')
          setRaidName('')
          setRaidPatch('')
        },
        onError: guard,
      },
    )
  }

  if (raidsQuery.isLoading) return <ListSkeleton />
  if (raidsQuery.isError) {
    guard(raidsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={(raidsQuery.error as Error)?.message ?? '团本加载失败。'}
        actionLabel="重试"
        onAction={() => raidsQuery.refetch()}
      />
    )
  }

  const raids = raidsQuery.data ?? []

  return (
    <div className="ps-admin__section">
      <form className="ps-admin__form glass" onSubmit={submitRaid}>
        <SectionHeading eyebrow="团本管理" title="新增团本" size="h2" />
        <div className="ps-admin__row-grid">
          <div className="ps-admin__field">
            <label className="ps-admin__label" htmlFor="ps-raid-id">ID（可选）</label>
            <input id="ps-raid-id" className="ps-admin__input" value={raidId} onChange={(e) => setRaidId(e.target.value)} placeholder="不填则自动生成" />
          </div>
          <div className="ps-admin__field">
            <label className="ps-admin__label" htmlFor="ps-raid-patch">版本</label>
            <input id="ps-raid-patch" className="ps-admin__input" value={raidPatch} onChange={(e) => setRaidPatch(e.target.value)} placeholder="例如 12.0.0" />
          </div>
        </div>
        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-raid-name">团本名</label>
          <input id="ps-raid-name" className="ps-admin__input" value={raidName} onChange={(e) => setRaidName(e.target.value)} />
        </div>
        {createRaid.error && <p className="ps-admin__error">{(createRaid.error as Error).message}</p>}
        <div className="ps-admin__actions">
          <Button type="submit" variant="primary" disabled={createRaid.isPending || !raidName.trim() || !raidPatch.trim()}>
            {createRaid.isPending ? '保存中…' : '新增团本'}
          </Button>
        </div>
      </form>

      <section className="ps-admin__list-block" aria-label="团本与 BOSS">
        <SectionHeading eyebrow="资源" title="团本与 BOSS" size="h2" trailing={`${raids.length} 个团本`} />
        <motion.ul
          className="ps-admin__rows"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {raids.map((raid) => (
            <motion.li key={raid.id} variants={reduce ? undefined : staggerItem}>
              <RaidResourceRow
                raid={raid}
                onGuard={guard}
                onDeleteRaid={() => deleteRaid.mutate(raid.id, { onError: guard })}
                raidDeleteBusy={deleteRaid.isPending && deleteRaid.variables === raid.id}
              />
            </motion.li>
          ))}
        </motion.ul>
      </section>
    </div>
  )
}

function RaidResourceRow({
  raid,
  onGuard,
  onDeleteRaid,
  raidDeleteBusy,
}: {
  raid: Raid
  onGuard: (error: unknown) => void
  onDeleteRaid: () => void
  raidDeleteBusy: boolean
}) {
  const raidQuery = useRaid(raid.id)
  const createBoss = useCreateBoss()
  const deleteBoss = useDeleteBoss()
  const [bossName, setBossName] = useState('')
  const [bossOrder, setBossOrder] = useState('')

  const bosses: Boss[] = raidQuery.data?.bosses ?? []

  function submitBoss(e: React.FormEvent) {
    e.preventDefault()
    const order = Number(bossOrder)
    if (!bossName.trim() || !Number.isInteger(order) || order < 1) return
    createBoss.mutate(
      { raidId: raid.id, name: bossName.trim(), order },
      {
        onSuccess: () => {
          setBossName('')
          setBossOrder('')
        },
        onError: onGuard,
      },
    )
  }

  return (
    <GlassCard tone="glass" as="div" className="ps-admin__row-card">
      <div className="ps-admin__row-main">
        <div className="ps-admin__row-flags">
          <Tag variant="gold">{raid.patch}</Tag>
          <Tag variant="neutral">{raid.boardCount} 块板</Tag>
        </div>
        <p className="ps-admin__row-title">{raid.name}</p>
        <p className="ps-admin__row-path">{raid.id}</p>
        <form className="ps-admin__inline-form" onSubmit={submitBoss}>
          <input
            className="ps-admin__input"
            value={bossName}
            onChange={(e) => setBossName(e.target.value)}
            placeholder="新增 BOSS 名"
          />
          <input
            className="ps-admin__input"
            value={bossOrder}
            onChange={(e) => setBossOrder(e.target.value)}
            placeholder="顺序"
            inputMode="numeric"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={createBoss.isPending}>
            新增 BOSS
          </Button>
        </form>
        {createBoss.error && <p className="ps-admin__error">{(createBoss.error as Error).message}</p>}
        {deleteBoss.error && <p className="ps-admin__error">{(deleteBoss.error as Error).message}</p>}
        <div className="ps-admin__boss-list">
          {bosses.map((boss) => (
            <span key={boss.id} className="ps-admin__boss-chip">
              {boss.order}. {boss.name}
              <button
                type="button"
                onClick={() => deleteBoss.mutate({ id: boss.id, raidId: raid.id }, { onError: onGuard })}
                disabled={deleteBoss.isPending}
              >
                删除
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="ps-admin__row-actions">
        <Button variant="ghost" size="sm" onClick={onDeleteRaid} disabled={raidDeleteBusy}>
          删除团本
        </Button>
      </div>
    </GlassCard>
  )
}

/* ============================================================
   账号管理：创作者账号列表 + 人工重置密码
   ============================================================ */
function AccountsPanel({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const accountsQuery = useAdminCreatorAccounts()
  const resetCreatorPassword = useResetCreatorPassword()

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (accountsQuery.isLoading) {
    return (
      <div className="ps-admin__rows" role="status" aria-busy="true">
        <div className="ps-admin__row-card glass">
          <div className="ps-admin__row-main">
            <Skeleton shape="line" width="40%" height={18} />
            <Skeleton shape="line" width="60%" height={14} />
          </div>
          <Skeleton shape="block" width={120} height={36} />
        </div>
      </div>
    )
  }

  if (accountsQuery.isError) {
    guard(accountsQuery.error)
    return (
      <div className="ps-admin__resource-note ps-admin__resource-note--warn glass">
        登录账号接口当前不可用：
        {' '}
        {(accountsQuery.error as Error)?.message ?? '账号加载失败'}。
        这通常说明线上 CloudBase 后端还没部署包含账号管理 API 的版本；公开作者资料和战术板管理不受影响。
      </div>
    )
  }

  const accounts = accountsQuery.data ?? []

  return (
    <>
      {resetCreatorPassword.isError && (
        <p className="ps-admin__error" role="alert">
          {(resetCreatorPassword.error as Error)?.message ?? '重置密码失败，请重试。'}
        </p>
      )}

      {accounts.length === 0 ? (
        <EmptyState icon="author" text="还没有创作者登录账号。" />
      ) : (
        <motion.ul
          className="ps-admin__rows"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {accounts.map((account) => (
            <motion.li key={account.id} variants={reduce ? undefined : staggerItem}>
              <AccountRow
                account={account}
                busy={
                  resetCreatorPassword.isPending &&
                  resetCreatorPassword.variables?.id === account.id
                }
                onResetPassword={(password, onSuccess) =>
                  resetCreatorPassword.mutate(
                    { id: account.id, password },
                    { onSuccess, onError: guard },
                  )
                }
              />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </>
  )
}

function AccountRow({
  account,
  busy,
  onResetPassword,
}: {
  account: AdminCreatorAccount
  busy: boolean
  onResetPassword: (password: string, onSuccess: () => void) => void
}) {
  const [isResetting, setIsResetting] = useState(false)
  const [password, setPassword] = useState('')
  const [issuedPassword, setIssuedPassword] = useState('')
  const trimmedPassword = password.trim()
  const canReset = trimmedPassword.length >= 8 && !busy
  const authorName = account.author?.name ?? '未绑定作者'
  const boardCount = account.author?.boardCount ?? 0

  function handleGenerate() {
    setPassword(generateTemporaryPassword())
    setIssuedPassword('')
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!canReset) return
    const nextPassword = trimmedPassword
    onResetPassword(nextPassword, () => {
      setIssuedPassword(nextPassword)
      setPassword('')
      setIsResetting(false)
    })
  }

  return (
    <GlassCard tone="glass" as="div" className="ps-admin__row-card">
      <div className="ps-admin__row-main">
        <div className="ps-admin__row-flags">
          <Tag variant={account.status === 'active' ? 'gold' : 'neutral'}>
            {account.status === 'active' ? '正常' : '已暂停'}
          </Tag>
        </div>
        <p className="ps-admin__row-title">{account.username}</p>
        <p className="ps-admin__row-path">
          {authorName} · {boardCount} 块战术板
        </p>
        <div className="ps-admin__row-meta">
          {account.contact && <span>联系方式：{account.contact}</span>}
          <span>注册：{formatDate(account.createdAt)}</span>
          {account.lastLoginAt && <span>最后登录：{formatDate(account.lastLoginAt)}</span>}
        </div>
        {issuedPassword && (
          <p className="ps-admin__success" role="status">
            已重置。请把新密码「{issuedPassword}」发给用户；离开本行后后台不会再显示它。
          </p>
        )}
      </div>

      <div className="ps-admin__row-actions">
        {isResetting ? (
          <form className="ps-admin__reset-form glass-strong" onSubmit={handleReset}>
            <label className="ps-admin__label" htmlFor={`ps-account-password-${account.id}`}>
              新密码
            </label>
            <input
              id={`ps-account-password-${account.id}`}
              className="ps-admin__input"
              type="text"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setIssuedPassword('')
              }}
              placeholder="至少 8 位"
              autoComplete="off"
            />
            <div className="ps-admin__confirm-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsResetting(false)
                  setPassword('')
                }}
                disabled={busy}
              >
                取消
              </Button>
              <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={busy}>
                生成临时密码
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={!canReset}>
                {busy ? '重置中…' : '确认重置'}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsResetting(true)
              setIssuedPassword('')
            }}
          >
            重置密码
          </Button>
        )}
      </div>
    </GlassCard>
  )
}

/* ============================================================
   创作者管理：公开资料 + 登录账号
   ============================================================ */
function CreatorsSection({
  isUnauthorized,
  onLogout,
}: {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}) {
  const reduce = useReducedMotion()
  const authorsQuery = useAdminAuthors()
  const [editing, setEditing] = useState<AdminAuthor | null>(null)
  const deleteAuthor = useDeleteAuthor()

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (authorsQuery.isLoading) {
    return <ListSkeleton />
  }

  if (authorsQuery.isError) {
    guard(authorsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={(authorsQuery.error as Error)?.message ?? '作者加载失败，请稍后重试。'}
        actionLabel="重新加载"
        onAction={() => authorsQuery.refetch()}
      />
    )
  }

  const authors = authorsQuery.data ?? []

  return (
    <div className="ps-admin__section">
      <div className="ps-admin__resource-note glass">
        创作者资料决定公开作者页、公会招募和战术板署名；登录账号只负责用户名、密码和找回。
        两者是一套创作者资源的两个侧面，不再拆成互相竞争的后台入口。
      </div>

      {/* ---------- 新增/编辑表单 ---------- */}
      <AuthorForm
        key={editing?.id ?? 'new'}
        editing={editing}
        onDone={() => setEditing(null)}
        onGuard={guard}
      />

      {/* ---------- 列表 ---------- */}
      <section className="ps-admin__list-block" aria-label="全部作者">
        <SectionHeading
          eyebrow="公开资料"
          title="创作者资料"
          size="h2"
          trailing={authors.length > 0 ? `${authors.length} 位` : undefined}
        />

        {/* 删除失败（如名下有板 409）提示 */}
        {deleteAuthor.isError && (
          <p className="ps-admin__error" role="alert">
            {(deleteAuthor.error as Error)?.message ?? '删除失败，请重试。'}
          </p>
        )}

        {authors.length === 0 ? (
          <EmptyState icon="author" text="还没有任何作者，先用上面的表单新增一位。" />
        ) : (
          <motion.ul
            className="ps-admin__rows"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            animate="show"
          >
            {authors.map((author) => (
              <motion.li key={author.id} variants={reduce ? undefined : staggerItem}>
                <AuthorRow
                  author={author}
                  isEditing={editing?.id === author.id}
                  onEdit={() => {
                    setEditing(author)
                    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
                  }}
                  onDelete={() =>
                    deleteAuthor.mutate(author.id, {
                      onSuccess: () => {
                        if (editing?.id === author.id) setEditing(null)
                      },
                      onError: guard,
                    })
                  }
                  busy={deleteAuthor.isPending && deleteAuthor.variables === author.id}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>

      <section className="ps-admin__list-block" aria-label="创作者登录账号">
        <SectionHeading
          eyebrow="登录账号"
          title="账号与密码"
          size="h2"
        />
        <AccountsPanel isUnauthorized={isUnauthorized} onLogout={onLogout} />
      </section>
    </div>
  )
}

/* ============================================================
   单个作者行：信息 + 操作（编辑 / 删除）
   ============================================================ */
function AuthorRow({
  author,
  isEditing,
  onEdit,
  onDelete,
  busy,
}: {
  author: AdminAuthor
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  busy: boolean
}) {
  const [confirm, setConfirm] = useState(false)

  return (
    <GlassCard tone="glass" as="div" className="ps-admin__row-card">
      <div className="ps-admin__row-main">
        <div className="ps-admin__row-author-head">
          <Avatar name={author.name} size={36} />
          <div>
            <p className="ps-admin__row-title">{author.name}</p>
            <p className="ps-admin__row-path">
              {author.boardCount} 块战术板
              {author.guildName ? ` · ${author.guildName}` : ''}
            </p>
          </div>
        </div>
        {author.bio && <p className="ps-admin__row-bio">{author.bio}</p>}
      </div>

      <div className="ps-admin__row-actions">
        {confirm ? (
          <div className="ps-admin__confirm glass-strong" role="alertdialog">
            <span className="ps-admin__confirm-text">
              确认删除作者「{author.name}」？名下有战术板时无法删除。
            </span>
            <div className="ps-admin__confirm-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(false)}
                disabled={busy}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onDelete()
                  setConfirm(false)
                }}
                disabled={busy}
              >
                删除
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant={isEditing ? 'primary' : 'secondary'}
              size="sm"
              onClick={onEdit}
            >
              {isEditing ? '编辑中' : '编辑'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={busy}
            >
              删除
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  )
}

/* ============================================================
   作者表单（新增 / 编辑复用）
   昵称必填；简介 / 公会名 / 招募 / 联系方式可空（可空就不渲染引流卡，由作者页守卫）。
   ============================================================ */
function AuthorForm({
  editing,
  onDone,
  onGuard,
}: {
  editing: AdminAuthor | null
  onDone: () => void
  onGuard: (error: unknown) => void
}) {
  const reduce = useReducedMotion()
  const isEdit = editing !== null

  const [name, setName] = useState(editing?.name ?? '')
  const [bio, setBio] = useState(editing?.bio ?? '')
  const [guildName, setGuildName] = useState(editing?.guildName ?? '')
  const [guildRecruit, setGuildRecruit] = useState(editing?.guildRecruit ?? '')
  const [guildContact, setGuildContact] = useState(editing?.guildContact ?? '')

  const createAuthor = useCreateAuthor()
  const updateAuthor = useUpdateAuthor()
  const pending = createAuthor.isPending || updateAuthor.isPending
  const error = createAuthor.error ?? updateAuthor.error

  const canSubmit = name.trim() !== '' && !pending

  function resetForm() {
    setName('')
    setBio('')
    setGuildName('')
    setGuildRecruit('')
    setGuildContact('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    // 可空字段：空串提交为 undefined，避免落库空串
    const body: AuthorInput = {
      name: name.trim(),
      bio: bio.trim() || undefined,
      guildName: guildName.trim() || undefined,
      guildRecruit: guildRecruit.trim() || undefined,
      guildContact: guildContact.trim() || undefined,
    }
    if (isEdit) {
      updateAuthor.mutate(
        { id: editing!.id, patch: body },
        { onSuccess: () => onDone(), onError: onGuard },
      )
    } else {
      createAuthor.mutate(body, {
        onSuccess: () => resetForm(),
        onError: onGuard,
      })
    }
  }

  return (
    <motion.form
      className="ps-admin__form glass"
      onSubmit={handleSubmit}
      variants={reduce ? undefined : staggerContainer}
      initial="hidden"
      animate="show"
      noValidate
    >
      <motion.div
        className="ps-admin__form-head"
        variants={reduce ? undefined : staggerItem}
      >
        <SectionHeading
          eyebrow={isEdit ? '编辑作者' : '新增作者'}
          title={isEdit ? `编辑「${editing!.name}」` : '新增一位作者'}
          size="h2"
        />
        {isEdit && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            取消编辑
          </Button>
        )}
      </motion.div>

      {/* 昵称 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-af-name">
          昵称
        </label>
        <input
          id="ps-af-name"
          className="ps-admin__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="作者昵称"
          maxLength={40}
        />
      </motion.div>

      {/* 简介 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-af-bio">
          简介（可空）
        </label>
        <input
          id="ps-af-bio"
          className="ps-admin__input"
          type="text"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="一句话介绍这位作者"
          maxLength={120}
        />
      </motion.div>

      {/* 公会名 + 联系方式 */}
      <motion.div className="ps-admin__row-grid" variants={reduce ? undefined : staggerItem}>
        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-af-guild">
            公会名（可空）
          </label>
          <input
            id="ps-af-guild"
            className="ps-admin__input"
            type="text"
            value={guildName}
            onChange={(e) => setGuildName(e.target.value)}
            placeholder="填了才在作者页渲染引流卡"
            maxLength={40}
          />
        </div>
        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-af-contact">
            联系方式（可空）
          </label>
          <input
            id="ps-af-contact"
            className="ps-admin__input"
            type="text"
            value={guildContact}
            onChange={(e) => setGuildContact(e.target.value)}
            placeholder="如 QQ 群号 / 联系人"
            maxLength={60}
          />
        </div>
      </motion.div>

      {/* 招募说明 */}
      <motion.div className="ps-admin__field" variants={reduce ? undefined : staggerItem}>
        <label className="ps-admin__label" htmlFor="ps-af-recruit">
          招募说明（可空）
        </label>
        <input
          id="ps-af-recruit"
          className="ps-admin__input"
          type="text"
          value={guildRecruit}
          onChange={(e) => setGuildRecruit(e.target.value)}
          placeholder="如 招募治疗与输出，长期稳定开荒"
          maxLength={120}
        />
      </motion.div>

      {error && (
        <motion.p
          className="ps-admin__error"
          role="alert"
          variants={reduce ? undefined : staggerItem}
        >
          {(error as Error)?.message ?? (isEdit ? '保存失败，请重试。' : '新增失败，请重试。')}
        </motion.p>
      )}

      <motion.div className="ps-admin__actions" variants={reduce ? undefined : staggerItem}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {pending
            ? isEdit
              ? '保存中…'
              : '提交中…'
            : isEdit
              ? '保存修改'
              : '新增作者'}
        </Button>
      </motion.div>
    </motion.form>
  )
}

/* ============================================================
   列表加载骨架（表单块 + 几行卡片占位）
   ============================================================ */
function ListSkeleton() {
  return (
    <div className="ps-admin__section" role="status" aria-busy="true" aria-label="正在加载">
      <div className="ps-admin__form glass" aria-hidden="true">
        <Skeleton shape="line" width={120} height={12} />
        <Skeleton shape="line" width="50%" height={28} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ps-admin__sk-field">
            <Skeleton shape="line" width={72} height={14} />
            <Skeleton shape="block" height={46} />
          </div>
        ))}
        <Skeleton shape="block" width={160} height={46} className="ps-admin__sk-btn" />
      </div>
      <div className="ps-admin__rows" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ps-admin__row-card glass">
            <div className="ps-admin__row-main">
              <Skeleton shape="line" width="40%" height={18} />
              <Skeleton shape="line" width="60%" height={14} />
              <Skeleton shape="line" width="30%" height={14} />
            </div>
            <Skeleton shape="block" width={120} height={36} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   下拉箭头（select 右侧装饰）
   Icon 集合无向下 chevron，select 专用 inline SVG，currentColor 描边。
   ============================================================ */
function SelectChevron() {
  return (
    <svg
      className="ps-admin__chevron"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
