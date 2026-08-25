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

    if (url.pathname.startsWith('/api/')) {
      const upstream = new URL(url.pathname + url.search, 'https://planshare-api.a549617612.workers.dev')
      return fetch(new Request(upstream, request))
    }

    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || request.method !== 'GET') return response
    if (url.pathname.startsWith('/assets/')) return response

    const indexUrl = new URL('/', url)
    return env.ASSETS.fetch(new Request(indexUrl, request))
  },
}
