import { ProxyAgent } from 'undici'

const fail=(message,statusCode=502)=>Object.assign(new Error(message),{statusCode})
const iconURL=name=>`https://wow.zamimg.com/images/wow/icons/medium/${name.toLowerCase()}.jpg`

function createFetch(env,fetchImpl){
  if(fetchImpl!==fetch)return fetchImpl
  const proxy=env.HTTPS_PROXY||env.https_proxy||env.ALL_PROXY||env.all_proxy
  if(!proxy)return fetchImpl
  const dispatcher=new ProxyAgent(proxy)
  return (url,init)=>fetchImpl(url,{...init,dispatcher})
}

export function registerEditorSpellRoutes(app,{env=process.env,fetchImpl=fetch}={}){
  const upstream=createFetch(env,fetchImpl)
  app.get('/api/editor/spells',async(req,reply)=>{
    const traceID=req.id
    const log=(stage,fields={})=>console.info('[STT editor spells]',{traceID,stage,...fields})
    log('start')
    try{
      const raw=req.query.ids
      if(typeof raw!=='string'||raw.length>400)throw fail('技能编号列表不合法',400)
      const parts=raw.split(',')
      if(!parts.length||parts.length>40||parts.some(id=>!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0||Number(id)>=100000000))throw fail('技能编号列表不合法',400)
      const ids=[...new Set(parts.map(Number))]
      const spells=[]
      for(let start=0;start<ids.length;start+=6){
        const batch=await Promise.all(ids.slice(start,start+6).map(async id=>{
          try{
            const response=await upstream(`https://nether.wowhead.com/tooltip/spell/${id}?dataEnv=1&locale=4`,{signal:AbortSignal.timeout(8000)})
            if(!response.ok)return null
            const data=await response.json()
            if(typeof data.name!=='string'||typeof data.icon!=='string'||! /^[a-z0-9_]+$/i.test(data.icon))return null
            const header=String(data.tooltip||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&#8203;|&#x200b;|\u200b/gi,'')
            const cast=header.match(/([\d.]+)\s*秒\s*施法时间/)
            const castTime=cast?Math.round(Number(cast[1])*1000):/瞬发/.test(header)?0:undefined
            return {id,name:data.name,icon:iconURL(data.icon),castTime}
          }catch{return null}
        }))
        spells.push(...batch.filter(Boolean))
      }
      if(!spells.length)throw fail('技能数据暂不可用，请稍后重试')
      log('end',{result:'ok',requested:ids.length,count:spells.length})
      return {spells}
    }catch(error){
      const message=error.name==='TimeoutError'?'技能数据查询超时，请重试':error.statusCode?error.message:'技能数据暂不可用，请稍后重试'
      log('end',{result:'failed',reason:message})
      return reply.code(error.statusCode??502).send({error:message})
    }
  })
}
