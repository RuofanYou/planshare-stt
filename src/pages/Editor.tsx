import {memo, useEffect, useRef, useState, type CSSProperties} from 'react'
import {getEditorSpells,getEditorWclReport,getEditorWclRoster,type EditorWclFight} from '../api/client'
import {editorAtlases} from '../generated/sttEditorMedia'
import editorMedia from '../lib/stt-editor/media.json'
import type {EditorRuntime,EditorView,UiNode,UiTree} from '../lib/stt-editor/runtime'
import '../styles/editor.css'

const STORAGE_KEY='stt.editor.v1'
const reportedMissingAssets=new Set<string>()
const utf8=new TextEncoder()
const byteOffset=(value:string,offset:number)=>utf8.encode(value.slice(0,offset)).length
function textOffset(value:string,bytes:number) {let at=0,count=0;for(const char of value){const size=utf8.encode(char).length;if(count+size>bytes)break;count+=size;at+=char.length}return at}
const rgba=(c?:number[])=>c?`rgba(${c.slice(0,3).map(v=>Math.round(v*255)).join(',')},${c[3]??1})`:undefined
const classIconCoords:Record<string,number[]>={
  WARRIOR:[0,.25,0,.25],MAGE:[.25,.5,0,.25],ROGUE:[.5,.75,0,.25],DRUID:[.75,1,0,.25],
  HUNTER:[0,.25,.25,.5],SHAMAN:[.25,.5,.25,.5],PRIEST:[.5,.75,.25,.5],WARLOCK:[.75,1,.25,.5],
  PALADIN:[0,.25,.5,.75],DEATHKNIGHT:[.25,.5,.5,.75],MONK:[.5,.75,.5,.75],DEMONHUNTER:[.75,1,.5,.75],
}
const normalizedTexture=(path:string)=>path.replace(/\\/g,'/').toLowerCase()
const isStatusBarTexture=(path?:string|number)=>typeof path==='string'&&normalizedTexture(path)==='interface/targetingframe/ui-statusbar'
function asset(path?:string|number,texCoord?:number[]):string|undefined {
  if(typeof path==='number')return Object.prototype.hasOwnProperty.call(editorMedia.textures,String(path))?`/stt-editor/textures/${path}.png`:undefined
  if(typeof path!=='string')return undefined
  if(path.startsWith('https://'))return path
  const normalized=path.replace(/\\/g,'/')
  const lower=normalized.toLowerCase()
  const local=normalized.match(/^Interface\/AddOns\/STT\/media\/(.+)$/i)
  if(local)return '/stt-editor/'+local[1].replace(/\.tga$/i,'.png')
  if(lower==='interface/icons/classicon_evoker')return '/stt-editor/classes/evoker.png'
  if(lower==='interface/glues/charactercreate/ui-charactercreate-classes'&&texCoord?.length===4){
    const classFile=Object.entries(classIconCoords).find(([,coords])=>coords.every((value,index)=>Math.abs(value-texCoord[index])<0.00001))?.[0]
    if(classFile)return `/stt-editor/classes/${classFile.toLowerCase()}.png`
  }
  return undefined
}
function textContent(text='') {return text.replace(/\|c[0-9a-fA-F]{8}|\|r/g,'').replace(/\|[TA][\s\S]*?\|[ta]/g,'')}
function RichText({text=''}:{text?:string}) {
  let color:string|undefined
  return <>{text.split(/(\|c[0-9a-fA-F]{8}|\|r|\|T.*?\|t|\|A.*?\|a)/g).map((part,i)=>{
    if(/^\|c/.test(part)){const argb=part.slice(2);color='#'+argb.slice(2)+argb.slice(0,2);return null}
    if(part==='|r'){color=undefined;return null}
    if(/^\|[TA]/.test(part)){
      const atlas=part[1]==='A',fields=part.slice(2,-2).split(':'),info=atlas?editorAtlases[fields[0] as keyof typeof editorAtlases]:undefined
      const path=atlas?info?.file:/^\d+$/.test(fields[0])?Number(fields[0]):fields[0]
      const url=asset(path,info?[info.leftTexCoord,info.rightTexCoord,info.topTexCoord,info.bottomTexCoord]:undefined)
      const width=Number(fields[1])||info?.width||16,height=Number(fields[2])||info?.height||width
      const coords=info&&[info.leftTexCoord,info.rightTexCoord,info.topTexCoord,info.bottomTexCoord]
      const crop=coords&&{backgroundSize:`${100/(coords[1]-coords[0])}% ${100/(coords[3]-coords[2])}%`,backgroundPosition:`${coords[1]-coords[0]===1?0:coords[0]/(1-coords[1]+coords[0])*100}% ${coords[3]-coords[2]===1?0:coords[2]/(1-coords[3]+coords[2])*100}%`}
      if(!url){const key=`inline:${fields[0]}`;if(!reportedMissingAssets.has(key)){reportedMissingAssets.add(key);console.warn('[STT editor asset missing]',{asset:key})}}
      return <span key={i} aria-label={fields[0]} style={{display:'inline-block',width,height,verticalAlign:'middle',color,backgroundImage:url?`url("${url}")`:undefined,backgroundSize:'100% 100%',...crop}}>{url?'':'□'}</span>
    }
    return <span key={i} style={{color}}>{part}</span>
  })}</>
}
type Send=(event:string,node:UiNode,data?:Record<string,string|number|boolean|number[]>)=>void
function NativeInput({node,style,send}:{node:UiNode;style:CSSProperties;send:Send}) {
  const ref=useRef<HTMLTextAreaElement>(null),composing=useRef(false)
  useEffect(()=>{
    const el=ref.current;if(!el||composing.current)return
    if(el.value!==(node.text||''))el.value=node.text||''
    if(node.focused&&document.activeElement!==el)el.focus({preventScroll:true})
    if(node.focused){const start=textOffset(el.value,node.highlight?.[0]??node.cursor??0),end=textOffset(el.value,(node.highlight?.[1]??node.cursor??0)<0?utf8.encode(el.value).length:node.highlight?.[1]??node.cursor??0);if(el.selectionStart!==start||el.selectionEnd!==end)el.setSelectionRange(start,end)}
  },[node.text,node.focused,node.cursor,node.highlight?.[0],node.highlight?.[1]])
  const changed=()=>{const el=ref.current!;if(!composing.current)send('OnTextChanged',node,{text:el.value,cursor:byteOffset(el.value,el.selectionStart)})}
  const insets=node.textInsets||[0,0,0,0]
  return <textarea ref={ref} data-lua-id={node.id} aria-label={node.isEditorText?'战术方案文本':node.label||'编辑字段'} className="stt-native-input" style={{...style,padding:`${insets[2]}px ${insets[1]}px ${insets[3]}px ${insets[0]}px`}} defaultValue={node.text} spellCheck={false} disabled={!node.enabled} maxLength={node.maxLetters||undefined}
    onFocus={()=>send('OnEditFocusGained',node)} onBlur={()=>send('OnEditFocusLost',node)}
    onChange={changed} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false;changed()}}
    onSelect={()=>{const el=ref.current;if(!composing.current&&el)send('OnCursorChanged',node,{cursor:byteOffset(el.value,el.selectionStart),highlight:[byteOffset(el.value,el.selectionStart),byteOffset(el.value,el.selectionEnd)]})}}/>
}
const LuaNode=memo(function LuaNode({node,send}:{node:UiNode;send:Send}) {
    const gesture=useRef<{id:number;x:number;y:number;button:string;dragging:boolean}|null>(null),suppressClick=useRef(false)
    const style:CSSProperties={left:node.x,top:node.y,width:node.width,height:node.height,zIndex:node.z,opacity:node.alpha,
      color:rgba(node.textColor),fontSize:node.font?.[1],fontFamily:'STT Dragonflight',whiteSpace:node.wordWrap?'pre-wrap':'pre',textAlign:(node.justifyH?.toLowerCase()||'left') as CSSProperties['textAlign'],
      display:'flex',alignItems:node.justifyV==='TOP'?'flex-start':node.justifyV==='BOTTOM'?'flex-end':'center',justifyContent:node.justifyH==='CENTER'?'center':node.justifyH==='RIGHT'?'flex-end':'flex-start',
      pointerEvents:node.mouse?'auto':'none'}
    if(node.shadowColor)style.textShadow=`${node.shadowOffset?.[0]||0}px ${-(node.shadowOffset?.[1]||0)}px ${rgba(node.shadowColor)}`
    if(node.hitRectInsets&&node.mouse){const [left,right,top,bottom]=node.hitRectInsets;style.left=node.x+left;style.top=node.y+top;style.width=node.width-left-right;style.height=node.height-top-bottom}
    if(node.clip){const c=node.clip,x=Number(style.left),y=Number(style.top),w=Number(style.width),h=Number(style.height);style.clipPath=`inset(${Math.max(0,c.top-y)}px ${Math.max(0,x+w-c.right)}px ${Math.max(0,y+h-c.bottom)}px ${Math.max(0,c.left-x)}px)`}
    if(node.backdrop){style.backgroundColor=rgba(node.backdropColor);style.backgroundImage=asset(node.backdrop.bgFile)?`url("${asset(node.backdrop.bgFile)}")`:undefined;style.border=`1px solid ${rgba(node.backdropBorderColor)||'transparent'}`}
    if(node.kind==='Texture') {
      const url=asset(node.texture,node.texCoord)
      const localClassIcon=typeof node.texture==='string'&&normalizedTexture(node.texture)==='interface/glues/charactercreate/ui-charactercreate-classes'&&!!url
      const statusBar=isStatusBarTexture(node.texture)
      const dropdownArrow=node.atlas==='common-dropdown-c-button-arrow-down'
      style.backgroundColor=rgba(node.color)
      if(url)style.backgroundImage=`url("${url}")`
      else if(statusBar){style.backgroundColor=rgba(node.vertexColor)||'#fff';style.backgroundImage='linear-gradient(to bottom,rgba(255,255,255,.28),rgba(255,255,255,.06) 45%,rgba(0,0,0,.14))'}
      else if(dropdownArrow){style.backgroundColor=rgba(node.vertexColor)||'#d7bd6b';style.clipPath='polygon(12% 32%,88% 32%,50% 72%)'}
      style.backgroundRepeat='no-repeat';style.backgroundSize='100% 100%'
      if(node.texCoord?.length===4&&!localClassIcon){const [l,r,t,b]=node.texCoord;style.backgroundSize=`${100/(r-l)}% ${100/(b-t)}%`;style.backgroundPosition=`${r-l===1?0:l/(1-r+l)*100}% ${b-t===1?0:t/(1-b+t)*100}%`}
      if(node.rotation)style.transform=`rotate(${-node.rotation}rad)`
      if(node.vertexColor)style.opacity=node.alpha*(node.vertexColor[3]??1)
      return <div key={node.id} data-lua-id={node.id} data-atlas={node.atlas} data-texture={node.texture} className={`stt-native-texture ${dropdownArrow?'stt-dropdown-arrow':''}`} style={style}/>
    }
    if(node.kind==='FontString')return <div key={node.id} data-lua-id={node.id} className="stt-native-font" style={style}><RichText text={node.text}/></div>
    if(node.kind==='EditBox')return <NativeInput key={node.id} node={node} style={{...style,display:'block',padding:0,lineHeight:1,whiteSpace:node.multiLine?'pre-wrap':'pre'}} send={send}/>
    const payload=(e:React.PointerEvent)=>({button:e.button===2?'RightButton':e.button===1?'MiddleButton':'LeftButton',now:e.timeStamp/1000,x:e.clientX,y:e.clientY,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})
    const events={
      onPointerDown:(e:React.PointerEvent)=>{const p=payload(e);gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,button:p.button,dragging:false};suppressClick.current=false;e.currentTarget.setPointerCapture(e.pointerId);send('OnMouseDown',node,p)},
      onPointerMove:(e:React.PointerEvent)=>{const g=gesture.current;if(g?.id===e.pointerId&&!g.dragging&&node.dragButtons?.includes(g.button)&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>=4){g.dragging=true;suppressClick.current=true;send('OnDragStart',node,payload(e))}},
      onPointerUp:(e:React.PointerEvent)=>{const g=gesture.current;if(g?.id===e.pointerId){if(g.dragging)send('OnDragStop',node,payload(e));gesture.current=null}send('OnMouseUp',node,payload(e))},
      onPointerCancel:(e:React.PointerEvent)=>{if(gesture.current?.id===e.pointerId){gesture.current=null;suppressClick.current=true;send('OnPointerCancel',node,payload(e))}},
      onLostPointerCapture:(e:React.PointerEvent)=>{if(gesture.current?.id===e.pointerId){gesture.current=null;suppressClick.current=true;send('OnPointerCancel',node,payload(e))}},
      onPointerEnter:(e:React.PointerEvent)=>send('OnEnter',node,payload(e)),
      onPointerLeave:(e:React.PointerEvent)=>send('OnLeave',node,payload(e)),
      onClick:(e:React.MouseEvent)=>{if(suppressClick.current){suppressClick.current=false;return}send('OnClick',node,{button:'LeftButton',now:e.timeStamp/1000,x:e.clientX,y:e.clientY,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})},
      onContextMenu:(e:React.MouseEvent)=>{e.preventDefault();send('OnClick',node,{button:'RightButton',x:e.clientX,y:e.clientY})},
      onWheel:(e:React.WheelEvent)=>send('OnMouseWheel',node,{delta:e.deltaY>0?-1:1,now:e.timeStamp/1000,x:e.clientX,y:e.clientY,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})}
    if(node.kind==='Slider')return <input key={node.id} data-lua-id={node.id} aria-label={textContent(node.label)||'滑块'} className="stt-native-slider" type="range" min={node.minValue} max={node.maxValue} step={node.valueStep||'any'} value={node.value||0} style={style} onChange={e=>send('OnValueChanged',node,{value:Number(e.currentTarget.value)})}/>
    if(node.kind==='Button'||node.kind==='CheckButton')return <button key={node.id} data-lua-id={node.id} aria-label={textContent(node.label)||node.name||'图标按钮'} aria-pressed={node.kind==='CheckButton'?node.checked:undefined} disabled={!node.enabled} className="stt-native-button" style={style} {...events}/>
    return <div key={node.id} data-lua-id={node.id} className="stt-native-frame" style={node.kind==='GameTooltip'?{...style,display:'block',padding:8,whiteSpace:'normal'}:style} {...events}>{node.kind==='GameTooltip'?node.lines?.map((line,index)=><div key={index} style={{color:rgba(line.color),whiteSpace:line.wrap?'normal':'nowrap'}}><RichText text={line.text}/></div>):null}</div>
})
function LuaSurface({tree,send}:{tree:UiTree;send:Send}) {
  return <div className="stt-lua-surface" aria-label="STT 战术方案编辑器">{tree.nodes.map(node=><LuaNode key={node.id} node={node} send={send}/>)}</div>
}
export default function Editor() {
  const runtime=useRef<EditorRuntime|null>(null),viewRef=useRef<EditorView|null>(null),blocked=useRef(false),latestText=useRef(''),requested=useRef(new Set<number>()),documents=useRef<Record<string,string>>({}),references=useRef<Record<string,{text?:string;hidden?:boolean}>>({}),uiNodes=useRef(new Map<number,UiNode>()),pointerDirty=useRef(true)
  const acceptRef=useRef<(view:EditorView)=>void>(),failRef=useRef<(error:unknown)=>void>(),sendRef=useRef<Send>()
  const [view,setView]=useState<EditorView|null>(null),[error,setError]=useState(''),[wcl,setWcl]=useState(false),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[report,setReport]=useState<{code:string;title:string;fights:EditorWclFight[];fight:number}|null>(null)
  const persist=(v:EditorView)=>{
    latestText.current=v.text
    if(blocked.current)return
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({context:{boss:v.document.bossKeyText,difficulty:v.document.difficulty,scope:v.document.scope},documents:v.documents,references:v.references,text:v.text}))}
    catch{blocked.current=true;setError('本地保存失败，当前文本仍可复制或导出。')}
  }
  const accept=(input:Partial<EditorView>)=>{
    const previous=viewRef.current
    let v={...previous,...input} as EditorView
    if(!v.ui)return
    if(v.ui.delta){for(const id of v.ui.hidden)uiNodes.current.delete(id);for(const node of v.ui.nodes)uiNodes.current.set(node.id,node)}
    else{uiNodes.current.clear();for(const node of v.ui.nodes)uiNodes.current.set(node.id,node)}
    v={...v,ui:{...v.ui,nodes:[...uiNodes.current.values()],hidden:[],delta:false}}
    if(v.documents)documents.current=v.documents
    if(v.references)references.current=v.references
    const documentKey=v.document.bossKeyText+'#'+v.document.difficulty+'#'+v.document.scope
    if(previous&&v.ui.delta&&v.ui.nodes.length===0&&v.ui.hidden.length===0
      &&previous.text===v.text&&previous.message===v.message&&previous.mode===v.mode
      &&previous.document.bossKeyText===v.document.bossKeyText&&previous.document.difficulty===v.document.difficulty
      &&previous.document.scope===v.document.scope&&!v.storageChanged) {
      previous.ui.revision=v.ui.revision
      if(v.wclRequested)setWcl(true)
      return
    }
    const shouldPersist=!previous||previous.text!==v.text||previous.document.bossKeyText!==v.document.bossKeyText
      ||previous.document.difficulty!==v.document.difficulty||previous.document.scope!==v.document.scope||v.storageChanged
    documents.current[documentKey]=v.text
    for(const node of v.ui.nodes){
      const missingAtlas=node.atlas&&!editorAtlases[node.atlas as keyof typeof editorAtlases]
      const missingTexture=typeof node.texture==='string'&&!asset(node.texture,node.texCoord)
      const missingBackdrop=node.backdrop?.edgeFile&&!asset(node.backdrop.edgeFile)&&normalizedTexture(node.backdrop.edgeFile)!=='interface/buttons/white8x8'
      const key=missingAtlas?`atlas:${node.atlas}`:missingTexture?`texture:${node.texture}`:missingBackdrop?`backdrop:${node.backdrop?.edgeFile}`:''
      if(key&&!reportedMissingAssets.has(key)){reportedMissingAssets.add(key);console.warn('[STT editor asset missing]',{asset:key,frame:node.name||node.kind})}
    }
    const wclRequested=v.wclRequested===true
    v={...v,wclRequested:false,storageChanged:false}
    viewRef.current=v;setView(v);if(shouldPersist)persist({...v,documents:documents.current,references:references.current});if(wclRequested)setWcl(true)
  }
  const fail=(reason:unknown)=>{setError(String(reason));console.error('[STT editor host]',{result:'failed',reason:String(reason)})}
  const call=(action:string,args:Parameters<EditorRuntime['call']>[1]={})=>{try{const v=runtime.current?.call<EditorView>(action,args);if(v?.ui)accept(v);return v}catch(e){fail(e)}}
  acceptRef.current=accept;failRef.current=fail
  sendRef.current??=((event,node,args={})=>{if(['OnMouseDown','OnMouseUp','OnClick','OnEnter','OnLeave','OnMouseWheel'].includes(event))pointerDirty.current=true;try{const v=runtime.current?.call<EditorView>('uiEvent',{id:node.id,event,...args});if(v?.ui)acceptRef.current?.(v)}catch(e){failRef.current?.(e)}})
  const send=sendRef.current
  useEffect(()=>{
    let disposed=false
    const font=new FontFace('STT Dragonflight','url(/stt-editor/fonts/stt_dragonflight_zhcn.ttf)')
    Promise.all([import('../lib/stt-editor/runtime'),font.load().then(f=>document.fonts.add(f))]).then(([{EditorRuntime}])=>{
      if(disposed)return
      const vm=new EditorRuntime();runtime.current=vm
      let saved:null|{context:{boss:string;difficulty:string;scope:string};documents:Record<string,string>;references:Record<string,never>;text?:string}=null
      try{const value=localStorage.getItem(STORAGE_KEY);saved=value?JSON.parse(value):null;if(saved&&(!saved.context||!saved.documents))throw Error('invalid draft')}
      catch{blocked.current=true;setError('草稿无法恢复，已暂停自动保存以保留原记录。')}
      const context=saved?.context
      const text=saved?.text??(context?saved?.documents[`${context.boss}#${context.difficulty}#${context.scope}`]:undefined)
      accept(vm.call('open',{width:window.innerWidth,height:window.innerHeight-34,...context,documents:saved?.documents,references:saved?.references,text}))
    }).catch(fail)
    const resize=()=>{pointerDirty.current=true;call('resize',{width:window.innerWidth,height:window.innerHeight-34})}
    const pointer=(e:PointerEvent)=>{pointerDirty.current=true;const x=e.clientX,y=e.clientY,hitIDs:number[]=[];for(const node of uiNodes.current.values()){const c=node.clip,i=node.hitRectInsets||[0,0,0,0];if(x>=node.x+i[0]&&x<=node.x+node.width-i[1]&&y>=node.y+i[2]&&y<=node.y+node.height-i[3]&&(!c||x>=c.left&&x<=c.right&&y>=c.top&&y<=c.bottom))hitIDs.push(node.id)}try{runtime.current?.call('pointer',{now:e.timeStamp/1000,x,y,hitIDs,hitRevision:viewRef.current?.ui.revision,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})}catch(e){fail(e)}}
    const key=(e:KeyboardEvent)=>{if(e.isComposing||e.target instanceof HTMLInputElement&&e.target.type==='range'||e.target instanceof HTMLElement&&e.target.closest('.stt-browser-tools,.stt-wcl'))return;const keys:Record<string,string>={Escape:'ESCAPE',Enter:'ENTER',Backspace:'BACKSPACE',Delete:'DELETE',Tab:'TAB',ArrowLeft:'LEFT',ArrowRight:'RIGHT',ArrowUp:'UP',ArrowDown:'DOWN',' ':'SPACE'};try{const result=runtime.current?.call<{consumed:boolean}>('key',{key:keys[e.key]||e.key.toUpperCase(),down:e.type==='keydown',shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey});if(result?.consumed)e.preventDefault()}catch(e){fail(e)}}
    const blur=()=>call('cancelPointer')
    window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer);window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur)
    return()=>{disposed=true;window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);runtime.current?.dispose();runtime.current=null}
  },[])
  useEffect(()=>{
    if(!view||!runtime.current)return
    let raf=0,previous=performance.now(),updateNext=false
    const tick=(now:number)=>{try{const update=pointerDirty.current||updateNext;pointerDirty.current=false;const next=runtime.current?.call<Partial<EditorView>>('frame',{elapsed:Math.min(.1,(now-previous)/1000),revision:viewRef.current?.ui.revision,update});previous=now;updateNext=next?.updateNext===true;if(next?.ui)accept(next)}catch(e){fail(e);return}raf=requestAnimationFrame(tick)}
    raf=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(raf)
  },[Boolean(view)])
  useEffect(()=>{
    const vm=runtime.current;if(!vm||!view)return
    let ids:number[]=[];try{ids=vm.call<number[]>('spellIDs').filter(id=>!requested.current.has(id)).slice(0,40)}catch(e){fail(e);return}
    if(!ids.length)return;ids.forEach(id=>requested.current.add(id))
    getEditorSpells(ids).then(result=>{if(runtime.current===vm&&result.spells.length)call('spellMetadata',{spells:result.spells.map(s=>({...s}))})}).catch(()=>setError('技能元数据暂不可用；方案文本已保留。'))
  },[view?.text,view?.document.bossKeyText,view?.ui.revision])
  async function loadReport(){setBusy(true);try{const parsed=new URL(url);if(!['warcraftlogs.com','www.warcraftlogs.com','cn.warcraftlogs.com'].includes(parsed.hostname))throw Error('请输入 Warcraft Logs 报告链接');const code=parsed.pathname.match(/^\/reports\/([A-Za-z0-9]{16})/)?.[1];if(!code)throw Error('报告链接无效');const result=await getEditorWclReport(code);const fight=Number(new URLSearchParams(parsed.hash.slice(1)).get('fight'))||result.fights[0]?.id;setReport({...result,code,fight})}catch(e){fail(e)}finally{setBusy(false)}}
  async function importRoster(){if(!report)return;setBusy(true);try{const result=await getEditorWclRoster(report.code,report.fight);if(call('roster',{members:result.members.map(m=>({...m}))}))setWcl(false)}catch(e){fail(e)}finally{setBusy(false)}}
  return <section className="stt-native" aria-busy={!view}>
    {view&&<LuaSurface tree={view.ui} send={send}/>}
    <div className="stt-browser-tools"><button onClick={()=>navigator.clipboard.writeText(latestText.current).catch(fail)}>复制战术方案</button><button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([latestText.current],{type:'text/plain;charset=utf-8'}));a.download='STT.txt';a.click();URL.revokeObjectURL(a.href)}}>导出文本</button><label>导入文本<input type="file" accept=".txt,text/plain" onChange={async e=>{const file=e.currentTarget.files?.[0];if(file)call('text',{text:await file.text()})}}/></label><span role="status">{view?.message||(!view?'正在载入编辑器…':'本地草稿')}</span></div>
    {error&&<div className="stt-host-error" role="alert">{error}<button onClick={()=>setError('')}>关闭提示</button></div>}
    {wcl&&<div className="stt-wcl"><section role="dialog" aria-modal="true" aria-label="从 WCL 导入团员"><button onClick={()=>setWcl(false)}>关闭</button><label>WCL 报告链接<input value={url} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy} onClick={loadReport}>读取报告</button>{report&&<><label>战斗<select value={report.fight} onChange={e=>setReport({...report,fight:Number(e.target.value)})}>{report.fights.map(f=><option value={f.id} key={f.id}>#{f.id} {f.name}</option>)}</select></label><button disabled={busy} onClick={importRoster}>导入这场名单</button></>}</section></div>}
  </section>
}
