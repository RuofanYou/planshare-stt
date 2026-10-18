import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real component handlers with deferred HTTP responses. This does
// not import EditorRuntime, execute Lua, contact WCL, or need a browser.
const source=readFileSync(process.env.STT_TEST_SOURCE||new URL('../src/pages/Editor.tsx',import.meta.url),'utf8')
const ast=ts.createSourceFile('Editor.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const handlers=new Map()
let cleanup
function visit(node){
  if(ts.isFunctionDeclaration(node)&&['loadReport','changeReportUrl','closeWcl'].includes(node.name?.text))handlers.set(node.name.text,node.getText(ast))
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
    const callback=node.arguments[0]
    if(callback&&ts.isArrowFunction(callback)&&ts.isArrowFunction(callback.body)&&callback.body.getText(ast).includes('reportRequest.current++'))cleanup=callback.body.getText(ast)
  }
  ts.forEachChild(node,visit)
}
visit(ast)
assert.equal(handlers.size,3,'all real request handlers must be present')
assert.ok(cleanup,'component unmount must invalidate the pending request')
const code=ts.transpileModule([...handlers.values(),`this.unmount=${cleanup}; this.handlers={loadReport,changeReportUrl,closeWcl}`].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
const reportA='AAAAAAAAAAAAAAAA',reportB='BBBBBBBBBBBBBBBB'
const url=(code=reportA,fight='1')=>`https://www.warcraftlogs.com/reports/${code}#fight=${fight}`
const result=(name='A',id=1)=>({title:`Report ${name}`,fights:[{id,name}]})
function harness(){
  const state={url:url(),report:null,loading:false,notice:'',wcl:true,errors:[],busyCalls:[]},requests=[]
  const sandbox={URL,URLSearchParams,url:state.url,reportRequest:{current:0},importRequest:{current:0},
    getEditorWclReport(code){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});requests.push({code,resolve,reject});return promise},
    setReport(value){state.report=value},setReportLoading(value){state.loading=value},setReportNotice(value){state.notice=value},
    setUrl(value){state.url=value;sandbox.url=value},setWcl(value){state.wcl=value},
    setBusy(value){state.busyCalls.push(value)},fail(error){state.errors.push(String(error))}}
  vm.createContext(sandbox);vm.runInContext(code,sandbox)
  return {state,requests,...sandbox.handlers,unmount:sandbox.unmount}
}

test('current report and requested fight are accepted',async()=>{
  const h=harness(),pending=h.loadReport();assert.equal(h.state.loading,true)
  h.requests[0].resolve(result());await pending
  assert.equal(h.state.report.code,reportA);assert.equal(h.state.report.fight,1);assert.equal(h.state.loading,false)
})
test('an absent fight still falls back to the first available fight',async()=>{
  const h=harness();h.changeReportUrl(url(reportA).split('#')[0]);const pending=h.loadReport()
  h.requests[0].resolve(result('A',9));await pending;assert.equal(h.state.report.fight,9);assert.equal(h.state.notice,'')
})
test('editing the URL invalidates an in-flight report before it can be displayed',async()=>{
  const h=harness(),pending=h.loadReport();h.changeReportUrl(url(reportB,'2'))
  h.requests[0].resolve(result());await pending
  assert.equal(h.state.url,url(reportB,'2'));assert.equal(h.state.report,null);assert.equal(h.state.loading,false)
})
test('changing the URL away and back still invalidates the original request',async()=>{
  const h=harness(),pending=h.loadReport();h.changeReportUrl(url(reportB));h.changeReportUrl(url(reportA))
  h.requests[0].resolve(result());await pending;assert.equal(h.state.report,null)
})
test('closing and reopening the dialog does not resurrect a dismissed report',async()=>{
  const h=harness(),pending=h.loadReport();h.closeWcl();assert.equal(h.state.wcl,false);h.state.wcl=true
  h.requests[0].resolve(result());await pending;assert.equal(h.state.report,null);assert.equal(h.state.loading,false)
})
test('the actual component cleanup discards results after unmount',async()=>{
  const h=harness(),pending=h.loadReport();h.unmount();const before=JSON.stringify(h.state)
  h.requests[0].resolve(result());await pending;assert.equal(JSON.stringify(h.state),before)
})
test('newest request wins when the old response resolves last',async()=>{
  const h=harness(),first=h.loadReport();h.changeReportUrl(url(reportB,'2'));const second=h.loadReport()
  h.requests[1].resolve(result('B',2));await second;h.requests[0].resolve(result());await first
  assert.equal(h.state.report.code,reportB);assert.equal(h.state.report.fight,2)
})
test('an older completion cannot clear the loading state of a newer request',async()=>{
  const h=harness(),first=h.loadReport(),second=h.loadReport()
  h.requests[0].resolve(result());await first;assert.equal(h.state.loading,true);assert.equal(h.state.report,null)
  h.requests[1].resolve(result());await second;assert.equal(h.state.loading,false)
})
test('a stale rejection is not shown as an error for the newer URL',async()=>{
  const h=harness(),pending=h.loadReport();h.changeReportUrl(url(reportB))
  h.requests[0].reject(Error('old report failed'));await pending;assert.deepEqual(h.state.errors,[])
})
test('a current rejection remains visible and releases its own loading state',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].reject(Error('current report failed'));await pending
  assert.deepEqual(h.state.errors,['Error: current report failed']);assert.equal(h.state.loading,false)
})
test('invalid domains fail before any HTTP request',async()=>{
  const h=harness();h.changeReportUrl('https://example.com/reports/'+reportA);await h.loadReport()
  assert.equal(h.requests.length,0);assert.equal(h.state.errors.length,1);assert.equal(h.state.loading,false)
})
test('changing a displayed report URL immediately removes the importable old report',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].resolve(result());await pending
  h.changeReportUrl(url(reportB));assert.equal(h.state.report,null)
})
test('report loading cancels roster busy state without using it for report loading',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].resolve(result());await pending
  assert.deepEqual(h.state.busyCalls,[false])
  h.closeWcl();assert.deepEqual(h.state.busyCalls,[false,false])
})
test('the dialog routes Close and URL edits through invalidation and disables imports while loading',()=>{
  assert.match(source,/onClick=\{closeWcl\}/)
  assert.match(source,/onChange=\{e=>changeReportUrl\(e\.target\.value\)\}/)
  assert.ok(source.includes('disabled={busy||reportLoading||!report.fights.some(f=>f.id===report.fight)} onClick={importRoster}'))
})
for(const requested of ['999','1.5','Infinity','0','-1','NaN'])test(`unknown/invalid fight ${requested} falls back to an available fight`,async()=>{
  const h=harness();h.changeReportUrl(url(reportA,requested));const pending=h.loadReport()
  h.requests[0].resolve({title:'Two fights',fights:[{id:1,name:'First'},{id:2,name:'Second'}]});await pending
  assert.equal(h.state.report.fight,1);assert.equal(h.state.loading,false);assert.match(h.state.notice,/请核对后再点击/)
})
test('a valid non-first selected fight is preserved',async()=>{
  const h=harness();h.changeReportUrl(url(reportA,'2'));const pending=h.loadReport()
  h.requests[0].resolve({title:'Two fights',fights:[{id:1,name:'First'},{id:2,name:'Second'}]});await pending;assert.equal(h.state.report.fight,2)
})
test('empty fight list cannot become an importable report and gives an explanation',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].resolve({title:'No fights',fights:[]});await pending
  assert.equal(h.state.report,null);assert.equal(h.state.loading,false);assert.match(h.state.errors[0],/没有可导入的有效战斗/)
})
test('invalid returned fight ids are excluded from the selection list',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].resolve({title:'Mixed',fights:[{id:0},{id:-1},{id:1.5},{id:Infinity},{id:Number.MAX_SAFE_INTEGER+1},{id:9,name:'Valid'}]});await pending
  assert.equal(h.state.report.fight,9);assert.equal(h.state.report.fights.length,1)
})
test('a report containing only invalid fights is not importable',async()=>{
  const h=harness(),pending=h.loadReport();h.requests[0].resolve({title:'Invalid',fights:[{id:0},{id:1.5}]});await pending
  assert.equal(h.state.report,null);assert.equal(h.state.loading,false);assert.equal(h.state.errors.length,1)
})
test('a fallback notice is cleared when the report URL changes',async()=>{
  const h=harness();h.changeReportUrl(url(reportA,'999'));const pending=h.loadReport();h.requests[0].resolve(result());await pending
  assert.match(h.state.notice,/请核对/);h.changeReportUrl(url(reportB));assert.equal(h.state.notice,'');assert.equal(h.state.report,null)
})
test('the fallback notice is visible in the dialog next to the separate import action',()=>{
  assert.ok(source.includes('{reportNotice&&<p role="status">{reportNotice}</p>}'))
  assert.ok(source.includes('onClick={importRoster}>导入这场名单</button>'))
})
