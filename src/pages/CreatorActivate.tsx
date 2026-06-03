import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useCreatorActivate, useCreatorResetPassword, useCreatorSession } from '../api/hooks'
import { fadeUp } from '../lib/motion'
import { Button, GlassCard, SectionHeading, Tag } from '../components/ui'
import './CreatorActivate.css'

export default function CreatorActivate({ mode = 'activate' }: { mode?: 'activate' | 'reset' }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const session = useCreatorSession()
  const activate = useCreatorActivate()
  const reset = useCreatorResetPassword()
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')
  const busy = activate.isPending || reset.isPending
  const error = localError || (activate.error as Error | undefined)?.message || (reset.error as Error | undefined)?.message

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    if (!token) {
      setLocalError('链接缺少 token，请重新发送邮件。')
      return
    }
    if (password.length < 8) {
      setLocalError('密码至少需要 8 位。')
      return
    }
    if (password !== confirm) {
      setLocalError('两次输入的密码不一致。')
      return
    }

    if (mode === 'activate') {
      activate.mutate(
        { token, password },
        {
          onSuccess: (result) => {
            session.login(result.token)
            navigate('/creator', { replace: true })
          },
        },
      )
      return
    }

    reset.mutate(
      { token, password },
      {
        onSuccess: () => navigate('/creator', { replace: true }),
      },
    )
  }

  return (
    <div className="container ps-creator-activate">
      <motion.div
        className="ps-creator-activate__wrap"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <GlassCard tone="glass-strong" className="ps-creator-activate__card">
          <Tag variant="gold">{mode === 'activate' ? '邮箱激活' : '重置密码'}</Tag>
          <SectionHeading
            eyebrow="Creator Account"
            title={mode === 'activate' ? '设置创作者密码' : '设置新密码'}
            as="h1"
            size="display"
          />
          <form className="ps-creator-activate__form" onSubmit={submit}>
            <label className="ps-creator-activate__label" htmlFor="creator-new-password">新密码</label>
            <input
              id="creator-new-password"
              className="ps-creator-activate__input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className="ps-creator-activate__label" htmlFor="creator-confirm-password">确认密码</label>
            <input
              id="creator-confirm-password"
              className="ps-creator-activate__input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {error && <p className="ps-creator-activate__error" role="alert">{error}</p>}
            <div className="ps-creator-activate__actions">
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? '提交中…' : mode === 'activate' ? '激活账号' : '重置密码'}
              </Button>
              <Button variant="secondary" to="/creator">
                返回登录
              </Button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  )
}
