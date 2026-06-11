import { formatCount } from '../../lib/format'
import Icon from './Icon'
import './Stat.css'

/** 统计种类：浏览量(eye) / 点赞数(heart)，复用 Icon 命名。 */
type StatKind = 'view' | 'like'

export interface StatProps {
  /** 统计种类，决定图标 */
  kind: StatKind
  /** 数值（只读展示） */
  value: number
  /** inline = 卡片底栏紧凑；large = 详情侧栏 epic 大数字 */
  size?: 'inline' | 'large'
  /** 无障碍标签前缀，如「浏览量」「点赞数」 */
  label: string
  /**
   * 可选：覆盖显示文本（如 count-up 过程中的实时值）。
   * 不传则用 formatCount(value)。a11y label 始终用终值 value。
   */
  display?: string
}

const KIND_ICON = { view: 'eye', like: 'heart' } as const

/**
 * Stat —— 图标 + 数字只读统计原语（整站唯一权威）。
 *
 * 整合：旧 Stat（卡片底栏浏览量）、Hero 浮卡内联 metric、详情侧栏大数字。
 * 非交互，始终「图标 + 文本」并存，不靠纯色传达信息。
 *  - inline：ink-soft 紧凑展示。
 *  - large：金图标 + epic 大数字（详情侧栏；count-up 由调用方传 display）。
 */
export default function Stat({ kind, value, size = 'inline', label, display }: StatProps) {
  const iconSize = size === 'large' ? 18 : 14
  return (
    <span
      className={`ps-stat ps-stat--${size}`}
      role="img"
      aria-label={`${label} ${value}`}
    >
      <span className="ps-stat__icon">
        <Icon name={KIND_ICON[kind]} size={iconSize} />
      </span>
      <span className="ps-stat__value">{display ?? formatCount(value)}</span>
    </span>
  )
}
