import Icon from './Icon'
import type { IconName } from './Icon'
import Button from './Button'
import './EmptyState.css'

export interface EmptyStateProps {
  /** 线框图标名（empty 列表空 / error 出错 / author 找不到作者 / question 未找到） */
  icon?: IconName
  /** 一行说明（中性词，由调用方传真实文案） */
  text: string
  /** 可选行动按钮文字（如「重新加载」「返回首页」） */
  actionLabel?: string
  /** 行动回调（与 actionLabel 配对，触发即渲染 secondary 按钮） */
  onAction?: () => void
  /** 是否包玻璃容器（列表内空态用 true；整页空态外层已有玻璃时可 false） */
  boxed?: boolean
  className?: string
}

/**
 * EmptyState —— 空态 / 错误态原语（整站唯一权威）。
 *
 * 线框 Icon（单色 ink-faint，非 emoji）+ 一行说明 + 可选 secondary 重试按钮。
 * 替代 Home / Category / Author / BoardDetail 各自内联的空态/错误态实现。
 * 无炫彩、无插画大图；boxed 时包一层淡玻璃容器。
 */
export default function EmptyState({
  icon = 'empty',
  text,
  actionLabel,
  onAction,
  boxed = true,
  className,
}: EmptyStateProps) {
  const cls = ['ps-empty', boxed ? 'glass' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} role="status">
      <span className="ps-empty__icon">
        <Icon name={icon} size={40} />
      </span>
      <p className="ps-empty__text">{text}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
