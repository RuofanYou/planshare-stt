import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import Icon from './Icon'
import type { IconName } from './Icon'
import './Button.css'

/** 三种权威变体：砖红材质实心 / 金描边玻璃 / 透明幽灵。 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
/** 两档尺寸：md(高 44) 默认 / sm(高 36)。 */
export type ButtonSize = 'md' | 'sm'

interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 前置图标（走 Icon 名） */
  leadingIcon?: IconName
  /** 后置图标（走 Icon 名，如 CTA 尾随箭头） */
  trailingIcon?: IconName
  /** 药丸形（圆角 full），默认 false 走 --radius-md */
  pill?: boolean
  children?: ReactNode
}

/** as-button：渲染 <button>，走原生按钮属性（onClick / type / disabled 等）。 */
type ButtonAsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps | 'className'> & {
    to?: undefined
  }

/** as-link：渲染 react-router <Link>，必须传 to（disabled 对链接无意义，不开放）。 */
type ButtonAsLink = ButtonOwnProps &
  Omit<LinkProps, keyof ButtonOwnProps | 'className'> & {
    to: LinkProps['to']
  }

export type ButtonProps = ButtonAsButton | ButtonAsLink

/** 图标尺寸随按钮尺寸：md 用 18，sm 用 16（与既有内联值一致）。 */
const ICON_SIZE: Record<ButtonSize, number> = { md: 18, sm: 16 }

/**
 * Button —— 整站唯一权威按钮。
 *
 * 变体（对标官网「红实心 + 金描边」）：
 *  - primary：砖红渐变材质实心（顶部高光 + 暖辉 depth），核心操作，一屏最多一个。
 *  - secondary：金描边玻璃，次级 CTA。
 *  - ghost：透明金字，导航 / 次要。
 *
 * 渲染目标二选一：
 *  - 传 to → react-router <Link>（整块可点的导航按钮）。
 *  - 不传 to → 原生 <button>（onClick / disabled / type）。
 *
 * 状态全部走 CSS：default / hover / active / focus(:focus-visible 金环) / disabled。
 * 图标一律走 Icon 原语（leadingIcon / trailingIcon），不在此手写 SVG。
 */
export default function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    pill = false,
    children,
    ...rest
  } = props

  const cls = [
    'ps-btn',
    `ps-btn--${variant}`,
    `ps-btn--${size}`,
    pill ? 'ps-btn--pill' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const iconSize = ICON_SIZE[size]

  const inner = (
    <>
      {leadingIcon && (
        <span className="ps-btn__icon">
          <Icon name={leadingIcon} size={iconSize} />
        </span>
      )}
      {children != null && <span className="ps-btn__label">{children}</span>}
      {trailingIcon && (
        <span className="ps-btn__icon ps-btn__icon--trailing">
          <Icon name={trailingIcon} size={iconSize} />
        </span>
      )}
    </>
  )

  // as-link：渲染 Link（disabled 对导航无意义，不处理）
  if ('to' in rest && rest.to !== undefined) {
    const { to, ...linkRest } = rest as ButtonAsLink
    return (
      <Link to={to} className={cls} {...linkRest}>
        {inner}
      </Link>
    )
  }

  // as-button：渲染原生 button
  const { type, ...btnRest } = rest as ButtonAsButton
  return (
    <button type={type ?? 'button'} className={cls} {...btnRest}>
      {inner}
    </button>
  )
}
