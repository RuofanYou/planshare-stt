import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button, Tag } from '../components/ui'
import { copyToClipboard } from '../lib/clipboard'
import { fadeUp, staggerContainer, staggerItem } from '../lib/motion'
import {
  createSttTranslatorRuntime,
  syncSttTranslatorAssets,
  type MrtBossOption,
  type TranslateResult,
  type TranslatorFormat,
  type TranslatorMode,
} from '../lib/stt-translator/runtime'
import './Translator.css'

type RuntimeState = {
  formats: TranslatorFormat[]
  bosses: MrtBossOption[]
  ready: boolean
  error: string
}

const EMPTY_RESULT: TranslateResult = {
  ok: true,
  outputText: '',
  eventCount: 0,
  phaseCount: 0,
  skipped: 0,
  totalLines: 0,
}

const MRT_BOSS_FALLBACK = 0

function createRuntimeState(): RuntimeState {
  try {
    const runtime = createSttTranslatorRuntime()
    const bosses = runtime.listMrtBossOptions()
    return {
      formats: runtime.listFormats(),
      bosses,
      ready: true,
      error: '',
    }
  } catch (error) {
    return {
      formats: [],
      bosses: [{ value: MRT_BOSS_FALLBACK, label: '自动 / 朴素直译 (pgN -> pN)' }],
      ready: false,
      error: error instanceof Error ? error.message : '翻译器初始化失败',
    }
  }
}

function formatName(formats: TranslatorFormat[], id?: string) {
  if (!id) return '自动识别'
  return formats.find((item) => item.id === id)?.name || id.toUpperCase()
}

function translateText(mode: TranslatorMode, text: string, mrtBoss: number): TranslateResult {
  if (!text.trim()) return EMPTY_RESULT
  try {
    return createSttTranslatorRuntime().translate({ mode, text, mrtBoss })
  } catch (error) {
    return {
      ...EMPTY_RESULT,
      ok: false,
      error: error instanceof Error ? error.message : '翻译失败',
    }
  }
}

export default function Translator() {
  const reduce = useReducedMotion()
  const manifest = syncSttTranslatorAssets()
  const runtimeState = useMemo(createRuntimeState, [])
  const defaultBoss = runtimeState.bosses[0]?.value ?? MRT_BOSS_FALLBACK
  const [mode, setMode] = useState<TranslatorMode>('auto')
  const [mrtBoss, setMrtBoss] = useState(defaultBoss)
  const [inputText, setInputText] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [trText, setTrText] = useState('')
  const [trStatus, setTrStatus] = useState('')
  const [trCopyStatus, setTrCopyStatus] = useState('')

  const result = useMemo(
    () => (runtimeState.ready ? translateText(mode, inputText, mrtBoss) : EMPTY_RESULT),
    [inputText, mode, mrtBoss, runtimeState.ready],
  )
  const statusError = runtimeState.error || result.error || ''
  const resolvedFormat = result.formatId || (mode === 'auto' ? undefined : mode)
  const showBossSelect = mode === 'auto' || mode === 'mrt'
  const canCopy = result.outputText.trim() !== ''
  const canExportTR = (result.outputText || inputText).trim() !== ''

  async function copyOutput() {
    if (!canCopy) return
    const ok = await copyToClipboard(result.outputText)
    setCopyStatus(ok ? '结果已复制' : '复制失败')
  }

  async function copyTR() {
    if (!trText.trim()) return
    const ok = await copyToClipboard(trText)
    setTrCopyStatus(ok ? 'TR 已复制' : '复制失败')
  }

  function clearAll() {
    setInputText('')
    setCopyStatus('')
    setTrText('')
    setTrStatus('')
    setTrCopyStatus('')
  }

  function exportTR() {
    setTrCopyStatus('')
    const sttText = (result.outputText || inputText).trim()
    if (!sttText) {
      setTrText('')
      setTrStatus('没有可导出的 STT 文本')
      return
    }

    try {
      const exported = createSttTranslatorRuntime().exportTR({ sttText, mrtBoss })
      setTrText(exported.outputText)
      setTrStatus(exported.ok ? 'TR 已生成' : exported.error || 'TR 导出失败')
    } catch (error) {
      setTrText('')
      setTrStatus(error instanceof Error ? error.message : 'TR 导出失败')
    }
  }

  return (
    <div className="ps-translator">
      <section className="container ps-translator__head" aria-labelledby="translator-title">
        <motion.div
          className="ps-translator__head-copy"
          variants={reduce ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={reduce ? undefined : staggerItem}>
            <Tag variant="gold" icon="star">
              STT 翻译器
            </Tag>
          </motion.div>
          <motion.h1
            id="translator-title"
            className="ps-translator__title text-gold-grad"
            variants={reduce ? undefined : staggerItem}
          >
            战术格式翻译器
          </motion.h1>
          <motion.p className="ps-translator__subtitle" variants={reduce ? undefined : staggerItem}>
            使用 STT 源码规则把 NSRT、MRT、TR 文本转成 STT 战术方案。
          </motion.p>
        </motion.div>
      </section>

      <section className="container" aria-label="翻译器工作台">
        <motion.div
          className="ps-translator__tool glass"
          variants={reduce ? undefined : fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="ps-translator__toolbar" aria-label="翻译选项">
            <label className="ps-translator__field">
              <span className="ps-translator__label">输入格式</span>
              <select
                className="ps-translator__select"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as TranslatorMode)
                  setCopyStatus('')
                  setTrStatus('')
                }}
              >
                <option value="auto">自动识别</option>
                {runtimeState.formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.name}
                  </option>
                ))}
              </select>
            </label>

            {showBossSelect && (
              <label className="ps-translator__field ps-translator__field--boss">
                <span className="ps-translator__label">MRT Boss 阶段</span>
                <select
                  className="ps-translator__select"
                  value={mrtBoss}
                  onChange={(event) => {
                    setMrtBoss(Number(event.target.value) || 0)
                    setCopyStatus('')
                    setTrStatus('')
                  }}
                >
                  {runtimeState.bosses.map((boss) => (
                    <option key={boss.value} value={boss.value}>
                      {boss.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="ps-translator__actions">
              <Button type="button" variant="secondary" size="sm" onClick={clearAll}>
                清空
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                leadingIcon="copy"
                disabled={!canCopy}
                onClick={copyOutput}
              >
                复制结果
              </Button>
            </div>
          </div>

          <div className="ps-translator__status" role="status" aria-live="polite">
            {statusError ? (
              <span className="ps-translator__status-error">{statusError}</span>
            ) : inputText.trim() ? (
              <>
                <span>格式：{formatName(runtimeState.formats, resolvedFormat)}</span>
                <span>事件：{result.eventCount}</span>
                <span>Phase：{result.phaseCount}</span>
                <span>跳过：{result.skipped}</span>
                <span>行数：{result.totalLines}</span>
                {result.encounterID ? <span>EncounterID：{result.encounterID}</span> : null}
                <span>Hash：{manifest.hash.slice(0, 10)}</span>
              </>
            ) : (
              <span>等待输入</span>
            )}
            {copyStatus && <span className="ps-translator__status-ok">{copyStatus}</span>}
          </div>

          <div className="ps-translator__panes">
            <label className="ps-translator__pane">
              <span className="ps-translator__pane-title">输入</span>
              <textarea
                className="ps-translator__textarea"
                value={inputText}
                onChange={(event) => {
                  setInputText(event.target.value)
                  setCopyStatus('')
                  setTrStatus('')
                  setTrCopyStatus('')
                }}
                spellCheck={false}
                placeholder="粘贴 NSRT、MRT 或 TR 文本"
              />
            </label>

            <label className="ps-translator__pane">
              <span className="ps-translator__pane-title">STT 输出</span>
              <textarea
                className="ps-translator__textarea ps-translator__textarea--output"
                value={result.outputText}
                readOnly
                spellCheck={false}
                placeholder="翻译结果会显示在这里"
              />
            </label>
          </div>

          <details className="ps-translator__advanced">
            <summary>高级：STT -&gt; TR 导出</summary>
            <div className="ps-translator__advanced-body">
              <div className="ps-translator__advanced-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canExportTR}
                  onClick={exportTR}
                >
                  导出 TR
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leadingIcon="copy"
                  disabled={!trText.trim()}
                  onClick={copyTR}
                >
                  复制 TR
                </Button>
                {(trStatus || trCopyStatus) && (
                  <span className="ps-translator__advanced-status">
                    {trCopyStatus || trStatus}
                  </span>
                )}
              </div>
              <textarea
                className="ps-translator__textarea ps-translator__textarea--tr"
                value={trText}
                readOnly
                spellCheck={false}
                placeholder="TR 导出结果会显示在这里"
              />
            </div>
          </details>
        </motion.div>
      </section>
    </div>
  )
}
