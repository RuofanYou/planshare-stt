import { Link } from 'react-router-dom'
import type { Board } from '../data/types'
import { useRaidsMap, useAuthorsMap, useBossName, useLikeBoard } from '../api/hooks'
import { GlassCard, Tag, Avatar, Stat } from './ui'
import DifficultyTag from './DifficultyTag'
import LikeButton from './LikeButton'
import './BoardCard.css'

interface BoardCardProps {
  board: Board
  /** compact = 作者主页内列表用；market = 浏览页模板市场卡 */
  variant?: 'default' | 'compact' | 'market'
}

const PREVIEW_LINE_COUNT = 4

function getBoardPreviewLines(board: Board): string[] {
  const lines = board.contentText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, PREVIEW_LINE_COUNT)

  if (lines.length > 0) return lines
  return [board.description || board.title]
}

/**
 * 板子卡片：整卡可点链到 /board/:id（外壳复用 GlassCard interactive：玻璃 chrome + hover 上浮 + 金辉描边 + 斜向光扫）。
 * 含 板名 + 团本/BOSS + 难度标签 + 作者署名 + 浏览量/点赞。
 * 精选板右上挂精选角标（Tag gold + star）。
 */
export default function BoardCard({ board, variant = 'default' }: BoardCardProps) {
  // 卡片只拿到 id，名称从共享缓存的查询表 / 轻量 hook 反查，避免每张卡各发请求。
  const raidsMap = useRaidsMap()
  const authorsMap = useAuthorsMap()
  const likeBoard = useLikeBoard()
  const raidName = raidsMap.get(board.raidId)?.name
  const bossName = useBossName(board.raidId, board.bossId)
  const author = authorsMap.get(board.authorId)

  // 适用范围：团本 · BOSS（BOSS 可能为 null）
  const scope = [raidName, bossName].filter(Boolean).join(' · ')
  const previewLines = variant === 'market' ? getBoardPreviewLines(board) : []

  return (
    <GlassCard as="article" interactive className={`ps-card ps-card--${variant}`}>
      {board.isFeatured && (
        <span className="ps-card__featured">
          <Tag variant="gold" icon="star">
            精选
          </Tag>
        </span>
      )}

      <Link to={`/board/${board.id}`} className="ps-card__link">
        {variant === 'market' && (
          <div className="ps-card__preview" aria-hidden="true">
            <pre className="ps-card__preview-code">
              {previewLines.map((line, index) => (
                <span key={`${board.id}-preview-${index}`} className="ps-card__preview-row">
                  <span className="ps-card__preview-index">{index + 1}</span>
                  <span className="ps-card__preview-text">{line}</span>
                </span>
              ))}
            </pre>
            <span className="ps-card__preview-mark">{board.difficulty === 'mythic' ? 'M' : 'H'}</span>
          </div>
        )}

        <h3 className="ps-card__title">{board.title}</h3>

        <p className="ps-card__scope">{scope}</p>

        <div className="ps-card__tags">
          <DifficultyTag difficulty={board.difficulty} />
          <span className="ps-card__season">{board.seasonVersion}</span>
        </div>

        {board.description && (
          <p className="ps-card__desc">{board.description}</p>
        )}
      </Link>

      {/* 底部元信息行：作者署名 + 浏览/点赞（在卡链接外，便于各自交互） */}
      <div className="ps-card__foot">
        {author && (
          <Link to={`/author/${author.id}`} className="ps-card__author">
            <Avatar name={author.name} size={22} />
            <span className="ps-card__author-name">{author.name}</span>
          </Link>
        )}
        <div className="ps-card__metrics">
          <Stat kind="view" value={board.viewCount} label="浏览量" />
          <LikeButton
            count={board.likeCount}
            size="compact"
            onLike={async () => {
              const result = await likeBoard.mutateAsync(board.id)
              return result.likeCount
            }}
          />
        </div>
      </div>
    </GlassCard>
  )
}
