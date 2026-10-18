import { useRef, useState, type FormEvent } from 'react'
import { Button, Tag } from '../components/ui'
import { copyToClipboard } from '../lib/clipboard'
import '../../vendor/raidplan2stt/converter.js'
import './Translator.css'

type Warning = { step: number; type: string; reason: string }
type Result = { text: string; boards: number; warnings: Warning[] }
type Converter = {
  compileRaidPlan: (document: unknown) => { boards: unknown[]; warnings: Warning[] }
  encodePayload: (payload: unknown) => Promise<string>
}

function planCode(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('请粘贴完整的 RaidPlan 方案链接')
  }
  const match = /^\/plan\/([A-Za-z0-9_-]{4,64})\/?$/.exec(url.pathname)
  if (url.protocol !== 'https:' || url.hostname !== 'raidplan.io' || url.port || !match) {
    throw new Error('链接应为 https://raidplan.io/plan/方案码')
  }
  return match[1]
}

export default function Rp2s() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const id = ++requestId.current
    setResult(null)
    setError('')
    setCopyStatus('')
    let code = ''
    try {
      code = planCode(input)
      setLoading(true)
      const response = await fetch(`/api/raidplan/${code}`, { cache: 'no-store' })
      const document = await response.json()
      if (!response.ok) throw new Error(document.error || 'RaidPlan 暂时无法读取')
      if (requestId.current !== id) return
      const converter = (globalThis as typeof globalThis & { STTRaidPlanConverter?: Converter }).STTRaidPlanConverter
      if (!converter) throw new Error('转换器未加载，请刷新网页重试')
      const payload = converter.compileRaidPlan(document)
      const text = await converter.encodePayload(payload)
      if (requestId.current !== id) return
      setResult({ text, boards: payload.boards.length, warnings: payload.warnings })
      console.info('[rp2s] converted', { code, boards: payload.boards.length, warnings: payload.warnings.length })
    } catch (cause) {
      if (requestId.current !== id) return
      const message = cause instanceof Error ? cause.message : '转换失败，请重试'
      setError(message)
      console.error('[rp2s] failed', { code, reason: message })
    } finally {
      if (requestId.current === id) setLoading(false)
    }
  }

  async function copyResult() {
    if (!result) return
    setCopyStatus(await copyToClipboard(result.text) ? '结果已复制' : '复制失败，可点选下方字符串手动复制')
  }

  return (
    <div className="ps-translator">
      <section className="container ps-translator__head" aria-labelledby="rp2s-title">
        <div className="ps-translator__head-copy">
          <Tag variant="gold">STT 视觉画板</Tag>
          <h1 id="rp2s-title" className="ps-translator__title text-gold-grad">RaidPlan 转视觉画板</h1>
          <p className="ps-translator__subtitle">粘贴已保存的公开 RaidPlan 方案链接，生成可在 STT 中导入的画板字符串。</p>
        </div>
      </section>

      <section className="container" aria-label="RaidPlan 转换工具">
        <div className="ps-translator__tool glass">
          <form onSubmit={convert} className="ps-translator__field">
            <label className="ps-translator__label" htmlFor="rp2s-url">RaidPlan 链接</label>
            <input
              id="rp2s-url"
              className="ps-translator__select"
              type="url"
              required
              value={input}
              placeholder="https://raidplan.io/plan/…"
              onChange={(event) => {
                ++requestId.current
                setInput(event.target.value)
                setResult(null)
                setError('')
                setCopyStatus('')
                setLoading(false)
              }}
            />
            <div className="ps-translator__actions">
              <Button type="submit" disabled={loading}>{loading ? '转换中…' : '生成画板字符串'}</Button>
            </div>
          </form>

          <div className="ps-translator__status" role="status" aria-live="polite">
            {error ? <span className="ps-translator__status-error">{error}</span>
              : loading ? <span>正在读取并转换方案…</span>
                : result ? <><span>已生成 {result.boards} 页画板</span><span>跳过 {result.warnings.length} 个节点或素材</span></>
                  : <span>等待输入</span>}
            {copyStatus && <span className={copyStatus.startsWith('复制失败') ? 'ps-translator__status-error' : 'ps-translator__status-ok'}>{copyStatus}</span>}
          </div>

          {result && <>
            {result.warnings.length > 0 && <details className="ps-translator__advanced">
              <summary>查看转换警告（{result.warnings.length}）</summary>
              <ul className="ps-translator__advanced-body">
                {result.warnings.slice(0, 8).map((warning, index) =>
                  <li key={index}>Step {warning.step}：{warning.type}（{warning.reason}）</li>)}
              </ul>
            </details>}
            <label className="ps-translator__pane">
              <span className="ps-translator__pane-title">STT 画板字符串</span>
              <textarea className="ps-translator__textarea ps-translator__textarea--output" value={result.text} readOnly spellCheck={false} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div className="ps-translator__actions">
              <Button type="button" variant="secondary" leadingIcon="copy" onClick={copyResult}>复制字符串</Button>
            </div>
            <p className="ps-translator__subtitle">在游戏内打开 STT「视觉画板」，选择「导入 Boss」，粘贴此字符串。</p>
          </>}
        </div>
      </section>
    </div>
  )
}
