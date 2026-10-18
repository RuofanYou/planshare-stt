import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {lua,lauxlib,lualib,to_luastring,to_jsstring} from 'fengari'

// Execute the actual Lua bridge key branch with controlled frame doubles.
// Browser acceptance is recorded separately; these are routing regressions.
const source=readFileSync(process.env.STT_BRIDGE_SOURCE||new URL('../src/lib/stt-editor/bridge.lua',import.meta.url),'utf8')
const branch=source.split("elseif action=='key'then")[1]?.split("elseif action=='spellIDs'then")[0]
assert.ok(branch)
function check(setup,verification){
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L)
 const code=`
 local calls={}
 local strata={MEDIUM=2,HIGH=3}
 local function frame(id,kind,level,visible,consume)
   local f={__sttWebUI={id=id,kind=kind,keyboard=true,frameStrata='MEDIUM',frameLevel=level,propagateKeyboard=true}}
   function f:IsVisible() return visible end
   function f:_Fire(event,key)
     calls[#calls+1]=self.__sttWebUI.id..':'..event..':'..tostring(key)
     self.__sttWebUI.propagateKeyboard=not consume
     if consume then __STT_WEB_KEY_CONSUMED=true end
   end
   return f
 end
 ${setup}
 local function route(args) ${branch} end
 ${verification}
 `
 try{const result=lauxlib.luaL_dostring(L,to_luastring(code));assert.equal(result,lua.LUA_OK,result===lua.LUA_OK?'':to_jsstring(lua.lua_tostring(L,-1)))}finally{lua.lua_close(L)}
}
test('unfocused high-level edit box cannot swallow timeline Delete',()=>check(`
 local editor=frame('editor','EditBox',100,true,true)
 local timeline=frame('timeline','Frame',10,true,true)
 __STT_WEB_FRAMES={editor,timeline}; __STT_WEB_FOCUS=nil
 `,`local result=route({down=true,key='DELETE'}); assert(result.consumed); assert(#calls==1 and calls[1]=='timeline:OnKeyDown:DELETE')`))
test('focused text edit box retains ordinary Delete priority',()=>check(`
 local editor=frame('editor','EditBox',100,true,false)
 local timeline=frame('timeline','Frame',10,true,true)
 __STT_WEB_FRAMES={editor,timeline}; __STT_WEB_FOCUS=editor
 `,`local result=route({down=true,key='DELETE'}); assert(not result.consumed); assert(#calls==1 and calls[1]=='editor:OnKeyDown:DELETE')`))
test('focused edit box consumed undo remains consumed',()=>check(`
 local editor=frame('editor','EditBox',100,true,true)
 __STT_WEB_FRAMES={editor}; __STT_WEB_FOCUS=editor
 `,`local result=route({down=true,key='Z'}); assert(result.consumed); assert(#calls==1)`))
test('unfocused edit boxes also do not receive root key-up',()=>check(`
 __STT_WEB_FRAMES={frame('editor','EditBox',100,true,true),frame('timeline','Frame',10,true,false)}; __STT_WEB_FOCUS=nil
 `,`local result=route({down=false,key='DELETE'}); assert(not result.consumed); assert(#calls==1 and calls[1]=='timeline:OnKeyUp:DELETE')`))
test('visible root priority and stop-on-consume are preserved',()=>check(`
 __STT_WEB_FRAMES={frame('low','Frame',1,true,true),frame('hidden','Frame',90,false,true),frame('top','Frame',20,true,true)}; __STT_WEB_FOCUS=nil
 `,`local result=route({down=true,key='DELETE'}); assert(result.consumed); assert(#calls==1 and calls[1]=='top:OnKeyDown:DELETE')`))
