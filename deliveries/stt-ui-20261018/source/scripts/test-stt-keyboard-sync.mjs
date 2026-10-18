import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the actual DOM keyboard listener with a controlled runtime. Real Lua
// import/edit/export/reload coverage lives in keyboard-roundtrip/regression.mjs.
const source=readFileSync(process.env.STT_TEST_SOURCE||new URL('../src/pages/Editor.tsx',import.meta.url),'utf8')
const ast=ts.createSourceFile('Editor.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let listener
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='key'&&n.initializer&&ts.isArrowFunction(n.initializer))listener=n.initializer.getText(ast);ts.forEachChild(n,visit)}
visit(ast);assert.ok(listener)
const code=ts.transpileModule('this.key='+listener,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
function host(consumed=true){
 const calls=[],accepted=[],errors=[]
 class HTMLElement{closest(){return null}}
 class HTMLInputElement extends HTMLElement{}
 const snapshot={text:'after undo',ui:{revision:2}}
 const sandbox={HTMLInputElement,HTMLElement,runtime:{current:{call(action,args){calls.push({action,args});return action==='key'?{consumed}:snapshot}}},
   call(action){const next=sandbox.runtime.current?.call(action);if(next?.ui)accepted.push(next);return next},fail(e){errors.push(e)}}
 vm.createContext(sandbox);vm.runInContext(code,sandbox)
 const event={key:'z',type:'keydown',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,isComposing:false,target:new HTMLElement(),preventDefault(){this.prevented=true}}
 return {sandbox,event,calls,accepted,errors,key:sandbox.key,snapshot}
}
for(const modifier of ['ctrlKey','metaKey'])test(`${modifier}: consumed shortcut synchronizes export and persistence through the regular call`,()=>{
 const h=host();h.event.ctrlKey=false;h.event[modifier]=true;h.key(h.event)
 assert.equal(h.event.prevented,true);assert.equal(h.calls[0].args.ctrl,true)
 assert.deepEqual(h.calls.map(c=>c.action),['key','snapshot']);assert.deepEqual(h.accepted,[h.snapshot])
})
test('ordinary unconsumed typing does not request an extra Lua snapshot',()=>{const h=host(false);h.key(h.event);assert.equal(h.event.prevented,undefined);assert.deepEqual(h.calls.map(c=>c.action),['key']);assert.deepEqual(h.accepted,[])})
for(const ignored of ['composition','range','toolbar'])test(`${ignored}: native browser editing does not invoke Lua`,()=>{
 const h=host();if(ignored==='composition')h.event.isComposing=true
 if(ignored==='range'){h.event.target=new h.sandbox.HTMLInputElement();h.event.target.type='range'}
 if(ignored==='toolbar')h.event.target.closest=()=>({})
 h.key(h.event);assert.deepEqual(h.calls,[]);assert.equal(h.event.prevented,undefined)
})
test('missing runtime does not consume input or request a snapshot',()=>{const h=host();h.sandbox.runtime.current=null;h.key(h.event);assert.deepEqual(h.calls,[]);assert.deepEqual(h.accepted,[]);assert.equal(h.event.prevented,undefined)})
test('runtime keyboard errors remain visible without claiming successful synchronization',()=>{const h=host();h.sandbox.runtime.current.call=()=>{throw Error('key failed')};h.key(h.event);assert.equal(h.errors.length,1);assert.match(String(h.errors[0]),/key failed/);assert.deepEqual(h.accepted,[])})
