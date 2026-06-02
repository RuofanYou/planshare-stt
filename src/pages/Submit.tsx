import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Difficulty } from '../data/types'
import { useCreateSubmission, useRaid, useRaids } from '../api/hooks'
import { Button, SectionHeading, Tag } from '../components/ui'
import { staggerContainer, staggerItem, fadeUp } from '../lib/motion'
import './Submit.css'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

export default function Submit() {
  const reduce = useReducedMotion()
  const raidsQuery = useRaids()
  const createSubmission = useCreateSubmission()

  const [title, setTitle] = useState('')
  const [raidId, setRaidId] = useState('')
  const [bossId, setBossId] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('mythic')
  const [description, setDescription] = useState('')
  const [contentText, setContentText] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [wantsCreatorProfile, setWantsCreatorProfile] = useState(false)
  const [contact, setContact] = useState('')
  const [creatorBio, setCreatorBio] = useState('')
  const [creatorGuildName, setCreatorGuildName] = useState('')
  const [creatorGuildRecruit, setCreatorGuildRecruit] = useState('')
  const [creatorGuildContact, setCreatorGuildContact] = useState('')
  const [localError, setLocalError] = useState('')
  const [submittedId, setSubmittedId] = useState('')
  const [submittedKind, setSubmittedKind] = useState<'regular' | 'creator' | ''>('')

  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []
  const pending = createSubmission.isPending
  const canSubmit =
    title.trim() !== '' &&
    raidId !== '' &&
    bossId !== '' &&
    contentText.trim() !== '' &&
    submitterName.trim() !== '' &&
    (!wantsCreatorProfile || contact.trim() !== '') &&
    !pending

  function handleRaidChange(next: string) {
    setRaidId(next)
    setBossId('')
  }

  function resetForm() {
    setTitle('')
    setRaidId('')
    setBossId('')
    setDifficulty('mythic')
    setDescription('')
    setContentText('')
    setSubmitterName('')
    setWantsCreatorProfile(false)
    setContact('')
    setCreatorBio('')
    setCreatorGuildName('')
    setCreatorGuildRecruit('')
    setCreatorGuildContact('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    setSubmittedId('')
    setSubmittedKind('')
    if (!canSubmit) {
      setLocalError(wantsCreatorProfile && !contact.trim() ? '申请成为创作者需要填写联系方式。' : '请补全必填项。')
      return
    }

    const requestedCreator = wantsCreatorProfile

    createSubmission.mutate(
      {
        title: title.trim(),
        raidId,
        bossId,
        difficulty,
        seasonVersion: raidsQuery.data?.find((raid) => raid.id === raidId)?.patch ?? '',
        description: description.trim(),
        contentText,
        submitterName: submitterName.trim(),
        wantsCreatorProfile,
        contact: wantsCreatorProfile ? contact.trim() : undefined,
        creatorBio: creatorBio.trim() || undefined,
        creatorGuildName: creatorGuildName.trim() || undefined,
        creatorGuildRecruit: creatorGuildRecruit.trim() || undefined,
        creatorGuildContact: creatorGuildContact.trim() || undefined,
      },
      {
        onSuccess: (submission) => {
          setSubmittedId(submission.id)
          setSubmittedKind(requestedCreator ? 'creator' : 'regular')
          resetForm()
        },
      },
    )
  }

  return (
    <div className="container ps-submit">
      <motion.header
        className="ps-submit__head"
        variants={reduce ? undefined : fadeUp}
        initial="hidden"
        animate="show"
      >
        <Tag variant="gold">投稿入口</Tag>
        <SectionHeading
          eyebrow="创作者"
          title="提交你的战术板"
          as="h1"
          size="display"
        />
      </motion.header>

      <motion.form
        className="ps-submit__form glass"
        onSubmit={handleSubmit}
        variants={reduce ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
        noValidate
      >
        <motion.div className="ps-submit__field" variants={reduce ? undefined : staggerItem}>
          <label className="ps-submit__label" htmlFor="ps-submit-title">
            标题
          </label>
          <input
            id="ps-submit-title"
            className="ps-submit__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：至暗之夜降临 · M"
            maxLength={80}
          />
        </motion.div>

        <motion.div className="ps-submit__grid" variants={reduce ? undefined : staggerItem}>
          <div className="ps-submit__field">
            <label className="ps-submit__label" htmlFor="ps-submit-raid">
              团本
            </label>
            <select
              id="ps-submit-raid"
              className="ps-submit__select"
              value={raidId}
              onChange={(e) => handleRaidChange(e.target.value)}
              disabled={raidsQuery.isLoading}
            >
              <option value="" disabled>
                {raidsQuery.isLoading ? '加载中…' : '选择团本'}
              </option>
              {(raidsQuery.data ?? []).map((raid) => (
                <option key={raid.id} value={raid.id}>
                  {raid.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ps-submit__field">
            <label className="ps-submit__label" htmlFor="ps-submit-boss">
              BOSS
            </label>
            <select
              id="ps-submit-boss"
              className="ps-submit__select"
              value={bossId}
              onChange={(e) => setBossId(e.target.value)}
              disabled={!raidId || raidDetailQuery.isLoading}
            >
              <option value="" disabled>
                {!raidId
                  ? '先选团本'
                  : raidDetailQuery.isLoading
                    ? '加载中…'
                    : '选择 BOSS'}
              </option>
              {bosses.map((boss) => (
                <option key={boss.id} value={boss.id}>
                  {boss.order}. {boss.name}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        <motion.div className="ps-submit__field" variants={reduce ? undefined : staggerItem}>
          <span className="ps-submit__label" id="ps-submit-diff-label">
            难度
          </span>
          <div className="ps-submit__seg glass" role="radiogroup" aria-labelledby="ps-submit-diff-label">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={difficulty === opt.value}
                className={difficulty === opt.value ? 'ps-submit__seg-btn is-active' : 'ps-submit__seg-btn'}
                onClick={() => setDifficulty(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div className="ps-submit__grid" variants={reduce ? undefined : staggerItem}>
          <div className="ps-submit__field">
            <label className="ps-submit__label" htmlFor="ps-submit-name">
              {wantsCreatorProfile ? '作者名 / 投稿署名' : '投稿署名'}
            </label>
            <input
              id="ps-submit-name"
              className="ps-submit__input"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder={wantsCreatorProfile ? '将作为作者主页名称' : '公开展示前会由管理员确认'}
              maxLength={40}
            />
          </div>
          <div className="ps-submit__field">
            <span className="ps-submit__label" id="ps-submit-identity-label">
              发布身份
            </span>
            <div className="ps-submit__identity" role="radiogroup" aria-labelledby="ps-submit-identity-label">
              <button
                type="button"
                role="radio"
                aria-checked={!wantsCreatorProfile}
                className={!wantsCreatorProfile ? 'ps-submit__identity-btn is-active' : 'ps-submit__identity-btn'}
                onClick={() => setWantsCreatorProfile(false)}
              >
                <span>普通投稿</span>
                <small>只给这块板署名</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={wantsCreatorProfile}
                className={wantsCreatorProfile ? 'ps-submit__identity-btn is-active' : 'ps-submit__identity-btn'}
                onClick={() => setWantsCreatorProfile(true)}
              >
                <span>申请创作者</span>
                <small>用署名建立作者页</small>
              </button>
            </div>
          </div>
        </motion.div>

        {wantsCreatorProfile && (
          <motion.div className="ps-submit__creator glass-strong" variants={reduce ? undefined : staggerItem}>
            <div className="ps-submit__creator-section">
              <div className="ps-submit__creator-section-head">
                <span>审核联系</span>
                <span>仅管理员可见</span>
              </div>
              <div className="ps-submit__field">
                <label className="ps-submit__label" htmlFor="ps-submit-contact">
                  联系方式
                </label>
                <input
                  id="ps-submit-contact"
                  className="ps-submit__input"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="微信 / QQ / BattleTag / 邮箱，任选一种"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="ps-submit__creator-section">
              <div className="ps-submit__creator-section-head">
                <span>公开资料</span>
                <span>用于作者页</span>
              </div>
              <div className="ps-submit__creator-fields">
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-bio">
                    作者简介（可选）
                  </label>
                  <input
                    id="ps-submit-bio"
                    className="ps-submit__input"
                    value={creatorBio}
                    onChange={(e) => setCreatorBio(e.target.value)}
                    placeholder="一句话介绍你或你的开荒定位"
                    maxLength={120}
                  />
                </div>
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-guild">
                    公会名（可选）
                  </label>
                  <input
                    id="ps-submit-guild"
                    className="ps-submit__input"
                    value={creatorGuildName}
                    onChange={(e) => setCreatorGuildName(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-guild-contact">
                    公会联系方式（可选）
                  </label>
                  <input
                    id="ps-submit-guild-contact"
                    className="ps-submit__input"
                    value={creatorGuildContact}
                    onChange={(e) => setCreatorGuildContact(e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div className="ps-submit__field ps-submit__field--wide">
                  <label className="ps-submit__label" htmlFor="ps-submit-recruit">
                    招募说明（可选）
                  </label>
                  <input
                    id="ps-submit-recruit"
                    className="ps-submit__input"
                    value={creatorGuildRecruit}
                    onChange={(e) => setCreatorGuildRecruit(e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div className="ps-submit__grid" variants={reduce ? undefined : staggerItem}>
          <div className="ps-submit__field">
            <label className="ps-submit__label" htmlFor="ps-submit-desc">
              说明（可选）
            </label>
            <input
              id="ps-submit-desc"
              className="ps-submit__input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选：补充适用场景"
              maxLength={120}
            />
          </div>
        </motion.div>

        <motion.div className="ps-submit__field" variants={reduce ? undefined : staggerItem}>
          <label className="ps-submit__label" htmlFor="ps-submit-content">
            战术正文
          </label>
          <textarea
            id="ps-submit-content"
            className="ps-submit__textarea glass-strong"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="粘贴 STT 战术方案"
            rows={16}
            spellCheck={false}
          />
        </motion.div>

        {(localError || createSubmission.error) && (
          <motion.p className="ps-submit__error" role="alert" variants={reduce ? undefined : staggerItem}>
            {localError || (createSubmission.error as Error)?.message || '提交失败，请稍后再试。'}
          </motion.p>
        )}

        {submittedId && (
          <motion.p className="ps-submit__success" role="status" variants={reduce ? undefined : staggerItem}>
            {submittedKind === 'creator'
              ? `投稿和创作者申请已进入审核：${submittedId}`
              : `投稿已进入审核，不会立刻公开：${submittedId}`}
          </motion.p>
        )}

        <motion.div className="ps-submit__actions" variants={reduce ? undefined : staggerItem}>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {pending ? '提交中…' : '提交审核'}
          </Button>
        </motion.div>
      </motion.form>
    </div>
  )
}
