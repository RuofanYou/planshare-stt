import assert from 'node:assert/strict'
import test from 'node:test'

import gateway from '../public/_worker.js'

test('/log 请求统一转给 RaidGlass Web 并携带追踪 ID', async () => {
  let forwarded
  const response = await gateway.fetch(new Request('https://zhaobanzi.pages.dev/log/help'), {
    RAIDGLASS_WEB: {
      async fetch(request) {
        forwarded = request
        return new Response('raidglass')
      },
    },
  })

  assert.equal(await response.text(), 'raidglass')
  assert.equal(new URL(forwarded.url).pathname, '/log/help')
  assert.ok(forwarded.headers.get('x-planshare-trace-id'))
})
