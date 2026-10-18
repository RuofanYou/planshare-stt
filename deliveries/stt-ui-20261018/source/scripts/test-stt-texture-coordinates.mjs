import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isAffineQuad,rasterBox,textureTriangles} from '../src/lib/stt-editor/texture-coordinates.ts'
test('native separable press displacement is one affine quad without an internal clip seam',()=>{
 const points=[[0,0],[0,26],[126,0],[126,26]].map(([x,y])=>[x+(x-63)*.075+1.15*(1-2*(y/26-.5)**2),y+(y-13)*-.14+.65*(1-2*(x/126-.5)**2)])
 assert.equal(isAffineQuad(points),true)
 points[3][0]+=1;assert.equal(isAffineQuad(points),false)
})
test('raster surface alignment leaves all native vertex positions unchanged',()=>{
 for(const scale of [1,.85,1180/1376,2,1.7])for(const [x,y,w,h] of [[12.75,25.2,100.5,.5],[1.2,9.7,12.75,12.75]]){
  const box=rasterBox(x,y,w,h,scale)
  assert.ok(Math.abs(box.left*scale-Math.round(box.left*scale))<1e-9)
  assert.ok(Math.abs(box.top*scale-Math.round(box.top*scale))<1e-9)
  assert.ok(Math.abs(box.left-box.viewLeft-x)<1e-9)
  assert.ok(Math.abs(box.top-box.viewTop-y)<1e-9)
  assert.ok(box.width>=w&&box.height>=h)
 }
})
test('eight UV coordinates preserve original atlas quarter-turns and flips',()=>{
 const l=.1083984375,r=.1611328125,t=.626953125,b=.732421875
 for(const uv of [[l,t,l,b,r,t,r,b],[l,b,r,b,l,t,r,t],[r,t,l,t,r,b,l,b],[r,t,r,b,l,t,l,b]]){
  const [a,z,c,d,e,f]=textureTriangles(32,36,uv)[0].matrix
  for(const [index,x,y] of [[0,0,0],[1,0,36],[2,32,0],[3,32,36]]){
   assert.ok(Math.abs(a*uv[index*2]+c*uv[index*2+1]+e-x)<1e-9)
   assert.ok(Math.abs(z*uv[index*2]+d*uv[index*2+1]+f-y)<1e-9)
  }
 }
 assert.equal(textureTriangles(32,36,[0,0,0,1,1,0,.8,1]).length,2)
})
