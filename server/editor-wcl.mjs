// Fixed WCL queries, using the same client-credentials flow as RaidGlass enrichment.
const REPORT_QUERY = `query STTEditorReport($code: String!) {
  reportData { report(code: $code) { title fights {
    id name encounterID difficulty startTime endTime kill friendlyPlayers
  } } }
}`
const ROSTER_QUERY = `query STTEditorRoster($code: String!, $fightIDs: [Int]) {
  reportData { report(code: $code) {
    masterData { actors(type: "Player") { id name subType server } }
    playerDetails(fightIDs: $fightIDs, includeCombatantInfo: true, translate: true)
  } }
}`
const fail = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode })

export function normalizeRoster(report) {
  let details = report?.playerDetails
  if (typeof details === 'string') { try { details = JSON.parse(details) } catch { throw fail('WCL 名单格式异常') } }
  details = details?.data?.playerDetails ?? details?.playerDetails ?? details
  if (!details || !['tanks', 'healers', 'dps'].some(key => Array.isArray(details[key]))) throw fail('WCL 未返回可识别的名单')
  const actors = new Map((report.masterData?.actors ?? []).map(a => [a.id, a]))
  const members = new Map()
  for (const entry of ['tanks', 'healers', 'dps'].flatMap(key => details[key] ?? [])) {
    const actor = actors.get(entry.id)
    const name = String(entry.name ?? actor?.name ?? '').trim()
    const server = String(entry.server?.name ?? entry.server ?? actor?.server ?? '').replace(/\s/g, '')
    if (!name || /[\s,;=|\[\]{}#]/u.test(name) || /[,;=|\[\]{}#]/u.test(server)) throw fail('WCL 返回了无法写入方案的角色名称')
    const specs = entry.specs ?? []
    const only = specs.length === 1 ? specs[0] : null
    const spec = typeof only === 'string' ? only : only?.spec ?? only?.name ?? ''
    const numericID = entry.specID ?? entry.combatantInfo?.specID ?? (typeof only === 'object' && only?.specID)
    const member = { name, server, className: String(entry.type ?? entry.class ?? actor?.subType ?? ''),
      specName: String(entry.spec ?? entry.specName ?? spec), specID: Number.isInteger(numericID) && numericID > 0 ? numericID : null }
    const key = `${name}\0${server}`
    const prior = members.get(key)
    if (prior && (prior.specName !== member.specName || prior.specID !== member.specID)) {
      member.specID = null; member.specName = '' // Ambiguous source: never choose an arbitrary spec.
    }
    members.set(key, member)
  }
  const result = [...members.values()].sort((a, b) => {
    const left = `${a.name}\0${a.server}`, right = `${b.name}\0${b.server}`
    return left < right ? -1 : left > right ? 1 : 0
  })
  if (!result.length) throw fail('这场战斗没有可导入的玩家')
  return result
}

export function registerEditorWclRoutes(app, { env = process.env, fetchImpl = fetch } = {}) {
  let token, expires = 0
  async function query(queryText, variables, log) {
    if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET) throw fail('本地未配置 WCL_CLIENT_ID / WCL_CLIENT_SECRET，仍可手动编辑名单', 503)
    if (!token || Date.now() >= expires) {
      const response = await fetchImpl('https://www.warcraftlogs.com/oauth/token', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Basic ${Buffer.from(`${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      })
      if (!response.ok) throw fail('WCL 服务认证失败', 502)
      const data = await response.json()
      if (!data.access_token) throw fail('WCL 未返回认证令牌')
      token = data.access_token
      expires = Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000
      log('authenticated')
    }
    const response = await fetchImpl('https://www.warcraftlogs.com/api/v2/client', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText, variables }),
    })
    log('upstream', { status: response.status })
    if (response.status === 401) { token = null; expires = 0 }
    if (response.status === 429) throw fail('WCL 查询额度不足，请稍后重试', 429)
    if (!response.ok) throw fail('WCL 查询失败，请稍后重试')
    const data = await response.json()
    if (data.errors?.length || !data.data?.reportData?.report) throw fail('报告不可读取，请检查链接或访问权限', 403)
    return data.data.reportData.report
  }
  for (const kind of ['report', 'roster']) {
    app.get(`/api/editor/wcl/${kind}`, async (req, reply) => {
      const traceID = req.id
      const log = (stage, fields = {}) => console.info('[STT editor WCL]', { traceID, kind, stage, ...fields })
      const code = req.query.code
      const fight = Number(req.query.fight)
      log('start', { fight: Number.isFinite(fight) ? fight : undefined })
      try {
        if (typeof code !== 'string' || !/^[A-Za-z0-9]{16}$/.test(code)
          || (kind === 'roster' && (!Number.isSafeInteger(fight) || fight <= 0))) throw fail('WCL 报告或战斗编号不合法', 400)
        const report = await query(kind === 'report' ? REPORT_QUERY : ROSTER_QUERY,
          kind === 'report' ? { code } : { code, fightIDs: [fight] }, log)
        const result = kind === 'report'
          ? { title: report.title, fights: (report.fights ?? []).filter(f => f.encounterID > 0) }
          : { members: normalizeRoster(report) }
        log('end', { result: 'ok', count: (result.members ?? result.fights).length })
        return result
      } catch (error) {
        const message = error.name === 'TimeoutError' ? 'WCL 查询超时，请重试' : error.statusCode ? error.message : 'WCL 查询失败，请稍后重试'
        log('end', { result: 'failed', reason: message })
        return reply.code(error.statusCode ?? 502).send({ error: message })
      }
    })
  }
}
