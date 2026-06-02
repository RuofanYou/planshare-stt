import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useInView,
  animate as animateMV,
  useTransform,
} from 'framer-motion'
import type { Author as AuthorModel, Board } from '../data/types'
import { useAuthor } from '../api/hooks'
import { formatCount } from '../lib/format'
import { staggerContainer, staggerItem, fadeUp, dur, easeEpic } from '../lib/motion'
import BoardCard from '../components/BoardCard'
import GuildCard from '../components/GuildCard'
import { Avatar, SectionHeading, EmptyState, Skeleton, SkeletonCard } from '../components/ui'
import './Author.css'

/**
 * 作者主页 —— /author/:authorId
 *
 * 深色液态玻璃 + 魔兽金 + 现代魔兽史诗奇幻。
 * 数据获取走 React Query：useAuthor(authorId) -> { author, boards }（已由后端排序、已排除隐藏）。
 *
 * 三态：
 *  - 加载中（isPending）：全站一致的玻璃骨架屏（头部 + 网格占位，Skeleton 原语）。
 *  - 出错 / 作者不存在（isError）：玻璃 EmptyState + 返回首页。
 *  - 成功：
 *     1. AuthorHeader：玻璃头部 —— 大头像（Avatar 原语 + 金辉环，本页唯一发光焦点）
 *        + 昵称（H1，epic 金色渐变）+ 简介 bio + 作品/总浏览/总赞 三联统计（count-up）。
 *     2. GuildCard：仅当作者填了公会信息时渲染（GuildCard 自身守卫），本站差异化引流闭环。
 *     3. 「TA 的战术板」SectionHeading + BoardCard(compact) 玻璃网格，stagger 进场。
 *     4. 作者无板时玻璃 EmptyState。
 *
 * 呈现层一律走 ui/ 原语（Avatar / SectionHeading / EmptyState / Skeleton），
 * 不再自写头像块 / 区块标题 / 空态 / 骨架基元。
 * 路由过场由 App 统一 AnimatePresence 负责，本页只做进场 stagger / hover / count-up。
 */
export default function Author() {
  const { authorId } = useParams<{ authorId: string }>()
  const { data, isPending, isError } = useAuthor(authorId)
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  // 加载中：玻璃骨架屏（头部 + 网格占位）
  if (isPending) {
    return <AuthorSkeleton />
  }

  // 出错 / 作者不存在：整页玻璃空态
  if (isError || !data) {
    return (
      <div className="container ps-author">
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <EmptyState
            icon="author"
            text="没有找到这位作者。"
            actionLabel="返回首页"
            onAction={() => navigate('/')}
          />
        </motion.div>
      </div>
    )
  }

  const { author, boards } = data
  return <AuthorView author={author} boards={boards} reduce={!!reduce} />
}

/**
 * 作者主页主体（拿到数据后渲染）。
 * 头部三联统计从已加载的 boards 实时聚合（mock 只读）。
 */
function AuthorView({
  author,
  boards,
  reduce,
}: {
  author: AuthorModel
  boards: Board[]
  reduce: boolean
}) {
  const boardCount = boards.length
  const totalViews = boards.reduce((sum, b) => sum + b.viewCount, 0)
  const totalLikes = boards.reduce((sum, b) => sum + b.likeCount, 0)

  return (
    <div className="container ps-author">
      {/* ---------- AuthorHeader：玻璃头部 ---------- */}
      <motion.header
        className="ps-author__header glass-strong"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        {/* 头像：Avatar 原语（首字母玻璃圆）+ 金辉环（本页唯一发光焦点，极缓慢呼吸） */}
        <span className="ps-author__avatar-wrap" aria-hidden="true">
          <motion.span
            className="ps-author__avatar-glow"
            animate={
              reduce
                ? undefined
                : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.05, 1] }
            }
            transition={
              reduce
                ? undefined
                : { duration: 4.5, ease: 'easeInOut', repeat: Infinity }
            }
          />
          <Avatar name={author.name} size={96} className="ps-author__avatar" />
        </span>

        <div className="ps-author__id">
          <p className="ps-author__eyebrow">战术板作者</p>
          <h1 className="ps-author__name text-gold-grad">{author.name}</h1>
          {author.bio && <p className="ps-author__bio">{author.bio}</p>}

          {/* 三联统计：作品 / 总浏览 / 获赞（进入视口 count-up） */}
          <dl className="ps-author__stats" aria-label="作者数据">
            <Stat value={boardCount} label="作品" reduce={reduce} />
            <span className="ps-author__stats-sep" aria-hidden="true" />
            <Stat value={totalViews} label="总浏览" reduce={reduce} />
            <span className="ps-author__stats-sep" aria-hidden="true" />
            <Stat value={totalLikes} label="获赞" reduce={reduce} />
          </dl>
        </div>
      </motion.header>

      {/* ---------- 公会引流卡（差异化模块；GuildCard 自身在无公会时返回 null） ---------- */}
      {author.guildName && (
        <motion.section
          className="ps-author__guild"
          aria-label="作者所在公会招募"
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-10%' }}
        >
          <GuildCard author={author} />
        </motion.section>
      )}

      {/* ---------- 「TA 的战术板」列表 ---------- */}
      <section className="ps-author__boards" aria-label="作者的战术板">
        <motion.div
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-10%' }}
        >
          <SectionHeading
            eyebrow="作者舞台"
            title="TA 的战术板"
            size="display"
            trailing={boardCount > 0 ? `${boardCount} 块` : undefined}
          />
        </motion.div>

        {boards.length > 0 ? (
          <motion.div
            className="ps-author__grid"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-8%' }}
          >
            {boards.map((board) => (
              <motion.div
                key={board.id}
                className="ps-author__grid-item"
                variants={reduce ? undefined : staggerItem}
              >
                <BoardCard board={board} variant="compact" />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            variants={reduce ? undefined : fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-10%' }}
          >
            <EmptyState icon="empty" text="这位作者还没有公开的战术板。" />
          </motion.div>
        )}
      </section>
    </div>
  )
}

/**
 * 加载骨架屏：与全站一致的玻璃材质占位（头部 + 网格）。
 * 全部走 Skeleton 原语（circle 头像位 + line 文字行 + SkeletonCard 卡片占位）。
 * 纯装饰，aria-hidden；外层用 role/aria-busy 宣告加载中。
 */
function AuthorSkeleton() {
  return (
    <div
      className="container ps-author"
      role="status"
      aria-busy="true"
      aria-label="正在加载作者主页"
    >
      {/* 头部骨架：头像圆块 + 文字行块 */}
      <div className="ps-author__header glass-strong" aria-hidden="true">
        <Skeleton shape="circle" width={96} height={96} className="ps-author__sk-avatar" />
        <div className="ps-author__id ps-author__sk-lines">
          <Skeleton shape="line" width={96} height={12} />
          <Skeleton shape="line" width={220} height={30} />
          <Skeleton shape="line" width="100%" height={14} />
          <Skeleton shape="line" width="60%" height={14} />
          <div className="ps-author__stats">
            <Skeleton shape="line" width={56} height={28} />
            <span className="ps-author__stats-sep" />
            <Skeleton shape="line" width={56} height={28} />
            <span className="ps-author__stats-sep" />
            <Skeleton shape="line" width={56} height={28} />
          </div>
        </div>
      </div>

      {/* 列表骨架：标题行 + 卡片占位网格 */}
      <div className="ps-author__boards" aria-hidden="true">
        <div className="ps-author__sk-head">
          <Skeleton shape="line" width={96} height={12} />
          <Skeleton shape="line" width={240} height={36} />
        </div>
        <div className="ps-author__grid">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 单项统计：大数字 count-up（进入视口触发一次）+ 下方标签。
 * reduce 时直接显示终值，不跑动画。数字用 formatCount 走「千分位 / 万」中性表达。
 */
function Stat({
  value,
  label,
  reduce,
}: {
  value: number
  label: string
  reduce: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  const mv = useMotionValue(0)
  // 把动画过程中的浮点数实时格式化成中性显示文本
  const text = useTransform(mv, (n) => formatCount(Math.round(n)))

  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    if (!inView) return
    const controls = animateMV(mv, value, {
      duration: dur.slow + 0.2,
      ease: easeEpic,
    })
    return () => controls.stop()
  }, [inView, reduce, value, mv])

  return (
    <div className="ps-author__stat" ref={ref}>
      <motion.dd className="ps-author__stat-num">
        {reduce ? formatCount(value) : text}
      </motion.dd>
      <dt className="ps-author__stat-label">{label}</dt>
    </div>
  )
}
