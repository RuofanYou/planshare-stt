import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Difficulty } from '../data/types'
import { useBoard, useCreateSubmission, useCreatorSession, useRaid, useRaids } from '../api/hooks'
import { Button, SectionHeading, Tag } from '../components/ui'
import { staggerContainer, staggerItem, fadeUp } from '../lib/motion'
import './Submit.css'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

const SUBMIT_DRAFT_KEY = 'planshare_submit_draft_v1'

interface SubmitDraft {
  title: string
  raidId: string
  bossId: string
  difficulty: Difficulty
  description: string
  contentText: string
  submitterName: string
  wantsCreatorProfile: boolean
  creatorUsername: string
  creatorBio: string
  creatorGuildName: string
  creatorGuildRecruit: string
  creatorGuildContact: string
}

const EMPTY_DRAFT: SubmitDraft = {
  title: '',
  raidId: '',
  bossId: '',
  difficulty: 'mythic',
  description: '',
  contentText: '',
  submitterName: '',
  wantsCreatorProfile: false,
  creatorUsername: '',
  creatorBio: '',
  creatorGuildName: '',
  creatorGuildRecruit: '',
  creatorGuildContact: '',
}

function readSubmitDraft(): SubmitDraft {
  if (typeof window === 'undefined') return EMPTY_DRAFT
  try {
    const raw = window.localStorage.getItem(SUBMIT_DRAFT_KEY)
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw) as Partial<SubmitDraft>
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      difficulty: parsed.difficulty === 'heroic' ? 'heroic' : 'mythic',
      wantsCreatorProfile: parsed.wantsCreatorProfile === true,
    }
  } catch {
    return EMPTY_DRAFT
  }
}

function hasDraftContent(draft: SubmitDraft) {
  return Boolean(
    draft.title.trim() ||
      draft.raidId ||
      draft.bossId ||
      draft.description.trim() ||
      draft.contentText.trim() ||
      draft.submitterName.trim() ||
      draft.creatorUsername.trim() ||
      draft.creatorBio.trim() ||
      draft.creatorGuildName.trim() ||
      draft.creatorGuildRecruit.trim() ||
      draft.creatorGuildContact.trim(),
  )
}

function writeSubmitDraft(draft: SubmitDraft) {
  if (typeof window === 'undefined') return
  try {
    if (hasDraftContent(draft)) {
      window.localStorage.setItem(SUBMIT_DRAFT_KEY, JSON.stringify(draft))
    } else {
      window.localStorage.removeItem(SUBMIT_DRAFT_KEY)
    }
  } catch {
    // localStorage 不可用时忽略；投稿本身不依赖草稿。
  }
}

export default function Submit() {
  const reduce = useReducedMotion()
  const raidsQuery = useRaids()
  const createSubmission = useCreateSubmission()
  const creatorSession = useCreatorSession()
  const [searchParams] = useSearchParams()
  const templateBoardId = searchParams.get('from') || ''
  const templateQuery = useBoard(templateBoardId || undefined)
  const appliedTemplateId = useRef('')
  const initialDraft = useRef(readSubmitDraft())
  const draftHydrated = useRef(false)

  const [title, setTitle] = useState(initialDraft.current.title)
  const [raidId, setRaidId] = useState(initialDraft.current.raidId)
  const [bossId, setBossId] = useState(initialDraft.current.bossId)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDraft.current.difficulty)
  const [description, setDescription] = useState(initialDraft.current.description)
  const [contentText, setContentText] = useState(initialDraft.current.contentText)
  const [submitterName, setSubmitterName] = useState(initialDraft.current.submitterName)
  const [wantsCreatorProfile, setWantsCreatorProfile] = useState(initialDraft.current.wantsCreatorProfile)
  const [creatorUsername, setCreatorUsername] = useState(initialDraft.current.creatorUsername)
  const [creatorPassword, setCreatorPassword] = useState('')
  const [creatorPasswordConfirm, setCreatorPasswordConfirm] = useState('')
  const [contact, setContact] = useState('')
  const [creatorBio, setCreatorBio] = useState(initialDraft.current.creatorBio)
  const [creatorGuildName, setCreatorGuildName] = useState(initialDraft.current.creatorGuildName)
  const [creatorGuildRecruit, setCreatorGuildRecruit] = useState(initialDraft.current.creatorGuildRecruit)
  const [creatorGuildContact, setCreatorGuildContact] = useState(initialDraft.current.creatorGuildContact)
  const [website, setWebsite] = useState('')
  const [localError, setLocalError] = useState('')
  const [submittedId, setSubmittedId] = useState('')
  const [submittedKind, setSubmittedKind] = useState<'regular' | 'creator' | ''>('')

  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []
  const pending = createSubmission.isPending
  const creatorPasswordHint =
    wantsCreatorProfile && creatorPassword.length > 0 && creatorPassword.length < 8
      ? `密码至少 8 位，还差 ${8 - creatorPassword.length} 位。`
      : '用于以后登录创作者后台，至少 8 位。'
  const creatorPasswordMismatch =
    wantsCreatorProfile &&
    creatorPassword.length >= 8 &&
    creatorPasswordConfirm.length > 0 &&
    creatorPassword !== creatorPasswordConfirm
  const creatorPasswordConfirmHint = creatorPasswordMismatch
    ? '两次密码不一致。'
    : '再输入一次，避免账号创建后无法登录。'
  const missingSubmitItems = [
    title.trim() === '' ? '标题' : '',
    raidId === '' ? '团本' : '',
    bossId === '' ? 'BOSS' : '',
    submitterName.trim() === '' ? (wantsCreatorProfile ? '作者名' : '投稿署名') : '',
    wantsCreatorProfile && creatorUsername.trim() === '' ? '登录用户名' : '',
    wantsCreatorProfile && creatorPassword.length < 8 ? '登录密码至少 8 位' : '',
    wantsCreatorProfile && creatorPassword.length >= 8 && creatorPassword !== creatorPasswordConfirm
      ? '确认密码一致'
      : '',
    contentText.trim() === '' ? '战术正文' : '',
  ].filter(Boolean)
  const canSubmit = missingSubmitItems.length === 0 && !pending
  const submitReadinessText =
    missingSubmitItems.length > 0
      ? `还差：${missingSubmitItems.join('、')}`
      : pending
        ? '正在提交，请稍候。'
        : '信息已补齐，可以提交审核。'
  const hasVisibleDraft = hasDraftContent({
    title,
    raidId,
    bossId,
    difficulty,
    description,
    contentText,
    submitterName,
    wantsCreatorProfile,
    creatorUsername,
    creatorBio,
    creatorGuildName,
    creatorGuildRecruit,
    creatorGuildContact,
  })

  useEffect(() => {
    draftHydrated.current = true
  }, [])

  useEffect(() => {
    const template = templateQuery.data?.board
    if (!templateBoardId || !template || appliedTemplateId.current === templateBoardId) return
    appliedTemplateId.current = templateBoardId
    setTitle(`基于 ${template.title} 的调整`.slice(0, 80))
    setRaidId(template.raidId)
    setBossId(template.bossId ?? '')
    setDifficulty(template.difficulty)
    setDescription(`基于「${template.title}」修改`.slice(0, 120))
    setContentText(template.contentText)
  }, [templateBoardId, templateQuery.data])

  useEffect(() => {
    if (!draftHydrated.current) return
    writeSubmitDraft({
      title,
      raidId,
      bossId,
      difficulty,
      description,
      contentText,
      submitterName,
      wantsCreatorProfile,
      creatorUsername,
      creatorBio,
      creatorGuildName,
      creatorGuildRecruit,
      creatorGuildContact,
    })
  }, [
    title,
    raidId,
    bossId,
    difficulty,
    description,
    contentText,
    submitterName,
    wantsCreatorProfile,
    creatorUsername,
    creatorBio,
    creatorGuildName,
    creatorGuildRecruit,
    creatorGuildContact,
  ])

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
    setCreatorUsername('')
    setCreatorPassword('')
    setCreatorPasswordConfirm('')
    setContact('')
    setCreatorBio('')
    setCreatorGuildName('')
    setCreatorGuildRecruit('')
    setCreatorGuildContact('')
    setWebsite('')
  }

  function clearDraft() {
    writeSubmitDraft(EMPTY_DRAFT)
    resetForm()
    setLocalError('')
    setSubmittedId('')
    setSubmittedKind('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    setSubmittedId('')
    setSubmittedKind('')
    if (!canSubmit) {
      setLocalError(
        wantsCreatorProfile
          ? '申请创作者需要填写用户名、至少 8 位密码，并确认两次密码一致。'
          : '请补全必填项。',
      )
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
        creatorUsername: wantsCreatorProfile ? creatorUsername.trim().toLowerCase() : undefined,
        creatorPassword: wantsCreatorProfile ? creatorPassword : undefined,
        contact: wantsCreatorProfile ? contact.trim() : undefined,
        creatorBio: creatorBio.trim() || undefined,
        creatorGuildName: creatorGuildName.trim() || undefined,
        creatorGuildRecruit: creatorGuildRecruit.trim() || undefined,
        creatorGuildContact: creatorGuildContact.trim() || undefined,
        website: website.trim() || undefined,
      },
      {
        onSuccess: (submission) => {
          setSubmittedId(submission.id)
          setSubmittedKind(requestedCreator && submission.creatorAuth?.token ? 'creator' : 'regular')
          if (submission.creatorAuth?.token) {
            creatorSession.login(submission.creatorAuth.token)
          }
          writeSubmitDraft(EMPTY_DRAFT)
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

      {templateBoardId && (
        <p className="ps-submit__template-note">
          {templateQuery.isError
            ? '源战术板加载失败，可以继续手动投稿。'
            : templateQuery.isPending
              ? '正在带入源战术板内容…'
              : '已带入源战术板内容，修改后提交审核。'}
        </p>
      )}

      <div className="ps-submit__draft-bar">
        <p className="ps-submit__draft-note">
          草稿会自动保存在本机；密码和联系方式不会保存。
        </p>
        {hasVisibleDraft && !submittedId && (
          <button type="button" className="ps-submit__draft-clear" onClick={clearDraft}>
            清空草稿
          </button>
        )}
      </div>

      <motion.form
        className="ps-submit__form glass"
        onSubmit={handleSubmit}
        variants={reduce ? undefined : staggerContainer}
        initial="hidden"
        animate="show"
        noValidate
      >
        <div className="ps-submit__honeypot" aria-hidden="true">
          <label htmlFor="ps-submit-website">Website</label>
          <input
            id="ps-submit-website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

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
                <span>登录账号</span>
                <span>立即创建</span>
              </div>
              <div className="ps-submit__creator-fields">
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-username">
                    用户名
                  </label>
                  <input
                    id="ps-submit-username"
                    className="ps-submit__input"
                    autoComplete="username"
                    value={creatorUsername}
                    onChange={(e) => setCreatorUsername(e.target.value.toLowerCase())}
                    placeholder="3-24 位小写英文、数字、_ 或 -"
                    maxLength={24}
                  />
                </div>
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-password">
                    密码
                  </label>
                  <input
                    id="ps-submit-password"
                    className="ps-submit__input"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="ps-submit-password-hint"
                    value={creatorPassword}
                    onChange={(e) => setCreatorPassword(e.target.value)}
                    placeholder="至少 8 位"
                  />
                  <p className="ps-submit__hint" id="ps-submit-password-hint">
                    {creatorPasswordHint}
                  </p>
                </div>
                <div className="ps-submit__field">
                  <label className="ps-submit__label" htmlFor="ps-submit-password-confirm">
                    确认密码
                  </label>
                  <input
                    id="ps-submit-password-confirm"
                    className="ps-submit__input"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="ps-submit-password-confirm-hint"
                    value={creatorPasswordConfirm}
                    onChange={(e) => setCreatorPasswordConfirm(e.target.value)}
                    placeholder="再输入一次"
                  />
                  <p
                    className={creatorPasswordMismatch ? 'ps-submit__hint is-error' : 'ps-submit__hint'}
                    id="ps-submit-password-confirm-hint"
                  >
                    {creatorPasswordConfirmHint}
                  </p>
                </div>
                <div className="ps-submit__field ps-submit__field--wide">
                  <label className="ps-submit__label" htmlFor="ps-submit-contact">
                    联系方式（可选）
                  </label>
                  <input
                    id="ps-submit-contact"
                    className="ps-submit__input"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="仅管理员可见，可填 BattleTag / QQ / 微信"
                    maxLength={80}
                  />
                  <p className="ps-submit__hint">
                    账号提交后立即可用；战术板公开仍需管理员审核。
                  </p>
                </div>
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
          <motion.div className="ps-submit__success" role="status" variants={reduce ? undefined : staggerItem}>
            <p>
              {submittedKind === 'creator'
                ? `账号已创建，投稿已进入审核：${submittedId}。`
                : `投稿已进入审核，不会立刻公开：${submittedId}`}
            </p>
            <div className="ps-submit__success-actions">
              {submittedKind === 'creator' && (
                <Button variant="secondary" to="/creator">
                  进入创作者后台
                </Button>
              )}
              <Button variant="secondary" to="/">
                回首页浏览
              </Button>
            </div>
          </motion.div>
        )}

        {!submittedId && (
          <motion.p
            className={canSubmit ? 'ps-submit__ready is-ready' : 'ps-submit__ready'}
            role="status"
            variants={reduce ? undefined : staggerItem}
          >
            {submitReadinessText}
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
