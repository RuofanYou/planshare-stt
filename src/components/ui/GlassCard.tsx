import type { ComponentType, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { HTMLMotionProps } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { To } from 'react-router-dom'
import { cardHover, dur, easeEpic } from '../../lib/motion'
import './GlassCard.css'

/** 渲染的语义元素（整卡可点时由内部 Link 承担，外壳仍可选语义标签）。 */
type GlassElement = 'div' | 'article' | 'li' | 'section'

export interface GlassCardProps {
  /** 玻璃强度：普通 .glass / 强版 .glass-strong（导航 / 引流卡 / 弹层级） */
  tone?: 'glass' | 'glass-strong'
  /** 语义标签，默认 div */
  as?: GlassElement
  /**
   * 交互态：开启后 hover 上浮(cardHover) + 金辉描边 + 斜向光扫(glassSweep)。
   * 默认 false（静态玻璃面板，如详情侧栏 / 引流卡外壳）。
   */
  interactive?: boolean
  /** 传了即把内容包进 react-router <Link>，整卡可点 */
  to?: To
  /** 链接无障碍标签（仅 to 存在时有意义） */
  ariaLabel?: string
  className?: string
  children?: ReactNode
}

/**
 * 语义元素 → motion 组件查找表（保留语义标签，又能驱动 hover 位移）。
 * 各标签的 motion props 互不兼容，故统一收敛为「接受通用 motion props」的组件类型，
 * 由外层只透传共用的 className / variants / whileHover 等，运行时按 as 选标签。
 */
type GlassMotion = ComponentType<HTMLMotionProps<'div'>>
const MOTION: Record<GlassElement, GlassMotion> = {
  div: motion.div,
  article: motion.article as GlassMotion,
  li: motion.li as GlassMotion,
  section: motion.section as GlassMotion,
}

/**
 * GlassCard —— 玻璃面板原语（.glass / .glass-strong 的组件化封装，整站唯一权威）。
 *
 * 用途：BoardCard / 团本入口卡 / Hero 浮卡 / GuildCard 外壳 / EmptyState 容器 /
 * 详情侧栏等所有玻璃 chrome，不再各写一套 background+blur+border+highlight+shadow。
 *
 * interactive=true 时复用 motion.ts 的 cardHover（上浮 + tap 缩放）与 glassSweep（斜向光扫），
 * 并由 CSS 在 hover 时叠金辉描边；reduce 时去掉位移与光扫，仅保留静态玻璃。
 */
export default function GlassCard({
  tone = 'glass',
  as = 'div',
  interactive = false,
  to,
  ariaLabel,
  className,
  children,
}: GlassCardProps) {
  const reduce = useReducedMotion()
  const Comp = MOTION[as]

  const cls = [
    'ps-glasscard',
    tone,
    interactive ? 'ps-glasscard--interactive' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  // 交互卡走 cardHover（hover 上浮 / tap 缩放）；静态卡不挂 variants。
  const motionProps =
    interactive && !reduce
      ? {
          variants: cardHover,
          initial: 'rest' as const,
          animate: 'rest' as const,
          whileHover: 'hover' as const,
          whileTap: 'tap' as const,
        }
      : {}

  // 斜向光扫层：仅交互卡 + 非 reduce 时挂载，由父级 whileHover 联动驱动。
  const sweep =
    interactive && !reduce ? (
      <motion.span
        className="ps-glasscard__sweep"
        aria-hidden="true"
        variants={{
          rest: { x: '-160%', opacity: 0 },
          hover: {
            x: '160%',
            opacity: [0, 0.9, 0],
            transition: { duration: dur.slow, ease: easeEpic },
          },
        }}
      />
    ) : null

  const inner = to ? (
    <Link to={to} className="ps-glasscard__link" aria-label={ariaLabel}>
      {children}
    </Link>
  ) : (
    children
  )

  return (
    <Comp className={cls} {...motionProps}>
      {sweep}
      {inner}
    </Comp>
  )
}
