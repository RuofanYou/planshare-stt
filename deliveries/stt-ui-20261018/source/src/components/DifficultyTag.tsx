import type { Difficulty } from '../data/types'
import { difficultyLabel } from '../lib/format'
import { Tag } from './ui'

interface DifficultyTagProps {
  difficulty?: Difficulty
}

/**
 * 难度标签：英雄 / 史诗。
 * 复用 Tag 原语的 neutral 变体（中性玻璃 chip，靠文字区分难度、绝不上色）。
 * 无 difficulty 时不渲染。
 */
export default function DifficultyTag({ difficulty }: DifficultyTagProps) {
  if (!difficulty) return null
  return <Tag variant="neutral">{difficultyLabel(difficulty)}</Tag>
}
