const VOICE_PACK_PATH = encodeURI('/downloads/STT-微软tts补充语音包.exe')
const VOICE_PACK_PARTS = [
  '/downloads/stt-microsoft-tts-supplement.part-aaa',
  '/downloads/stt-microsoft-tts-supplement.part-aab',
  '/downloads/stt-microsoft-tts-supplement.part-aac',
  '/downloads/stt-microsoft-tts-supplement.part-aad',
]
const VOICE_PACK_SIZE = 63984820
const VOICE_PACK_HEADERS = {
  'Content-Type': 'application/octet-stream',
  'Content-Disposition': 'attachment; filename="STT-tts.exe"; filename*=UTF-8\'\'STT-%E5%BE%AE%E8%BD%AFtts%E8%A1%A5%E5%85%85%E8%AF%AD%E9%9F%B3%E5%8C%85.exe',
  'Content-Length': String(VOICE_PACK_SIZE),
  'Cache-Control': 'public, max-age=0, must-revalidate',
}
const SKILL_ENTRY_PATH = '/skill/SKILL.md'
const SKILL_HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function isSkillEntryPath(pathname) {
  return ['/skill', '/skill/', '/skill/12.1', '/skill/12.1/'].includes(pathname)
    || pathname.startsWith('/skill%')
    || pathname.startsWith('/skill,')
}

function isSkillRequestPath(pathname) {
  return isSkillEntryPath(pathname) || pathname.startsWith('/skill/')
}

async function serveSkill(request, env, url) {
  const traceId = request.headers.get('cf-ray') || crypto.randomUUID()
  const targetPath = isSkillEntryPath(url.pathname)
    ? SKILL_ENTRY_PATH
    : url.pathname
  const event = {
    chain: 'stt-ai-writing-skill',
    traceId,
    method: request.method,
    path: url.pathname,
    targetPath,
  }
  console.info(JSON.stringify({ ...event, stage: 'started' }))

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    console.warn(JSON.stringify({ ...event, stage: 'rejected', reason: 'method_not_allowed', status: 405 }))
    return new Response('Method Not Allowed', { status: 405, headers: { ...SKILL_HEADERS, Allow: 'GET, HEAD' } })
  }

  try {
    const targetUrl = new URL(targetPath, url)
    const response = await env.ASSETS.fetch(new Request(targetUrl, request))
    const sourceType = response.headers.get('content-type') || ''
    if (!response.ok || sourceType.includes('text/html')) {
      console.warn(JSON.stringify({ ...event, stage: 'completed', result: 'not_found', status: 404 }))
      return new Response(request.method === 'HEAD' ? null : 'Not Found', { status: 404, headers: SKILL_HEADERS })
    }
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(SKILL_HEADERS)) headers.set(name, value)
    console.info(JSON.stringify({ ...event, stage: 'completed', result: 'served', status: response.status }))
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error(JSON.stringify({
      ...event,
      stage: 'failed',
      reason: error instanceof Error ? error.name : 'unknown',
    }))
    return new Response(request.method === 'HEAD' ? null : 'Skill unavailable', { status: 502, headers: SKILL_HEADERS })
  }
}

async function serveVoicePack(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    console.warn('[stt-voice-pack] rejected method=%s status=405', request.method)
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  console.info('[stt-voice-pack] start method=%s parts=%d size=%d', request.method, VOICE_PACK_PARTS.length, VOICE_PACK_SIZE)
  if (request.method === 'HEAD') return new Response(null, { headers: VOICE_PACK_HEADERS })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const part of VOICE_PACK_PARTS) {
          const response = await env.ASSETS.fetch(new Request(new URL(part, request.url)))
          if (!response.ok || !response.body) throw new Error(`part unavailable: ${part}`)

          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        }
        controller.close()
        console.info('[stt-voice-pack] complete parts=%d size=%d', VOICE_PACK_PARTS.length, VOICE_PACK_SIZE)
      } catch (error) {
        console.error('[stt-voice-pack] failed reason=%s', String(error))
        controller.error(error)
      }
    },
  })

  return new Response(stream, { headers: VOICE_PACK_HEADERS })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (isSkillRequestPath(url.pathname)) {
      return serveSkill(request, env, url)
    }
    if (url.pathname === '/generator' || url.pathname.startsWith('/generator/')) {
      const traceId = request.headers.get('cf-ray') || crypto.randomUUID()
      const event = {
        chain: 'stt-generator-gateway',
        traceId,
        method: request.method,
        path: url.pathname,
      }
      console.info(JSON.stringify({ ...event, stage: 'started' }))
      try {
        const response = await env.STT_LOKTAR_WEB.fetch(request)
        console.info(JSON.stringify({ ...event, stage: 'completed', status: response.status }))
        return response
      } catch (error) {
        console.error(
          JSON.stringify({
            ...event,
            stage: 'failed',
            reason: error instanceof Error ? error.name : 'unknown',
          }),
        )
        throw error
      }
    }

    if (url.pathname === '/log' || url.pathname.startsWith('/log/')) {
      const traceId = request.headers.get('cf-ray') || crypto.randomUUID()
      const headers = new Headers(request.headers)
      headers.set('x-planshare-trace-id', traceId)
      const event = {
        chain: 'raidglass-gateway',
        traceId,
        method: request.method,
        path: url.pathname,
      }
      console.info(JSON.stringify({ ...event, stage: 'started' }))
      try {
        const response = await env.RAIDGLASS_WEB.fetch(new Request(request, { headers }))
        console.info(JSON.stringify({ ...event, stage: 'completed', status: response.status }))
        return response
      } catch (error) {
        console.error(JSON.stringify({
          ...event,
          stage: 'failed',
          reason: error instanceof Error ? error.name : 'unknown',
        }))
        throw error
      }
    }

    if (url.pathname.startsWith('/api/')) {
      const upstream = new URL(url.pathname + url.search, 'https://planshare-api.a549617612.workers.dev')
      return fetch(new Request(upstream, request))
    }
    if (url.pathname === VOICE_PACK_PATH) return serveVoicePack(request, env)

    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || request.method !== 'GET') return response
    if (url.pathname.startsWith('/assets/')) return response

    const indexUrl = new URL('/', url)
    return env.ASSETS.fetch(new Request(indexUrl, request))
  },
}
