// Experimental Wasmoon 1.16.0 adapter. Requires the official UMD dist/index.js
// loaded as a same-origin script/module (globalThis.wasmoon), and its glue.wasm.
// No production host, plugin source, or rendering behavior is replaced here.
export class WasmoonEditorRuntime {
 static async create({assets,prelude,bridge,atlases,hash,displayText,encodeLuaString,decodeLuaString,wasmUri,measureText,api=globalThis.wasmoon}) {
  if(!api?.LuaFactory)throw new Error('Wasmoon 1.16.0 script is not loaded');
  if(typeof encodeLuaString!=='function'||typeof decodeLuaString!=='function')throw new Error('Original STT Lua UTF-8 helpers are required for byte-compatible strings');
  if(!wasmUri)throw new Error('An explicit same-origin Wasmoon WASM URL is required');
  const engine=await new api.LuaFactory(wasmUri).createEngine({openStandardLibs:false,enableProxy:false,injectObjects:false});
  const runtime=new WasmoonEditorRuntime(engine,api,hash,encodeLuaString,decodeLuaString);
  try {
   for(const name of ['_G','math','string','table','debug'])runtime.global.loadLibrary(name);
   runtime.global.set('__STT_WEB_NOW_MS',()=>performance.now());
   runtime.global.set('__STT_WEB_LOG',text=>console.debug('[STT Lua]',text));
   const measure=measureText||createCanvasMeasure(displayText);
   runtime.installMeasure(measure);
   runtime.set('__STT_WEB_ATLAS',atlases);
   runtime.run(prelude,'editor-host');
   for(const asset of assets){
    runtime.run(`local f=function(...)\n${asset.source}\nend;f('${asset.path.split('/')[0]}',__STT_WEB_NS)`,asset.path);
    if(asset.path==='STT/core/init.lua')runtime.run('__STT_EDITOR_HOST()','host-bind');
   }
   runtime.run('__STT_EDITOR_AFTER_LOAD()','host-after-load');runtime.run(bridge,'editor-bridge');
   return runtime;
  } catch(error){runtime.dispose();throw error;}
 }
 constructor(engine,api,hash,encodeLuaString,decodeLuaString){
  this.engine=engine;this.api=api;this.global=engine.global;this.lua=this.global.lua;this.state=this.global.address;
  this.hash=hash;this.closed=false;this.encodeLuaString=encodeLuaString;this.decodeLuaString=decodeLuaString;this.lenPtr=this.lua.module._malloc(4);
 }
 assertOpen(){if(this.closed)throw new Error('Editor runtime has been disposed');}
 dispose(){if(!this.closed){this.closed=true;this.lua.module._free(this.lenPtr);this.global.close();}}
 set(name,value){this.assertOpen();this.push(value);this.lua.lua_setglobal(this.state,name);}
 run(source,name='STT'){this.assertOpen();const top=this.global.getTop();try{this.global.loadString(source,name);this.global.assertOk(this.lua.lua_pcallk(this.state,0,0,0,0,null));}finally{this.global.setTop(top);}}
 readString(index,state=this.state,stringCache){
  const mod=this.lua.module;
  const ptr=mod.ccall('lua_tolstring','number',['number','number','number'],[state,index,this.lenPtr]);
  const length=mod.getValue(this.lenPtr,'i32');
  const cached=stringCache?.get(ptr);
  if(cached&&cached.length===length)return cached.value;
  const value=this.decodeLuaString(mod.HEAPU8.subarray(ptr,ptr+length));
  if(stringCache)stringCache.set(ptr,{length,value});
  return value;
 }
 installMeasure(measure){
  // Official raw callback API avoids default Wasmoon string truncation at NUL
  // and preserves the original pushnumber (float) return semantics.
  this.global.set('__STT_WEB_MEASURE_TEXT',this.api.decorateFunction((thread,quantity)=>{
   const l=thread.lua,L=thread.address,args=[];
   for(let i=1;i<=quantity;i++){const type=l.lua_type(L,i);args.push(type===4?this.readString(i,L):type===3?l.lua_tonumberx(L,i,null):type===1?!!l.lua_toboolean(L,i):null);}
   const values=measure(...args);for(const value of values)l.lua_pushnumber(L,value);
   return new this.api.LuaRawResult(values.length);
  },{receiveThread:true,receiveArgsQuantity:true}));
 }
 push(value){const l=this.lua,L=this.state;
  if(value==null)l.lua_pushnil(L);
  else if(typeof value==='boolean')l.lua_pushboolean(L,value?1:0);
  else if(typeof value==='number')l.lua_pushnumber(L,value);
  else if(typeof value==='string'){
   const bytes=this.encodeLuaString(value),ptr=l.module._malloc(bytes.length+1);
   try{l.module.HEAPU8.set(bytes,ptr);l.lua_pushlstring(L,ptr,bytes.length);}finally{l.module._free(ptr);}
  }else{
   l.lua_createtable(L,Array.isArray(value)?value.length:0,0);
   for(const[key,item]of Object.entries(value)){this.push(Array.isArray(value)?Number(key)+1:key);this.push(item);l.lua_settable(L,-3);}
  }
 }
 // One synchronous return traversal only: no Lua business code runs here.
 // Lua strings are immutable; reuse only decoded JS strings, never heap views.
 // The local map cannot survive this read or leak into callbacks/later calls.
 read(index,depth=0,stringCache=new Map()){const l=this.lua,L=this.state;
  if(!l.lua_checkstack(L,4))throw new Error('Lua return stack exhausted');
  const type=l.lua_type(L,index);
  if(type===4)return this.readString(index,L,stringCache);
  if(type===3)return l.lua_tonumberx(L,index,null);
  if(type===1)return !!l.lua_toboolean(L,index);
  if(type!==5||depth>64)return null;
  const absolute=l.lua_absindex(L,index),entries=[];l.lua_pushnil(L);
  while(l.lua_next(L,absolute)){entries.push([this.read(-2,depth+1,stringCache),this.read(-1,depth+1,stringCache)]);l.lua_pop(L,1);}
  if(entries.every(([key])=>typeof key==='number'&&key>=1&&key<=entries.length))return entries.sort((a,b)=>a[0]-b[0]).map(([,value])=>value);
  return Object.fromEntries(entries);
 }
 call(action,args={}){
  this.assertOpen();const l=this.lua,L=this.state,top=this.global.getTop(),started=performance.now();
  try{
   l.lua_getglobal(L,'__STT_EDITOR_CALL');this.push(action);this.push({now:performance.now()/1000,epoch:Math.floor(Date.now()/1000),...args,traceID:crypto.randomUUID()});
   const pushed=performance.now();this.global.assertOk(l.lua_pcallk(L,2,1,0,0,null));const executed=performance.now();
   const result=this.read(-1),finished=performance.now();
   this.lastPhases={action,push:pushed-started,lua:executed-pushed,read:finished-executed,total:finished-started};return result;
  }finally{this.global.setTop(top);}
 }
}
function createCanvasMeasure(displayText){
 if(typeof displayText!=='function')throw new Error('The original displayText function is required');
 const canvas=document.createElement('canvas').getContext('2d');if(!canvas)throw new Error('Canvas text measurement unavailable');
 return(text,font,size,flags,width,wrap)=>{
  size=size||12;canvas.font=`${size}px "STT Dragonflight"`;const plain=displayText(text).text;let measured=0,lines=0;
  for(const line of plain.split('\n')){
   if(!wrap||width<=0){measured=Math.max(measured,canvas.measureText(line).width);lines++;continue;}
   const chars=Array.from(line);if(!chars.length){lines++;continue;}let start=0;
   while(start<chars.length){let low=start+1,high=chars.length,fit=start;
    while(low<=high){const middle=(low+high)>>1;if(canvas.measureText(chars.slice(start,middle).join('')).width<=width){fit=middle;low=middle+1;}else high=middle-1;}
    if(fit===start)fit=start+1;measured=Math.max(measured,canvas.measureText(chars.slice(start,fit).join('')).width);lines++;start=fit;
   }
  }
  return[measured,Math.max(1,lines)*size];
 };
}
