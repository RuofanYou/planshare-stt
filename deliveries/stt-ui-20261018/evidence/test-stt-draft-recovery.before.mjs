import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'

// Execute the actual initialization recovery block and persistence callback.
// Storage and Lua open are controlled adapters, not a browser/Lua acceptance.
const source=readFileSync(process.env.STT_TEST_SOURCE||new URL('../src/pages/Editor.tsx',import.meta.url),'utf8')
const start=source.indexOf('      let saved:null|')
const end=source.indexOf('\n    }).catch(error=>',start)
assert.ok(start>0&&end>start)
const persistStart=source.indexOf('  const persist=')
const persistEnd=source.indexOf('\n  const accept=',persistStart)
const code=stripTypeScriptTypes(source.slice(persistStart,persistEnd)+'\nthis.persist=persist;\n'+ '(async()=>{'+source.slice(start,end)+'})()')
const context={boss:'Boss',difficulty:'mythic',scope:'team'}
async function restore(raw,readError=false){
 const result={errors:[],opens:[],writes:[],blocked:false}
 const sandbox={STORAGE_KEY:'stt.editor.v1',latestText:{current:''},blocked:{current:false},
  setError(error){result.errors.push(error)},viewport(){return {width:1280,height:720}},
  localStorage:{getItem(){if(readError)throw Error('storage unavailable');return raw},setItem(key,value){result.writes.push(value)}},
  vm:{call(action,args){assert.equal(action,'open');result.opens.push(args);return {text:args.text||'',document:{bossKeyText:'Boss',difficulty:'mythic',scope:'team'},documents:args.documents||{},references:args.references||{}}}},
  accept(value){sandbox.persist(value)},
 }
 vm.createContext(sandbox)
 await vm.runInContext(code,sandbox)
 result.blocked=sandbox.blocked.current
 return result
}
for(const [name,value] of [
 ['missing documents',{context}],['null documents',{context,documents:null}],
 ['string documents',{context,documents:'draft'}],['array documents',{context,documents:[]}],
 ['numeric document entry',{context,documents:{'Boss#mythic#team':42}}],
 ['missing context',{documents:{}}],['string context',{context:'Boss',documents:{}}],
 ['array context',{context:[],documents:{}}],['numeric boss',{context:{...context,boss:42},documents:{}}],
 ['zero root',0],['false root',false],['numeric root',42],['string root','draft'],['array root',[]],
 ['wrong text type',{context,documents:{},text:{bad:true}}],
 ])test(`invalid stored draft: ${name} opens safely without overwriting original`,async()=>{
 const raw=JSON.stringify(value),r=await restore(raw)
 assert.equal(r.opens.length,1);assert.equal(r.blocked,true);assert.equal(r.errors.length,1)
 assert.equal(r.opens[0].documents,undefined);assert.equal(r.opens[0].text,undefined);assert.equal(r.opens[0].boss,undefined)
 assert.equal(r.writes.length,0)
})
for(const [name,raw,readError] of [['malformed JSON','{',false],['storage exception',null,true]])test(name+' opens safely with saving blocked',async()=>{
 const r=await restore(raw,readError);assert.equal(r.opens.length,1);assert.equal(r.blocked,true);assert.equal(r.errors.length,1);assert.equal(r.writes.length,0)
})
for(const raw of [null,'null'])test(`empty storage ${raw} opens normally`,async()=>{const r=await restore(raw);assert.equal(r.opens.length,1);assert.equal(r.blocked,false);assert.equal(r.errors.length,0);assert.equal(r.writes.length,1)})
for(const [name,extras,expected] of [['legacy per-document text',{},'中文😀旧草稿'],['explicit text',{text:'新草稿'},'新草稿'],['explicit empty text',{text:''},'']])test(name+' is preserved',async()=>{
 const documents={'Boss#mythic#team':'中文😀旧草稿','Other#normal#team':'另一草稿'}
 const r=await restore(JSON.stringify({context,documents,...extras}))
 assert.equal(r.opens[0].text,expected);assert.equal(r.opens[0].boss,'Boss');assert.deepEqual(JSON.parse(JSON.stringify(r.opens[0].documents)),documents)
 assert.equal(r.blocked,false);assert.equal(r.errors.length,0);assert.equal(r.writes.length,1)
})

test('valid references and explicit appearance remain unchanged',async()=>{
 const references={'Other#mythic#team':{text:'参考',hidden:true}}
 const appearance={mode:'legacy',palette:'default',explicit:true}
 const r=await restore(JSON.stringify({context,documents:{},references,appearance}))
 assert.deepEqual(JSON.parse(JSON.stringify(r.opens[0].references)),references)
 assert.deepEqual(JSON.parse(JSON.stringify(r.opens[0].appearance)),appearance)
 assert.equal(r.blocked,false);assert.equal(r.errors.length,0)
})
