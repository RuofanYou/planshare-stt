import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  useFeaturedBoards,
  useRaids,
  useBoards,
} from '../api/hooks'
import {
  staggerContainer,
  staggerItem,
  fadeUp,
} from '../lib/motion'
import BoardCard from '../components/BoardCard'
import {
  Button,
  GlassCard,
  SectionHeading,
  Tag,
  Skeleton,
  SkeletonCard,
  EmptyState,
  Icon,
} from '../components/ui'
import './Home.css'

/* 视口进场配置：进入视口一次性触发 stagger，不重复播放。 */
const inView = { once: true, margin: '-10%' } as const

/* 骨架占位数量：推荐与团本各放几块，撑出列表节奏，加载时不空荡。 */
const FEATURED_SKELETON_COUNT = 3
const RAID_SKELETON_COUNT = 3

/**
 * 首页（/）—— 搜索优先的战术板资源社区入口。
 * 参考 Figma Community：首屏给搜索与资源入口，推荐位降级为运营横幅，
 * 团本浏览提前成为主路径，避免“先看随机精选、再找入口”的割裂感。
 */
export default function Home() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()

  const featuredQuery = useFeaturedBoards()
  const raidsQuery = useRaids()
  const boardsQuery = useBoards()

  const featured = featuredQuery.data ?? []
  const raids = raidsQuery.data ?? []
  const boards = boardsQuery.data ?? []

  const [query, setQuery] = useState('')
  const [searchHint, setSearchHint] = useState('')

  // 主 CTA 指向首个团本目录（异步拿到后才有；未就绪时退化为锚点滚到团本区）。
  const firstRaidId = raids[0]?.id
  const spotlightBoard = featured[0] ?? boards[0]
  const latestBoards = useMemo(
    () =>
      [...boards]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 3),
    [boards],
  )

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      setSearchHint('先输入 BOSS、作者或战术关键词。')
      return
    }

    const matched = boards.find((board) =>
      [board.title, board.description, board.contentText]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword)),
    )

    if (matched) {
      navigate(`/board/${matched.id}`)
      return
    }

    setSearchHint('暂时没搜到匹配的板子，可以先按团本浏览。')
  }

  function scrollToSection(id: string, updateHash = true) {
    if (updateHash) window.history.replaceState(null, '', `#${id}`)
    document.getElementById(id)?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  useEffect(() => {
    if (location.hash !== '#home-latest') return
    requestAnimationFrame(() => scrollToSection('home-latest', false))
  }, [location.hash, reduce])

  return (
    <div className="home">
      {/* ============ ① Hero：搜索优先的社区入口 ============ */}
      <section
        className="home-hero container"
        aria-labelledby="home-hero-title"
      >
        {/* 文案列：进场 stagger fade-up */}
        <motion.div
          className="home-hero__copy"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={reduce ? undefined : staggerItem}>
            <Tag variant="gold" icon="star">
              STT 战术板分享
            </Tag>
          </motion.div>

          <motion.h1
            id="home-hero-title"
            className="home-hero__title text-gold-grad"
            variants={reduce ? undefined : staggerItem}
          >
            找一块能直接用的战术板
          </motion.h1>

          <motion.p
            className="home-hero__subtitle"
            variants={reduce ? undefined : staggerItem}
          >
            搜 BOSS、作者或关键词；也可以按团本进入，挑一份顺手的板子复制进游戏。
          </motion.p>

          <motion.form
            className="home-search glass-strong"
            role="search"
            aria-label="搜索战术板"
            onSubmit={handleSearch}
            variants={reduce ? undefined : staggerItem}
          >
            <Icon name="search" size={20} className="home-search__icon" />
            <input
              className="home-search__input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSearchHint('')
              }}
              placeholder="搜索 BOSS、作者、技能名或关键词"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={boardsQuery.isLoading}
            >
              搜索
            </Button>
          </motion.form>

          {searchHint && <p className="home-search__hint">{searchHint}</p>}

          <motion.div
            className="home-quick"
            variants={reduce ? undefined : staggerItem}
          >
            <Button
              to={firstRaidId ? `/raid/${firstRaidId}` : '#home-raids'}
              variant="secondary"
              size="sm"
              pill
            >
              当前团本
            </Button>
            {spotlightBoard && (
              <Button
                to={`/board/${spotlightBoard.id}`}
                variant="ghost"
                size="sm"
                pill
              >
                本周热门
              </Button>
            )}
            <a
              href="#home-latest"
              className="ps-btn ps-btn--ghost ps-btn--sm ps-btn--pill"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('home-latest')
              }}
            >
              <span className="ps-btn__label">最新上传</span>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ ② 按团本浏览：主路径提前 ============ */}
      <section
        id="home-raids"
        className="home-section container"
        aria-labelledby="home-raids-title"
      >
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={inView}
        >
          <SectionHeading
            eyebrow="按团本浏览"
            title="先选一个战斗场景"
            titleId="home-raids-title"
          />
        </motion.div>

        {raidsQuery.isLoading ? (
          <div className="home-raid-grid" aria-hidden="true">
            {Array.from({ length: RAID_SKELETON_COUNT }).map((_, i) => (
              <RaidCardSkeleton key={i} />
            ))}
          </div>
        ) : raidsQuery.isError ? (
          <EmptyState
            icon="error"
            text="团本列表加载失败，请稍后重试。"
            actionLabel="重新加载"
            onAction={() => raidsQuery.refetch()}
          />
        ) : raids.length > 0 ? (
          <motion.ul
            className="home-raid-grid"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={inView}
          >
            {raids.map((raid) => (
              <motion.li key={raid.id} variants={reduce ? undefined : staggerItem}>
                <GlassCard
                  as="div"
                  interactive
                  to={`/raid/${raid.id}`}
                  ariaLabel={`进入团本 ${raid.name}`}
                  className="home-raid-card"
                >
                  <span className="home-raid-card__corner" aria-hidden="true" />
                  <h3 className="home-raid-card__name">{raid.name}</h3>
                  <p className="home-raid-card__patch">{raid.patch} 版本</p>
                  <p className="home-raid-card__count">
                    <strong>{raid.boardCount}</strong> 块战术板
                  </p>
                  <span className="home-raid-card__arrow" aria-hidden="true">
                    <Icon name="arrow" size={18} />
                  </span>
                </GlassCard>
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <EmptyState text="暂无团本。" />
        )}
      </section>

      {/* ============ ③ 横向推荐位：运营内容降级为资源推荐 ============ */}
      {featuredQuery.isLoading ? (
        <section className="home-section container" aria-hidden="true">
          <HeroShowcaseSkeleton />
        </section>
      ) : spotlightBoard ? (
        <motion.section
          className="home-section container"
          aria-labelledby="home-spotlight-title"
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={inView}
        >
          <GlassCard
            as="section"
            interactive
            to={`/board/${spotlightBoard.id}`}
            ariaLabel={`查看本周推荐战术板 ${spotlightBoard.title}`}
            className="home-spotlight"
          >
            <div className="home-spotlight__copy">
              <Tag variant="gold" icon="star">
                本周推荐
              </Tag>
              <h2 id="home-spotlight-title" className="home-spotlight__title">
                {spotlightBoard.title}
              </h2>
              <p className="home-spotlight__desc">{spotlightBoard.description}</p>
            </div>
            <span className="home-spotlight__cta">
              查看并复制
              <Icon name="arrow" size={18} />
            </span>
          </GlassCard>
        </motion.section>
      ) : null}

      {/* ============ ④ 最新上传：资源流 ============ */}
      <section
        id="home-latest"
        className="home-section container"
        aria-labelledby="home-latest-title"
      >
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={inView}
        >
          <SectionHeading
            eyebrow="资源流"
            title="最新上传"
            titleId="home-latest-title"
          />
        </motion.div>

        {boardsQuery.isLoading ? (
          <div className="home-card-grid" aria-hidden="true">
            {Array.from({ length: FEATURED_SKELETON_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : boardsQuery.isError ? (
          <EmptyState
            icon="error"
            text="战术板加载失败，请稍后重试。"
            actionLabel="重新加载"
            onAction={() => boardsQuery.refetch()}
          />
        ) : latestBoards.length > 0 ? (
          <motion.div
            className="home-card-grid"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={inView}
          >
            {latestBoards.map((board) => (
              <motion.div
                key={board.id}
                className="home-card-grid__cell"
                variants={reduce ? undefined : staggerItem}
              >
                <BoardCard board={board} variant="market" />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState text="暂无战术板。" />
        )}
      </section>
    </div>
  )
}

/** Hero 浮起精选卡的加载骨架（玻璃低对比块，无炫光），与浮卡同尺寸占位防抖。 */
function HeroShowcaseSkeleton() {
  return (
    <div className="home-hero__showcase">
      <div className="home-hero__card-stack">
        <div className="home-hero__card glass" aria-hidden="true">
          <Skeleton shape="line" width="30%" height={10} />
          <Skeleton shape="line" width="70%" height={20} />
          <Skeleton shape="line" width="45%" />
          <Skeleton shape="line" width="90%" />
          <Skeleton shape="line" width="90%" />
          <div className="home-hero__card-foot">
            <Skeleton shape="circle" width={24} height={24} />
            <Skeleton shape="line" width="64px" height={14} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 团本入口卡骨架：玻璃低对比占位（无炫光），与真实入口卡同节奏占位防抖。 */
function RaidCardSkeleton() {
  return (
    <div className="home-raid-card glass" aria-hidden="true">
      <Skeleton shape="line" width="70%" height={20} />
      <Skeleton shape="line" width="40%" height={10} />
      <span className="home-raid-card__count-skel">
        <Skeleton shape="line" width="35%" />
      </span>
    </div>
  )
}
