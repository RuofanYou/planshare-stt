/**
 * PlanShare 动效底座（Framer Motion 通用 variants）。
 * 全站主缓动 ease-epic = cubic-bezier(.22,1,.36,1)。
 * 只用 transform(translate/scale) + opacity，绝不过渡 width/height/top/left，避免 layout-shift。
 * 尊重 prefers-reduced-motion 由各页面 / useReducedMotion 在调用处兜底；
 * 这里只导出权威 variants，禁止在组件里散落写魔法数字。
 */
import type { Variants, Transition } from 'framer-motion'

/** 全站主缓动（与 tokens.css 的 --ease-epic 数值一致）。 */
export const easeEpic = [0.22, 1, 0.36, 1] as const

/** 时长令牌（秒），与 tokens.css 的 --dur-* 一致。 */
export const dur = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
} as const

/** 进场子项的通用过渡。 */
const enterTransition: Transition = {
  duration: dur.slow,
  ease: easeEpic,
}

/**
 * stagger 容器：列表 / 网格父级。
 * 子项依次进场，间隔 60ms。配合 staggerItem 使用。
 */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
}

/**
 * fade-up 子项：从下方 16px 淡入上浮。
 * 配合 staggerContainer，或单独用 initial="hidden" animate="show"。
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: enterTransition,
  },
}

/** 单元素 fade-up（无 stagger 语境时直接用）。 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: enterTransition,
  },
}

/**
 * 卡片 hover lift：上浮 4px + 微缩放，配合 .glass-hover 的金辉描边。
 * 用法：<motion.div variants={cardHover} whileHover="hover" whileTap="tap">。
 * 位移只用 transform，不触发布局回流。
 */
export const cardHover: Variants = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -4,
    transition: { duration: dur.base, ease: easeEpic },
  },
  tap: {
    scale: 0.98,
    transition: { duration: dur.fast, ease: easeEpic },
  },
}

/**
 * 玻璃光扫：斜向高光从左下扫到右上（45°）。
 * 用在卡片 hover 的 ::after 替身层（motion 层）上：
 * <motion.span variants={glassSweep} initial="rest" whileHover="sweep" .../>
 * 只过渡 transform + opacity。
 */
export const glassSweep: Variants = {
  rest: { x: '-120%', opacity: 0 },
  sweep: {
    x: '120%',
    opacity: [0, 0.6, 0],
    transition: { duration: dur.slow, ease: easeEpic },
  },
}

/**
 * 路由过场：AnimatePresence mode="wait" 包裹页面根。
 * 进场从下方 12px 淡入，离场向上 12px 淡出。
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.base, ease: easeEpic },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: dur.base, ease: easeEpic },
  },
}

/**
 * focus 微缩放：可聚焦玻璃元素的 whileFocus。
 * 呼应 visionOS spatial focus 的 scale(1.02)。
 */
export const focusScale: Variants = {
  rest: { scale: 1 },
  focus: {
    scale: 1.02,
    transition: { duration: dur.fast, ease: easeEpic },
  },
}

/**
 * 复制成功微动：图标 scale 1 → 1.12 → 1。
 * 用在 CopyButton 成功态图标层。
 */
export const copySuccessPop: Variants = {
  rest: { scale: 1 },
  pop: {
    scale: [1, 1.12, 1],
    transition: { duration: dur.base, ease: easeEpic },
  },
}

/**
 * 玻璃 Toast 滑入：从底部 12px 淡入，离场淡出。
 * 只用 opacity + translateY，不做 scale 弹跳。
 */
export const toastSlide: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.base, ease: easeEpic },
  },
  exit: {
    opacity: 0,
    y: 12,
    transition: { duration: dur.fast, ease: easeEpic },
  },
}
