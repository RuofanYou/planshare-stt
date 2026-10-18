import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import ts from 'typescript'

// Static AST inspection only. Never import the generated runtime or execute Lua.
const bundle=readFileSync('src/generated/sttEditorBundle.ts','utf8')
const prefix='export const editorAssets = '
const assets=JSON.parse(bundle.split('\n').find(line=>line.startsWith(prefix)).slice(prefix.length))
const manifest=JSON.parse(readFileSync('src/lib/stt-editor/source-manifest.json','utf8'))
const literals=new Set()
for(const file of readdirSync('dist-wcl-report-fix/assets').filter(file=>file.endsWith('.js'))){
  const ast=ts.createSourceFile(file,readFileSync('dist-wcl-report-fix/assets/'+file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
  const visit=node=>{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))literals.add(node.text);ts.forEachChild(node,visit)}
  visit(ast)
}
const sha=text=>createHash('sha256').update(text).digest('hex')
if(assets.length!==114||Object.keys(manifest.files).length!==114)throw Error('Unexpected source count')
for(const asset of assets){
  if(sha(asset.source)!==asset.hash||asset.hash!==manifest.files[asset.path].sha256||!literals.has(asset.source))throw Error('Source mismatch: '+asset.path)
}
const host=readFileSync('src/lib/stt-editor/prelude.lua','utf8'),bridge=readFileSync('src/lib/stt-editor/bridge.lua','utf8')
if(!literals.has(host)||!literals.has(bridge))throw Error('Host/bridge source changed in compiled output')
const result={luaFiles:assets.length,luaRevision:manifest.revision,allLuaSourceHashesMatch:true,compiledLuaStringsMatch:true,compiledHostMatches:true,compiledBridgeMatches:true,hostSha256:sha(host),bridgeSha256:sha(bridge),luaExecuted:false}
writeFileSync('verification/frozen-lua-build.json',JSON.stringify(result,null,2)+'\n')
console.log(result)
