import type { CSSProperties } from 'react'
import './Skeleton.css'

export interface SkeletonProps {
  /** 形状：line = 文字行块 / block = 大块面 / circle = 圆形（头像位） */
  shape?: 'line' | 'block' | 'circle'
  /** 宽度（数字按 px，字符串原样，如 '60%' / '14ch'） */
  width?: number | string
  /** 高度（数字按 px，字符串原样） */
  height?: number | string
  className?: string
}

/** 把 number → px、string 原样，作为内联尺寸。 */
function dim(v?: number | string): string | undefined {
  if (v == null) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

/**
 * Skeleton —— 加载占位块原语（整站唯一权威）。
 *
 * 玻璃低对比块，仅极缓 opacity 呼吸（无 shimmer / 无炫光 / 无斜向光扫）。
 * prefers-reduced-motion 下呼吸停止（由 CSS 媒体查询关掉 animation）。
 * 替代各页 home-skel / ps-skel / ps-skel-line 等重复骨架基元。
 */
export default function Skeleton({
  shape = 'line',
  width,
  height,
  className,
}: SkeletonProps) {
  const style: CSSProperties = { width: dim(width), height: dim(height) }
  return (
    <span
      className={['ps-skeleton', `ps-skeleton--${shape}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    />
  )
}

export interface SkeletonTextProps {
  /** 行数 */
  lines?: number
  /** 末行宽度（制造长短不齐的真实感），默认 '60%' */
  lastLineWidth?: number | string
  className?: string
}

/**
 * SkeletonText —— 多行文字骨架。最后一行收窄，模拟段落末行。
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  className,
}: SkeletonTextProps) {
  return (
    <span
      className={['ps-skeleton-text', className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          shape="line"
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </span>
  )
}

/**
 * SkeletonCard —— 与板卡同形的玻璃占位（标题 + 几行文字 + 底栏：头像位 + 一行 metric）。
 * 用于列表加载态，与 BoardCard 尺寸节奏对齐，加载完成不跳版。
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={['ps-skeleton-card', 'glass', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label="正在加载"
    >
      <div className="ps-skeleton-card__body">
        <Skeleton shape="line" height={18} width="70%" />
        <Skeleton shape="line" width="45%" />
        <Skeleton shape="line" width="38%" />
        <Skeleton shape="line" width="92%" />
      </div>
      <div className="ps-skeleton-card__foot">
        <Skeleton shape="circle" width={22} height={22} />
        <Skeleton shape="line" width="3rem" />
      </div>
    </div>
  )
}
