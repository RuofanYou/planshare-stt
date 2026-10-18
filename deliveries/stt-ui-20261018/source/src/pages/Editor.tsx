import {memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react'
import {getEditorSpells,getEditorWclStatus,getEditorWclReport,getEditorWclRoster,type EditorWclFight} from '../api/client'
import {editorAtlases} from '../generated/sttEditorMedia'
import editorMedia from '../lib/stt-editor/media.json'
import sourceManifest from '../lib/stt-editor/source-manifest.json'
import addonMedia from '../lib/stt-editor/addon-media-manifest.json'
import remoteImages from '../lib/stt-editor/remote-image-manifest.json'
import type {EditorRuntimeHandle,EditorView,UiNode,UiTree} from '../lib/stt-editor/runtime'
import '../styles/editor.css'
import TextureRegion from '../lib/stt-editor/TextureRegion'
import {displayText,replaceDisplayText,byteOffset,textOffset,measureInputCaret} from '../lib/stt-editor/display-text'
import {editorViewport,editorPoint} from '../lib/stt-editor/viewport'

const sameRecord=(a:object|undefined,b:object|undefined)=>a===b||!!(a&&b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>(a as Record<string,unknown>)[key]===(b as Record<string,unknown>)[key]))
const STORAGE_KEY='stt.editor.v1'
const previewBuild=import.meta.env.VITE_STT_EDITOR_PREVIEW==='1'
const reportedMissingAssets=new Set<string>()
const rgba=(c?:number[])=>c?`rgba(${c.slice(0,3).map(v=>Math.round(v*255)).join(',')},${c[3]??1})`:undefined
const classIconCoords:Record<string,number[]>={
  WARRIOR:[0,.25,0,.25],MAGE:[.25,.5,0,.25],ROGUE:[.5,.75,0,.25],DRUID:[.75,1,0,.25],
  HUNTER:[0,.25,.25,.5],SHAMAN:[.25,.5,.25,.5],PRIEST:[.5,.75,.25,.5],WARLOCK:[.75,1,.25,.5],
  PALADIN:[0,.25,.5,.75],DEATHKNIGHT:[.25,.5,.5,.75],MONK:[.5,.75,.5,.75],DEMONHUNTER:[.75,1,.5,.75],
}
const nativeImages=new Map(Object.entries(addonMedia).map(([source,value])=>{const entry=value as {png:string;addon?:string;sourcePath?:string};return [(entry.addon||'STT').toLowerCase()+'/'+(entry.sourcePath||source).toLowerCase(),'/stt-editor/'+entry.png]}))
const normalizedTexture=(path:string)=>path.replace(/\\/g,'/').toLowerCase()
const isStatusBarTexture=(path?:string|number)=>typeof path==='string'&&normalizedTexture(path)==='interface/targetingframe/ui-statusbar'
function asset(path?:string|number,texCoord?:number[]):string|undefined {
  if(typeof path==='number')return Object.prototype.hasOwnProperty.call(editorMedia.textures,String(path))?`/stt-editor/textures/${path}.png`:undefined
  if(typeof path!=='string')return undefined
  if(path.startsWith('https://')){const cached=(remoteImages as Record<string,{file:string}>)[path];if(cached)return '/stt-editor/'+cached.file;const icon=path.match(/^https:\/\/wow\.zamimg\.com\/images\/wow\/icons\/medium\/([a-z0-9_]+\.jpg)$/);return icon?'/api/editor/icon?name='+encodeURIComponent(icon[1]):path}
  const normalized=path.replace(/\\/g,'/')
  const lower=normalized.toLowerCase()
  const local=normalized.match(/^Interface\/AddOns\/(STT|STT_TacticsEditor)\/media\/(.+)$/i)
  if(local){const key=local[1].toLowerCase()+'/'+local[2].toLowerCase();return nativeImages.get(key)||nativeImages.get(key+'.tga')||(!/\.tga$/i.test(local[2])?'/stt-editor/'+(local[1].toLowerCase()==='stt'?'':'tactics-editor/')+local[2]:undefined)}
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
  const previous=useRef({cursor:node.cursor,start:node.highlight?.[0],end:node.highlight?.[1]})
  const displayBuffer=useRef(node.text||'')
  const inputDisplay=(raw:string)=>node.isEditorText?displayText(raw):{text:raw,toNative:(offset:number)=>byteOffset(raw,offset),toVisible:(bytes:number)=>textOffset(raw,bytes)}
  useLayoutEffect(()=>{
    const el=ref.current;if(!el||composing.current)return
    const display=inputDisplay(node.text||'')
    displayBuffer.current=node.text||''
    const textChanged=el.value!==display.text
    if(textChanged)el.value=display.text
    const programmaticFocus=node.focused&&document.activeElement!==el
    if(programmaticFocus)el.focus({preventScroll:true})
    if(!node.focused&&document.activeElement===el)el.blur()
    const selectionChanged=previous.current.cursor!==node.cursor||previous.current.start!==node.highlight?.[0]||previous.current.end!==node.highlight?.[1]
    if(node.focused&&(textChanged||selectionChanged||programmaticFocus)){const start=display.toVisible(node.highlight?.[0]??node.cursor??0),end=(node.highlight?.[1]??node.cursor??0)<0?el.value.length:display.toVisible(node.highlight?.[1]??node.cursor??0);if(el.selectionStart!==start||el.selectionEnd!==end)el.setSelectionRange(start,end)}
    previous.current={cursor:node.cursor,start:node.highlight?.[0],end:node.highlight?.[1]}
  },[node.text,node.focused,node.cursor,node.highlight?.[0],node.highlight?.[1]])
  const changed=()=>{const el=ref.current!;if(!composing.current){const text=node.isEditorText?replaceDisplayText(displayBuffer.current,el.value):el.value;displayBuffer.current=text;send('OnTextChanged',node,{text,cursor:inputDisplay(text).toNative(el.selectionStart),...measureInputCaret(el)})}}
  const selected=()=>{const el=ref.current;if(!composing.current&&el){const display=inputDisplay(displayBuffer.current);send('OnCursorChanged',node,{cursor:display.toNative(el.selectionDirection==='backward'?el.selectionStart:el.selectionEnd),highlight:[display.toNative(el.selectionStart),display.toNative(el.selectionEnd)],...measureInputCaret(el)})}}
  const pointer=(event:React.PointerEvent)=>({button:event.button===2?'RightButton':event.button===1?'MiddleButton':'LeftButton',now:event.timeStamp/1000,x:event.clientX,y:event.clientY,shift:event.shiftKey,ctrl:event.ctrlKey||event.metaKey,alt:event.altKey})
  const insets=node.textInsets||[0,0,0,0]
  return <textarea ref={ref} data-lua-id={node.id} aria-label={node.isEditorText?'战术方案文本':node.label||'编辑字段'} className="stt-native-input" style={{...style,color:node.composing?(style.caretColor||'white'):style.color,padding:`${insets[2]}px ${insets[1]}px ${insets[3]}px ${insets[0]}px`}} defaultValue={inputDisplay(node.text||'').text} spellCheck={false} disabled={!node.enabled} maxLength={node.maxLetters||undefined}
    onFocus={()=>send('OnEditFocusGained',node)} onBlur={()=>{if(composing.current){composing.current=false;if(ref.current)ref.current.value=inputDisplay(displayBuffer.current).text;send('OnCompositionChanged',node,{composing:false})}send('OnEditFocusLost',node)}}
    onChange={changed} onCompositionStart={()=>{composing.current=true;send('OnCompositionChanged',node,{composing:true})}} onCompositionEnd={()=>{composing.current=false;send('OnCompositionChanged',node,{composing:false});changed()}}
    onPointerDown={event=>send('OnMouseDown',node,pointer(event))} onPointerUp={event=>{selected();send('OnMouseUp',node,pointer(event))}}
    onPointerEnter={event=>send('OnEnter',node,pointer(event))} onPointerLeave={event=>send('OnLeave',node,pointer(event))}
    onScroll={event=>{if(node.isEditorText){event.currentTarget.scrollTop=0;event.currentTarget.scrollLeft=0}}}
    onSelect={selected}/>
}
const LuaNode=memo(function LuaNode({node,send,scale}:{node:UiNode;send:Send;scale:number}) {
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
      if(url||node.color||node.gradient)return <TextureRegion node={node} style={style} asset={asset} displayScale={scale}/>
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
    if(node.kind==='FontString')return <div key={node.id} data-lua-id={node.id} className="stt-native-font" style={{...style,visibility:node.composing?'hidden':undefined}}><span style={{display:'block',width:'100%',overflowWrap:node.wordWrap?'anywhere':undefined}}>{node.nativeTextRegion?displayText(node.text).runs.map((run,index)=><span key={index} style={{color:run.color}}>{run.text}</span>):<RichText text={node.text}/>}</span></div>
    if(node.kind==='EditBox')return <NativeInput key={node.id} node={node} style={{...style,display:'block',padding:0,lineHeight:1,whiteSpace:node.multiLine?'pre-wrap':'pre',color:node.nativeTextRegion?'transparent':style.color,caretColor:style.color||'white'}} send={send}/>
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
      onContextMenu:(e:React.MouseEvent)=>{e.preventDefault();send('OnClick',node,{button:'RightButton',x:e.clientX,y:e.clientY})}}
    if(node.kind==='Slider')return <input key={node.id} data-lua-id={node.id} aria-label={textContent(node.label)||'滑块'} className="stt-native-slider" type="range" min={node.minValue} max={node.maxValue} step={node.valueStep||'any'} value={node.value||0} style={style} onChange={e=>send('OnValueChanged',node,{value:Number(e.currentTarget.value)})}/>
    if(node.kind==='Button'||node.kind==='CheckButton')return <button key={node.id} data-lua-id={node.id} aria-label={textContent(node.label)||node.name||'图标按钮'} aria-pressed={node.kind==='CheckButton'?node.checked:undefined} disabled={!node.enabled} className="stt-native-button" style={style} {...events}/>
    return <div key={node.id} data-lua-id={node.id} className="stt-native-frame" data-hit-insets={node.hitRectInsets?.join(',')} style={node.kind==='GameTooltip'?{...style,display:'block',padding:8,whiteSpace:'normal'}:style} {...events}>{node.kind==='GameTooltip'?node.lines?.map((line,index)=><div key={index} style={{color:rgba(line.color),whiteSpace:line.wrap?'normal':'nowrap'}}><RichText text={line.text}/></div>):null}</div>
})
function LuaSurface({tree,send,scale}:{tree:UiTree;send:Send;scale:number}) {
  return <div className="stt-canvas-space" style={{width:tree.width*scale,height:tree.height*scale}}><div className="stt-lua-surface" aria-label="STT 战术方案编辑器" style={{width:tree.width,height:tree.height,zoom:scale}}>{tree.nodes.map(node=><LuaNode key={node.id} node={node} send={send} scale={scale}/>)}</div></div>
}
export default function Editor() {
  const viewportRef=useRef<HTMLDivElement|null>(null)
  const viewport=()=>editorViewport(window.innerWidth,viewportRef.current?.clientHeight||window.innerHeight-34)
  const spellAttempts=useRef(new Map<number,number>()),spellBusy=useRef(false),metadataApplied=useRef(false)
  const [metadataTick,setMetadataTick]=useState(0),[metadataLoading,setMetadataLoading]=useState(false),[metadataFailed,setMetadataFailed]=useState(false)
  const runtime=useRef<EditorRuntimeHandle|null>(null),viewRef=useRef<EditorView|null>(null),blocked=useRef(false),latestText=useRef(''),requested=useRef(new Set<number>()),documents=useRef<Record<string,string>>({}),references=useRef<Record<string,{text?:string;hidden?:boolean}>>({}),uiNodes=useRef(new Map<number,UiNode>()),pointerDirty=useRef(true)
  const acceptRef=useRef<(view:EditorView)=>void>(),failRef=useRef<(error:unknown)=>void>(),sendRef=useRef<Send>()
  const [view,setView]=useState<EditorView|null>(null),[error,setError]=useState(''),[wcl,setWcl]=useState(false),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[report,setReport]=useState<{code:string;title:string;fights:EditorWclFight[];fight:number}|null>(null)
  const [wclAvailability,setWclAvailability]=useState<'checking'|'ready'|'unconfigured'|'unavailable'>('checking')
  const reportRequest=useRef(0),importRequest=useRef(0),draftRevision=useRef(0),[reportLoading,setReportLoading]=useState(false),[reportNotice,setReportNotice]=useState('')
  useEffect(()=>()=>{reportRequest.current++;importRequest.current++},[])
  useEffect(()=>{
    if(!wcl)return
    let active=true;setWclAvailability('checking')
    getEditorWclStatus().then(result=>{if(active)setWclAvailability(result.configured?'ready':'unconfigured')}).catch(()=>{if(active)setWclAvailability('unavailable')})
    return()=>{active=false}
  },[wcl])
  const persist=(v:EditorView)=>{
    latestText.current=v.text
    if(blocked.current)return
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({context:{boss:v.document.bossKeyText,difficulty:v.document.difficulty,scope:v.document.scope},documents:v.documents,references:v.references,text:v.text,appearance:v.appearance?.explicit?v.appearance:undefined}))}
    catch{blocked.current=true;setError('本地保存失败，当前文本仍可复制或导出。')}
  }
  const accept=(input:Partial<EditorView>)=>{
    const previous=viewRef.current
    let v={...previous,...input} as EditorView
    if(!v.ui)return
    if(v.ui.delta){for(const id of v.ui.hidden)uiNodes.current.delete(id);for(const node of v.ui.nodes)uiNodes.current.set(node.id,node)}
    else{uiNodes.current.clear();for(const node of v.ui.nodes)uiNodes.current.set(node.id,node)}
    v={...v,ui:{...v.ui,nodes:[...uiNodes.current.values()],hidden:[],delta:false}}
    // Empty Lua tables arrive as arrays; document keys require a JSON object.
    if(v.documents)documents.current={...v.documents}
    if(v.references)references.current=v.references
    const documentKey=v.document.bossKeyText+'#'+v.document.difficulty+'#'+v.document.scope
    if(previous&&(previous.text!==v.text||previous.document.bossKeyText!==v.document.bossKeyText
      ||previous.document.difficulty!==v.document.difficulty||previous.document.scope!==v.document.scope||v.storageChanged)){
      draftRevision.current++;importRequest.current++;setBusy(false)
    }
    if(previous&&input.ui?.delta===true&&input.ui.nodes.length===0&&input.ui.hidden.length===0
      &&previous.ui.width===v.ui.width&&previous.ui.height===v.ui.height&&sameRecord(previous.document,v.document)&&sameRecord(previous.appearance,v.appearance)
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
  const call=(action:string,args:Parameters<EditorRuntimeHandle['call']>[1]={})=>{try{const v=runtime.current?.call<EditorView>(action,args);if(v?.ui)accept(v);return v}catch(e){fail(e)}}
  acceptRef.current=accept;failRef.current=fail
  sendRef.current??=((event,node,args={})=>{if(['OnMouseDown','OnMouseUp','OnClick','OnEnter','OnLeave','OnMouseWheel'].includes(event))pointerDirty.current=true;const point=typeof args.x==='number'&&typeof args.y==='number'?editorPoint(args.x,args.y,viewportRef.current,viewport().scale):{};try{const v=runtime.current?.call<EditorView>('uiEvent',{id:node.id,event,...args,...point});if(v?.ui)acceptRef.current?.(v)}catch(e){failRef.current?.(e)}})
  const send=sendRef.current
  useEffect(()=>{
    let disposed=false
    const font=new FontFace('STT Dragonflight','url(/stt-editor/fonts/stt_dragonflight_zhcn.ttf)')
    Promise.all([import('../lib/stt-editor/runtime'),font.load().then(f=>document.fonts.add(f))]).then(async([{EditorRuntime}])=>{
      if(disposed)return
      const vm=await EditorRuntime.create()
      if(disposed){vm.dispose();return}
      runtime.current=vm
      let saved:null|{context:{boss:string;difficulty:string;scope:string};documents:Record<string,string>;references?:EditorView['references'];text?:string;appearance?:EditorView['appearance']}=null
      try{
        const value=localStorage.getItem(STORAGE_KEY);saved=value?JSON.parse(value):null
        if(saved!==null){
          const record=(value:unknown)=>!!value&&typeof value==='object'&&!Array.isArray(value)
          // Recover drafts written by the former empty-table array serializer.
          // The explicit text is authoritative; ambiguous arrays remain protected.
          if(record(saved)&&Array.isArray(saved.documents)&&saved.documents.length===0&&typeof saved.text==='string')saved.documents={}
          if(!record(saved)||!record(saved.context)||!record(saved.documents)
            ||typeof saved.context.boss!=='string'||typeof saved.context.difficulty!=='string'||typeof saved.context.scope!=='string'
            ||Object.values(saved.documents).some(text=>typeof text!=='string')
            ||saved.text!==undefined&&typeof saved.text!=='string')throw Error('invalid draft')
          // The Lua adapter serializes an empty table as []; preserve that valid form.
          const referenceRecord=(value:unknown)=>record(value)||Array.isArray(value)&&value.length===0
          if(saved.references!==undefined&&(!referenceRecord(saved.references)||Object.values(saved.references).some(reference=>
            !referenceRecord(reference)||reference.text!==undefined&&typeof reference.text!=='string'
            ||reference.hidden!==undefined&&typeof reference.hidden!=='boolean')))throw Error('invalid references')
        }
      }
      catch{saved=null;blocked.current=true;setError('草稿无法恢复，已暂停自动保存以保留原记录。')}
      const context=saved?.context
      const text=saved?.text??(context?saved?.documents[`${context.boss}#${context.difficulty}#${context.scope}`]:undefined)
      // The requested web appearance is glass. Keep an explicit saved choice,
      // while migrating old drafts that only inherited the native legacy default.
      const appearance=saved?.appearance?.explicit?saved.appearance:{mode:'glass'}
      let initialView:EditorView
      try{initialView=vm.call('open',{...viewport(),...context,documents:saved?.documents,references:saved?.references,appearance,text})}
      catch(error){
        if(!saved)throw error
        blocked.current=true;setError('草稿无法恢复，已暂停自动保存以保留原记录。')
        runtime.current=null;vm.dispose()
        const clean=await EditorRuntime.create()
        if(disposed){clean.dispose();return}
        runtime.current=clean
        initialView=clean.call('open',{...viewport(),appearance:{mode:'glass'}})
      }
      accept(initialView)
    }).catch(error=>{if(!disposed)fail(error)})
    const resize=()=>{pointerDirty.current=true;call('resize',viewport())}
    const pointer=(e:PointerEvent)=>{pointerDirty.current=true;const {x,y}=editorPoint(e.clientX,e.clientY,viewportRef.current,viewport().scale),hitIDs:number[]=[];for(const node of uiNodes.current.values()){const c=node.clip,i=node.hitRectInsets||[0,0,0,0];if(x>=node.x+i[0]&&x<=node.x+node.width-i[1]&&y>=node.y+i[2]&&y<=node.y+node.height-i[3]&&(!c||x>=c.left&&x<=c.right&&y>=c.top&&y<=c.bottom))hitIDs.push(node.id)}try{runtime.current?.call('pointer',{now:e.timeStamp/1000,x,y,hitIDs,hitRevision:viewRef.current?.ui.revision,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})}catch(e){fail(e)}}
    // Consumed shortcuts can mutate the draft; frame deltas only synchronize UI.
    const key=(e:KeyboardEvent)=>{if(e.isComposing||e.target instanceof HTMLInputElement&&e.target.type==='range'||e.target instanceof HTMLElement&&e.target.closest('.stt-browser-tools,.stt-wcl'))return;const keys:Record<string,string>={Escape:'ESCAPE',Enter:'ENTER',Backspace:'BACKSPACE',Delete:'DELETE',Tab:'TAB',ArrowLeft:'LEFT',ArrowRight:'RIGHT',ArrowUp:'UP',ArrowDown:'DOWN',' ':'SPACE'};try{const result=runtime.current?.call<{consumed:boolean}>('key',{key:keys[e.key]||e.key.toUpperCase(),down:e.type==='keydown',shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey});if(result?.consumed){e.preventDefault();call('snapshot')}}catch(e){fail(e)}}
    const blur=()=>call('cancelPointer')
    const wheel=(e:WheelEvent)=>{
      if(e.defaultPrevented||!e.deltaY||!(e.target instanceof Element)||!e.target.closest('.stt-lua-surface'))return
      const element=e.target.closest('[data-lua-id]'),node=element&&uiNodes.current.get(Number(element.getAttribute('data-lua-id')))
      if(!node)return
      pointerDirty.current=true
      const point=editorPoint(e.clientX,e.clientY,viewportRef.current,viewport().scale)
      try{
        const v=runtime.current?.call<EditorView&{wheelHandled?:boolean}>('uiEvent',{id:node.id,event:'OnMouseWheel',delta:e.deltaY>0?-1:1,now:e.timeStamp/1000,...point,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey})
        if(v?.wheelHandled)e.preventDefault()
        if(v?.ui)acceptRef.current?.(v)
      }catch(error){failRef.current?.(error)}
    }
    const observer=new ResizeObserver(resize);if(viewportRef.current)observer.observe(viewportRef.current)
    window.addEventListener('wheel',wheel,{passive:false})
    window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer);window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur)
    return()=>{disposed=true;observer.disconnect();window.removeEventListener('wheel',wheel);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);runtime.current?.dispose();runtime.current=null}
  },[])
  useEffect(()=>{
    if(!view||!runtime.current)return
    let raf=0,previous=performance.now(),updateNext=false
    const tick=(now:number)=>{try{const update=pointerDirty.current||updateNext;pointerDirty.current=false;const next=runtime.current?.call<Partial<EditorView>>('frame',{now:now/1000,elapsed:Math.min(.1,(now-previous)/1000),revision:viewRef.current?.ui.revision,update});previous=now;updateNext=next?.updateNext===true;if(next?.ui)accept(next)}catch(e){fail(e);return}raf=requestAnimationFrame(tick)}
    raf=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(raf)
  },[Boolean(view)])
  useEffect(()=>{
    const vm=runtime.current;if(!vm||!view||spellBusy.current)return
    let missing:number[]=[];try{missing=vm.call<number[]>('spellIDs').filter(id=>!requested.current.has(id))}catch(e){fail(e);return}
    const ids=missing.filter(id=>(spellAttempts.current.get(id)||0)<2).slice(0,40)
    setMetadataFailed(missing.some(id=>(spellAttempts.current.get(id)||0)>=2))
    if(!ids.length){setMetadataLoading(false);if(metadataApplied.current){metadataApplied.current=false;call('spellMetadataComplete')}return}
    spellBusy.current=true;setMetadataLoading(true);ids.forEach(id=>spellAttempts.current.set(id,(spellAttempts.current.get(id)||0)+1))
    getEditorSpells(ids).then(result=>{
      if(runtime.current!==vm)return
      const spells=result.spells.filter(s=>ids.includes(s.id))
      for(const spell of spells){requested.current.add(spell.id);spellAttempts.current.delete(spell.id)}
      if(spells.length){metadataApplied.current=true;call('spellMetadata',{spells:spells.map(s=>({...s}))})}
    }).catch(()=>{/* A bounded retry follows; persistent failure stays visible. */}).finally(()=>{
      if(runtime.current===vm){spellBusy.current=false;setMetadataTick(tick=>tick+1)}
    })
  },[view?.text,view?.document.bossKeyText,view?.ui.revision,metadataTick])
  function changeReportUrl(nextUrl:string){reportRequest.current++;setBusy(false);setReportLoading(false);setReportNotice('');setReport(null);setUrl(nextUrl)}
  function closeWcl(){reportRequest.current++;setBusy(false);setReportLoading(false);setReportNotice('');setReport(null);setWcl(false)}
  function changeFight(fight:number){if(!report||!report.fights.some(f=>f.id===fight))return;reportRequest.current++;setBusy(false);setReportNotice('');setReport({...report,fight})}
  async function loadReport(){
    const request=++reportRequest.current
    setBusy(false);setReportLoading(true);setReportNotice('');setReport(null)
    try{
      const parsed=new URL(url)
      if(!['warcraftlogs.com','www.warcraftlogs.com','cn.warcraftlogs.com'].includes(parsed.hostname))throw Error('请输入 Warcraft Logs 报告链接')
      const code=parsed.pathname.match(/^\/reports\/([A-Za-z0-9]{16})/)?.[1]
      if(!code)throw Error('报告链接无效')
      const result=await getEditorWclReport(code)
      if(request!==reportRequest.current)return
      const fights=result.fights.filter(f=>Number.isSafeInteger(f.id)&&f.id>0)
      if(!fights.length)throw Error('这份报告没有可导入的有效战斗，请更换报告链接。')
      const requestedFight=new URLSearchParams(parsed.hash.slice(1)).get('fight')
      const selectedFight=fights.find(f=>f.id===Number(requestedFight))
      const fight=selectedFight?.id??fights[0].id
      if(requestedFight!==null&&!selectedFight)setReportNotice('链接中的战斗编号无效，已选中列表中的第一场战斗。请核对后再点击“导入这场名单”。')
      setReport({...result,fights,code,fight})
    }catch(e){if(request===reportRequest.current)fail(e)}
    finally{if(request===reportRequest.current)setReportLoading(false)}
  }
  async function importText(file:File|undefined){
    const vm=runtime.current
    if(!file||!vm||!viewRef.current)return
    const request=++importRequest.current,revision=draftRevision.current
    const current=()=>request===importRequest.current&&revision===draftRevision.current&&runtime.current===vm
    setBusy(false)
    try{const text=await file.text();if(current())call('text',{text})}
    catch(e){if(current())fail(e)}
  }
  async function importRoster(){
    const vm=runtime.current,selected=report
    if(!selected||!vm||!viewRef.current||!selected.fights.some(f=>f.id===selected.fight))return
    const request=++importRequest.current,revision=draftRevision.current,reportRevision=reportRequest.current
    const current=()=>request===importRequest.current&&revision===draftRevision.current&&runtime.current===vm&&reportRevision===reportRequest.current
    setBusy(true)
    try{
      const result=await getEditorWclRoster(selected.code,selected.fight)
      if(current()&&call('roster',{members:result.members.map(m=>({...m}))}))closeWcl()
    }catch(e){if(current())fail(e)}
    finally{if(current())setBusy(false)}
  }
  return <section className="stt-native" aria-busy={!view}>
    <div className="stt-host-viewport" ref={viewportRef}>{view&&<LuaSurface tree={view.ui} send={send} scale={viewport().scale}/>}</div>
    <div className="stt-browser-tools"><span title={sourceManifest.revision}>STT {sourceManifest.revision.slice(0,7)}</span><span data-stt-engine={runtime.current?.engine||'loading'} aria-label="Lua运行引擎">{runtime.current?.engine==='wasmoon'?'Lua: WASM':runtime.current?.engine==='fengari'?'Lua: Fengari':'Lua: 载入中'}</span>{previewBuild&&<a href="/stt-editor/preview-status.txt" target="_blank" rel="noreferrer">预览 · 差异说明</a>}<label>外观<select aria-label="编辑器外观" disabled={!view} value={view?.appearance?.mode||'glass'} onChange={e=>call('appearance',{mode:e.target.value})}><option value="legacy">原版</option><option value="glass">玻璃</option></select></label><button onClick={()=>navigator.clipboard.writeText(latestText.current).catch(fail)}>复制战术方案</button><button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([latestText.current],{type:'text/plain;charset=utf-8'}));a.download='STT.txt';a.click();URL.revokeObjectURL(a.href)}}>导出文本</button><label>导入文本<input type="file" accept=".txt,text/plain" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importText(file)}}/></label><span role="status">{metadataLoading?'正在载入技能资料…':metadataFailed?'部分技能资料未加载':view?.message||(!view?'正在载入编辑器…':'本地草稿')}</span>{metadataFailed&&<button onClick={()=>{spellAttempts.current.clear();setMetadataFailed(false);setMetadataTick(tick=>tick+1)}}>重试技能资料</button>}</div>
    {error&&<div className="stt-host-error" role="alert">{error}<button onClick={()=>setError('')}>关闭提示</button></div>}
    {wcl&&<div className="stt-wcl"><section role="dialog" aria-modal="true" aria-label="从 WCL 导入团员"><button onClick={closeWcl}>关闭</button>{wclAvailability!=='ready'&&<p role="status">{wclAvailability==='unconfigured'?'当前服务尚未配置 WCL 导入，你仍可手动编辑名单。':wclAvailability==='unavailable'?'WCL 服务暂不可用，请稍后重新打开；当前方案已保留。':'正在检查 WCL 服务…'}</p>}<label>WCL 报告链接<input value={url} onChange={e=>changeReportUrl(e.target.value)}/></label><button disabled={busy||reportLoading||wclAvailability!=='ready'} onClick={loadReport}>读取报告</button>{reportNotice&&<p role="status">{reportNotice}</p>}{report&&<><label>战斗<select value={report.fight} onChange={e=>changeFight(Number(e.target.value))}>{report.fights.map(f=><option value={f.id} key={f.id}>#{f.id} {f.name}</option>)}</select></label><button disabled={busy||reportLoading||!report.fights.some(f=>f.id===report.fight)} onClick={importRoster}>导入这场名单</button></>}</section></div>}
  </section>
}
