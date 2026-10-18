type Point=[number,number]
export function isAffineQuad(points:number[][]){
 return [0,1].every(axis=>Math.abs(points[0][axis]+points[3][axis]-points[1][axis]-points[2][axis])<1e-9)
}
export function rasterBox(x:number,y:number,width:number,height:number,pixelScale:number){
 const left=Math.floor(x*pixelScale)/pixelScale,top=Math.floor(y*pixelScale)/pixelScale
 const right=Math.ceil((x+width)*pixelScale)/pixelScale,bottom=Math.ceil((y+height)*pixelScale)/pixelScale
 return {left,top,width:Math.max(1/pixelScale,right-left),height:Math.max(1/pixelScale,bottom-top),viewLeft:left-x,viewTop:top-y}
}
// Map the original normalized image UV triangle to its screen-space triangle.
export function uvMatrix(uv:Point[],xy:Point[]){
 const [p,q,r]=uv,[a,b,c]=xy
 const u=q[0]-p[0],v=q[1]-p[1],s=r[0]-p[0],t=r[1]-p[1],det=u*t-v*s
 if(Math.abs(det)<1e-12)return [0,0,0,0,0,0]
 const ax=((b[0]-a[0])*t-(c[0]-a[0])*v)/det,cx=((c[0]-a[0])*u-(b[0]-a[0])*s)/det
 const ay=((b[1]-a[1])*t-(c[1]-a[1])*v)/det,cy=((c[1]-a[1])*u-(b[1]-a[1])*s)/det
 return [ax,ay,cx,cy,a[0]-ax*p[0]-cx*p[1],a[1]-ay*p[0]-cy*p[1]]
}
export function textureTriangles(width:number,height:number,coords:number[]){
 const uv:Point[]=[[coords[0],coords[1]],[coords[2],coords[3]],[coords[4],coords[5]],[coords[6],coords[7]]]
 const xy:Point[]=[[0,0],[0,height],[width,0],[width,height]]
 const affine=Math.abs(uv[3][0]-uv[1][0]-uv[2][0]+uv[0][0])<1e-9&&Math.abs(uv[3][1]-uv[1][1]-uv[2][1]+uv[0][1])<1e-9
 return (affine?[[0,1,2]]:[[0,1,2],[2,1,3]]).map(indices=>({matrix:uvMatrix(indices.map(i=>uv[i]),indices.map(i=>xy[i])),clip:affine?undefined:indices.map(i=>xy[i])}))
}
