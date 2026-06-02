/**
 * 纯格式化工具：只做展示层的数值 / 日期 / 标签格式化。
 * 无副作用、无网络、无取数（取数与排序由后端 + api/hooks 负责）。
 */
import type { Difficulty } from '../data/types'

/* ============================ 格式化 ============================ */

/**
 * 浏览量 / 点赞数显示：
 *  < 10000 用千分位（1,234）；>= 10000 用「万」（1.2 万）。
 *  中性表达，不夸张。
 */
export function formatCount(n: number): string {
  if (n >= 10000) {
    const wan = n / 10000
    // 整万不带小数，否则保留一位
    const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1)
    return `${text} 万`
  }
  return n.toLocaleString('zh-CN')
}

/**
 * 相对时间：基于硬编码「今天」（2026-06-01），把 ISO 日期转成
 * 「今天 / 昨天 / N 天前 / N 个月前」这类中性中文表述。
 */
export function formatRelativeTime(iso: string): string {
  const now = new Date('2026-06-01T00:00:00+08:00').getTime()
  const then = new Date(iso).getTime()
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 30) return `${diffDays} 天前`
  const months = Math.floor(diffDays / 30)
  if (months < 12) return `${months} 个月前`
  const years = Math.floor(months / 12)
  return `${years} 年前`
}

/** ISO 日期 -> YYYY-MM-DD（用于「更新于」这类绝对日期展示） */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 难度英文 key -> 中文标签文字 */
export function difficultyLabel(d?: Difficulty): string {
  if (d === 'heroic') return '英雄'
  if (d === 'mythic') return '史诗'
  return ''
}
