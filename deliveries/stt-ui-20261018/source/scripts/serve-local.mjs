import http from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const port=Number(process.env.PORT||4173)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}
http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
    if(pathname==='/'){res.writeHead(302,{Location:'/source-editor/'});return res.end()}
    let base,relative
    if(pathname.startsWith('/source-editor/')){base=path.join(root,'dist');relative=pathname.slice('/source-editor/'.length)||'index.html'}
    else if(pathname.startsWith('/stt-editor/')){base=path.join(root,'public-editor');relative=pathname.slice(1)}
    else{res.writeHead(404);return res.end('Not found')}
    const file=path.resolve(base,relative)
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end()}
    if(!(await stat(file)).isFile()){res.writeHead(404);return res.end()}
    const bytes=await readFile(file)
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'})
    res.end(req.method==='HEAD'?undefined:bytes)
  }catch{res.writeHead(404);res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Local editor: http://127.0.0.1:${port}/source-editor/`))
