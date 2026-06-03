import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getWechatLoginUrl } from '../api/client'
import { useCreatorMe, useCreatorSession } from '../api/hooks'
import { fadeUp, staggerContainer, staggerItem } from '../lib/motion'
import { Avatar, Button, EmptyState, GlassCard, SectionHeading, Skeleton, Tag } from '../components/ui'
import './Creator.css'

/**
 * 创作者后台 MVP —— /creator
 * 当前只承接微信扫码登录、身份确认和作者绑定状态展示。
 * 内容自助管理后续继续挂在这个页面，不把完整用户系统一次性做大。
 */
export default function Creator() {
  const reduce = useReducedMotion()
  const session = useCreatorSession()
  const meQuery = useCreatorMe(session.isAuthed)
  const { login, logout, isUnauthorized } = session

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('creator_token')
    if (!token) return
    login(token)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [login])

  useEffect(() => {
    if (meQuery.isError && isUnauthorized(meQuery.error)) {
      logout()
    }
  }, [isUnauthorized, logout, meQuery.error, meQuery.isError])

  if (!session.isAuthed) {
    return <CreatorLogin reduce={!!reduce} />
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

function CreatorLogin({ reduce }: { reduce: boolean }) {
  function handleWechatLogin() {
    window.location.assign(getWechatLoginUrl('/creator'))
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
          <SectionHeading
            eyebrow="Creator Portal"
            title="创作者后台"
            as="h1"
            size="display"
          />
          <p className="ps-creator__lead">使用微信身份进入，管理你的作者主页与投稿状态。</p>
          <Button variant="primary" onClick={handleWechatLogin}>
            微信扫码登录
          </Button>
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
  user: {
    nickname?: string
    avatarUrl?: string
    openid: string
    unionid?: string
  }
  author: {
    id: string
    name: string
    bio?: string
    avatarUrl?: string
  } | null
  onLogout: () => void
}) {
  const displayName = user.nickname || '微信用户'
  return (
    <div className="container ps-creator">
      <motion.header
        className="ps-creator__head"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <SectionHeading
          eyebrow="创作者"
          title="后台"
          as="h1"
          size="display"
        />
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
              <p className="ps-creator__eyebrow">微信身份</p>
              <h2 className="ps-creator__name">{displayName}</h2>
              <p className="ps-creator__meta">
                {user.unionid ? '已取得 UnionID' : `OpenID ${user.openid.slice(0, 8)}…`}
              </p>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={reduce ? undefined : staggerItem}>
          {author ? (
            <GlassCard tone="glass" className="ps-creator__panel">
              <Tag variant="gold">已绑定作者</Tag>
              <h2 className="ps-creator__panel-title">{author.name}</h2>
              {author.bio && <p className="ps-creator__panel-copy">{author.bio}</p>}
              <div className="ps-creator__actions">
                <Button variant="primary" to={`/author/${author.id}`}>
                  作者主页
                </Button>
                <Button variant="secondary" to="/submit">
                  提交新稿
                </Button>
              </div>
            </GlassCard>
          ) : (
            <GlassCard tone="glass" className="ps-creator__panel">
              <Tag variant="gold">待绑定作者</Tag>
              <h2 className="ps-creator__panel-title">还没有绑定作者主页</h2>
              <p className="ps-creator__panel-copy">
                先通过投稿申请创作者，审核通过后管理员会把作者主页绑定到这个微信身份。
              </p>
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
