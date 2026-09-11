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
