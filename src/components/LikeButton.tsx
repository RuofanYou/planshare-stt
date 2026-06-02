import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { dur, easeEpic } from '../lib/motion'
import { Icon } from './ui'
import './LikeButton.css'

interface LikeButtonProps {
  /** 点赞起始值（mock） */
  count: number
  /** compact = 卡片底栏小尺寸 */
  size?: 'default' | 'compact'
}

/**
 * 点赞按钮：本地态切换，不持久化（mock）。
 * 已赞 -> 实心 gold 心（Icon heart filled）+ 数字 +1（count-up 微动）；用 aria-pressed 表达赞/未赞，不靠纯色。
 * 刷新即还原（仅当前会话内存）。
 */
export default function LikeButton({ count, size = 'default' }: LikeButtonProps) {
  const [liked, setLiked] = useState(false)
  const reduce = useReducedMotion()
  const display = liked ? count + 1 : count
  const iconSize = size === 'compact' ? 14 : 16

  return (
    <button
      type="button"
      className={`ps-like ps-like--${size}${liked ? ' is-liked' : ''}`}
      aria-pressed={liked}
      aria-label={liked ? '取消点赞' : '点赞'}
      onClick={() => setLiked((v) => !v)}
    >
      {/* 心形：已赞实心 + 切换时一次 scale 微动（呼应 visionOS 触感） */}
      <motion.span
        className="ps-like__icon"
        animate={reduce ? undefined : { scale: liked ? [1, 1.25, 1] : 1 }}
        transition={{ duration: dur.base, ease: easeEpic }}
      >
        <Icon name="heart" size={iconSize} filled={liked} />
      </motion.span>
      {/* 数字 count-up 微动：切换时旧值上移淡出、新值下方滑入 */}
      <span className="ps-like__count">
        {reduce ? (
          display
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={display}
              className="ps-like__count-val"
              initial={{ y: liked ? 8 : -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: liked ? -8 : 8, opacity: 0 }}
              transition={{ duration: dur.fast, ease: easeEpic }}
            >
              {display}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </button>
  )
}
