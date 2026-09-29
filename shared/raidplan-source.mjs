const MAX_SOURCE_BYTES = 8 * 1024 * 1024

export async function readRaidPlan(code, fetcher = fetch) {
  const started = Date.now()
  const validCode = /^[A-Za-z0-9_-]{4,64}$/.test(code)
  const finish = (status, body) => {
    console.info('[rp2s] source', { code: validCode ? code : 'invalid', status, reason: body.error, elapsedMs: Date.now() - started })
    return { status, body }
  }
  if (!validCode) return finish(400, { error: '无效的 RaidPlan 方案码' })

  try {
    const url = `https://userdata.raidplan.io/${code}.json?stt=${Date.now()}`
    const response = await fetcher(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    })
    if (response.status === 404) return finish(404, { error: '方案不存在或尚未保存' })
    if (!response.ok || response.status !== 200 || !response.body) {
      return finish(502, { error: 'RaidPlan 暂时无法读取' })
    }
    if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) {
      return finish(413, { error: '方案数据过大' })
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parts = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SOURCE_BYTES) {
        await reader.cancel()
        return finish(413, { error: '方案数据过大' })
      }
      parts.push(decoder.decode(value, { stream: true }))
    }
    parts.push(decoder.decode())
    const document = JSON.parse(parts.join(''))
    if (!document || document.code !== code || document.version !== 2) {
      return finish(422, { error: 'RaidPlan 方案格式不受支持' })
    }
    return finish(200, document)
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return finish(timeout ? 504 : 502, { error: timeout ? '读取 RaidPlan 超时' : 'RaidPlan 暂时无法读取' })
  }
}
