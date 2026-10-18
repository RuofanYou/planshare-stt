import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Actual host event handlers with controlled runtime/UI snapshots; not browser acceptance.
const source=readFileSync(process.env.STT_TEST_SOURCE||new URL('../src/pages/Editor.tsx',import.meta.url),'utf8')
const ast=ts.createSourceFile('Editor.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let sender,events
function visit(n){
 if(ts.isBinaryExpression(n)&&n.left.getText(ast)==='sendRef.current'&&n.operatorToken.kind===ts.SyntaxKind.QuestionQuestionEqualsToken)sender=n.right.getText(ast)
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='events'&&ts.isObjectLiteralExpression(n.initializer))events=n.initializer.getText(ast)
 ts.forEachChild(n,visit)
}
visit(ast);assert.ok(sender);assert.ok(events)
const transpile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
function host(next={id:7,x:100,y:50,width:20,height:20,mouse:true}){
 const calls=[],accepted=[],errors=[],nodes=new Map([[7,{id:7,x:0,y:0,width:20,height:20,mouse:true}]])
 const sandbox={pointerDirty:{current:false},viewportRef:{current:{}},viewport:()=>({scale:1}),editorPoint:(x,y)=>({x,y}),uiNodes:{current:nodes},
  runtime:{current:{call(action,args){calls.push({action,args});return {ui:{revision:calls.length}}}}},
  acceptRef:{current(v){accepted.push(v);if(next)nodes.set(7,next);else nodes.delete(7)}},failRef:{current(e){errors.push(e)}}}
 vm.createContext(sandbox);vm.runInContext(transpile('this.send='+sender),sandbox)
 return {sandbox,calls,accepted,errors,send:sandbox.send}
}
test('drag release refreshes hover using accepted new bounds, without leaking host flag',()=>{
 const h=host();h.send('OnMouseUp',{id:7},{x:110,y:60,button:'LeftButton',refreshHover:true})
 assert.deepEqual(h.calls.map(x=>x.args.event),['OnMouseUp','OnEnter']);assert.equal(h.accepted.length,2)
 assert.equal(h.calls[0].args.refreshHover,undefined);assert.equal(h.calls[1].args.refreshHover,undefined)
 assert.equal(h.calls[1].args.id,7);assert.equal(h.calls[1].args.x,110);assert.equal(h.calls[1].args.y,60)
})
for(const kind of ['click','outside','hidden','no-mouse','clipped','inset','other-event'])test(`hover refresh is skipped for ${kind}`,()=>{
 let node={id:7,x:100,y:50,width:20,height:20,mouse:true}
 if(kind==='hidden')node=null
 if(kind==='no-mouse')node.mouse=false
 if(kind==='clipped')node.clip={left:100,right:105,top:50,bottom:70}
 if(kind==='inset')node.hitRectInsets=[15,0,0,0]
 const h=host(node);h.send(kind==='other-event'?'OnMouseDown':'OnMouseUp',{id:7},{x:kind==='outside'?5:110,y:60,refreshHover:kind!=='click'})
 assert.equal(h.calls.length,1)
})
test('hover refresh uses translated editor coordinates',()=>{
 const h=host();h.sandbox.editorPoint=(x,y)=>({x:x/2,y:y/2});h.send('OnMouseUp',{id:7},{x:220,y:120,refreshHover:true})
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].args.x,110)
})
test('runtime failure stops refresh and remains visible',()=>{
 const h=host();h.sandbox.runtime.current.call=()=>{throw Error('mouseup failed')};h.send('OnMouseUp',{id:7},{x:110,y:60,refreshHover:true});assert.equal(h.errors.length,1);assert.equal(h.accepted.length,0)
})
for(const [name,gesture,point,expected] of [
 ['left move', {id:1,x:0,y:0,button:'LeftButton',dragging:false},[4,0],true],
 ['click', {id:1,x:0,y:0,button:'LeftButton',dragging:false},[3,0],false],
 ['right move', {id:1,x:0,y:0,button:'RightButton',dragging:false},[10,0],false],
 ['middle move', {id:1,x:0,y:0,button:'MiddleButton',dragging:false},[10,0],false],
 ['wrong pointer', {id:2,x:0,y:0,button:'LeftButton',dragging:false},[10,0],false],
 ['cancelled', null,[10,0],false],
 ['registered drag', {id:1,x:0,y:0,button:'LeftButton',dragging:true},[10,0],true],
])test(`actual pointer-up handler: ${name}`,()=>{
 const calls=[],sandbox={gesture:{current:gesture},node:{id:7},suppressClick:{current:false},payload:e=>({x:e.clientX,y:e.clientY,button:'LeftButton'}),send:(event,node,args)=>calls.push({event,node,args})}
 vm.createContext(sandbox);vm.runInContext(transpile('this.events='+events),sandbox)
 sandbox.events.onPointerUp({pointerId:1,clientX:point[0],clientY:point[1]})
 assert.equal(!!calls.at(-1).args.refreshHover,expected)
 if(name==='registered drag')assert.deepEqual(calls.map(c=>c.event),['OnDragStop','OnMouseUp'])
})
