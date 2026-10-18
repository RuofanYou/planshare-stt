import type {CSSProperties} from 'react'
import type {UiNode} from './runtime'
import {isAffineQuad,rasterBox,textureTriangles} from './texture-coordinates'

type Asset = (path?:string|number,coords?:number[])=>string|undefined
const rgba = (c:number[])=>`rgba(${c.slice(0,3).map(v=>Math.round(v*255)).join(',')},${c[3]??1})`
function crop(width:number,height:number,coords?:number[]) {
  const [l,r,t,b]=coords?.length===4?coords:[0,1,0,1]
  const dw=r-l||1,dh=b-t||1
  return {x:0,y:0,width:Math.abs(width/dw),height:Math.abs(height/dh),transform:`translate(${-l*width/dw} ${-t*height/dh}) scale(${Math.sign(dw)} ${Math.sign(dh)})`}
}
// WoW texture quads are two affine triangles, not a CSS rounded rectangle or
// perspective approximation. The same source alpha masks and vertex offsets
// drive the native nine-slice spring material and this SVG transport.
export default function TextureRegion({node,style,asset,displayScale=1}:{node:UiNode;style:CSSProperties;asset:Asset;displayScale?:number}) {
  const w=Math.max(.001,node.width),h=Math.max(.001,node.height),id=`stt-tx-${node.id}`
  const url=asset(node.texture,node.texCoord),tint=node.vertexColor||[1,1,1,1]
  const whiteMask=typeof node.texture==='string'&&/\/glass\//i.test(node.texture.replace(/\\/g,'/'))
  const localClassIcon=typeof node.texture==='string'&&/ui-charactercreate-classes$/i.test(node.texture)&&!!url
  const imageCrop=crop(w,h,localClassIcon?undefined:node.texCoord)
  const uvTriangles=node.texCoord?.length===8?textureTriangles(w,h,node.texCoord):undefined
  const sourceImage=(filter?:string)=>uvTriangles?uvTriangles.map((triangle,index)=><g key={index} clipPath={triangle.clip?`url(#${id}-uv${index})`:undefined}><image href={url} width="1" height="1" preserveAspectRatio="none" transform={`matrix(${triangle.matrix.join(',')})`} filter={filter}/></g>):<image href={url} {...imageCrop} preserveAspectRatio="none" filter={filter}/>
  const gradient=node.gradient
  const multiply=(c:number[])=>c.map((v,i)=>v*(tint[i]??1))
  const points=[[0,0],[0,h],[w,0],[w,h]].map(([x,y],i)=>[x+(node.vertexOffsets?.[i]?.[0]||0),y-(node.vertexOffsets?.[i]?.[1]||0)])
  const deformed=points.some(([x,y],i)=>x!==[0,0,w,w][i]||y!==[0,h,0,h][i])
  const affine=isAffineQuad(points)
  const matrix=(triangle:number)=>{
    const [a,b,c,d]=points
    return triangle===0?`matrix(${(c[0]-a[0])/w},${(c[1]-a[1])/w},${(b[0]-a[0])/h},${(b[1]-a[1])/h},${a[0]},${a[1]})`:
      `matrix(${(d[0]-b[0])/w},${(d[1]-b[1])/w},${(d[0]-c[0])/h},${(d[1]-c[1])/h},${b[0]+c[0]-d[0]},${b[1]+c[1]-d[1]})`
  }
  const rotation=node.rotation?`rotate(${-node.rotation*180/Math.PI},${w/2},${h/2})`:undefined
  const fill=gradient?`url(#${id}-gradient)`:rgba(multiply(node.color||[1,1,1,1]))
  // Align the SVG raster surface, not the native quad. Fractional independent
  // SVG viewport edges otherwise alpha-composite twice along shared tile seams.
  const box=rasterBox(node.x,node.y,w,h,displayScale*(typeof window==='undefined'?1:window.devicePixelRatio||1))
  const clip=node.clip?`inset(${Math.max(0,node.clip.top-box.top)}px ${Math.max(0,box.left+box.width-node.clip.right)}px ${Math.max(0,box.top+box.height-node.clip.bottom)}px ${Math.max(0,node.clip.left-box.left)}px)`:style.clipPath
  return <svg aria-hidden="true" data-lua-id={node.id} data-atlas={node.atlas} data-texture={node.texture} className="stt-native-texture" width={w} height={h} viewBox={`${box.viewLeft} ${box.viewTop} ${box.width} ${box.height}`} style={{...style,left:box.left,top:box.top,width:box.width,height:box.height,clipPath:clip,display:'block',overflow:'visible',mixBlendMode:node.blendMode==='ADD'?'plus-lighter':undefined}}>
    <defs>
      <clipPath id={`${id}-bounds`}><rect width={w} height={h} shapeRendering="crispEdges"/></clipPath>
      {uvTriangles?.map((triangle,index)=>triangle.clip&&<clipPath key={index} id={`${id}-uv${index}`}><polygon shapeRendering="crispEdges" points={triangle.clip.map(p=>p.join(',')).join(' ')}/></clipPath>)}
      {gradient&&<linearGradient id={`${id}-gradient`} x1="0" y1={gradient.direction==='VERTICAL'?'1':'0'} x2={gradient.direction==='HORIZONTAL'?'1':'0'} y2="0"><stop offset="0" stopColor={rgba(multiply(gradient.low))}/><stop offset="1" stopColor={rgba(multiply(gradient.high))}/></linearGradient>}
      {url&&whiteMask&&<mask id={`${id}-shape`} maskUnits="userSpaceOnUse" x="-1" y="-1" width={w+2} height={h+2} style={{maskType:'alpha'}}>{sourceImage()}</mask>}
      {url&&!whiteMask&&<filter id={`${id}-tint`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        {(node.desaturated||node.desaturation)&&<feColorMatrix type="saturate" values={String(1-(node.desaturated?1:node.desaturation||0))}/>}
        <feColorMatrix type="matrix" values={`${tint[0]} 0 0 0 0  0 ${tint[1]} 0 0 0  0 0 ${tint[2]} 0 0  0 0 0 ${tint[3]??1} 0`}/>
      </filter>}
      {!!node.masks?.length&&<mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h} style={{maskType:'alpha'}}>{node.masks.map((mask,index)=><svg key={index} x={mask.x-node.x} y={mask.y-node.y} width={mask.width} height={mask.height} viewBox={`0 0 ${mask.width} ${mask.height}`}><image href={asset(mask.texture,mask.texCoord)} {...crop(mask.width,mask.height,mask.texCoord)} preserveAspectRatio="none"/></svg>)}</mask>}
      <g id={`${id}-paint`} clipPath={url&&!whiteMask?`url(#${id}-bounds)`:undefined} mask={node.masks?.length?`url(#${id}-mask)`:undefined}>
        {url?(whiteMask?<rect width={w} height={h} shapeRendering="crispEdges" fill={fill} mask={`url(#${id}-shape)`}/>:sourceImage(`url(#${id}-tint)`)):<rect width={w} height={h} shapeRendering="crispEdges" fill={node.color||gradient?fill:'transparent'}/>}
      </g>
      {deformed&&!affine&&<><clipPath id={`${id}-tri0`}><polygon shapeRendering="crispEdges" points={[points[0],points[1],points[2]].map(p=>p.join(',')).join(' ')}/></clipPath><clipPath id={`${id}-tri1`}><polygon shapeRendering="crispEdges" points={[points[2],points[1],points[3]].map(p=>p.join(',')).join(' ')}/></clipPath></>}
    </defs>
    <g transform={rotation}>{deformed&&!affine?[0,1].map(i=><g key={i} clipPath={`url(#${id}-tri${i})`}><use href={`#${id}-paint`} transform={matrix(i)}/></g>):<use href={`#${id}-paint`} transform={deformed?matrix(0):undefined}/>}</g>
  </svg>
}
