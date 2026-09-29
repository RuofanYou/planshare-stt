import test from 'node:test'
import assert from 'node:assert/strict'
import { readRaidPlan } from '../shared/raidplan-source.mjs'

const code = '77e628xft5dspgd3'
const document = { code, version: 2, steps: 1, nodes: [] }

test('RaidPlan source accepts only a bounded plan code and a matching v2 document', async () => {
  let requested = ''
  const fetcher = async (url, options) => {
    requested = url
    assert.equal(options.redirect, 'manual')
    return Response.json(document)
  }
  assert.equal((await readRaidPlan('../private', fetcher)).status, 400)
  assert.equal(requested, '')
  assert.deepEqual((await readRaidPlan(code, fetcher)).body, document)
  assert.match(requested, /^https:\/\/userdata\.raidplan\.io\/77e628xft5dspgd3\.json\?stt=\d+$/)
  assert.equal((await readRaidPlan(code, async () => Response.json({ ...document, code: 'other' }))).status, 422)
})

test('RaidPlan source rejects redirect and oversized response', async () => {
  assert.equal((await readRaidPlan(code, async () => new Response(null, { status: 302 }))).status, 502)
  assert.equal((await readRaidPlan(code, async () => new Response('x', {
    headers: { 'content-length': String(8 * 1024 * 1024 + 1) },
  }))).status, 413)
  assert.equal((await readRaidPlan(code, async () => { throw new DOMException('timeout', 'TimeoutError') })).status, 504)
})
