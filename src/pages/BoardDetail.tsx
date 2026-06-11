import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  animate,
} from 'framer-motion'
import { useBoard, useBoards, useLikeBoard, useReportBoard } from '../api/hooks'
import { formatDate, formatCount, difficultyLabel } from '../lib/format'
import {
  staggerContainer,
  staggerItem,
  fadeUp,
  toastSlide,
  dur,
  easeEpic,
} from '../lib/motion'
import { copyToClipboard } from '../lib/clipboard'
import CopyButton from '../components/CopyButton'
import BoardCard from '../components/BoardCard'
import {
  Breadcrumb,
  SectionHeading,
  Tag,
  Avatar,
  Button,
  Icon,
  Skeleton,
  EmptyState,
  GlassCard,
} from '../components/ui'
import './BoardDetail.css'

/** 战术正文超过这个行数时默认折叠，给一个「展开全文」入口（避免长文撑爆首屏） */
const COLLAPSE_LINE_THRESHOLD = 14

/** 玻璃 Toast 停留时长（与 CopyButton 的 1.5s 成功态对齐） */
const TOAST_DURATION = 1500
const REPORT_REASONS = [
  { value: 'wrong-info', label: '内容有误' },
  { value: 'spam', label: '垃圾内容' },
  { value: 'abuse', label: '违规内容' },
  { value: 'copyright', label: '版权问题' },
  { value: 'other', label: '其它' },
] as const

/**
 * 浏览量大数字 count-up：进场触发一次，从 0 滚到终值。
 * reduce 时直接显示终值；始终带眼睛图标 + 文本，不靠纯色传达。
 */
function ViewCountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const [shown, setShown] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const controls = animate(mv, value, {
      duration: 0.8,
      ease: easeEpic,
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, reduce, mv])

  return (
    <span className="ps-detail__view" role="img" aria-label={`浏览量 ${value}`}>
      <span className="ps-detail__view-icon">
        <Icon name="eye" size={20} />
      </span>
      <span className="ps-detail__view-num">{formatCount(shown)}</span>
      <span className="ps-detail__view-label">次浏览</span>
    </span>
  )
}

/**
 * 详情页侧栏点赞（服务端持久化版）。
 * 共享 LikeButton 是 mock 本地态（仅展示），本页需要真持久化，故页面级实现：
 * 点击调 useLikeBoard() 写后端 +1，乐观更新本地显示数；后端返回后以真值为准，
 * 避免 query 刷新后把「后端新计数」再次本地 +1。
 * 造型沿用共享 LikeButton 的心形 + 金色语言，保持全站一致。
 */
function PersistedLike({
  boardId,
  count,
}: {
  boardId: string
  count: number
}) {
  const reduce = useReducedMotion()
  const likeBoard = useLikeBoard()
  // 本会话内已点过赞则不再重复 +1（与全站「点一次」语义一致；刷新还原由后端真值接管）
  const [liked, setLiked] = useState(false)
  const [display, setDisplay] = useState(count)

  useEffect(() => {
    setLiked(false)
    setDisplay(count)
  }, [boardId])

  useEffect(() => {
    if (!liked && !likeBoard.isPending) setDisplay(count)
  }, [count, liked, likeBoard.isPending])

  function handleLike() {
    if (liked || likeBoard.isPending) return
    setLiked(true) // 乐观更新：先点亮 + 数字 +1
    setDisplay(count + 1)
    likeBoard.mutate(boardId, {
      onSuccess: (result) => setDisplay(result.likeCount),
      onError: () => {
        setLiked(false)
        setDisplay(count)
      },
    })
  }

  return (
    <button
      type="button"
      className={`ps-like ps-like--default${liked ? ' is-liked' : ''}`}
      aria-pressed={liked}
      aria-label={liked ? '已点赞' : '点赞'}
      disabled={likeBoard.isPending && !liked}
      onClick={handleLike}
    >
      <motion.span
        className="ps-like__icon"
        animate={reduce ? undefined : { scale: liked ? [1, 1.25, 1] : 1 }}
        transition={{ duration: dur.base, ease: easeEpic }}
      >
        <Icon name="heart" size={16} filled={liked} />
      </motion.span>
      <span className="ps-like__count">
        {reduce ? (
          display
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={display}
              className="ps-like__count-val"
              initial={{ y: liked ? 8 : -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: liked ? -8 : 8, opacity: 0 }}
              transition={{ duration: dur.fast, ease: easeEpic }}
            >
              {display}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </button>
  )
}

/**
 * 加载骨架屏：走 ui Skeleton（玻璃低对比块 + 极缓呼吸）。
 * 结构镜像真实布局（面包屑 + 两栏 + 底部），避免加载完成时跳版。
 */
function DetailSkeleton() {
  return (
    <div className="container ps-detail" aria-busy="true" aria-live="polite">
      <span className="ps-skeleton-srtext">正在加载战术板…</span>

      {/* 面包屑骨架 */}
      <GlassCard
        tone="glass-strong"
        className="ps-detail__crumbs ps-detail__crumbs--skel"
      >
        <Skeleton shape="line" width="14ch" />
      </GlassCard>

      <div className="ps-detail__grid" aria-hidden="true">
        {/* 主体骨架 */}
        <div className="ps-detail__main">
          <div className="ps-detail__head ps-detail__head--skel">
            <Skeleton shape="line" height={38} width="65%" />
            <Skeleton shape="line" width="40%" />
            <Skeleton shape="line" width="60%" />
          </div>
          <Skeleton shape="block" height={44} width={220} className="ps-detail__skel-copybar" />
          <Skeleton shape="block" height={320} className="ps-detail__skel-plan" />
        </div>

        {/* 侧栏骨架 */}
        <GlassCard as="section" className="ps-detail__meta ps-detail__meta--skel">
          <Skeleton shape="line" width="70%" height={28} />
          <div className="ps-detail__meta-rule" />
          <Skeleton shape="line" width="40%" />
          <div className="ps-detail__meta-rule" />
          <Skeleton shape="line" width="55%" />
        </GlassCard>
      </div>
    </div>
  )
}

/** 统一的玻璃错误/空态壳：未找到、加载失败共用，提供回首页入口（ui EmptyState） */
function DetailFallback({
  text,
  isError,
  onHome,
}: {
  text: string
  isError: boolean
  onHome: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <div className="container ps-detail">
      <motion.div
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
        className="ps-detail__notfound-wrap"
      >
        <EmptyState
          icon={isError ? 'error' : 'question'}
          text={text}
          actionLabel="返回首页"
          onAction={onHome}
        />
      </motion.div>
    </div>
  )
}

/**
 * 板子详情页（路由 /board/:boardId）。
 * 数据全走 React Query：useBoard(boardId) 取 { board, raid, boss, author }
 * （命中即后端 viewCount += 1）；底部「同一 BOSS 其它板」走 useBoards({ bossId })。
 * 核心交互 = 一键复制 contentText（整站第一优先级，任何动效不得干扰）。
 * 皮：2026 暗色液态玻璃 + 魔兽金 + 现代魔兽史诗奇幻氛围。
 * 布局：桌面两栏（左主体 + 右元信息玻璃侧栏），移动单列堆叠。
 * 呈现层一律走 ui 原语：面包屑 / 难度赛季标签 / 头像 / 主复制按钮 / 区块标题 / 骨架 / 空态 / 玻璃容器。
 * 硬约束：本页绝不放公会引流卡；战术文本逐字呈现不改写不重排。
 */
export default function BoardDetail() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const boardQuery = useBoard(boardId)
  const reportBoard = useReportBoard()
  const detail = boardQuery.data
  const board = detail?.board

  // 正文是否处于折叠态（仅长文默认折叠）。Hook 必须在条件返回之前声明。
  const [expanded, setExpanded] = useState(false)
  const lineCount = board ? board.contentText.split('\n').length : 0
  const collapsible = lineCount > COLLAPSE_LINE_THRESHOLD

  // 复制成功玻璃 Toast：CopyButton 内部已处理剪贴板，这里只负责站点级浮层提示
  const [toastText, setToastText] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]['value']>('wrong-info')
  const [reportDetail, setReportDetail] = useState('')
  const [reportDone, setReportDone] = useState(false)
  function flashToast(message = '已复制到剪贴板') {
    setToastText(message)
    window.setTimeout(() => setToastText(''), TOAST_DURATION)
  }

  // 同一 BOSS 其它板：异步拉 useBoards({ bossId })（后端已排序、已排除隐藏），去掉本板
  const bossId = board?.bossId ?? undefined
  const siblingsQuery = useBoards(bossId ? { bossId } : {})
  const siblingBoards = useMemo(() => {
    if (!bossId || !siblingsQuery.data) return []
    return siblingsQuery.data.filter((b) => b.id !== board?.id)
  }, [bossId, siblingsQuery.data, board?.id])

  // 加载中：玻璃骨架屏
  if (boardQuery.isPending) {
    return <DetailSkeleton />
  }

  // 加载失败 / 未找到：统一玻璃空态
  if (boardQuery.isError || !detail || !board) {
    const text = boardQuery.isError
      ? '战术板加载失败，请稍后再试。'
      : '没有找到这块战术板。'
    return (
      <DetailFallback
        text={text}
        isError={boardQuery.isError}
        onHome={() => navigate('/')}
      />
    )
  }

  const { raid, boss, author } = detail
  // 适用范围：团本 · BOSS（BOSS 可能为 null）
  const scopeParts = [raid?.name, boss?.name].filter(Boolean) as string[]
  // 难度文字（英雄 / 史诗），无难度则不渲染难度标签
  const diffLabel = difficultyLabel(board.difficulty)

  /** 复制文本到剪贴板（带非安全上下文降级），成功后弹站点级玻璃 Toast。 */
  async function copyText(text: string, message = '已复制到剪贴板') {
    const copied = await copyToClipboard(text)
    if (!copied) return false
    flashToast(message)
    return true
  }

  function copyShareLink() {
    void copyText(window.location.href, '链接已复制')
  }

  function submitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!board || reportBoard.isPending) return
    reportBoard.mutate(
      {
        boardId: board.id,
        reason: reportReason,
        detail: reportDetail.trim() || undefined,
      },
      {
        onSuccess: () => {
          setReportDone(true)
          setReportOpen(false)
          setReportDetail('')
        },
      },
    )
  }

  return (
    <div className="container ps-detail">
      {/* 玻璃面包屑：首页 / 团本名 / 板子标题（当前项不可点） */}
      <motion.div
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
        className="ps-detail__crumbs-wrap"
      >
        <Breadcrumb
          tone="glass-strong"
          items={[
            { label: '首页', to: '/' },
            ...(raid ? [{ label: raid.name, to: `/raid/${raid.id}` }] : []),
            { label: board.title },
          ]}
        />
      </motion.div>

      <motion.div
        className="ps-detail__grid"
        variants={reduce ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* ---------------- 主体（左 / 上） ---------------- */}
        <div className="ps-detail__main">
          <motion.header
            className="ps-detail__head"
            variants={reduce ? undefined : staggerItem}
          >
            {/* 史诗金渐变板名（epic 字体 + 金色文字 + 极淡投影） */}
            <h1 className="ps-detail__title text-gold-grad">{board.title}</h1>

            {/* 适用范围：团本名 · BOSS名 */}
            <div className="ps-detail__scope">
              {scopeParts.map((name, i) => (
                <span key={name} className="ps-detail__scope-item">
                  {i > 0 && (
                    <span className="ps-detail__scope-dot" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {name}
                </span>
              ))}
            </div>

            <div className="ps-detail__badges">
              {/* 难度：neutral 中性玻璃 chip（靠文字区分，绝不上色） */}
              {diffLabel && <Tag variant="neutral">{diffLabel}</Tag>}
              {/* 赛季：gold 奶金药丸，沿用原赛季徽标的奶金质感 */}
              <Tag variant="gold">{board.seasonVersion}</Tag>
              <span className="ps-detail__updated">
                更新于 {formatDate(board.updatedAt)}
              </span>
            </div>

            {/* 作者署名：链接到作者主页 */}
            {author && (
              <Link to={`/author/${author.id}`} className="ps-detail__author">
                <Avatar name={author.name} size={30} />
                <span className="ps-detail__author-name">{author.name}</span>
              </Link>
            )}

            {/* 说明 description（仅作者真有填时显示，不自造文案） */}
            {board.description && (
              <p className="ps-detail__desc">{board.description}</p>
            )}
          </motion.header>

          {/* 主复制按钮条：ui Button primary（砖红渐变材质），全屏唯一 accent 实底。
              剪贴板写入在页面级处理，成功反馈走站点级玻璃 Toast。 */}
          <motion.div
            className="ps-detail__copybar"
            variants={reduce ? undefined : staggerItem}
          >
            <Button
              variant="primary"
              leadingIcon="copy"
              onClick={() => copyText(board.contentText)}
            >
              复制战术
            </Button>
            <Button
              variant="secondary"
              leadingIcon="copy"
              onClick={copyShareLink}
            >
              复制链接
            </Button>
            <Button
              variant="secondary"
              to={`/submit?from=${encodeURIComponent(board.id)}`}
            >
              基于此投稿
            </Button>
          </motion.div>

          {/* 战术正文块：深玻璃底、mono、保留换行、长文可折叠、右上角 icon 复制 */}
          <motion.section
            className="ps-detail__plan glass-strong"
            aria-label="战术正文"
            variants={reduce ? undefined : staggerItem}
          >
            <div className="ps-detail__plan-tools" onClick={() => flashToast()}>
              <CopyButton text={board.contentText} variant="icon" />
            </div>
            <pre
              className={`ps-detail__plan-text${
                collapsible && !expanded ? ' is-collapsed' : ''
              }`}
              tabIndex={0}
            >
              {board.contentText}
            </pre>
            {collapsible && (
              <button
                type="button"
                className="ps-detail__toggle"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            )}
          </motion.section>

          {/* 导入码块（可选）：复制整套导入码（ui Button primary） */}
          {board.importCode && (
            <motion.section
              className="ps-detail__import"
              aria-label="导入码"
              variants={reduce ? undefined : staggerItem}
            >
              <div className="ps-detail__import-head">
                <span className="ps-detail__import-label">导入码</span>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="copy"
                  onClick={() => copyText(board.importCode!)}
                >
                  复制整套导入码
                </Button>
              </div>
              <pre className="ps-detail__import-text glass-strong" tabIndex={0}>
                {board.importCode}
              </pre>
            </motion.section>
          )}
        </div>

        {/* ---------------- 元信息玻璃侧栏（右 / 移动端顶部） ---------------- */}
        <motion.div variants={reduce ? undefined : staggerItem}>
          <GlassCard as="section" className="ps-detail__meta" ariaLabel="数据">
            {/* 浏览量大数字 count-up */}
            <div className="ps-detail__meta-block">
              <ViewCountUp value={board.viewCount} />
            </div>
            {/* 一根暖金 hairline 分隔 */}
            <div className="ps-detail__meta-rule" aria-hidden="true" />
            {/* 点赞：服务端持久化 + 乐观更新 */}
            <div className="ps-detail__meta-block ps-detail__meta-block--like">
              <PersistedLike boardId={board.id} count={board.likeCount} />
            </div>
            <div className="ps-detail__meta-rule" aria-hidden="true" />
            <div className="ps-detail__meta-block ps-detail__report">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReportOpen((value) => !value)
                  setReportDone(false)
                }}
              >
                举报
              </Button>
              {reportDone && <p className="ps-detail__report-status">举报已提交</p>}
              {reportOpen && (
                <form className="ps-detail__report-form glass-strong" onSubmit={submitReport}>
                  <label className="ps-detail__report-label" htmlFor="ps-report-reason">
                    理由
                  </label>
                  <select
                    id="ps-report-reason"
                    className="ps-detail__report-select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                  <label className="ps-detail__report-label" htmlFor="ps-report-detail">
                    补充说明
                  </label>
                  <textarea
                    id="ps-report-detail"
                    className="ps-detail__report-textarea"
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    rows={3}
                    maxLength={200}
                  />
                  {reportBoard.error && (
                    <p className="ps-detail__report-error" role="alert">
                      {(reportBoard.error as Error).message}
                    </p>
                  )}
                  <Button type="submit" variant="primary" size="sm" disabled={reportBoard.isPending}>
                    {reportBoard.isPending ? '提交中…' : '提交举报'}
                  </Button>
                </form>
              )}
            </div>
            {/* 作者小署名（侧栏复用主体作者链接行为） */}
            {author && (
              <>
                <div className="ps-detail__meta-rule" aria-hidden="true" />
                <Link
                  to={`/author/${author.id}`}
                  className="ps-detail__meta-author"
                >
                  <Avatar name={author.name} size={30} />
                  <span className="ps-detail__meta-author-name">
                    {author.name}
                  </span>
                </Link>
              </>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* ---------------- 同一 BOSS 的其它战术板（底部玻璃卡列表） ---------------- */}
      {siblingBoards.length > 0 && (
        <section
          className="ps-detail__siblings"
          aria-label="同一 BOSS 的其它战术板"
        >
          <SectionHeading
            as="h2"
            size="h2"
            title="同一 BOSS 的其它战术板"
            className="ps-detail__siblings-head"
          />
          <motion.div
            className="ps-detail__siblings-grid"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-10%' }}
          >
            {siblingBoards.map((b) => (
              <motion.div key={b.id} variants={reduce ? undefined : staggerItem}>
                <BoardCard board={b} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ---------------- 复制成功玻璃 Toast（站点级浮层，不阻塞操作） ----------------
          外层 fixed 容器负责水平居中，内层 motion 只动 opacity + y，
          避免 Framer 的 transform 覆盖掉 CSS 的 translateX 居中。 */}
      <div className="ps-detail__toast-anchor" aria-hidden={!toastText}>
        <AnimatePresence>
          {toastText && (
            <motion.div
              className="ps-detail__toast glass-strong"
              role="status"
              variants={reduce ? undefined : toastSlide}
              initial={reduce ? { opacity: 1 } : 'hidden'}
              animate={reduce ? { opacity: 1 } : 'show'}
              exit={reduce ? { opacity: 0 } : 'exit'}
            >
              <span className="ps-detail__toast-icon" aria-hidden="true">
                <Icon name="check" size={18} />
              </span>
              <span className="ps-detail__toast-text">{toastText}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
