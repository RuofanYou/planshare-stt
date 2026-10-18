import {test} from 'node:test'
import assert from 'node:assert/strict'
import {displayText,replaceDisplayText,byteOffset,textOffset} from '../src/lib/stt-editor/display-text.ts'

test('native display decorations preserve Chinese, emoji and literal pipes',()=>{
  const raw='|cffff0000中😀||cff00ff00字|r |Hsttspell:740|h740|h'
  assert.equal(displayText(raw).text,'中😀|cff00ff00字 740')
  const shown=displayText(raw)
  for(const offset of [0,1,3,4,shown.text.length])assert.equal(shown.toVisible(shown.toNative(offset)),offset)
  assert.equal(byteOffset('中😀a',3),7)
  assert.equal(textOffset('中😀a',7),3)
})
test('browser replacements never insert stale prefixes or strip literal markup',()=>{
  for(const raw of ['', '[人员]\n\n[笔记]\n\n[时间轴]', '|cffff0000准备|r','|Hsttspell:740|h740|h','||cffff0000中||r']){
    for(const next of ['', '集合', '😀中文', '|cffff0000原文|r', '[方案]\n名称=网页验收\n{time:00:10} {spell:740}准备\n', displayText(raw).text+'继续']){
      assert.equal(displayText(replaceDisplayText(raw,next)).text,next,JSON.stringify({raw,next}))
    }
  }
})
