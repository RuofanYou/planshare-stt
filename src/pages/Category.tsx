import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Difficulty } from '../data/types'
import { useRaid, useBoards } from '../api/hooks'
import { staggerContainer, staggerItem, fadeUp } from '../lib/motion'
import BoardCard from '../components/BoardCard'
import {
  Breadcrumb,
  Tag,
  Skeleton,
  SkeletonCard,
  EmptyState,
  Icon,
} from '../components/ui'
import './Category.css'

/** 难度筛选选项：全部 / 英雄 / 史诗（'all' = 全部） */
type DifficultyFilter = 'all' | Difficulty

const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'heroic', label: '英雄' },
  { key: 'mythic', label: '史诗' },
]

type SortMode = 'recommended' | 'latest' | 'likes' | 'views'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'recommended', label: '推荐排序' },
  { key: 'latest', label: '最新上传' },
  { key: 'likes', label: '最多点赞' },
  { key: 'views', label: '最多浏览' },
]

/**
 * 分类目录页（/raid/:raidId）。
 * 团本 -> BOSS -> 板列表三级浏览（深色液态玻璃 · 魔兽金 · 现代魔兽史诗奇幻）。
 *
 * 数据全走 React Query：
 *  useRaid(raidId)        -> { raid, bosses }，拿团本头与 BOSS 分段；
 *  useBoards({ bossId })  -> 选中 BOSS 的板（后端已排序、已排除隐藏，前端不再排）。
 *
 * 交互层：
 *  BOSS 玻璃分段控件用 useState 选中（数据到位后默认第一个）；
 *  难度筛选（全部/英雄/史诗）在前端过滤；
 *  加载态用 ui Skeleton 占位，错误/空态用 ui EmptyState。
 *  面包屑 / 难度赛季标签 / 重试按钮 / 玻璃容器一律走 ui 原语。
 */
export default function Category() {
  const { raidId } = useParams<{ raidId: string }>()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  // 团本 + BOSS 列表（含加载 / 错误态）
  const raidQuery = useRaid(raidId)
  const raid = raidQuery.data?.raid
  const bosses = useMemo(() => raidQuery.data?.bosses ?? [], [raidQuery.data])

  // 选中的 BOSS：数据异步到位，先留空，加载完默认选第一个
  const [selectedBossId, setSelectedBossId] = useState<string>('')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('recommended')

  // BOSS 列表到位后，若当前未选或所选已不在列表中，回落到第一个
  useEffect(() => {
    if (bosses.length === 0) return
    const stillValid = bosses.some((b) => b.id === selectedBossId)
    if (!stillValid) setSelectedBossId(bosses[0].id)
  }, [bosses, selectedBossId])

  // 选中 BOSS 的板（后端已排序、已排除隐藏）；未选中时不请求
  const boardsQuery = useBoards(selectedBossId ? { bossId: selectedBossId } : {})
  const boardsEnabled = !!selectedBossId

  // 难度前端过滤（后端排序已固化，过滤不打乱顺序）
  const boards = useMemo(() => {
    const list = boardsQuery.data ?? []
    const filtered =
      difficulty === 'all' ? list : list.filter((b) => b.difficulty === difficulty)

    return [...filtered].sort((a, b) => {
      if (sortMode === 'latest') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      if (sortMode === 'likes') return b.likeCount - a.likeCount
      if (sortMode === 'views') return b.viewCount - a.viewCount
      return 0
    })
  }, [boardsQuery.data, difficulty, sortMode])

  const selectedBoss = bosses.find((boss) => boss.id === selectedBossId)

  /* ---------- 团本加载中：整页玻璃骨架屏 ---------- */
  if (raidQuery.isLoading) {
    return (
      <div className="container ps-cat">
        <CategorySkeleton />
      </div>
    )
  }

  /* ---------- 团本加载失败 / 不存在：玻璃 EmptyState ---------- */
  if (raidQuery.isError || !raid) {
    return (
      <div className="container ps-cat">
        <EmptyState
          icon={raidQuery.isError ? 'error' : 'empty'}
          text={
            raidQuery.isError ? '团本加载失败，请稍后重试。' : '没有找到这个团本。'
          }
          actionLabel="返回首页"
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  return (
    <div className="container ps-cat">
      {/* 面包屑：玻璃药丸，首页 / 团本名（当前项亮金，非链接） */}
      <motion.div
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
        className="ps-cat-crumb-wrap"
      >
        <Breadcrumb
          tone="glass"
          items={[{ label: '首页', to: '/' }, { label: raid.name }]}
        />
      </motion.div>

      {/* 团本头：市场式列表页头 */}
      <motion.header
        className="ps-cat-head"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <div className="ps-cat-head__copy">
          <Tag variant="gold">补丁 {raid.patch}</Tag>
          <h1 className="ps-cat-head__title text-gold-grad">{raid.name}</h1>
          <p className="ps-cat-head__desc">
            选择 BOSS 后浏览可复制的战术板，按推荐、最新、点赞或浏览量快速比较。
          </p>
        </div>
      </motion.header>

      {/* BOSS 选择：玻璃分段控件，选中态金色文字 + 段底浮起高亮 + 金 hairline。
          BOSS 列表来自后端（已按 order 升序），无 BOSS 时不渲染该控件。 */}
      {bosses.length > 0 && (
        <motion.div
          className="ps-cat-bosses glass"
          role="tablist"
          aria-label="选择 BOSS"
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          {bosses.map((boss) => {
            const active = boss.id === selectedBossId
            return (
              <button
                key={boss.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? 'ps-cat-boss is-active' : 'ps-cat-boss'}
                onClick={() => setSelectedBossId(boss.id)}
              >
                {/* 选中段底玻璃高亮，用 layoutId 在段间平滑滑动 */}
                {active && !reduce && (
                  <motion.span
                    layoutId="ps-cat-boss-pill"
                    className="ps-cat-boss__pill"
                    aria-hidden="true"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="ps-cat-boss__order" aria-hidden="true">
                  {boss.order}
                </span>
                <span className="ps-cat-boss__name">{boss.name}</span>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* 列表工具条：结果数量 + 难度筛选 + 排序 */}
      <motion.div
        className="ps-cat-toolbar"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <div className="ps-cat-toolbar__main">
          <span className="ps-cat-toolbar__count" aria-live="polite">
            {boardsEnabled && boardsQuery.isSuccess
              ? `${boards.length} 块战术板`
              : '正在加载战术板'}
          </span>
          {selectedBoss && (
            <span className="ps-cat-toolbar__scope">
              {selectedBoss.name}
            </span>
          )}
        </div>
        <div className="ps-cat-toolbar__controls">
          <div className="ps-cat-filter" role="group" aria-label="按难度筛选">
            {DIFFICULTY_FILTERS.map((opt) => {
              const active = opt.key === difficulty
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={active}
                  className={active ? 'ps-cat-chip is-active' : 'ps-cat-chip'}
                  onClick={() => setDifficulty(opt.key)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <label className="ps-cat-sort">
            <span className="ps-cat-sort__label">排序</span>
            <span className="ps-cat-sort__select-wrap">
              <select
                className="ps-cat-sort__select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={16} className="ps-cat-sort__icon" />
            </span>
          </label>
        </div>
      </motion.div>

      {/* 板区：加载骨架 / 加载失败 / 空态 / 列表 */}
      {boardsEnabled && boardsQuery.isLoading ? (
        <BoardGridSkeleton />
      ) : boardsQuery.isError ? (
        <EmptyState
          icon="error"
          text="战术板加载失败，请稍后重试。"
          actionLabel="重新加载"
          onAction={() => boardsQuery.refetch()}
        />
      ) : boards.length > 0 ? (
        <motion.div
          // key 让切换 BOSS / 难度时整组列表重新 stagger 进场
          key={`${selectedBossId}-${difficulty}`}
          className="ps-cat-grid"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {boards.map((board) => (
            <motion.div key={board.id} variants={reduce ? undefined : staggerItem}>
              <BoardCard board={board} variant="market" />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon="empty"
          text={
            !boardsEnabled
              ? '这个团本还没有 BOSS 分组。'
              : difficulty === 'all'
                ? '这个 BOSS 还没有战术板。'
                : '当前难度下还没有战术板。'
          }
          actionLabel={difficulty !== 'all' ? '查看全部难度' : undefined}
          onAction={
            difficulty !== 'all' ? () => setDifficulty('all') : undefined
          }
        />
      )}
    </div>
  )
}

/* ============================ 玻璃骨架屏 ============================ */

/**
 * 整页骨架：面包屑 + 团本头 + BOSS 分段 + 工具条 + 板网格占位。
 * 走 ui Skeleton（玻璃低对比块 + 极缓呼吸），不抢可读性。
 */
function CategorySkeleton() {
  return (
    <div className="ps-cat-skeleton" role="status" aria-label="正在加载团本">
      <Skeleton width={160} height={28} className="ps-cat-skel-crumb" />
      <div className="ps-cat-skeleton__head" aria-hidden="true">
        <Skeleton width="min(280px, 60vw)" height={40} />
        <Skeleton width={88} height={22} />
      </div>
      <Skeleton width="100%" height={60} className="ps-cat-skel-bosses" />
      <div className="ps-cat-skeleton__toolbar" aria-hidden="true">
        <Skeleton width={72} height={34} />
        <Skeleton width={72} height={34} />
        <Skeleton width={72} height={34} />
      </div>
      <BoardGridSkeleton />
      <span className="ps-visually-hidden">正在加载团本数据</span>
    </div>
  )
}

/** 板网格骨架：6 张玻璃卡占位块（ui SkeletonCard，与板卡同形）。 */
function BoardGridSkeleton() {
  return (
    <div
      className="ps-cat-grid ps-cat-grid--skeleton"
      role="status"
      aria-label="正在加载战术板"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="ps-visually-hidden">正在加载战术板列表</span>
    </div>
  )
}
