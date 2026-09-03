import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp } from '../lib/motion'
import { Button, GlassCard, SectionHeading, Tag } from '../components/ui'
import './CreatorActivate.css'

export default function CreatorActivate() {
  const reduce = useReducedMotion()
  return (
    <div className="container ps-creator-activate">
      <motion.div
        className="ps-creator-activate__wrap"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <GlassCard tone="glass-strong" className="ps-creator-activate__card">
          <Tag variant="gold">创作者账号</Tag>
          <SectionHeading
            eyebrow="Creator Account"
            title="旧链接已停用"
            as="h1"
            size="display"
          />
          <p className="ps-creator-activate__error">
            创作者账号已改为用户名和密码登录。忘记密码请联系管理员重置。
          </p>
          <div className="ps-creator-activate__actions">
            <Button variant="primary" to="/creator">
              返回登录
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
