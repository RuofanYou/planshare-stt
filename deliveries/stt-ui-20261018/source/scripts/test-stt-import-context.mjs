import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the actual host handlers, accept, call, persist and cleanup. Runtime
// calls and delayed I/O are controlled doubles; no Lua or network is executed.
const source=readFileSync(process.env.STT_TEST_SOURCE||new URL('../src/pages/Editor.tsx',import.meta.url),'utf8')
const ast=ts.createSourceFile('Editor.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const selected=new Map(),names=['importText','importRoster','changeReportUrl','closeWcl','changeFight','loadReport']
let cleanup,fileInput,fightInput
function visit(node){
  if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))selected.set(node.name.text,node.getText(ast))
  if(ts.isVariableDeclaration(node)&&['accept','call','persist','fail'].includes(node.name.getText(ast)))selected.set(node.name.getText(ast),'const '+node.getText(ast))
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
    const callback=node.arguments[0]
    if(callback&&ts.isArrowFunction(callback)&&ts.isArrowFunction(callback.body)&&callback.body.getText(ast).includes('reportRequest.current++'))cleanup=callback.body.getText(ast)
  }
  if(ts.isJsxAttribute(node)&&node.name.getText(ast)==='onChange'&&node.initializer&&ts.isJsxExpression(node.initializer)){
    const expr=node.initializer.expression,code=expr?.getText(ast)||''
    if(code.includes('files?.[0]'))fileInput=code
    if(code.includes('setReport({...report,fight:'))fightInput=code
  }
  ts.forEachChild(node,visit)
}
visit(ast)
assert.ok(cleanup);assert.ok(fileInput)
// These fallbacks execute the actual former inline handlers for red tests.
if(!selected.has('importText'))selected.set('importText',`const importText=file=>(${fileInput})({currentTarget:{files:file?[file]:[]}})`)
if(!selected.has('changeFight'))selected.set('changeFight',`const changeFight=fight=>(${fightInput})({target:{value:String(fight)}})`)
const code=ts.transpileModule([...selected.values(),`this.unmount=${cleanup};this.fileInput=${fileInput};this.handlers={${[...names,'accept'].join(',')}}`].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const documentKey=v=>v.document.bossKeyText+'#'+v.document.difficulty+'#'+v.document.scope
const initial=()=>({text:'draft A',document:{bossKeyText:'A',difficulty:'mythic',scope:'team'},ui:{width:100,height:100,nodes:[],hidden:[],revision:1},appearance:{mode:'glass'},mode:'text',message:''})
function harness(){
  const state={view:initial(),busy:false,wcl:true,report:{code:'AAAAAAAAAAAAAAAA',fight:1,title:'A',fights:[{id:1},{id:2}]},errors:[],writes:[],calls:[],busyCalls:[],reportLoading:false},requests=[]
  const runtime={call(action,args){state.calls.push({action,args});return {...state.view,...(action==='text'?{text:args.text}:{}),storageChanged:action==='roster'}}}
  const sandbox={URL,URLSearchParams,console:{error(){}},STORAGE_KEY:'test',url:'https://www.warcraftlogs.com/reports/AAAAAAAAAAAAAAAA',
    runtime:{current:runtime},viewRef:{current:state.view},importRequest:{current:0},draftRevision:{current:0},reportRequest:{current:0},
    documents:{current:{[documentKey(state.view)]:state.view.text}},references:{current:{}},uiNodes:{current:new Map()},latestText:{current:state.view.text},blocked:{current:false},report:state.report,
    sameRecord(a,b){return JSON.stringify(a)===JSON.stringify(b)},
    setView(value){state.view=value},setBusy(value){state.busy=value;state.busyCalls.push(value)},setWcl(value){state.wcl=value},
    setReport(value){state.report=value;sandbox.report=value},setReportLoading(value){state.reportLoading=value},setReportNotice(value){state.reportNotice=value},setUrl(value){sandbox.url=value},setError(value){state.errors.push(value)},
    localStorage:{setItem(key,value){state.writes.push(JSON.parse(value))}},
    getEditorWclRoster(code,fight){const d=deferred();requests.push({...d,code,fight});return d.promise},
    getEditorWclReport(){const d=deferred();requests.push(d);return d.promise},
  }
  vm.createContext(sandbox);vm.runInContext(code,sandbox)
  return {state,requests,sandbox,...sandbox.handlers,unmount:sandbox.unmount,fileInput:sandbox.fileInput,
    file(){const d=deferred();return {...d,file:{text:()=>d.promise}}},
    change(fields){sandbox.handlers.accept({...state.view,...fields,ui:{...state.view.ui,revision:state.view.ui.revision+1}})},
    select(fields){sandbox.handlers.accept({...state.view,document:{...state.view.document,...fields},ui:{...state.view.ui,revision:state.view.ui.revision+1}})},
    replaceRuntime(){sandbox.runtime.current={call:runtime.call}},
  }
}
const rosterResult={members:[{name:'Tester',class:'MAGE'}]}
function begin(h,kind){if(kind==='file'){const d=h.file();return {pending:h.importText(d.file),resolve:()=>d.resolve('imported'),reject:()=>d.reject(Error('read failed'))}}const pending=h.importRoster(),d=h.requests.at(-1);return {pending,resolve:()=>d.resolve(rosterResult),reject:()=>d.reject(Error('roster failed'))}}

for(const kind of ['file','roster']){
  test(`${kind}: current import is applied once and persisted`,async()=>{
    const h=harness(),p=begin(h,kind);p.resolve();await p.pending
    assert.equal(h.state.calls.length,1);assert.equal(h.state.calls[0].action,kind==='file'?'text':'roster');assert.equal(h.state.writes.length,1);assert.equal(h.state.busy,false)
    if(kind==='file')assert.equal(h.state.writes[0].text,'imported');else assert.equal(h.state.wcl,false)
  })
  for(const field of ['bossKeyText','difficulty','scope'])test(`${kind}: switching ${field} discards the pending import`,async()=>{
    const h=harness(),p=begin(h,kind);h.select({[field]:'B'});const writes=h.state.writes.length;p.resolve();await p.pending
    assert.equal(h.state.calls.length,0);assert.equal(h.state.writes.length,writes);assert.equal(h.state.busy,false)
  })
  test(`${kind}: switching A to B and back to A discards the original import`,async()=>{
    const h=harness(),p=begin(h,kind);h.select({bossKeyText:'B'});h.select({bossKeyText:'A'});p.resolve();await p.pending;assert.equal(h.state.calls.length,0)
  })
  test(`${kind}: text edited and reverted still invalidates the import`,async()=>{
    const h=harness(),p=begin(h,kind);h.change({text:'manual'});h.change({text:'draft A'});p.resolve();await p.pending;assert.equal(h.state.calls.length,0)
  })
  test(`${kind}: storage-only draft changes invalidate the import`,async()=>{
    const h=harness(),p=begin(h,kind);h.change({storageChanged:true});p.resolve();await p.pending;assert.equal(h.state.calls.length,0)
  })
  test(`${kind}: a harmless empty UI delta keeps the import valid`,async()=>{
    const h=harness(),p=begin(h,kind);h.accept({...h.state.view,ui:{...h.state.view.ui,delta:true,nodes:[],hidden:[],revision:2}});p.resolve();await p.pending;assert.equal(h.state.calls.length,1)
  })
  test(`${kind}: cleanup prevents late result and state writes`,async()=>{
    const h=harness(),p=begin(h,kind);h.unmount();const state=JSON.stringify(h.state);p.resolve();await p.pending;assert.equal(JSON.stringify(h.state),state)
  })
  test(`${kind}: cleanup then a fresh runtime cannot accept old work`,async()=>{
    const h=harness(),p=begin(h,kind);h.unmount();h.replaceRuntime();p.resolve();await p.pending;assert.equal(h.state.calls.length,0)
  })
  test(`${kind}: replacement runtime without cleanup rejects old work`,async()=>{
    const h=harness(),p=begin(h,kind);h.replaceRuntime();p.resolve();await p.pending;assert.equal(h.state.calls.length,0)
  })
  test(`${kind}: stale failures are ignored`,async()=>{
    const h=harness(),p=begin(h,kind);h.select({bossKeyText:'B'});p.reject();await p.pending;assert.deepEqual(h.state.errors,[])
  })
  test(`${kind}: current failures remain visible`,async()=>{
    const h=harness(),p=begin(h,kind);p.reject();await p.pending;assert.equal(h.state.errors.length,1);assert.equal(h.state.busy,false)
  })
  test(`${kind}: a current runtime exception stays visible and releases busy state`,async()=>{
    const h=harness();h.sandbox.runtime.current.call=()=>{throw Error('runtime import failed')}
    const p=begin(h,kind);p.resolve();await p.pending
    assert.deepEqual(h.state.errors,['Error: runtime import failed']);assert.equal(h.state.busy,false);assert.equal(h.state.writes.length,0);assert.equal(h.state.wcl,true)
  })
}

for(const first of ['file','roster'])for(const second of ['file','roster']){
  for(const firstCompletesFirst of [true,false])test(`${first} then ${second}: newest wins; completion order ${firstCompletesFirst?'old-first':'new-first'}`,async()=>{
    const h=harness(),a=begin(h,first),b=begin(h,second)
    if(firstCompletesFirst){a.resolve();await a.pending;assert.equal(h.state.calls.length,0);assert.equal(h.state.busy,second==='roster');b.resolve();await b.pending}
    else{b.resolve();await b.pending;a.resolve();await a.pending}
    assert.equal(h.state.calls.length,1);assert.equal(h.state.calls[0].action,second==='file'?'text':'roster');assert.equal(h.state.busy,false)
  })
}

for(const invalidation of ['close','url','fight','report'])test(`roster: ${invalidation} change cancels old result`,async()=>{
  const h=harness(),p=begin(h,'roster')
  if(invalidation==='close')h.closeWcl()
  if(invalidation==='url')h.changeReportUrl('https://www.warcraftlogs.com/reports/BBBBBBBBBBBBBBBB')
  if(invalidation==='fight')h.changeFight(2)
  if(invalidation==='report')void h.loadReport()
  p.resolve();await p.pending;assert.equal(h.state.calls.length,0);assert.equal(h.state.busy,false)
})
test('roster: stale finally does not clear a newer roster busy state',async()=>{
  const h=harness(),a=begin(h,'roster');h.changeFight(2);const b=begin(h,'roster');a.resolve();await a.pending
  assert.equal(h.state.busy,true);assert.equal(h.requests[1].fight,2);b.resolve();await b.pending;assert.equal(h.state.busy,false)
})
test('file: closing an unrelated WCL dialog does not discard a file import',async()=>{
  const h=harness(),p=begin(h,'file');h.closeWcl();p.resolve();await p.pending;assert.equal(h.state.calls.length,1)
})
test('file input resets selection so the same file can be retried',async()=>{
  const h=harness(),d=h.file(),input={files:[d.file],value:'C:\\fakepath\\STT.txt'};h.fileInput({currentTarget:input});assert.equal(input.value,'');d.resolve('imported');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.state.calls.length,1)
})
test('empty file picker and an editor without runtime cannot start imports',async()=>{
  const h=harness();await h.importText(undefined);h.sandbox.runtime.current=null;await h.importText(h.file().file);await h.importRoster();assert.equal(h.requests.length,0);assert.equal(h.state.calls.length,0)
})
test('roster: a selected fight outside the current report cannot reach the API',async()=>{
  const h=harness();h.sandbox.report={...h.state.report,fight:999};await h.importRoster();assert.equal(h.requests.length,0);assert.equal(h.state.busy,false)
})
test('roster: changing to an unavailable fight cannot alter the current selection',()=>{
  const h=harness();h.changeFight(999);assert.equal(h.state.report.fight,1);assert.equal(h.sandbox.reportRequest.current,0)
})
test('restored draft persistence includes all documents, references and explicit appearance',()=>{
  const h=harness();h.change({documents:{'A#mythic#team':'draft A','B#mythic#team':'retained'},references:{ref:{text:'reference'}},appearance:{mode:'legacy',explicit:true}})
  const saved=h.state.writes.at(-1)||(()=>{h.change({text:'next'});return h.state.writes.at(-1)})()
  assert.equal(saved.documents['B#mythic#team'],'retained');assert.equal(saved.references.ref.text,'reference');assert.equal(saved.appearance.mode,'legacy')
})

test('fresh Lua empty documents array becomes an object before actual accept-to-persist',()=>{
  const h=harness(),incoming=[]
  h.accept({...h.state.view,documents:incoming,text:'新草稿自动保存：中文😀',storageChanged:true})
  const saved=h.state.writes.at(-1)
  assert.equal(Array.isArray(saved.documents),false)
  assert.equal(saved.documents['A#mythic#team'],'新草稿自动保存：中文😀')
  assert.deepEqual(Object.keys(incoming),[],'do not assign document properties onto the Lua array')
  h.change({text:'再次编辑😀'})
  assert.equal(h.state.writes.at(-1).documents['A#mythic#team'],'再次编辑😀')
})
