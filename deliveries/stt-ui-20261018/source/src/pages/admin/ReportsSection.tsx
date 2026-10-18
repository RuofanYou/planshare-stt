import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAdminReports, useDismissReport, useHideBoardFromReport } from '../../api/hooks'
import { formatDate } from '../../lib/format'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { Button, EmptyState, GlassCard, SectionHeading, Tag } from '../../components/ui'
import { ListSkeleton, type AdminGuardProps } from './AdminShared'

export function ReportsSection({
  isUnauthorized,
  onLogout,
}: AdminGuardProps) {
  const reduce = useReducedMotion()
  const reportsQuery = useAdminReports()
  const hideBoard = useHideBoardFromReport()
  const dismissReport = useDismissReport()
  const [confirmReportAction, setConfirmReportAction] = useState<{ id: string; action: 'hide' | 'dismiss' } | null>(
    null,
  )

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (reportsQuery.isLoading) return <ListSkeleton />
  if (reportsQuery.isError) {
    guard(reportsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={(reportsQuery.error as Error)?.message ?? '举报队列加载失败。'}
        actionLabel="重试"
        onAction={() => reportsQuery.refetch()}
      />
    )
  }

  const reports = reportsQuery.data ?? []
  const pendingCount = reports.filter((report) => report.status === 'pending').length

  return (
    <div className="ps-admin__section">
      <section className="ps-admin__list-block" aria-label="举报队列">
        <SectionHeading
          eyebrow="内容治理"
          title="举报队列"
          size="h2"
          trailing={pendingCount > 0 ? `${pendingCount} 条待处理` : undefined}
        />
        {reports.length === 0 ? (
          <EmptyState icon="empty" text="暂无举报" />
        ) : (
          <motion.ul
            className="ps-admin__rows"
            variants={reduce ? undefined : staggerContainer}
            initial="hidden"
            animate="show"
          >
            {reports.map((report) => {
              const isPending = report.status === 'pending'
              const boardTitle = report.boardTitle ?? `战术板 ${report.boardId}`
              const boardContent = report.boardContent?.trim()
              const confirmAction =
                confirmReportAction?.id === report.id ? confirmReportAction.action : null
              const busy =
                (hideBoard.isPending && hideBoard.variables?.id === report.id) ||
                (dismissReport.isPending && dismissReport.variables?.id === report.id)
              return (
                <motion.li key={report.id} variants={reduce ? undefined : staggerItem}>
                  <GlassCard tone="glass" as="div" className={isPending ? 'ps-admin__row-card' : 'ps-admin__row-card ps-admin__row-card--handled'}>
                    <div className="ps-admin__row-main">
                      <div className="ps-admin__row-flags">
                        <Tag variant={isPending ? 'gold' : 'neutral'}>
                          {reportStatusLabel(report.status)}
                        </Tag>
                        <Tag variant="neutral">{reportReasonLabel(report.reason)}</Tag>
                      </div>
                      <p className="ps-admin__row-title">{boardTitle}</p>
                      <p className="ps-admin__row-path">
                        {report.boardId}
                        {report.boardUpdatedAt ? ` · 举报时更新于 ${formatDate(report.boardUpdatedAt)}` : ''}
                      </p>
                      <p className="ps-admin__row-meta">
                        提交于 {formatDate(report.createdAt)}
                        {report.detail ? ` · ${report.detail}` : ''}
                      </p>
                      {report.boardDescription && (
                        <p className="ps-admin__row-meta">举报时简介：{report.boardDescription}</p>
                      )}
                      {boardContent && (
                        <p className="ps-admin__row-meta">举报时正文：{compactReportContent(boardContent)}</p>
                      )}
                    </div>
                    <div className="ps-admin__row-actions">
                      <Button to={`/board/${report.boardId}`} variant="secondary" size="sm">
                        查看板
                      </Button>
                      {isPending && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmReportAction({ id: report.id, action: 'hide' })}
                          >
                            隐藏板
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmReportAction({ id: report.id, action: 'dismiss' })}
                          >
                            驳回举报
                          </Button>
                        </>
                      )}
                      {isPending && confirmAction && (
                        <div className="ps-admin__confirm glass-strong" role="alertdialog">
                          <span className="ps-admin__confirm-text">
                            {confirmAction === 'hide'
                              ? `确认隐藏「${boardTitle}」？隐藏后公开列表和详情页都会不可见，创作者不能自行恢复。`
                              : `确认驳回对「${boardTitle}」的举报？驳回后这块板会继续公开展示。`}
                          </span>
                          <div className="ps-admin__confirm-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmReportAction(null)}
                              disabled={busy}
                            >
                              取消
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                confirmAction === 'hide'
                                  ? hideBoard.mutate(
                                      { id: report.id, note: '后台处理举报隐藏' },
                                      {
                                        onSuccess: () => setConfirmReportAction(null),
                                        onError: guard,
                                      },
                                    )
                                  : dismissReport.mutate(
                                      { id: report.id, note: '后台驳回举报' },
                                      {
                                        onSuccess: () => setConfirmReportAction(null),
                                        onError: guard,
                                      },
                                    )
                              }
                              disabled={busy}
                            >
                              {busy ? '处理中…' : confirmAction === 'hide' ? '确认隐藏' : '确认驳回'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </section>
    </div>
  )
}

function compactReportContent(content: string) {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  return singleLine.length > 140 ? `${singleLine.slice(0, 140)}...` : singleLine
}

function reportStatusLabel(status: string) {
  if (status === 'pending') return '待处理'
  if (status === 'hidden') return '已隐藏'
  return '已驳回'
}

function reportReasonLabel(reason: string) {
  if (reason === 'spam') return '垃圾内容'
  if (reason === 'abuse') return '违规内容'
  if (reason === 'wrong-info') return '内容有误'
  if (reason === 'copyright') return '版权问题'
  return '其它'
}
