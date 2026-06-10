import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Boss, Raid } from '../../data/types'
import {
  useCreateBoss,
  useCreateRaid,
  useDeleteBoss,
  useDeleteRaid,
  useRaid,
  useRaids,
} from '../../api/hooks'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { Button, EmptyState, GlassCard, SectionHeading, Tag } from '../../components/ui'
import { ListSkeleton, type AdminGuardProps } from './AdminShared'

export function ResourcesSection({
  isUnauthorized,
  onLogout,
}: AdminGuardProps) {
  const reduce = useReducedMotion()
  const raidsQuery = useRaids()
  const createRaid = useCreateRaid()
  const deleteRaid = useDeleteRaid()
  const [raidId, setRaidId] = useState('')
  const [raidName, setRaidName] = useState('')
  const [raidPatch, setRaidPatch] = useState('')

  function guard(error: unknown) {
    if (isUnauthorized(error)) onLogout()
  }

  function submitRaid(e: React.FormEvent) {
    e.preventDefault()
    if (!raidName.trim() || !raidPatch.trim()) return
    createRaid.mutate(
      {
        id: raidId.trim() || undefined,
        name: raidName.trim(),
        patch: raidPatch.trim(),
      },
      {
        onSuccess: () => {
          setRaidId('')
          setRaidName('')
          setRaidPatch('')
        },
        onError: guard,
      },
    )
  }

  if (raidsQuery.isLoading) return <ListSkeleton />
  if (raidsQuery.isError) {
    guard(raidsQuery.error)
    return (
      <EmptyState
        icon="error"
        text={(raidsQuery.error as Error)?.message ?? '团本加载失败。'}
        actionLabel="重试"
        onAction={() => raidsQuery.refetch()}
      />
    )
  }

  const raids = raidsQuery.data ?? []

  return (
    <div className="ps-admin__section">
      <form className="ps-admin__form glass" onSubmit={submitRaid}>
        <SectionHeading eyebrow="团本管理" title="新增团本" size="h2" />
        <div className="ps-admin__row-grid">
          <div className="ps-admin__field">
            <label className="ps-admin__label" htmlFor="ps-raid-id">ID（可选）</label>
            <input id="ps-raid-id" className="ps-admin__input" value={raidId} onChange={(e) => setRaidId(e.target.value)} placeholder="不填则自动生成" />
          </div>
          <div className="ps-admin__field">
            <label className="ps-admin__label" htmlFor="ps-raid-patch">版本</label>
            <input id="ps-raid-patch" className="ps-admin__input" value={raidPatch} onChange={(e) => setRaidPatch(e.target.value)} placeholder="例如 12.0.0" />
          </div>
        </div>
        <div className="ps-admin__field">
          <label className="ps-admin__label" htmlFor="ps-raid-name">团本名</label>
          <input id="ps-raid-name" className="ps-admin__input" value={raidName} onChange={(e) => setRaidName(e.target.value)} />
        </div>
        {createRaid.error && <p className="ps-admin__error">{(createRaid.error as Error).message}</p>}
        <div className="ps-admin__actions">
          <Button type="submit" variant="primary" disabled={createRaid.isPending || !raidName.trim() || !raidPatch.trim()}>
            {createRaid.isPending ? '保存中…' : '新增团本'}
          </Button>
        </div>
      </form>

      <section className="ps-admin__list-block" aria-label="团本与 BOSS">
        <SectionHeading eyebrow="资源" title="团本与 BOSS" size="h2" trailing={`${raids.length} 个团本`} />
        <motion.ul
          className="ps-admin__rows"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          {raids.map((raid) => (
            <motion.li key={raid.id} variants={reduce ? undefined : staggerItem}>
              <RaidResourceRow
                raid={raid}
                onGuard={guard}
                onDeleteRaid={() => deleteRaid.mutate(raid.id, { onError: guard })}
                raidDeleteBusy={deleteRaid.isPending && deleteRaid.variables === raid.id}
              />
            </motion.li>
          ))}
        </motion.ul>
      </section>
    </div>
  )
}

function RaidResourceRow({
  raid,
  onGuard,
  onDeleteRaid,
  raidDeleteBusy,
}: {
  raid: Raid
  onGuard: (error: unknown) => void
  onDeleteRaid: () => void
  raidDeleteBusy: boolean
}) {
  const raidQuery = useRaid(raid.id)
  const createBoss = useCreateBoss()
  const deleteBoss = useDeleteBoss()
  const [bossName, setBossName] = useState('')
  const [bossOrder, setBossOrder] = useState('')

  const bosses: Boss[] = raidQuery.data?.bosses ?? []

  function submitBoss(e: React.FormEvent) {
    e.preventDefault()
    const order = Number(bossOrder)
    if (!bossName.trim() || !Number.isInteger(order) || order < 1) return
    createBoss.mutate(
      { raidId: raid.id, name: bossName.trim(), order },
      {
        onSuccess: () => {
          setBossName('')
          setBossOrder('')
        },
        onError: onGuard,
      },
    )
  }

  return (
    <GlassCard tone="glass" as="div" className="ps-admin__row-card">
      <div className="ps-admin__row-main">
        <div className="ps-admin__row-flags">
          <Tag variant="gold">{raid.patch}</Tag>
          <Tag variant="neutral">{raid.boardCount} 块板</Tag>
        </div>
        <p className="ps-admin__row-title">{raid.name}</p>
        <p className="ps-admin__row-path">{raid.id}</p>
        <form className="ps-admin__inline-form" onSubmit={submitBoss}>
          <input
            className="ps-admin__input"
            value={bossName}
            onChange={(e) => setBossName(e.target.value)}
            placeholder="新增 BOSS 名"
          />
          <input
            className="ps-admin__input"
            value={bossOrder}
            onChange={(e) => setBossOrder(e.target.value)}
            placeholder="顺序"
            inputMode="numeric"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={createBoss.isPending}>
            新增 BOSS
          </Button>
        </form>
        {createBoss.error && <p className="ps-admin__error">{(createBoss.error as Error).message}</p>}
        {deleteBoss.error && <p className="ps-admin__error">{(deleteBoss.error as Error).message}</p>}
        <div className="ps-admin__boss-list">
          {bosses.map((boss) => (
            <span key={boss.id} className="ps-admin__boss-chip">
              {boss.order}. {boss.name}
              <button
                type="button"
                onClick={() => deleteBoss.mutate({ id: boss.id, raidId: raid.id }, { onError: onGuard })}
                disabled={deleteBoss.isPending}
              >
                删除
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="ps-admin__row-actions">
        <Button variant="ghost" size="sm" onClick={onDeleteRaid} disabled={raidDeleteBusy}>
          删除团本
        </Button>
      </div>
    </GlassCard>
  )
}
