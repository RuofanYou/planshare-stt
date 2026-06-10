import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  useCreateCreatorBoard,
  useCreatorBoards,
  useCreatorLogin,
  useCreatorMe,
  useCreatorSession,
  useCreatorSubmissions,
  useDeleteCreatorBoard,
  useRaid,
  useRaids,
  useUpdateCreatorBoard,
  useUpdateCreatorPassword,
  useUpdateCreatorProfile,
} from '../api/hooks'
import { fadeUp, staggerContainer, staggerItem } from '../lib/motion'
import { Avatar, Button, EmptyState, GlassCard, SectionHeading, Skeleton, Tag } from '../components/ui'
import type { Author, CreatorBoard, CreatorSubmission, CreatorUser, Difficulty } from '../data/types'
import './Creator.css'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

export default function Creator() {
  const reduce = useReducedMotion()
  const session = useCreatorSession()
  const meQuery = useCreatorMe(session.isAuthed)

  useEffect(() => {
    if (meQuery.isError && session.isUnauthorized(meQuery.error)) {
      session.logout()
    }
  }, [meQuery.error, meQuery.isError, session])

  if (!session.isAuthed) {
    return <CreatorLogin reduce={!!reduce} onLogin={session.login} />
  }

  if (meQuery.isPending) {
    return <CreatorSkeleton />
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="container ps-creator">
        <EmptyState
          icon="error"
          text={(meQuery.error as Error | undefined)?.message ?? '创作者身份加载失败。'}
          actionLabel="重新登录"
          onAction={session.logout}
        />
      </div>
    )
  }

  return (
    <CreatorConsole
      reduce={!!reduce}
      user={meQuery.data.user}
      author={meQuery.data.author}
      onLogout={session.logout}
    />
  )
}

function CreatorLogin({ reduce, onLogin }: { reduce: boolean; onLogin: (token: string) => void }) {
  const loginMutation = useCreatorLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const busy = loginMutation.isPending

  function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    loginMutation.mutate(
      { username: username.trim().toLowerCase(), password },
      {
        onSuccess: (result) => onLogin(result.token),
      },
    )
  }

  return (
    <div className="container ps-creator ps-creator--login">
      <motion.div
        className="ps-creator__login-wrap"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <GlassCard tone="glass-strong" className="ps-creator__login-card">
          <Tag variant="gold">创作者</Tag>
          <SectionHeading eyebrow="Creator Portal" title="创作者后台" as="h1" size="display" />
          <p className="ps-creator__lead">
            使用申请创作者时设置的用户名和密码登录。忘记密码请联系管理员重置。
          </p>
          <form className="ps-creator__form" onSubmit={submitLogin}>
            <label className="ps-creator__label" htmlFor="creator-username">用户名</label>
            <input
              id="creator-username"
              className="ps-creator__input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
            />
            <label className="ps-creator__label" htmlFor="creator-password">密码</label>
            <input
              id="creator-password"
              className="ps-creator__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {loginMutation.error && (
              <p className="ps-creator__error" role="alert">
                {(loginMutation.error as Error).message}
              </p>
            )}
            <p className="ps-creator__notice">
              首次投稿需要审核；成为正式创作者后可直接发布和维护自己的战术板。
            </p>
            <div className="ps-creator__actions">
              <Button type="submit" variant="primary" disabled={busy || !username.trim() || !password}>
                {loginMutation.isPending ? '登录中…' : '登录'}
              </Button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  )
}

function CreatorConsole({
  reduce,
  user,
  author,
  onLogout,
}: {
  reduce: boolean
  user: CreatorUser
  author: Author | null
  onLogout: () => void
}) {
  const displayName = author?.name || user.username || '创作者'
  const trustLevel = user.trustLevel ?? 'trusted'
  const approvedSubmissionCount = user.approvedSubmissionCount ?? (trustLevel === 'trusted' ? 3 : 0)
  const canDirectPublish = author?.visibility === 'approved' && trustLevel === 'trusted'
  const needsReview = author?.visibility === 'approved' && trustLevel !== 'trusted'

  return (
    <div className="container ps-creator">
      <motion.header
        className="ps-creator__head"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <SectionHeading eyebrow="创作者" title="后台" as="h1" size="display" />
        <Button variant="secondary" size="sm" onClick={onLogout}>
          退出登录
        </Button>
      </motion.header>

      {canDirectPublish && (
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <CreatorBoardManager />
        </motion.div>
      )}

      <motion.div
        className="ps-creator__grid"
        variants={reduce ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={reduce ? undefined : staggerItem}>
          <GlassCard tone="glass-strong" className="ps-creator__profile">
            <Avatar name={displayName} size={72} />
            <div className="ps-creator__profile-main">
              <p className="ps-creator__eyebrow">创作者账号</p>
              <h2 className="ps-creator__name">{displayName}</h2>
              <p className="ps-creator__meta">
                {user.username} · {statusLabel(user.status)} · {visibilityLabel(author?.visibility)}
              </p>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={reduce ? undefined : staggerItem}>
          {author ? (
            <CreatorProfileEditor author={author} />
          ) : (
            <GlassCard tone="glass" className="ps-creator__panel">
              <Tag variant="gold">待申请</Tag>
              <h2 className="ps-creator__panel-title">还没有作者主页</h2>
              <p className="ps-creator__panel-copy">先通过投稿申请创作者，账号会立即创建，投稿仍需审核。</p>
              <div className="ps-creator__actions">
                <Button variant="primary" to="/submit">
                  去投稿
                </Button>
              </div>
            </GlassCard>
          )}
        </motion.div>

        <motion.div variants={reduce ? undefined : staggerItem}>
          <CreatorSecurityPanel />
        </motion.div>
      </motion.div>

      {author && (
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <CreatorSubmissionTracker />
        </motion.div>
      )}

      {author && author.visibility !== 'approved' && (
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <GlassCard tone="glass" className="ps-creator__panel">
            <Tag variant="gold">等待审核</Tag>
            <h2 className="ps-creator__panel-title">战术板通过后可自助发布</h2>
            <p className="ps-creator__panel-copy">
              你的作者主页当前还不是正式状态。前 3 个战术板通过审核后，这里会开放直发、编辑、下架和恢复发布。
            </p>
          </GlassCard>
        </motion.div>
      )}

      {needsReview && (
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <GlassCard tone="glass" className="ps-creator__panel">
            <Tag variant="gold">审核期</Tag>
            <h2 className="ps-creator__panel-title">还需 {Math.max(0, 3 - approvedSubmissionCount)} 次审核通过</h2>
            <p className="ps-creator__panel-copy">
              你已经是正式作者主页，但账号还在新创作者审核期。继续从投稿入口提交战术板，累计 3 次通过后会自动开放直发。
            </p>
            <div className="ps-creator__actions">
              <Button variant="primary" to="/submit">
                继续投稿
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}

function CreatorSecurityPanel() {
  const updatePassword = useUpdateCreatorPassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const canSubmit =
    currentPassword.length > 0 &&
    nextPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    !updatePassword.isPending

  function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    if (nextPassword !== confirmPassword) {
      setLocalError('两次新密码不一致。')
      return
    }
    updatePassword.mutate(
      { currentPassword, nextPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNextPassword('')
          setConfirmPassword('')
        },
      },
    )
  }

  return (
    <GlassCard tone="glass" className="ps-creator__panel">
      <Tag variant="gold">账号安全</Tag>
      <h2 className="ps-creator__panel-title">修改密码</h2>
      <p className="ps-creator__panel-copy">
        输入当前密码后设置至少 8 位新密码；当前窗口会继续保持登录，其他旧登录会被撤销。
      </p>
      <form className="ps-creator__form" onSubmit={submitPassword}>
        <label className="ps-creator__label" htmlFor="creator-current-password">当前密码</label>
        <input
          id="creator-current-password"
          className="ps-creator__input"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <label className="ps-creator__label" htmlFor="creator-next-password">新密码</label>
        <input
          id="creator-next-password"
          className="ps-creator__input"
          type="password"
          autoComplete="new-password"
          value={nextPassword}
          onChange={(e) => setNextPassword(e.target.value)}
        />
        <label className="ps-creator__label" htmlFor="creator-confirm-password">确认新密码</label>
        <input
          id="creator-confirm-password"
          className="ps-creator__input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {(localError || updatePassword.error) && (
          <p className="ps-creator__error" role="alert">
            {localError || (updatePassword.error as Error).message}
          </p>
        )}
        {updatePassword.isSuccess && <p className="ps-creator__notice">密码已更新。</p>}
        <div className="ps-creator__actions">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {updatePassword.isPending ? '更新中…' : '更新密码'}
          </Button>
        </div>
      </form>
    </GlassCard>
  )
}

function CreatorSubmissionTracker() {
  const submissionsQuery = useCreatorSubmissions(true)
  const submissions = submissionsQuery.data ?? []

  return (
    <GlassCard tone="glass" className="ps-creator__panel ps-creator__submissions">
      <div className="ps-creator__section-head">
        <div>
          <Tag variant="gold">审核状态</Tag>
          <h2 className="ps-creator__panel-title">投稿进度</h2>
        </div>
        <Button variant="secondary" to="/submit">
          继续投稿
        </Button>
      </div>
      {submissionsQuery.isPending && <Skeleton shape="line" width="100%" height={56} />}
      {submissionsQuery.isError && (
        <p className="ps-creator__error" role="alert">
          {(submissionsQuery.error as Error).message}
        </p>
      )}
      {!submissionsQuery.isPending && !submissionsQuery.isError && submissions.length === 0 && (
        <p className="ps-creator__panel-copy">还没有投稿记录。提交后可以在这里看审核结果。</p>
      )}
      {submissions.length > 0 && (
        <div className="ps-creator__submission-list">
          {submissions.map((submission) => (
            <CreatorSubmissionItem key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function CreatorSubmissionItem({ submission }: { submission: CreatorSubmission }) {
  const status = submissionStatusMeta(submission)

  return (
    <article className="ps-creator__submission">
      <div className="ps-creator__submission-top">
        <div>
          <h3 className="ps-creator__submission-title">{submission.title}</h3>
          <p className="ps-creator__meta">
            {status.copy} · {formatShortDate(submission.reviewedAt ?? submission.createdAt)}
          </p>
        </div>
        <Tag variant={status.tone}>{status.label}</Tag>
      </div>
      {(submission.reviewNote || submission.spamReason) && (
        <p className="ps-creator__submission-note">
          {submission.reviewNote ? `管理员备注：${submission.reviewNote}` : `系统拦截：${spamReasonLabel(submission.spamReason)}`}
        </p>
      )}
      <div className="ps-creator__actions">
        {submission.boardId && (
          <Button variant="secondary" size="sm" to={`/board/${submission.boardId}`}>
            查看公开板
          </Button>
        )}
        {submission.status === 'rejected' && (
          <Button variant="secondary" size="sm" to="/submit">
            修改后重投
          </Button>
        )}
      </div>
    </article>
  )
}

function CreatorProfileEditor({ author }: { author: Author }) {
  const updateProfile = useUpdateCreatorProfile()
  const [name, setName] = useState(author.name)
  const [bio, setBio] = useState(author.bio ?? '')
  const [guildName, setGuildName] = useState(author.guildName ?? '')
  const [guildRecruit, setGuildRecruit] = useState(author.guildRecruit ?? '')
  const [guildContact, setGuildContact] = useState(author.guildContact ?? '')

  useEffect(() => {
    setName(author.name)
    setBio(author.bio ?? '')
    setGuildName(author.guildName ?? '')
    setGuildRecruit(author.guildRecruit ?? '')
    setGuildContact(author.guildContact ?? '')
  }, [author])

  function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    updateProfile.mutate({
      name: name.trim(),
      bio: bio.trim() || undefined,
      guildName: guildName.trim() || undefined,
      guildRecruit: guildRecruit.trim() || undefined,
      guildContact: guildContact.trim() || undefined,
    })
  }

  return (
    <GlassCard tone="glass" className="ps-creator__panel">
      <Tag variant="gold">{visibilityLabel(author.visibility)}</Tag>
      <h2 className="ps-creator__panel-title">作者主页资料</h2>
      <p className="ps-creator__panel-copy">
        {author.visibility === 'approved'
          ? '资料会展示在作者主页；上方可直接发布和维护你的战术板。'
          : '资料可半公开展示；首个战术板通过审核后会开放直接发布。'}
      </p>
      <form className="ps-creator__form" onSubmit={submitProfile}>
        <label className="ps-creator__label" htmlFor="creator-name">作者名</label>
        <input id="creator-name" className="ps-creator__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <label className="ps-creator__label" htmlFor="creator-bio">简介</label>
        <input id="creator-bio" className="ps-creator__input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} />
        <label className="ps-creator__label" htmlFor="creator-guild">公会名</label>
        <input id="creator-guild" className="ps-creator__input" value={guildName} onChange={(e) => setGuildName(e.target.value)} maxLength={40} />
        <label className="ps-creator__label" htmlFor="creator-contact">公会联系方式</label>
        <input id="creator-contact" className="ps-creator__input" value={guildContact} onChange={(e) => setGuildContact(e.target.value)} maxLength={80} />
        <label className="ps-creator__label" htmlFor="creator-recruit">招募说明</label>
        <input id="creator-recruit" className="ps-creator__input" value={guildRecruit} onChange={(e) => setGuildRecruit(e.target.value)} maxLength={120} />
        {updateProfile.error && (
          <p className="ps-creator__error" role="alert">
            {(updateProfile.error as Error).message}
          </p>
        )}
        {updateProfile.isSuccess && <p className="ps-creator__notice">资料已保存。</p>}
        <div className="ps-creator__actions">
          <Button type="submit" variant="primary" disabled={updateProfile.isPending || !name.trim()}>
            {updateProfile.isPending ? '保存中…' : '保存资料'}
          </Button>
          <Button variant="secondary" to={`/author/${author.id}`}>
            查看主页
          </Button>
        </div>
      </form>
    </GlassCard>
  )
}

function CreatorBoardManager() {
  const boardsQuery = useCreatorBoards(true)
  const createBoard = useCreateCreatorBoard()
  const raidsQuery = useRaids()
  const [title, setTitle] = useState('')
  const [raidId, setRaidId] = useState('')
  const [bossId, setBossId] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('mythic')
  const [description, setDescription] = useState('')
  const [contentText, setContentText] = useState('')

  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []
  const canCreate =
    title.trim() !== '' &&
    raidId !== '' &&
    bossId !== '' &&
    contentText.trim() !== '' &&
    !createBoard.isPending

  function handleRaidChange(nextRaidId: string) {
    setRaidId(nextRaidId)
    setBossId('')
  }

  function resetCreateForm() {
    setTitle('')
    setRaidId('')
    setBossId('')
    setDifficulty('mythic')
    setDescription('')
    setContentText('')
  }

  function submitBoard(e: React.FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    createBoard.mutate(
      {
        title: title.trim(),
        raidId,
        bossId,
        difficulty,
        seasonVersion: raidsQuery.data?.find((raid) => raid.id === raidId)?.patch ?? '',
        description: description.trim(),
        contentText,
      },
      { onSuccess: resetCreateForm },
    )
  }

  return (
    <GlassCard tone="glass" className="ps-creator__panel ps-creator__boards">
      <div className="ps-creator__section-head">
        <div>
          <Tag variant="gold">快速发布</Tag>
          <h2 className="ps-creator__panel-title">我的战术板</h2>
        </div>
        <Button variant="secondary" to="/submit">
          游客投稿页
        </Button>
      </div>

      <form className="ps-creator__form ps-creator__board-form" onSubmit={submitBoard}>
        <div className="ps-creator__field-grid">
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor="creator-board-title">标题</label>
            <input
              id="creator-board-title"
              className="ps-creator__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor="creator-board-raid">团本</label>
            <select
              id="creator-board-raid"
              className="ps-creator__input"
              value={raidId}
              onChange={(e) => handleRaidChange(e.target.value)}
              disabled={raidsQuery.isLoading}
            >
              <option value="">{raidsQuery.isLoading ? '加载中…' : '选择团本'}</option>
              {(raidsQuery.data ?? []).map((raid) => (
                <option key={raid.id} value={raid.id}>
                  {raid.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor="creator-board-boss">BOSS</label>
            <select
              id="creator-board-boss"
              className="ps-creator__input"
              value={bossId}
              onChange={(e) => setBossId(e.target.value)}
              disabled={!raidId || raidDetailQuery.isLoading}
            >
              <option value="">{!raidId ? '先选团本' : '选择 BOSS'}</option>
              {bosses.map((boss) => (
                <option key={boss.id} value={boss.id}>
                  {boss.order}. {boss.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor="creator-board-difficulty">难度</label>
            <select
              id="creator-board-difficulty"
              className="ps-creator__input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ps-creator__field">
          <label className="ps-creator__label" htmlFor="creator-board-description">简介</label>
          <input
            id="creator-board-description"
            className="ps-creator__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="ps-creator__field">
          <label className="ps-creator__label" htmlFor="creator-board-content">战术正文</label>
          <textarea
            id="creator-board-content"
            className="ps-creator__input ps-creator__textarea"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={8}
          />
        </div>
        {createBoard.error && (
          <p className="ps-creator__error" role="alert">
            {(createBoard.error as Error).message}
          </p>
        )}
        {createBoard.isSuccess && <p className="ps-creator__notice">战术板已发布。</p>}
        <div className="ps-creator__actions">
          <Button type="submit" variant="primary" disabled={!canCreate}>
            {createBoard.isPending ? '发布中…' : '直接发布'}
          </Button>
        </div>
      </form>

      <div className="ps-creator__board-list">
        {boardsQuery.isPending && <Skeleton shape="line" width="100%" height={56} />}
        {boardsQuery.isError && (
          <p className="ps-creator__error" role="alert">
            {(boardsQuery.error as Error).message}
          </p>
        )}
        {!boardsQuery.isPending && !boardsQuery.isError && (boardsQuery.data ?? []).length === 0 && (
          <p className="ps-creator__panel-copy">还没有已发布战术板。</p>
        )}
        {(boardsQuery.data ?? []).map((board) => (
          <CreatorBoardItem key={board.id} board={board} />
        ))}
      </div>
    </GlassCard>
  )
}

function CreatorBoardItem({ board }: { board: CreatorBoard }) {
  const updateBoard = useUpdateCreatorBoard()
  const deleteBoard = useDeleteCreatorBoard()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(board.title)
  const [description, setDescription] = useState(board.description)
  const [contentText, setContentText] = useState(board.contentText)

  useEffect(() => {
    if (editing) return
    setTitle(board.title)
    setDescription(board.description)
    setContentText(board.contentText)
  }, [board, editing])

  function saveBoard(e: React.FormEvent) {
    e.preventDefault()
    updateBoard.mutate(
      {
        id: board.id,
        patch: {
          title: title.trim(),
          description: description.trim(),
          contentText,
        },
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  function hideBoard() {
    if (!window.confirm('确定下架这个战术板？下架后不会公开展示，但可以随时恢复发布。')) return
    deleteBoard.mutate(board.id)
  }

  return (
    <article className="ps-creator__board">
      <div className="ps-creator__board-top">
        <div>
          <h3 className="ps-creator__board-title">{board.title}</h3>
          <p className="ps-creator__meta">
            {board.isHidden ? '已下架' : '已发布'} · {board.updatedAt}
          </p>
        </div>
        <Tag variant={board.isHidden ? 'neutral' : 'gold'}>{board.isHidden ? '下架' : '公开'}</Tag>
      </div>

      {editing ? (
        <form className="ps-creator__form" onSubmit={saveBoard}>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor={`creator-edit-title-${board.id}`}>标题</label>
            <input
              id={`creator-edit-title-${board.id}`}
              className="ps-creator__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor={`creator-edit-description-${board.id}`}>简介</label>
            <input
              id={`creator-edit-description-${board.id}`}
              className="ps-creator__input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="ps-creator__field">
            <label className="ps-creator__label" htmlFor={`creator-edit-content-${board.id}`}>战术正文</label>
            <textarea
              id={`creator-edit-content-${board.id}`}
              className="ps-creator__input ps-creator__textarea"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={8}
            />
          </div>
          {updateBoard.error && (
            <p className="ps-creator__error" role="alert">
              {(updateBoard.error as Error).message}
            </p>
          )}
          <div className="ps-creator__actions">
            <Button type="submit" variant="primary" disabled={updateBoard.isPending || !title.trim() || !contentText.trim()}>
              {updateBoard.isPending ? '保存中…' : '保存修改'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="ps-creator__panel-copy">{board.description || '无简介'}</p>
          <div className="ps-creator__actions">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              编辑
            </Button>
            {board.isHidden ? (
              <Button
                variant="primary"
                onClick={() => updateBoard.mutate({ id: board.id, patch: { isHidden: false } })}
                disabled={updateBoard.isPending}
              >
                {updateBoard.isPending ? '恢复中…' : '恢复发布'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" to={`/board/${board.id}`}>
                  查看
                </Button>
                <Button
                  variant="secondary"
                  onClick={hideBoard}
                  disabled={deleteBoard.isPending}
                >
                  {deleteBoard.isPending ? '下架中…' : '下架'}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </article>
  )
}

function statusLabel(status?: CreatorUser['status']) {
  if (status === 'active') return '可登录'
  if (status === 'suspended') return '已冻结'
  return '未知状态'
}

function visibilityLabel(visibility?: Author['visibility']) {
  if (visibility === 'approved') return '正式创作者'
  if (visibility === 'hidden') return '已隐藏'
  if (visibility === 'draft') return '草稿'
  return '半公开主页'
}

function submissionStatusMeta(submission: CreatorSubmission): {
  label: string
  copy: string
  tone: 'gold' | 'neutral'
} {
  if (submission.status === 'approved') return { label: '已通过', copy: '已发布到公开站', tone: 'gold' }
  if (submission.status === 'rejected') return { label: '未通过', copy: '需要修改后重投', tone: 'neutral' }
  if (submission.status === 'spam') return { label: '被拦截', copy: '没有进入人工审核', tone: 'neutral' }
  return { label: '待审核', copy: '管理员审核中', tone: 'gold' }
}

function spamReasonLabel(reason?: string) {
  if (reason === 'honeypot') return '表单异常'
  if (reason === 'duplicate_content') return '同一网络下重复正文'
  if (reason) return reason
  return '内容风险'
}

function formatShortDate(value?: string) {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function CreatorSkeleton() {
  return (
    <div className="container ps-creator" role="status" aria-busy="true" aria-label="正在加载创作者后台">
      <div className="ps-creator__head" aria-hidden="true">
        <Skeleton shape="line" width={180} height={40} />
        <Skeleton shape="line" width={88} height={36} />
      </div>
      <div className="ps-creator__grid" aria-hidden="true">
        <div className="ps-creator__profile glass-strong">
          <Skeleton shape="circle" width={72} height={72} />
          <div className="ps-creator__profile-main">
            <Skeleton shape="line" width={80} height={12} />
            <Skeleton shape="line" width={160} height={28} />
            <Skeleton shape="line" width={120} height={14} />
          </div>
        </div>
        <div className="ps-creator__panel glass">
          <Skeleton shape="line" width={88} height={24} />
          <Skeleton shape="line" width={200} height={30} />
          <Skeleton shape="line" width="100%" height={16} />
          <Skeleton shape="line" width="70%" height={16} />
        </div>
      </div>
    </div>
  )
}
