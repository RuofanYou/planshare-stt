import assert from 'node:assert/strict'
import test from 'node:test'

import gateway from '../public/_worker.js'

function skillEnv(body = '---\nname: stt-plan-writer\n---\n') {
  const requests = []
  return {
    requests,
    env: {
      ASSETS: {
        async fetch(request) {
          requests.push(request)
          if (new URL(request.url).pathname === '/skill/SKILL.md') {
            return new Response(body, { headers: { 'Content-Type': 'application/octet-stream' } })
          }
          return new Response('<!doctype html><title>PlanShare</title>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        },
      },
    },
  }
}

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

test('/skill 返回 Markdown 入口并容忍豆包把中文标点吞进 URL', async () => {
  for (const path of [
    '/skill',
    '/skill/',
    '/skill/SKILL.md',
    '/skill/12.1',
    '/skill/12.1/',
    '/skill%EF%BC%8C%E5%B8%AE%E6%88%91%E5%86%99',
  ]) {
    const mock = skillEnv()
    const response = await gateway.fetch(new Request(`https://zhaobanzi.pages.dev${path}`), mock.env)

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(await response.text(), '---\nname: stt-plan-writer\n---\n')
    assert.equal(new URL(mock.requests[0].url).pathname, '/skill/SKILL.md')
  }
})

test('/skill 缺失引用返回 404，不回退到 SPA 首页', async () => {
  const mock = skillEnv()
  const response = await gateway.fetch(
    new Request('https://zhaobanzi.pages.dev/skill/references/missing.md'),
    mock.env,
  )

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
  assert.equal(await response.text(), 'Not Found')
  assert.equal(mock.requests.length, 1)
})

test('/skill 只接受 GET 和 HEAD', async () => {
  const mock = skillEnv()
  const response = await gateway.fetch(
    new Request('https://zhaobanzi.pages.dev/skill', { method: 'POST' }),
    mock.env,
  )

  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'GET, HEAD')
  assert.equal(mock.requests.length, 0)
})
