import { useState, useRef, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
 * 点击复制到剪贴板 -> 进 copied 成功态约 1.5s（对勾 + 「已复制」+ success 色）-> 自动回 default。
 * 用 navigator.clipboard，键盘触发同样生效。成功态通过 aria-live 区域宣告，供读屏。
 *
 * primary 复用 Button 原语的 ps-btn--primary 砖红材质（不再自写一套 ember 渐变），
 * 仅叠加 copied 成功态与图标 morph 微动这套按钮原语不提供的逻辑。
 */
export default function CopyButton({
  text,
  variant = 'primary',
  label = '复制战术',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  // 卸载时清掉计时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 剪贴板不可用（如非安全上下文）时降级：用临时 textarea
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        // 复制失败则静默，不进成功态
        document.body.removeChild(ta)
        return
      }
      document.body.removeChild(ta)
    }

    setCopied(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1500)
  }

  const isIcon = variant === 'icon'
  const reduce = useReducedMotion()

  // primary 复用 Button 原语的砖红材质（ps-btn / ps-btn--primary / ps-btn--md），
  // icon 走自有玻璃小图标骨架；两者都叠 ps-copy 承载 copied 成功态与图标 morph。
  const cls = [
    'ps-copy',
    `ps-copy--${variant}`,
    isIcon ? '' : 'ps-btn ps-btn--primary ps-btn--md',
    copied ? 'is-copied' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={handleCopy}
      aria-label={isIcon ? (copied ? '已复制' : '复制') : undefined}
    >
      {/* 图标：复制 -> 对勾 morph + 成功时一次 scale 微动 */}
      <motion.span
        className="ps-copy__icon"
        variants={reduce ? undefined : copySuccessPop}
        initial="rest"
        animate={copied ? 'pop' : 'rest'}
      >
        <Icon name={copied ? 'check' : 'copy'} size={isIcon ? 16 : 17} />
      </motion.span>
      {!isIcon && (
        <span className="ps-copy__label">{copied ? '已复制' : label}</span>
      )}
      {/* 读屏宣告：仅在成功态有文本 */}
      <span className="ps-copy__live" aria-live="polite">
        {copied ? '已复制到剪贴板' : ''}
      </span>
    </button>
  )
}
