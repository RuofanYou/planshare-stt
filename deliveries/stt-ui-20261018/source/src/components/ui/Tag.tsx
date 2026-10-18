import type { ReactNode } from 'react'
import Icon from './Icon'
import type { IconName } from './Icon'
import './Tag.css'

/**
 * 变体：
 *  - neutral：中性玻璃 chip（难度英雄/史诗、赛季/版本），靠文字区分，绝不上色。
 *  - gold：奶金药丸（eyebrow 小标 / 精选角标），可带极小金图标。
 */
export type TagVariant = 'neutral' | 'gold'

export interface TagProps {
  variant?: TagVariant
  /** 可选前置小图标（走 Icon，如精选角标的 star） */
  icon?: IconName
  className?: string
  children: ReactNode
}

/**
 * Tag —— 小标签 / 徽标原语（整站唯一权威）。
 *
 * 替代分散的：难度标签、赛季 span、精选角标、各页 eyebrow 药丸。
 *  - neutral：玻璃中性 chip + ink-soft 文字 + 暖金描边 + 顶高光（难度靠文字不靠彩色）。
 *  - gold：奶金 eyebrow / 精选角标（玻璃底 + 奶金字 + 暖金描边），可挂极小金 star。
 */
export default function Tag({ variant = 'neutral', icon, className, children }: TagProps) {
  const cls = ['ps-tag', `ps-tag--${variant}`, className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls}>
      {icon && (
        <span className="ps-tag__icon">
          <Icon name={icon} size={11} />
        </span>
      )}
      <span className="ps-tag__label">{children}</span>
    </span>
  )
}
