import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  useCreatorForgotPassword,
  useCreatorLogin,
  useCreatorMe,
  useCreatorResendActivation,
  useCreatorSession,
  useUpdateCreatorProfile,
} from '../api/hooks'
import { fadeUp, staggerContainer, staggerItem } from '../lib/motion'
import { Avatar, Button, EmptyState, GlassCard, SectionHeading, Skeleton, Tag } from '../components/ui'
import type { Author, CreatorUser } from '../data/types'
import './Creator.css'

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
  const resendActivation = useCreatorResendActivation()
  const forgotPassword = useCreatorForgotPassword()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const busy = loginMutation.isPending || resendActivation.isPending || forgotPassword.isPending

  function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (result) => onLogin(result.token),
      },
    )
  }

  function requestActivation() {
    setMessage('')
    resendActivation.mutate(email.trim(), {
      onSuccess: () => setMessage('如果邮箱存在待激活账号，激活邮件会重新发送。'),
    })
  }

  function requestReset() {
    setMessage('')
    forgotPassword.mutate(email.trim(), {
      onSuccess: () => setMessage('如果邮箱已激活，重置密码邮件会发送到该邮箱。'),
    })
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
            使用申请时填写的邮箱登录。申请创作者后会立即收到激活邮件，板子公开仍需审核。
          </p>
          <form className="ps-creator__form" onSubmit={submitLogin}>
            <label className="ps-creator__label" htmlFor="creator-email">邮箱</label>
            <input
              id="creator-email"
              className="ps-creator__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {message && <p className="ps-creator__notice">{message}</p>}
            <div className="ps-creator__actions">
              <Button type="submit" variant="primary" disabled={busy || !email.trim() || !password}>
                {loginMutation.isPending ? '登录中…' : '登录'}
              </Button>
              <Button type="button" variant="secondary" disabled={busy || !email.trim()} onClick={requestActivation}>
                重发激活邮件
              </Button>
              <Button type="button" variant="ghost" disabled={busy || !email.trim()} onClick={requestReset}>
                忘记密码
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
  const displayName = author?.name || user.email || '创作者'
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
              <p className="ps-creator__eyebrow">邮箱账号</p>
              <h2 className="ps-creator__name">{displayName}</h2>
              <p className="ps-creator__meta">
                {user.email} · {statusLabel(user.status)}
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
              <p className="ps-creator__panel-copy">先通过投稿申请创作者，系统会给你的邮箱发送激活邮件。</p>
              <div className="ps-creator__actions">
                <Button variant="primary" to="/submit">
                  去投稿
                </Button>
              </div>
            </GlassCard>
          )}
        </motion.div>
      </motion.div>
    </div>
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
        资料可半公开展示；战术板需要管理员审核通过后才会进入团本和 BOSS 页面。
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
          <Button variant="secondary" to="/submit">
            提交新稿
          </Button>
        </div>
      </form>
    </GlassCard>
  )
}

function statusLabel(status?: CreatorUser['status']) {
  if (status === 'active') return '已激活'
  if (status === 'suspended') return '已冻结'
  return '待激活'
}

function visibilityLabel(visibility?: Author['visibility']) {
  if (visibility === 'approved') return '正式创作者'
  if (visibility === 'hidden') return '已隐藏'
  if (visibility === 'draft') return '草稿'
  return '半公开主页'
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
