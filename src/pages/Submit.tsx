import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Difficulty, SubmissionReceipt, SubmissionStatus } from '../data/types'
import {
  useBoard,
  useCreateSubmission,
  useCreatorMe,
  useCreatorSession,
  useRaid,
  useRaids,
  useSubmissionReceipt,
} from '../api/hooks'
import { Button, SectionHeading, Tag } from '../components/ui'
import { staggerContainer, staggerItem, fadeUp } from '../lib/motion'
import { copyToClipboard } from '../lib/clipboard'
import './Submit.css'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

const SUBMIT_DRAFT_KEY = 'planshare_submit_draft_v1'
const CREATOR_USERNAME_PATTERN = /^[a-z0-9_-]{3,24}$/

function spamReasonLabel(reason: string) {
  if (reason === 'honeypot') return '表单异常'
  if (reason === 'duplicate_content') return '同一网络下重复正文，系统不会重复进入审核'
  if (reason === 'content_blacklist') return '内容风险'
  return reason || '内容风险'
}

function receiptStatusLabel(status: SubmissionStatus) {
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已发布'
  if (status === 'rejected') return '未通过'
  if (status === 'spam') return '被系统拦截'
  if (status === 'withdrawn') return '已撤回'
  return '未知状态'
}

function receiptStatusCopy(receipt: SubmissionReceipt) {
  if (receipt.status === 'pending') return '管理员还没有处理，请稍后再来查。'
  if (receipt.status === 'approved') return '这份投稿已经公开，可以直接打开战术板。'
  if (receipt.status === 'rejected') {
    return receipt.reviewNote ? `管理员备注：${receipt.reviewNote}` : '这份投稿没有通过，可以按反馈修改后重新投稿。'
  }
  if (receipt.status === 'spam') return `未进入人工审核：${spamReasonLabel(receipt.spamReason ?? '')}。`
  if (receipt.status === 'withdrawn') return '这份投稿已撤回，需要重新提交才会进入审核。'
  return '状态暂时无法识别。'
}

function receiptStatusTone(status: SubmissionStatus) {
  if (status === 'approved') return 'is-success'
  if (status === 'rejected' || status === 'spam' || status === 'withdrawn') return 'is-warning'
  return ''
}

function receiptCanResubmit(status: SubmissionStatus) {
  return status === 'rejected' || status === 'spam' || status === 'withdrawn'
}

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
  const receiptLookup = useSubmissionReceipt()
  const creatorSession = useCreatorSession()
  const creatorMeQuery = useCreatorMe(creatorSession.isAuthed)
  const [searchParams, setSearchParams] = useSearchParams()
  const templateBoardId = searchParams.get('from') || ''
  const contextRaidId = searchParams.get('raidId') || ''
  const contextBossId = searchParams.get('bossId') || ''
  const receiptParam = searchParams.get('receipt') || ''
  const templateQuery = useBoard(templateBoardId || undefined)
  const appliedTemplateId = useRef('')
  const appliedContextKey = useRef('')
  const appliedReceiptId = useRef('')
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
  const [submittedKind, setSubmittedKind] = useState<'regular' | 'creator' | 'creatorSubmission' | ''>('')
  const [submittedStatus, setSubmittedStatus] = useState<SubmissionStatus | ''>('')
  const [submittedSpamReason, setSubmittedSpamReason] = useState('')
  const [receiptCopyStatus, setReceiptCopyStatus] = useState('')
  const [receiptId, setReceiptId] = useState(receiptParam)
  const [receiptLocalError, setReceiptLocalError] = useState('')
  const creatorNamePrefilled = useRef(false)

  const raidDetailQuery = useRaid(raidId || undefined)
  const bosses = raidDetailQuery.data?.bosses ?? []
  const pending = createSubmission.isPending
  const loggedInCreator = creatorMeQuery.data?.user
  const loggedInAuthor = creatorMeQuery.data?.author
  const loggedInCreatorName = loggedInAuthor?.name || loggedInCreator?.username || ''
  const isLoggedInCreator = creatorSession.isAuthed && !!loggedInCreator
  const creatorPasswordHint =
    wantsCreatorProfile && creatorPassword.length > 0 && creatorPassword.length < 8
      ? `密码至少 8 位，还差 ${8 - creatorPassword.length} 位。`
      : '用于以后登录创作者后台，至少 8 位。'
  const creatorPasswordMismatch =
    wantsCreatorProfile &&
    creatorPassword.length >= 8 &&
    creatorPasswordConfirm.length > 0 &&
    creatorPassword !== creatorPasswordConfirm
  const creatorUsernameValue = creatorUsername.trim()
  const creatorUsernameInvalid =
    wantsCreatorProfile && creatorUsernameValue !== '' && !CREATOR_USERNAME_PATTERN.test(creatorUsernameValue)
  const creatorUsernameHint = creatorUsernameInvalid
    ? '用户名需要 3-24 位，只能使用小写英文、数字、下划线或短横线。'
    : '3-24 位小写英文、数字、_ 或 -。'
  const creatorPasswordConfirmHint = creatorPasswordMismatch
    ? '两次密码不一致。'
    : '再输入一次，避免账号创建后无法登录。'
  const missingSubmitItems = [
    title.trim() === '' ? '标题' : '',
    raidId === '' ? '团本' : '',
    bossId === '' ? 'BOSS' : '',
    submitterName.trim() === '' ? (wantsCreatorProfile ? '作者名' : '投稿署名') : '',
    wantsCreatorProfile && creatorUsernameValue === '' ? '登录用户名' : '',
    creatorUsernameInvalid ? '登录用户名格式' : '',
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
  const editableFingerprint = [
    title,
    raidId,
    bossId,
    difficulty,
    description,
    contentText,
    submitterName,
    wantsCreatorProfile ? 'creator' : 'regular',
    creatorUsername,
    creatorPassword,
    creatorPasswordConfirm,
    contact,
    creatorBio,
    creatorGuildName,
    creatorGuildRecruit,
    creatorGuildContact,
  ].join('\u001f')
  const previousEditableFingerprint = useRef(editableFingerprint)

  useEffect(() => {
    draftHydrated.current = true
  }, [])

  useEffect(() => {
    if (creatorMeQuery.isError && creatorSession.isUnauthorized(creatorMeQuery.error)) {
      creatorSession.logout()
    }
  }, [creatorMeQuery.error, creatorMeQuery.isError, creatorSession])

  useEffect(() => {
    if (!creatorSession.isAuthed || !wantsCreatorProfile) return
    setWantsCreatorProfile(false)
    setCreatorUsername('')
    setCreatorPassword('')
    setCreatorPasswordConfirm('')
    setContact('')
  }, [creatorSession.isAuthed, wantsCreatorProfile])

  useEffect(() => {
    if (!loggedInCreatorName || creatorNamePrefilled.current || submitterName.trim()) return
    creatorNamePrefilled.current = true
    setSubmitterName(loggedInCreatorName)
  }, [loggedInCreatorName, submitterName])

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
    const contextKey = `${contextRaidId}:${contextBossId}`
    if (templateBoardId || !contextRaidId || !contextBossId || appliedContextKey.current === contextKey) return
    appliedContextKey.current = contextKey
    setRaidId(contextRaidId)
    setBossId(contextBossId)
  }, [contextBossId, contextRaidId, templateBoardId])

  useEffect(() => {
    const nextReceiptId = receiptParam.trim()
    if (!nextReceiptId || appliedReceiptId.current === nextReceiptId) return
    appliedReceiptId.current = nextReceiptId
    setReceiptId(nextReceiptId)
    setReceiptLocalError('')
    receiptLookup.mutate(nextReceiptId)
  }, [receiptParam])

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

  useEffect(() => {
    if (pending) return
    if (previousEditableFingerprint.current === editableFingerprint) return
    previousEditableFingerprint.current = editableFingerprint
    if (localError) setLocalError('')
    if (createSubmission.error) createSubmission.reset()
  }, [
    editableFingerprint,
    pending,
    localError,
    createSubmission,
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
    setSubmittedStatus('')
    setSubmittedSpamReason('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    setSubmittedId('')
    setSubmittedKind('')
    setSubmittedStatus('')
    setSubmittedSpamReason('')
    setReceiptCopyStatus('')
    if (!canSubmit) {
      setLocalError(
        wantsCreatorProfile
          ? '申请创作者需要填写用户名、至少 8 位密码，并确认两次密码一致。'
          : '请补全必填项。',
      )
      return
    }

    const requestedCreator = wantsCreatorProfile && !isLoggedInCreator
    const requestedCreatorSubmission = isLoggedInCreator

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
          setSubmittedStatus(submission.status)
          setSubmittedSpamReason(submission.spamReason ?? '')
          setReceiptCopyStatus('')
          setSubmittedKind(
            requestedCreator && submission.creatorAuth?.token
              ? 'creator'
              : requestedCreatorSubmission
                ? 'creatorSubmission'
                : 'regular',
          )
          if (submission.creatorAuth?.token) {
            creatorSession.login(submission.creatorAuth.token)
          }
          if (submission.status !== 'spam') {
            writeSubmitDraft(EMPTY_DRAFT)
            resetForm()
          }
        },
      },
    )
  }

  async function copySubmittedId() {
    if (!submittedId) return
    const copied = await copyToClipboard(submittedId)
    setReceiptCopyStatus(copied ? '已复制投稿编号。' : '复制失败，请手动记录投稿编号。')
  }

  function submitReceiptLookup(e: React.FormEvent) {
    e.preventDefault()
    const nextReceiptId = receiptId.trim()
    if (!nextReceiptId) {
      receiptLookup.reset()
      setReceiptLocalError('请先填写投稿编号。')
      return
    }
    setReceiptLocalError('')
    receiptLookup.mutate(nextReceiptId)
  }

  function startNewSubmissionFromReceipt() {
    receiptLookup.reset()
    setReceiptId('')
    setReceiptLocalError('')
    setSearchParams({})
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

      {!templateBoardId && contextRaidId && contextBossId && (
        <p className="ps-submit__template-note">
          已带入团本和 BOSS，补上标题与战术正文即可提交。
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

      <section className="ps-submit__receipt-lookup glass" aria-labelledby="ps-submit-receipt-title">
        <div className="ps-submit__receipt-head">
          <div>
            <h2 id="ps-submit-receipt-title">查询投稿状态</h2>
            <p>输入投稿编号，查看这份投稿现在是待审核、已发布还是需要修改。</p>
          </div>
        </div>
        <form className="ps-submit__receipt-form" onSubmit={submitReceiptLookup}>
          <label className="ps-submit__label" htmlFor="ps-submit-receipt-id">
            投稿编号
          </label>
          <input
            id="ps-submit-receipt-id"
            className="ps-submit__input"
            value={receiptId}
            onChange={(e) => {
              setReceiptId(e.target.value)
              setReceiptLocalError('')
              if (receiptLookup.error || receiptLookup.data) receiptLookup.reset()
            }}
            placeholder="粘贴投稿编号"
          />
          <Button type="submit" variant="secondary" disabled={receiptLookup.isPending}>
            {receiptLookup.isPending ? '查询中…' : '查询'}
          </Button>
        </form>
        {(receiptLocalError || receiptLookup.error) && (
          <p className="ps-submit__receipt-error" role="alert">
            {receiptLocalError || (receiptLookup.error as Error).message}
          </p>
        )}
        {receiptLookup.data && (
          <div className="ps-submit__receipt-result" role="status">
            <div>
              <p className={`ps-submit__receipt-kicker ${receiptStatusTone(receiptLookup.data.status)}`}>
                {receiptStatusLabel(receiptLookup.data.status)}
              </p>
              <h3>{receiptLookup.data.title}</h3>
              <p>{receiptStatusCopy(receiptLookup.data)}</p>
            </div>
            {receiptLookup.data.status === 'approved' && receiptLookup.data.boardId && (
              <Button variant="primary" to={`/board/${receiptLookup.data.boardId}`}>
                打开战术板
              </Button>
            )}
            {receiptCanResubmit(receiptLookup.data.status) && (
              <Button variant="secondary" onClick={startNewSubmissionFromReceipt}>
                重新投稿
              </Button>
            )}
          </div>
        )}
      </section>

      {isLoggedInCreator && (
        <p className="ps-submit__creator-session">
          已登录为 {loggedInCreatorName}；这次投稿会进入你的创作者后台审核进度，不需要重新申请账号。
        </p>
      )}

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
            {isLoggedInCreator ? (
              <p className="ps-submit__identity-note">
                使用当前创作者账号投稿；通过审核后会累计到直发资格。
              </p>
            ) : (
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
            )}
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
                    aria-describedby="ps-submit-username-hint"
                    value={creatorUsername}
                    onChange={(e) => setCreatorUsername(e.target.value.toLowerCase())}
                    placeholder="3-24 位小写英文、数字、_ 或 -"
                    maxLength={24}
                  />
                  <p
                    className={creatorUsernameInvalid ? 'ps-submit__hint is-error' : 'ps-submit__hint'}
                    id="ps-submit-username-hint"
                  >
                    {creatorUsernameHint}
                  </p>
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
          <motion.div
            className={submittedStatus === 'spam' ? 'ps-submit__error' : 'ps-submit__success'}
            role={submittedStatus === 'spam' ? 'alert' : 'status'}
            variants={reduce ? undefined : staggerItem}
          >
            <p>
              {submittedStatus === 'spam'
                ? `投稿已被系统拦截，未进入人工审核：${spamReasonLabel(submittedSpamReason)}。请修改后重新提交。`
                : submittedKind === 'creator'
                  ? `账号已创建，投稿已进入审核。投稿编号：${submittedId}。`
                  : submittedKind === 'creatorSubmission'
                    ? `投稿已进入你的创作者审核进度。投稿编号：${submittedId}。`
                    : `投稿已进入审核，不会立刻公开。投稿编号：${submittedId}。`}
            </p>
            {submittedStatus !== 'spam' && (
              <div className="ps-submit__success-actions">
                <Button variant="secondary" onClick={copySubmittedId}>
                  复制投稿编号
                </Button>
                <Button variant="secondary" to={`/submit?receipt=${encodeURIComponent(submittedId)}`}>
                  查看审核状态
                </Button>
                {(submittedKind === 'creator' || submittedKind === 'creatorSubmission') && (
                  <Button variant="secondary" to="/creator">
                    进入创作者后台
                  </Button>
                )}
                <Button variant="secondary" to="/">
                  回首页浏览
                </Button>
              </div>
            )}
            {submittedStatus !== 'spam' && receiptCopyStatus && (
              <p className="ps-submit__receipt-status" role="status">
                {receiptCopyStatus}
              </p>
            )}
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
