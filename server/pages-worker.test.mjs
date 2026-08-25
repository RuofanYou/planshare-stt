import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pagesWorker from '../public/_worker.js'

function assetsWithFallback() {
  const requests = []
  return {
    requests,
    binding: {
      async fetch(request) {
        requests.push(request)
        const path = new URL(request.url).pathname
        return path === '/' ? new Response('planshare-spa') : new Response('missing', { status: 404 })
      },
    },
  }
}

test('Pages config binds the private STT generator Worker', async () => {
  const config = JSON.parse(
    await readFile(new URL('../pages/wrangler.jsonc', import.meta.url), 'utf8'),
  )
  assert.deepEqual(config.services, [
    { binding: 'STT_LOKTAR_WEB', service: 'stt-loktar-web' },
  ])
})

test('generator routes keep method, body, headers and cookies on the Service Binding', async (t) => {
  t.mock.method(console, 'info', () => {})
  for (const path of ['/generator', '/generator/', '/generator/assets/app.js']) {
    const assets = assetsWithFallback()
    const seen = []
    const request = new Request(`https://zhaobanzi.pages.dev${path}?source=test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'session=public-test',
        'X-Forwarded-Test': 'kept',
      },
      body: JSON.stringify({ report: 'public-report' }),
    })
    const response = await pagesWorker.fetch(request, {
      ASSETS: assets.binding,
      STT_LOKTAR_WEB: {
        async fetch(forwarded) {
          seen.push({
            url: forwarded.url,
            method: forwarded.method,
            cookie: forwarded.headers.get('cookie'),
            marker: forwarded.headers.get('x-forwarded-test'),
            body: await forwarded.json(),
          })
          return new Response('generator')
        },
      },
    })

    assert.equal(await response.text(), 'generator')
    assert.deepEqual(seen, [
      {
        url: `https://zhaobanzi.pages.dev${path}?source=test`,
        method: 'POST',
        cookie: 'session=public-test',
        marker: 'kept',
        body: { report: 'public-report' },
      },
    ])
    assert.equal(assets.requests.length, 0, `${path} must not reach SPA assets`)
  }
})

test('generator API wins before the PlanShare API and SPA fallbacks', async (t) => {
  t.mock.method(console, 'info', () => {})
  const assets = assetsWithFallback()
  const upstreamFetch = t.mock.method(globalThis, 'fetch', async () => new Response('planshare-api'))
  const serviceFetch = t.mock.fn(async () => new Response('generator-api'))

  const response = await pagesWorker.fetch(
    new Request('https://zhaobanzi.pages.dev/generator/api/config'),
    { ASSETS: assets.binding, STT_LOKTAR_WEB: { fetch: serviceFetch } },
  )

  assert.equal(await response.text(), 'generator-api')
  assert.equal(serviceFetch.mock.callCount(), 1)
  assert.equal(upstreamFetch.mock.callCount(), 0)
  assert.equal(assets.requests.length, 0)
})

test('generator binding failures are traceable without logging request data', async (t) => {
  t.mock.method(console, 'info', () => {})
  const errorLog = t.mock.method(console, 'error', () => {})
  const request = new Request('https://zhaobanzi.pages.dev/generator/api/config', {
    headers: { Cookie: 'session=must-not-be-logged', 'cf-ray': 'trace-test' },
  })

  await assert.rejects(
    pagesWorker.fetch(request, {
      ASSETS: assetsWithFallback().binding,
      STT_LOKTAR_WEB: { fetch: async () => { throw new TypeError('binding unavailable') } },
    }),
    /binding unavailable/,
  )

  assert.equal(errorLog.mock.callCount(), 1)
  const event = JSON.parse(errorLog.mock.calls[0].arguments[0])
  assert.deepEqual(event, {
    chain: 'stt-generator-gateway',
    traceId: 'trace-test',
    method: 'GET',
    path: '/generator/api/config',
    stage: 'failed',
    reason: 'TypeError',
  })
})

test('existing PlanShare API and SPA routes keep their behavior', async (t) => {
  const assets = assetsWithFallback()
  const upstreamFetch = t.mock.method(globalThis, 'fetch', async (request) => {
    assert.equal(request.url, 'https://planshare-api.a549617612.workers.dev/api/raids?season=12.1')
    return new Response('planshare-api')
  })
  const serviceFetch = t.mock.fn()

  const apiResponse = await pagesWorker.fetch(
    new Request('https://zhaobanzi.pages.dev/api/raids?season=12.1'),
    { ASSETS: assets.binding, STT_LOKTAR_WEB: { fetch: serviceFetch } },
  )
  assert.equal(await apiResponse.text(), 'planshare-api')
  assert.equal(upstreamFetch.mock.callCount(), 1)

  for (const path of ['/', '/translator', '/loot']) {
    const response = await pagesWorker.fetch(
      new Request(`https://zhaobanzi.pages.dev${path}`),
      { ASSETS: assets.binding, STT_LOKTAR_WEB: { fetch: serviceFetch } },
    )
    assert.equal(await response.text(), 'planshare-spa')
  }
  assert.equal(serviceFetch.mock.callCount(), 0)
})
