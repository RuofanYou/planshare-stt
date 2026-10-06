import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerEditorSpellRoutes } from './editor-spells.mjs'

test('spell route validates IDs and returns sanitized display metadata',async()=>{
  const app=Fastify();const requests=[]
  registerEditorSpellRoutes(app,{env:{},fetchImpl:async(url,init)=>{
    requests.push({url,init})
    return new Response(JSON.stringify({name:'宁静',icon:'spell_nature_tranquility',tooltip:'<table><tr><td>2秒施法时间</td></tr></table>'}),{status:200})
  }})
  try{
    assert.equal((await app.inject('/api/editor/spells?ids=0')).statusCode,400)
    assert.equal((await app.inject('/api/editor/spells?ids=740,740')).statusCode,200)
    assert.equal(requests.length,1)
    assert.match(requests[0].url,/^https:\/\/nether\.wowhead\.com\/tooltip\/spell\/740\?/)
    assert.ok(requests[0].init.signal instanceof AbortSignal)
    assert.deepEqual((await app.inject('/api/editor/spells?ids=740')).json(),{spells:[{
      id:740,name:'宁静',icon:'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_tranquility.jpg',castTime:2000,
    }]})
  }finally{await app.close()}
})

test('spell route caps input and reports a stable upstream failure',async()=>{
  let calls=0
  const app=Fastify()
  registerEditorSpellRoutes(app,{env:{},fetchImpl:async()=>{calls++;return new Response('blocked',{status:403})}})
  try{
    assert.equal((await app.inject(`/api/editor/spells?ids=${Array.from({length:41},(_,i)=>i+1).join(',')}`)).statusCode,400)
    const result=await app.inject('/api/editor/spells?ids=740')
    assert.equal(result.statusCode,502)
    assert.equal(result.json().error,'技能数据暂不可用，请稍后重试')
    assert.equal(calls,1)
  }finally{await app.close()}
})
