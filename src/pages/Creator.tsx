import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  useWithdrawCreatorSubmission,
} from '../api/hooks'
import { fadeUp, staggerContainer, staggerItem } from '../lib/motion'
import { copyToClipboard } from '../lib/clipboard'
import { Avatar, Button, EmptyState, GlassCard, SectionHeading, Skeleton, Tag } from '../components/ui'
import type { Author, CreatorBoard, CreatorSubmission, CreatorUser, Difficulty } from '../data/types'
import './Creator.css'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

const SUBMIT_DRAFT_KEY = 'planshare_submit_draft_v1'

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
              <Button variant="secondary" to="/submit">
                没有账号？去投稿申请创作者
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
          <CreatorBoardManager creatorId={user.id} />
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
  const passwordMismatch =
    nextPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    nextPassword !== confirmPassword

  const canSubmit =
    currentPassword.length > 0 &&
    nextPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    !passwordMismatch &&
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
          onChange={(e) => {
            setCurrentPassword(e.target.value)
            setLocalError('')
          }}
        />
        <label className="ps-creator__label" htmlFor="creator-next-password">新密码</label>
        <input
          id="creator-next-password"
          className="ps-creator__input"
          type="password"
          autoComplete="new-password"
          value={nextPassword}
          onChange={(e) => {
            setNextPassword(e.target.value)
            setLocalError('')
          }}
        />
        <label className="ps-creator__label" htmlFor="creator-confirm-password">确认新密码</label>
        <input
          id="creator-confirm-password"
          className="ps-creator__input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            setLocalError('')
          }}
        />
        {(passwordMismatch || localError || updatePassword.error) && (
          <p className="ps-creator__error" role="alert">
            {passwordMismatch ? '两次新密码不一致。' : localError || (updatePassword.error as Error).message}
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
  const withdrawSubmission = useWithdrawCreatorSubmission()
  const navigate = useNavigate()

  function withdraw() {
    if (!window.confirm('确定撤回这条待审投稿？撤回后管理员不会再审核它。')) return
    withdrawSubmission.mutate(submission.id)
  }

  function retrySubmission() {
    try {
      window.localStorage.setItem(
        SUBMIT_DRAFT_KEY,
        JSON.stringify({
          title: submission.title,
          raidId: submission.raidId,
          bossId: submission.bossId ?? '',
          difficulty: submission.difficulty,
          description: submission.description,
          contentText: submission.contentText,
          submitterName: submission.submitterName,
          wantsCreatorProfile: false,
          creatorUsername: '',
          creatorBio: '',
          creatorGuildName: '',
          creatorGuildRecruit: '',
          creatorGuildContact: '',
        }),
      )
    } catch {
      // localStorage 不可用时仍允许跳转，用户可以手动填写。
    }
    navigate('/submit')
  }

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
        {(submission.status === 'rejected' || submission.status === 'withdrawn') && (
          <Button variant="secondary" size="sm" onClick={retrySubmission}>
            修改后重投
          </Button>
        )}
        {submission.status === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={withdraw}
            disabled={withdrawSubmission.isPending}
          >
            {withdrawSubmission.isPending ? '撤回中…' : '撤回投稿'}
          </Button>
        )}
      </div>
      {withdrawSubmission.error && (
        <p className="ps-creator__error" role="alert">
          {(withdrawSubmission.error as Error).message}
        </p>
      )}
    </article>
  )
}

const CREATOR_PROFILE_DRAFT_KEY_PREFIX = 'planshare_creator_profile_draft_v1'

interface CreatorProfileDraft {
  name: string
  bio: string
  guildName: string
  guildRecruit: string
  guildContact: string
}

function creatorProfileDraftKey(authorId: string) {
  return `${CREATOR_PROFILE_DRAFT_KEY_PREFIX}:${authorId}`
}

function currentAuthorProfileDraft(author: Author): CreatorProfileDraft {
  return {
    name: author.name,
    bio: author.bio ?? '',
    guildName: author.guildName ?? '',
    guildRecruit: author.guildRecruit ?? '',
    guildContact: author.guildContact ?? '',
  }
}

function readCreatorProfileDraft(author: Author): CreatorProfileDraft {
  const current = currentAuthorProfileDraft(author)
  if (typeof window === 'undefined') return current
  try {
    const raw = window.localStorage.getItem(creatorProfileDraftKey(author.id))
    if (!raw) return current
    const parsed = JSON.parse(raw) as Partial<CreatorProfileDraft>
    return {
      name: typeof parsed.name === 'string' ? parsed.name : current.name,
      bio: typeof parsed.bio === 'string' ? parsed.bio : current.bio,
      guildName: typeof parsed.guildName === 'string' ? parsed.guildName : current.guildName,
      guildRecruit: typeof parsed.guildRecruit === 'string' ? parsed.guildRecruit : current.guildRecruit,
      guildContact: typeof parsed.guildContact === 'string' ? parsed.guildContact : current.guildContact,
    }
  } catch {
    return current
  }
}

function hasCreatorProfileDraftContent(author: Author, draft: CreatorProfileDraft) {
  const current = currentAuthorProfileDraft(author)
  return (
    draft.name !== current.name ||
    draft.bio !== current.bio ||
    draft.guildName !== current.guildName ||
    draft.guildRecruit !== current.guildRecruit ||
    draft.guildContact !== current.guildContact
  )
}

function writeCreatorProfileDraft(author: Author, draft: CreatorProfileDraft) {
  if (typeof window === 'undefined') return
  try {
    const key = creatorProfileDraftKey(author.id)
    if (hasCreatorProfileDraftContent(author, draft)) {
      window.localStorage.setItem(key, JSON.stringify(draft))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage 不可用时忽略；资料保存本身不依赖草稿。
  }
}

function clearCreatorProfileDraft(authorId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(creatorProfileDraftKey(authorId))
  } catch {
    // 忽略本地存储异常。
  }
}

function CreatorProfileEditor({ author }: { author: Author }) {
  const updateProfile = useUpdateCreatorProfile()
  const [initialDraft] = useState(() => readCreatorProfileDraft(author))
  const [name, setName] = useState(initialDraft.name)
  const [bio, setBio] = useState(initialDraft.bio)
  const [guildName, setGuildName] = useState(initialDraft.guildName)
  const [guildRecruit, setGuildRecruit] = useState(initialDraft.guildRecruit)
  const [guildContact, setGuildContact] = useState(initialDraft.guildContact)

  useEffect(() => {
    const draft = readCreatorProfileDraft(author)
    setName(draft.name)
    setBio(draft.bio)
    setGuildName(draft.guildName)
    setGuildRecruit(draft.guildRecruit)
    setGuildContact(draft.guildContact)
  }, [author])

  useEffect(() => {
    writeCreatorProfileDraft(author, { name, bio, guildName, guildRecruit, guildContact })
  }, [author, bio, guildContact, guildName, guildRecruit, name])

  function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    updateProfile.mutate(
      {
        name: name.trim(),
        bio: bio.trim() || undefined,
        guildName: guildName.trim() || undefined,
        guildRecruit: guildRecruit.trim() || undefined,
        guildContact: guildContact.trim() || undefined,
      },
      {
        onSuccess: () => clearCreatorProfileDraft(author.id),
      },
    )
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
      <p className="ps-creator__notice">资料草稿会自动保存在本机；保存成功后清空。</p>
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

const CREATOR_BOARD_DRAFT_KEY_PREFIX = 'planshare_creator_board_draft_v1'
const CREATOR_BOARD_EDIT_DRAFT_KEY_PREFIX = 'planshare_creator_board_edit_draft_v1'

interface CreatorBoardDraft {
  title: string
  raidId: string
  bossId: string
  difficulty: Difficulty
  description: string
  contentText: string
}

const EMPTY_CREATOR_BOARD_DRAFT: CreatorBoardDraft = {
  title: '',
  raidId: '',
  bossId: '',
  difficulty: 'mythic',
  description: '',
  contentText: '',
}

function creatorBoardDraftKey(creatorId: string) {
  return `${CREATOR_BOARD_DRAFT_KEY_PREFIX}:${creatorId}`
}

function readCreatorBoardDraft(creatorId: string): CreatorBoardDraft {
  if (typeof window === 'undefined') return EMPTY_CREATOR_BOARD_DRAFT
  try {
    const raw = window.localStorage.getItem(creatorBoardDraftKey(creatorId))
    if (!raw) return EMPTY_CREATOR_BOARD_DRAFT
    const parsed = JSON.parse(raw) as Partial<CreatorBoardDraft>
    return {
      ...EMPTY_CREATOR_BOARD_DRAFT,
      ...parsed,
      difficulty: parsed.difficulty === 'heroic' ? 'heroic' : 'mythic',
    }
  } catch {
    return EMPTY_CREATOR_BOARD_DRAFT
  }
}

function hasCreatorBoardDraftContent(draft: CreatorBoardDraft) {
  return Boolean(
    draft.title.trim() ||
      draft.raidId ||
      draft.bossId ||
      draft.description.trim() ||
      draft.contentText.trim(),
  )
}

function writeCreatorBoardDraft(creatorId: string, draft: CreatorBoardDraft) {
  if (typeof window === 'undefined') return
  try {
    const key = creatorBoardDraftKey(creatorId)
    if (hasCreatorBoardDraftContent(draft)) {
      window.localStorage.setItem(key, JSON.stringify(draft))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage 不可用时忽略；直接发布本身不依赖草稿。
  }
}

function clearCreatorBoardDraft(creatorId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(creatorBoardDraftKey(creatorId))
  } catch {
    // 忽略本地存储异常。
  }
}

interface CreatorBoardEditDraft {
  title: string
  description: string
  contentText: string
}

function creatorBoardEditDraftKey(boardId: string) {
  return `${CREATOR_BOARD_EDIT_DRAFT_KEY_PREFIX}:${boardId}`
}

function readCreatorBoardEditDraft(board: CreatorBoard): CreatorBoardEditDraft {
  if (typeof window === 'undefined') {
    return {
      title: board.title,
      description: board.description,
      contentText: board.contentText,
    }
  }
  try {
    const raw = window.localStorage.getItem(creatorBoardEditDraftKey(board.id))
    if (!raw) {
      return {
        title: board.title,
        description: board.description,
        contentText: board.contentText,
      }
    }
    const parsed = JSON.parse(raw) as Partial<CreatorBoardEditDraft>
    return {
      title: typeof parsed.title === 'string' ? parsed.title : board.title,
      description: typeof parsed.description === 'string' ? parsed.description : board.description,
      contentText: typeof parsed.contentText === 'string' ? parsed.contentText : board.contentText,
    }
  } catch {
    return {
      title: board.title,
      description: board.description,
      contentText: board.contentText,
    }
  }
}

function hasCreatorBoardEditDraftContent(board: CreatorBoard, draft: CreatorBoardEditDraft) {
  return (
    draft.title !== board.title ||
    draft.description !== board.description ||
    draft.contentText !== board.contentText
  )
}

function writeCreatorBoardEditDraft(board: CreatorBoard, draft: CreatorBoardEditDraft) {
  if (typeof window === 'undefined') return
  try {
    const key = creatorBoardEditDraftKey(board.id)
    if (hasCreatorBoardEditDraftContent(board, draft)) {
      window.localStorage.setItem(key, JSON.stringify(draft))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage 不可用时忽略；编辑保存本身不依赖草稿。
  }
}

function clearCreatorBoardEditDraft(boardId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(creatorBoardEditDraftKey(boardId))
  } catch {
    // 忽略本地存储异常。
  }
}

function CreatorBoardManager({ creatorId }: { creatorId: string }) {
  const boardsQuery = useCreatorBoards(true)
  const createBoard = useCreateCreatorBoard()
  const raidsQuery = useRaids()
  const [initialDraft] = useState(() => readCreatorBoardDraft(creatorId))
  const [title, setTitle] = useState(initialDraft.title)
  const [raidId, setRaidId] = useState(initialDraft.raidId)
  const [bossId, setBossId] = useState(initialDraft.bossId)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDraft.difficulty)
  const [description, setDescription] = useState(initialDraft.description)
  const [contentText, setContentText] = useState(initialDraft.contentText)

  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []
  const missingCreateItems = [
    title.trim() === '' ? '标题' : '',
    raidId === '' ? '团本' : '',
    bossId === '' ? 'BOSS' : '',
    contentText.trim() === '' ? '战术正文' : '',
  ].filter(Boolean)
  const canCreate = missingCreateItems.length === 0 && !createBoard.isPending
  const hasCreateFormContent = Boolean(
    title.trim() || raidId || bossId || description.trim() || contentText.trim(),
  )
  const createReadinessText =
    missingCreateItems.length > 0
      ? `还差：${missingCreateItems.join('、')}`
      : createBoard.isPending
        ? '正在发布，请稍候。'
        : '信息已补齐，可以直接发布。'

  useEffect(() => {
    writeCreatorBoardDraft(creatorId, {
      title,
      raidId,
      bossId,
      difficulty,
      description,
      contentText,
    })
  }, [bossId, contentText, creatorId, description, difficulty, raidId, title])

  function handleRaidChange(nextRaidId: string) {
    setRaidId(nextRaidId)
    setBossId('')
  }

  function resetCreateForm() {
    clearCreatorBoardDraft(creatorId)
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
          <p className="ps-creator__panel-copy">直发草稿会自动保存在本机；成功发布后清空。</p>
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
          <label className="ps-creator__label" htmlFor="creator-board-description">战术简介</label>
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
        {(!createBoard.isSuccess || hasCreateFormContent) && (
          <p className={canCreate ? 'ps-creator__ready is-ready' : 'ps-creator__ready'} role="status">
            {createReadinessText}
          </p>
        )}
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
  const [initialEditDraft] = useState(() => readCreatorBoardEditDraft(board))
  const [title, setTitle] = useState(initialEditDraft.title)
  const [description, setDescription] = useState(initialEditDraft.description)
  const [contentText, setContentText] = useState(initialEditDraft.contentText)
  const [copyNotice, setCopyNotice] = useState('')
  const missingEditItems = [
    title.trim() === '' ? '标题' : '',
    contentText.trim() === '' ? '战术正文' : '',
  ].filter(Boolean)
  const canSave = missingEditItems.length === 0 && !updateBoard.isPending
  const editReadinessText =
    missingEditItems.length > 0
      ? `还差：${missingEditItems.join('、')}`
      : updateBoard.isPending
        ? '正在保存，请稍候。'
        : '信息已补齐，可以保存修改。'

  useEffect(() => {
    if (editing) return
    const draft = readCreatorBoardEditDraft(board)
    setTitle(draft.title)
    setDescription(draft.description)
    setContentText(draft.contentText)
  }, [board, editing])

  useEffect(() => {
    if (!editing) return
    writeCreatorBoardEditDraft(board, { title, description, contentText })
  }, [board, contentText, description, editing, title])

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
      {
        onSuccess: () => {
          clearCreatorBoardEditDraft(board.id)
          setEditing(false)
        },
      },
    )
  }

  function hideBoard() {
    if (!window.confirm('确定下架这个战术板？下架后不会公开展示，但可以随时恢复发布。')) return
    deleteBoard.mutate(board.id)
  }

  async function copyBoardLink() {
    const origin = window.location.origin
    const copied = await copyToClipboard(`${origin}/board/${board.id}`)
    setCopyNotice(copied ? '链接已复制。' : '复制失败，请打开公开页后从地址栏复制。')
  }

  const hiddenByAdmin = board.isHidden && board.hiddenBy === 'admin'

  return (
    <article className="ps-creator__board">
      <div className="ps-creator__board-top">
        <div>
          <h3 className="ps-creator__board-title">{board.title}</h3>
          <p className="ps-creator__meta">
            {hiddenByAdmin ? '管理员隐藏' : board.isHidden ? '已下架' : '已发布'} · {board.updatedAt}
          </p>
        </div>
        <Tag variant={board.isHidden ? 'neutral' : 'gold'}>
          {hiddenByAdmin ? '管理员隐藏' : board.isHidden ? '下架' : '公开'}
        </Tag>
      </div>

      {editing ? (
        <form className="ps-creator__form" onSubmit={saveBoard}>
          <p className="ps-creator__notice">编辑草稿会自动保存在本机；保存成功后清空。</p>
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
            <label className="ps-creator__label" htmlFor={`creator-edit-description-${board.id}`}>战术简介</label>
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
          <p className={canSave ? 'ps-creator__ready is-ready' : 'ps-creator__ready'} role="status">
            {editReadinessText}
          </p>
          <div className="ps-creator__actions">
            <Button type="submit" variant="primary" disabled={!canSave}>
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
          {hiddenByAdmin && (
            <p className="ps-creator__notice">该战术板已被管理员隐藏，不能自行恢复发布。</p>
          )}
          {copyNotice && <p className="ps-creator__notice">{copyNotice}</p>}
          <div className="ps-creator__actions">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              编辑
            </Button>
            {hiddenByAdmin ? null : board.isHidden ? (
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
                  查看公开板
                </Button>
                <Button variant="secondary" leadingIcon="copy" onClick={() => void copyBoardLink()}>
                  复制链接
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
  if (submission.status === 'withdrawn') return { label: '已撤回', copy: '创作者已自行撤回', tone: 'neutral' }
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
