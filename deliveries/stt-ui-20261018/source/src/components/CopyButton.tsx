import { useState, useRef, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { copyToClipboard } from '../lib/clipboard'
import { copySuccessPop } from '../lib/motion'
import { Icon } from './ui'
import './CopyButton.css'

interface CopyButtonProps {
  /** 要复制的文本 */
  text: string
  /** primary = 详情页主复制按钮（复用 Button primary 砖红材质 + 文字）；icon = 文本块右上角小图标 */
  variant?: 'primary' | 'icon'
  /** 默认态文字（仅 primary 用），如「复制战术」「复制整套导入码」 */
  label?: string
}

/**
 * 一键复制按钮（整站第一优先级交互）。
 * 点击复制到剪贴板 -> 成功 / 失败态短暂可见 -> 自动回 default。
 * 复制实现统一走 copyToClipboard，键盘触发同样生效。结果通过 aria-live 区域宣告，供读屏。
 *
 * primary 复用 Button 原语的 ps-btn--primary 砖红材质（不再自写一套 ember 渐变），
 * 仅叠加 copied 成功态与图标 morph 微动这套按钮原语不提供的逻辑。
 */
export default function CopyButton({
  text,
  variant = 'primary',
  label = '复制战术',
}: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timerRef = useRef<number | null>(null)

  // 卸载时清掉计时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  async function handleCopy() {
    const copied = await copyToClipboard(text)
    setStatus(copied ? 'copied' : 'failed')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setStatus('idle'), 1800)
  }

  const isIcon = variant === 'icon'
  const reduce = useReducedMotion()
  const copied = status === 'copied'
  const failed = status === 'failed'

  // primary 复用 Button 原语的砖红材质（ps-btn / ps-btn--primary / ps-btn--md），
  // icon 走自有玻璃小图标骨架；两者都叠 ps-copy 承载 copied 成功态与图标 morph。
  const cls = [
    'ps-copy',
    `ps-copy--${variant}`,
    isIcon ? '' : 'ps-btn ps-btn--primary ps-btn--md',
    copied ? 'is-copied' : '',
    failed ? 'is-failed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={handleCopy}
      aria-label={isIcon ? (copied ? '已复制' : failed ? '复制失败' : '复制') : undefined}
    >
      {/* 图标：复制 -> 对勾 morph + 成功时一次 scale 微动 */}
      <motion.span
        className="ps-copy__icon"
        variants={reduce ? undefined : copySuccessPop}
        initial="rest"
        animate={copied || failed ? 'pop' : 'rest'}
      >
        <Icon name={copied ? 'check' : 'copy'} size={isIcon ? 16 : 17} />
      </motion.span>
      {!isIcon && (
        <span className="ps-copy__label">{copied ? '已复制' : failed ? '复制失败' : label}</span>
      )}
      {/* 读屏宣告：成功 / 失败都要可感知，避免复制失败静默。 */}
      <span className="ps-copy__live" aria-live="polite">
        {copied ? '已复制到剪贴板' : failed ? '复制失败，请手动选中文本复制' : ''}
      </span>
    </button>
  )
}
