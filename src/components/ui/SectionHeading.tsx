import type { ReactNode } from 'react'
import './SectionHeading.css'

export interface SectionHeadingProps {
  /** 奶金 eyebrow 小标（前缀一段暖金 hairline），可选 */
  eyebrow?: string
  /** 大标题文本 */
  title: ReactNode
  /** 标题层级标签（区块多为 h2，页面级可 h1），默认 h2 */
  as?: 'h1' | 'h2'
  /** 标题元素 id（供 aria-labelledby 引用） */
  titleId?: string
  /** 标题尺寸：display（精选区大标题）/ h2（区块标题），默认 display */
  size?: 'display' | 'h2'
  /** 标题右侧附挂内容（如计数「12 块」），同基线排布 */
  trailing?: ReactNode
  className?: string
}

/**
 * SectionHeading —— 区块标题原语（整站唯一权威）。
 *
 * 结构 = 奶金 eyebrow（暖金 hairline + 奶金小标）+ 大标题，可选右侧 trailing 计数。
 * 替代 Home / Category / Author / BoardDetail 各自重复的「eyebrow + 标题」区块头。
 */
export default function SectionHeading({
  eyebrow,
  title,
  as = 'h2',
  titleId,
  size = 'display',
  trailing,
  className,
}: SectionHeadingProps) {
  const Title = as
  return (
    <div className={['ps-heading', className ?? ''].filter(Boolean).join(' ')}>
      {eyebrow && <span className="ps-heading__eyebrow">{eyebrow}</span>}
      <div className="ps-heading__row">
        <Title id={titleId} className={`ps-heading__title ps-heading__title--${size}`}>
          {title}
        </Title>
        {trailing && <span className="ps-heading__trailing">{trailing}</span>}
      </div>
    </div>
  )
}
