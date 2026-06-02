import { motion, useReducedMotion } from 'framer-motion'
import {
  useFeaturedBoards,
  useRaids,
  useRaidsMap,
  useAuthorsMap,
  useBossName,
} from '../api/hooks'
import type { Board } from '../data/types'
import {
  staggerContainer,
  staggerItem,
  fadeUp,
  dur,
  easeEpic,
} from '../lib/motion'
import BoardCard from '../components/BoardCard'
import {
  Button,
  GlassCard,
  SectionHeading,
  Tag,
  Avatar,
  Stat,
  Skeleton,
  SkeletonCard,
  EmptyState,
  Icon,
} from '../components/ui'
import './Home.css'

/* 视口进场配置：进入视口一次性触发 stagger，不重复播放。 */
const inView = { once: true, margin: '-10%' } as const

/* 骨架占位数量：精选与团本各放几块，撑出列表节奏，加载时不空荡。 */
const FEATURED_SKELETON_COUNT = 6
const RAID_SKELETON_COUNT = 3

/**
 * 首页（/）—— 电影级暗场门面。
 * 数据全走 React Query hooks（异步）：useFeaturedBoards() 取精选、useRaids() 取团本入口。
 *  ① Hero：奶金 eyebrow + epic 金渐变史诗标题 + 副文案 + 砖红/金描边 CTA，
 *     右侧浮起一张玻璃精选卡（取首张精选板做预览）。
 *  ② 官方精选：均匀等宽玻璃卡网格摆 isFeatured 板（复用 BoardCard），stagger fade-up。
 *  ③ 按团本浏览：团本入口玻璃卡（boardCount 来自后端），hover 金辉，点击进 /raid/:id。
 * 呈现层全部组装自 ui/ 原语：Button / GlassCard / SectionHeading / Tag / Avatar / Stat /
 * Skeleton / EmptyState（不再自写按钮 / 玻璃 / 头像 / 标签 / 骨架 / 空态 / 区块标题 / 内联 SVG）。
 * Header / Footer / 余烬背景由 App 统一渲染；本页只负责主内容区。
 */
export default function Home() {
  const reduce = useReducedMotion()

  const featuredQuery = useFeaturedBoards()
  const raidsQuery = useRaids()

  const featured = featuredQuery.data ?? []
  const raids = raidsQuery.data ?? []

  // Hero 浮起精选卡：取第一张精选板做电影预览（无精选则不渲染浮卡）。
  const heroBoard = featured[0]
  // 主 CTA 指向首个团本目录（异步拿到后才有；未就绪时退化为锚点滚到团本区）。
  const firstRaidId = raids[0]?.id

  return (
    <div className="home">
      {/* ============ ① Hero：电影级第一屏 ============ */}
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
            直接抄一份现成的好板子
          </motion.h1>

          <motion.p
            className="home-hero__subtitle"
            variants={reduce ? undefined : staggerItem}
          >
            按团本和 BOSS 找现成的战术板，复制粘贴进游戏就能用。
          </motion.p>

          <motion.div
            className="home-hero__actions"
            variants={reduce ? undefined : staggerItem}
          >
            {/* 团本列表就绪 -> 进首个团本目录；未就绪 -> 锚点滚到团本区，不留死链 */}
            <Button
              to={firstRaidId ? `/raid/${firstRaidId}` : '#home-raids'}
              variant="primary"
              trailingIcon="arrow"
            >
              按团本浏览
            </Button>
            {heroBoard && (
              <Button to={`/board/${heroBoard.id}`} variant="secondary">
                看看精选板
              </Button>
            )}
          </motion.div>
        </motion.div>

        {/* 浮起玻璃精选卡：取首张精选板；加载未就绪时用玻璃骨架占位，撑住版式不抖动 */}
        {heroBoard ? (
          <HeroShowcase board={heroBoard} reduce={!!reduce} />
        ) : featuredQuery.isLoading ? (
          <HeroShowcaseSkeleton />
        ) : null}
      </section>

      {/* ============ ② 官方精选 —— 均匀等宽玻璃卡网格 ============ */}
      <section
        className="home-section container"
        aria-labelledby="home-featured-title"
      >
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={inView}
        >
          <SectionHeading
            eyebrow="精选"
            title="官方精选"
            titleId="home-featured-title"
          />
        </motion.div>

        {featuredQuery.isLoading ? (
          // 加载：均匀等宽骨架卡网格（无炫光）
          <div className="home-card-grid" aria-hidden="true">
            {Array.from({ length: FEATURED_SKELETON_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : featuredQuery.isError ? (
          <EmptyState
            icon="error"
            text="精选战术板加载失败，请稍后重试。"
            actionLabel="重新加载"
            onAction={() => featuredQuery.refetch()}
          />
        ) : featured.length > 0 ? (
          <motion.div
            className="home-card-grid"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={inView}
          >
            {featured.map((board) => (
              <motion.div
                key={board.id}
                className="home-card-grid__cell"
                variants={reduce ? undefined : staggerItem}
              >
                <BoardCard board={board} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState text="暂无精选战术板。" />
        )}
      </section>

      {/* ============ ③ 按团本浏览 ============ */}
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
            title="挑一个团本进去"
            titleId="home-raids-title"
          />
        </motion.div>

        {raidsQuery.isLoading ? (
          // 加载：团本入口骨架卡（无炫光）
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
                {/* 整卡可点：进入该团本目录（玻璃 chrome / 光扫 / hover 上浮由 GlassCard 提供） */}
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
                  {/* 箭头：纯装饰，hover 时右移 */}
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
    </div>
  )
}

/**
 * Hero 浮起玻璃精选卡（取首张精选板做电影预览）。
 * 玻璃 chrome / 光扫 / hover 上浮 / 整卡链接由 GlassCard 承担；精选角标用 Tag，
 * 作者用 Avatar，浏览/点赞用 Stat。板名 / 适用范围 / 描述链向 /board/:id。
 * 团本 · BOSS · 作者名复用共享缓存查询表，避免重复请求。
 * 外层 .home-hero__card-stack 负责 3D 倾斜 + 背后两片玻璃残影（悬浮深度），
 * GlassCard 自身的 overflow 裁切只作用于卡内光扫，不影响残影。
 */
function HeroShowcase({ board, reduce }: { board: Board; reduce: boolean }) {
  const raidsMap = useRaidsMap()
  const authorsMap = useAuthorsMap()
  const raidName = raidsMap.get(board.raidId)?.name
  const bossName = useBossName(board.raidId, board.bossId)
  const author = authorsMap.get(board.authorId)
  const scope = [raidName, bossName].filter(Boolean).join(' · ')

  return (
    <motion.div
      className="home-hero__showcase"
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={
        reduce
          ? undefined
          : {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: dur.slow, ease: easeEpic, delay: 0.12 },
            }
      }
    >
      <div className="home-hero__card-stack">
        <GlassCard
          as="article"
          interactive
          to={`/board/${board.id}`}
          ariaLabel={`查看精选战术板 ${board.title}`}
          className="home-hero__card"
        >
          <span className="home-hero__card-eyebrow">
            <Tag variant="gold" icon="star">
              精选
            </Tag>
          </span>
          <h2 className="home-hero__card-title">{board.title}</h2>
          {scope && <p className="home-hero__card-scope">{scope}</p>}
          {board.description && (
            <p className="home-hero__card-desc">{board.description}</p>
          )}

          <div className="home-hero__card-foot">
            {author && (
              <span className="home-hero__card-author">
                <Avatar name={author.name} size={24} />
                <span className="home-hero__card-author-name">{author.name}</span>
              </span>
            )}
            <span className="home-hero__card-metrics">
              <Stat kind="view" value={board.viewCount} label="浏览量" />
              <Stat kind="like" value={board.likeCount} label="点赞数" />
            </span>
          </div>
        </GlassCard>
      </div>
    </motion.div>
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
