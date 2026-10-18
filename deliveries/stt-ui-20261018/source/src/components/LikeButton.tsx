import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { dur, easeEpic } from '../lib/motion'
import { Icon } from './ui'
import './LikeButton.css'

interface LikeButtonProps {
  /** 后端当前点赞数。 */
  count: number
  /** compact = 卡片底栏小尺寸 */
  size?: 'default' | 'compact'
  /** 持久化点赞回调；返回后端最新 likeCount。未传时退化成本地预览态。 */
  onLike?: () => Promise<number>
}

/**
 * 点赞按钮：接入 onLike 时为后端持久化点赞；未接入时仅用于本地预览态。
 * 已赞 -> 实心 gold 心（Icon heart filled）+ 数字 +1（count-up 微动）；用 aria-pressed 表达赞/未赞。
 */
export default function LikeButton({ count, size = 'default', onLike }: LikeButtonProps) {
  const [liked, setLiked] = useState(false)
  const [pending, setPending] = useState(false)
  const [display, setDisplay] = useState(count)
  const [error, setError] = useState('')
  const reduce = useReducedMotion()
  const iconSize = size === 'compact' ? 14 : 16

  useEffect(() => {
    if (!liked && !pending) setDisplay(count)
  }, [count, liked, pending])

  async function handleClick() {
    setError('')
    if (!onLike) {
      setLiked((value) => {
        const next = !value
        setDisplay(next ? count + 1 : count)
        return next
      })
      return
    }

    if (liked || pending) return
    setLiked(true)
    setPending(true)
    setDisplay(count + 1)
    try {
      const nextCount = await onLike()
      setDisplay(nextCount)
    } catch {
      setLiked(false)
      setDisplay(count)
      setError('点赞失败，请稍后再试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="ps-like-wrap">
      <button
        type="button"
        className={`ps-like ps-like--${size}${liked ? ' is-liked' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? '已点赞' : '点赞'}
        disabled={pending}
        onClick={() => void handleClick()}
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
      {error && (
        <span className="ps-like__error" role="status">
          {error}
        </span>
      )}
    </span>
  )
}
