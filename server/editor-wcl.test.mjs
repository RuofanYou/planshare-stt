import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { normalizeRoster, registerEditorWclRoutes } from './editor-wcl.mjs'

const report = {
  masterData: { actors: [{ id: 1, name: '坦克', server: '测试服', subType: 'Warrior' }] },
  playerDetails: { data: { playerDetails: {
    tanks: [{ id: 1, name: '坦克', type: 'Warrior', specs: ['Protection'] }],
    healers: [{ id: 2, name: '治疗', type: 'Druid', specs: ['Restoration'] }],
    dps: [{ id: 3, name: '输出', type: 'Mage', specs: ['Frost'] }, { id: 4, name: '未知', type: 'Druid', specs: ['Balance', 'Feral'] }],
  } } },
}
test('complete fight roster includes DPS without cooldown events and keeps ambiguous specs unknown', () => {
  const members = normalizeRoster(report)
  assert.equal(members.length, 4)
  assert.equal(members.find(m => m.name === '坦克').server, '测试服')
  assert.equal(members.find(m => m.name === '输出').specName, 'Frost')
  assert.equal(members.find(m => m.name === '未知').specName, '')
  assert.throws(() => normalizeRoster({ playerDetails: { tanks: [] } }), /没有可导入/)
})
test('fixed endpoints validate before fetching; fight ID is scoped; credentials never leave server response', async () => {
  const app = Fastify()
  const requests = []
  registerEditorWclRoutes(app, { env: { WCL_CLIENT_ID: 'test-client', WCL_CLIENT_SECRET: 'test-secret' }, fetchImpl: async (url, init) => {
    requests.push({url,init})
    return new Response(JSON.stringify(url.endsWith('/oauth/token') ? { access_token:'private-token',expires_in:3600 }
      : { data: {reportData:{report}} }), {status:200})
  } })
  try {
    assert.equal((await app.inject('/api/editor/wcl/roster?code=bad&fight=1')).statusCode, 400)
    assert.equal(requests.length, 0)
    const response = await app.inject('/api/editor/wcl/roster?code=AbCdEfGhIjKlMnOp&fight=12')
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().members.length, 4)
    assert.deepEqual(JSON.parse(requests[1].init.body).variables, {code:'AbCdEfGhIjKlMnOp',fightIDs:[12]})
    assert.doesNotMatch(response.body, /test-secret|private-token|Authorization/)
    assert.equal((await app.inject('/api/editor/wcl/roster?code=AbCdEfGhIjKlMnOp&fight=-1')).statusCode, 400)
  } finally { await app.close() }
})
test('missing credentials and upstream permission failure are actionable errors', async () => {
  for (const [env,status] of [[{},503],[{WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret'},403]]) {
    const app = Fastify()
    registerEditorWclRoutes(app, { env, fetchImpl: async url => new Response(JSON.stringify(url.endsWith('/oauth/token')
      ? {access_token:'token',expires_in:3600} : {errors:[{message:'private'}]}), {status:200}) })
    try { assert.equal((await app.inject('/api/editor/wcl/report?code=AbCdEfGhIjKlMnOp')).statusCode,status) }
    finally { await app.close() }
  }
})
