import { Link } from 'react-router-dom'
import type { To } from 'react-router-dom'
import Icon from './Icon'
import './Breadcrumb.css'

export interface BreadcrumbItem {
  label: string
  /** 目标路由；末项当前页不传 to（渲染为金色不可点） */
  to?: To
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** 玻璃药丸外壳（Category 风）/ 强玻璃条（Detail 风），默认 glass */
  tone?: 'glass' | 'glass-strong'
  className?: string
}

/**
 * Breadcrumb —— 面包屑原语（整站唯一权威）。
 *
 * items 自上而下渲染，chevron 分隔；带 to 的项是链接（ink-soft → hover 金），
 * 末项（或任一无 to 项）当前页金色、不可点、aria-current="page"。
 * 替代 Category / BoardDetail 各自内联的面包屑结构。
 */
export default function Breadcrumb({ items, tone = 'glass', className }: BreadcrumbProps) {
  const cls = ['ps-crumb', tone, className ?? ''].filter(Boolean).join(' ')
  return (
    <nav className={cls} aria-label="面包屑">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span className="ps-crumb__item" key={`${item.label}-${i}`}>
            {i > 0 && (
              <span className="ps-crumb__sep" aria-hidden="true">
                <Icon name="chevron" size={14} />
              </span>
            )}
            {item.to && !isLast ? (
              <Link to={item.to} className="ps-crumb__link">
                {item.label}
              </Link>
            ) : (
              <span className="ps-crumb__current" aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
