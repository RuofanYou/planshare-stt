import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { AdminSubmission, ApproveSubmissionInput } from '../../data/types'
import {
  useAdminAuthors,
  useAdminSubmissions,
  useApproveSubmission,
  useRejectSubmission,
  useMarkSubmissionSpam,
} from '../../api/hooks'
import { difficultyLabel, formatDate } from '../../lib/format'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { Button, EmptyState, SectionHeading, Tag } from '../../components/ui'
import { ListSkeleton, SelectChevron, type AdminGuardProps } from './AdminShared'

export function SubmissionsSection({
  isUnauthorized,
  onLogout,
}: AdminGuardProps) {
  const reduce = useReducedMotion()
  const submissionsQuery = useAdminSubmissions()
  const authorsQuery = useAdminAuthors()
  const approveSubmission = useApproveSubmission()
  const rejectSubmission = useRejectSubmission()
  const markSpam = useMarkSubmissionSpam()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [authorBySubmission, setAuthorBySubmission] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  if (submissionsQuery.isLoading || authorsQuery.isLoading) {
    return <ListSkeleton />
  }

  if (submissionsQuery.isError || authorsQuery.isError) {
    const message =
      (submissionsQuery.error as Error | undefined)?.message ??
      (authorsQuery.error as Error | undefined)?.message ??
      '投稿审核队列加载失败。'
    guard(submissionsQuery.error ?? authorsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={`加载失败：${message}`}
        actionLabel="重试"
        onAction={() => {
          submissionsQuery.refetch()
          authorsQuery.refetch()
        }}
      />
    )
  }

  const submissions = submissionsQuery.data ?? []
  const authors = authorsQuery.data ?? []
  const pendingSubmissions = submissions.filter((item) => item.status === 'pending')
  const pendingIds = new Set(pendingSubmissions.map((item) => item.id))
  const pendingCount = pendingSubmissions.length
  const selectedPendingIds = selectedIds.filter((id) => pendingIds.has(id))
  const hasSelectedPending = selectedPendingIds.length > 0
  const allPendingSelected = pendingCount > 0 && selectedPendingIds.length === pendingCount
  const bulkBusy = rejectSubmission.isPending || markSpam.isPending

  function approve(id: string, input: ApproveSubmissionInput) {
    approveSubmission.mutate(
      { id, input },
      {
        onSuccess: () => setExpandedId(null),
        onError: guard,
      },
    )
  }

  function selectedAuthor(id: string) {
    return authorBySubmission[id] ?? ''
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id]
      }
      return current.filter((item) => item !== id)
    })
  }

  function toggleAllPending(checked: boolean) {
    setSelectedIds(checked ? pendingSubmissions.map((submission) => submission.id) : [])
  }

  async function bulkReject() {
    if (!hasSelectedPending || bulkBusy) return
    try {
      await Promise.all(
        selectedPendingIds.map((id) =>
          rejectSubmission.mutateAsync({ id, note: '后台批量驳回' }),
        ),
      )
      setSelectedIds([])
    } catch (error) {
      guard(error)
    }
  }

  async function bulkSpam() {
    if (!hasSelectedPending || bulkBusy) return
    try {
      await Promise.all(
        selectedPendingIds.map((id) =>
          markSpam.mutateAsync({ id, note: '后台批量标记垃圾' }),
        ),
      )
      setSelectedIds([])
    } catch (error) {
      guard(error)
    }
  }

  return (
    <div className="ps-admin__section">
      <section className="ps-admin__list-block" aria-label="投稿审核队列">
        <SectionHeading
          eyebrow="投稿审核"
          title="待处理投稿"
          size="h2"
          trailing={pendingCount > 0 ? `${pendingCount} 条待处理` : undefined}
        />

        {submissions.length === 0 ? (
          <EmptyState icon="empty" text="暂无投稿" />
        ) : (
          <>
            {pendingCount > 0 && (
              <div className="ps-admin__bulk-bar glass" aria-label="批量审核操作">
                <label className="ps-admin__bulk-check">
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={(event) => toggleAllPending(event.target.checked)}
                  />
                  <span>全选待审</span>
                </label>
                <span className="ps-admin__bulk-count">
                  已选 {selectedPendingIds.length} / {pendingCount}
                </span>
                <div className="ps-admin__bulk-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasSelectedPending || bulkBusy}
                    onClick={() => void bulkReject()}
                  >
                    批量驳回
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasSelectedPending || bulkBusy}
                    onClick={() => void bulkSpam()}
                  >
                    批量标记垃圾
                  </Button>
                </div>
              </div>
            )}

            <motion.div
              className="ps-admin__rows"
              variants={reduce ? undefined : staggerContainer}
              initial="hidden"
              animate="show"
            >
              {submissions.map((submission) => {
              const isExpanded = expandedId === submission.id
              const isPending = submission.status === 'pending'
              const isSelected = selectedPendingIds.includes(submission.id)
              const busy =
                (approveSubmission.isPending && approveSubmission.variables?.id === submission.id) ||
                (rejectSubmission.isPending && rejectSubmission.variables?.id === submission.id) ||
                (markSpam.isPending && markSpam.variables?.id === submission.id)

              return (
                <motion.article
                  key={submission.id}
                  className={
                    isPending
                      ? 'ps-admin__row-card glass'
                      : 'ps-admin__row-card ps-admin__row-card--handled glass'
                  }
                  variants={reduce ? undefined : staggerItem}
                >
                  {isPending && (
                    <label className="ps-admin__row-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleSelected(submission.id, event.target.checked)}
                      />
                      <span>选择</span>
                    </label>
                  )}

                  <div className="ps-admin__row-main">
                    <div className="ps-admin__row-flags">
                      <Tag variant={isPending ? 'gold' : 'neutral'}>
                        {submissionStatusLabel(submission.status)}
                      </Tag>
                      {submission.wantsCreatorProfile && <Tag variant="neutral">申请创作者</Tag>}
                    </div>
                    <p className="ps-admin__row-title">{submission.title}</p>
                    <p className="ps-admin__row-path">
                      {submission.raidId} · {difficultyLabel(submission.difficulty)} ·{' '}
                      {submission.seasonVersion}
                    </p>
                    <p className="ps-admin__row-meta">
                      署名：{submission.submitterName} · 提交于 {formatDate(submission.createdAt)}
                    </p>
                    {submission.contact && (
                      <p className="ps-admin__row-meta">联系方式：{submission.contact}</p>
                    )}
                  </div>

                  <div className="ps-admin__row-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                    >
                      {isExpanded ? '收起' : '查看'}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="ps-admin__submission-detail">
                      <pre className="ps-admin__submission-code glass-strong">
                        {submission.contentText}
                      </pre>

                      {submission.wantsCreatorProfile && (
                        <div className="ps-admin__submission-profile">
                          {submission.creatorBio && <p>简介：{submission.creatorBio}</p>}
                          {submission.creatorGuildName && <p>公会：{submission.creatorGuildName}</p>}
                          {submission.creatorGuildRecruit && (
                            <p>招募：{submission.creatorGuildRecruit}</p>
                          )}
                          {submission.creatorGuildContact && (
                            <p>公会联系方式：{submission.creatorGuildContact}</p>
                          )}
                        </div>
                      )}

                      {isPending ? (
                        <div className="ps-admin__submission-review">
                          <div className="ps-admin__select-wrap">
                            <select
                              className="ps-admin__select"
                              value={selectedAuthor(submission.id)}
                              onChange={(e) =>
                                setAuthorBySubmission((current) => ({
                                  ...current,
                                  [submission.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">选择已有作者</option>
                              {authors.map((author) => (
                                <option key={author.id} value={author.id}>
                                  {author.name}
                                </option>
                              ))}
                            </select>
                            <SelectChevron />
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!selectedAuthor(submission.id) || busy}
                            onClick={() =>
                              approve(submission.id, {
                                mode: 'existingAuthor',
                                authorId: selectedAuthor(submission.id),
                              })
                            }
                          >
                            绑定已有作者发布
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => approve(submission.id, { mode: 'createAuthor' })}
                          >
                            创建作者并发布
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => approve(submission.id, { mode: 'plainAuthor' })}
                          >
                            作为普通投稿发布
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              rejectSubmission.mutate(
                                { id: submission.id, note: '后台驳回' },
                                { onError: guard },
                              )
                            }
                          >
                            驳回
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              markSpam.mutate(
                                { id: submission.id, note: '后台标记垃圾' },
                                { onError: guard },
                              )
                            }
                          >
                            标记垃圾
                          </Button>
                        </div>
                      ) : (
                        <p className="ps-admin__row-meta">
                          已处理：{submissionStatusLabel(submission.status)}
                          {submission.boardId ? ` · 板子 ${submission.boardId}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </motion.article>
              )
              })}
            </motion.div>
          </>
        )}

        {(approveSubmission.error || rejectSubmission.error || markSpam.error) && (
          <p className="ps-admin__error" role="alert">
            {((approveSubmission.error ?? rejectSubmission.error ?? markSpam.error) as Error)?.message ??
              '审核操作失败，请重试。'}
          </p>
        )}
      </section>
    </div>
  )
}

function submissionStatusLabel(status: AdminSubmission['status']) {
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已发布'
  if (status === 'rejected') return '已驳回'
  if (status === 'withdrawn') return '已撤回'
  return '垃圾'
}
