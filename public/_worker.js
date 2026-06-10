export default {
  async fetch(request, env) {
    const url = new URL(request.url)
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
