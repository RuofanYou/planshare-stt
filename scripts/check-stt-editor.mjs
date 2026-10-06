import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readEditorAssets } from './sync-stt-editor-assets.mjs'
const require = createRequire(import.meta.url)
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari')
const L = lauxlib.luaL_newstate()
lualib.luaL_openlibs(L)
function run(source, name) {
  if (lauxlib.luaL_loadbuffer(L, to_luastring(source), null, to_luastring(name)) !== lua.LUA_OK
      || lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
    throw new Error(to_jsstring(lua.lua_tostring(L, -1)))
  }
}
run(readFileSync(new URL('../src/lib/stt-editor/prelude.lua', import.meta.url), 'utf8'), 'web-host')
for (const asset of readEditorAssets()) {
  run(`local f = function(...)\n${asset.source}\nend\nf('${asset.path.split('/')[0]}', __STT_WEB_NS)`, asset.path)
  if (asset.path === 'STT/core/init.lua') run('__STT_EDITOR_HOST()', 'host-bind')
}
run('__STT_EDITOR_AFTER_LOAD()', 'host-after-load')
run('__STT_WEB_BOSS_COMPILE=__STT_WEB_NS[1].BossReference.Compile;__STT_WEB_BOSS_BUILD=__STT_WEB_NS[1].BossReference.BuildEntry', 'capture-original-editor-functions')
run(readFileSync(new URL('../src/lib/stt-editor/bridge.lua', import.meta.url), 'utf8'), 'web-bridge')
// Headless logic checks provide a deterministic font measurement seam. Browser tests use Canvas and the real font.
run('__STT_WEB_MEASURE_TEXT=function()return 80,12 end', 'test-font-metrics')
run(`
local call=__STT_EDITOR_CALL
assert(__STT_WEB_NS[1].BossReference.Compile==__STT_WEB_BOSS_COMPILE and __STT_WEB_NS[1].BossReference.BuildEntry==__STT_WEB_BOSS_BUILD,'boss_reference_overridden')
local view=call('open',{width=1512,height=948,now=1,epoch=1790156628})
assert(view.ui and #view.ui.nodes>100,'original_editor_not_rendered')
local selector
for _,node in ipairs(view.ui.nodes)do if node.kind=='Button'and node.label=='视角水平'then selector=node.id end end
assert(selector,'view_selector_missing')
view=call('uiEvent',{id=selector,event='OnClick'})
local vertical
for _,node in ipairs(view.ui.nodes)do if node.kind=='Button'and node.label=='垂直'then vertical=node.id end end
assert(vertical,'original_menu_missing')
view=call('uiEvent',{id=vertical,event='OnClick'})
assert(view.mode=='vertical'and call('snapshot').mode=='vertical','view_mode_overridden')
local f=CreateFrame('Frame',nil,UIParent);f:SetSize(100,30);f:SetPoint('TOPLEFT',UIParent,'TOPLEFT',20,-25)
local text=f:CreateFontString();text:SetFont(STANDARD_TEXT_FONT,17,'');text:SetText('颜色');text:SetTextColor(.1,.2,.3,.4);text:SetPoint('LEFT')
local texture=f:CreateTexture();texture:SetAllPoints();texture:SetColorTexture(.3,.4,.5,.6);texture:SetTexCoord(.1,.9,.2,.8)
local foundFont,foundTexture
for _,node in ipairs(call('snapshot').ui.nodes)do
 if node.id==text.__sttWebUI.id then assert(node.font[2]==17 and node.textColor[4]==.4);foundFont=true end
 if node.id==texture.__sttWebUI.id then assert(node.color[4]==.6 and node.texCoord[1]==.1);foundTexture=true end
end
assert(foundFont and foundTexture,'display_properties_missing')
print('PASS original entry, native selector, persistent vertical mode and display properties')
`, 'native-editor-regression')
