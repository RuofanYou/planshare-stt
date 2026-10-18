// WoW display-string transport only. STT's source decoration and editing rules
// remain in the pinned Lua. Offsets crossing the bridge are UTF-8 bytes.
const utf8 = new TextEncoder()
export const byteOffset = (text: string, offset: number) => utf8.encode(text.slice(0, offset)).length
export function textOffset(text: string, bytes: number) {
  let at = 0, consumed = 0
  for (const char of text) { const size = utf8.encode(char).length; if (consumed + size > bytes) break; consumed += size; at += char.length }
  return at
}
export interface DisplayRun { text: string; color?: string }
export function displayText(raw = '') {
  let visible = '', color: string | undefined
  const offsets: number[] = [0], runs: DisplayRun[] = []
  for (let at = 0; at < raw.length;) {
    const start = at, tail = raw.slice(at)
    const code = /^\|c([\da-f]{8})/i.exec(tail)
    if (code) { color = '#' + code[1].slice(2) + code[1].slice(0, 2); at += 10; offsets[visible.length] = at; continue }
    if (tail.startsWith('|r')) { color = undefined; at += 2; offsets[visible.length] = at; continue }
    const link = /^\|H[^|]*\|h/.exec(tail)
    if (link) { at += link[0].length; offsets[visible.length] = at; continue }
    if (tail.startsWith('|h')) { at += 2; offsets[visible.length] = at; continue }
    const char = tail.startsWith('||') ? '|' : String.fromCodePoint(raw.codePointAt(at)!)
    at += tail.startsWith('||') ? 2 : char.length
    const last = runs[runs.length - 1]
    if (last && last.color === color) last.text += char; else runs.push({ text: char, color })
    offsets[visible.length] = start
    for (let i = 1; i <= char.length; i++) offsets[visible.length + i] = i === char.length ? at : start + i
    visible += char
  }
  offsets[visible.length] = raw.length
  return {
    text: visible, runs,
    toNative: (offset: number) => byteOffset(raw, offsets[Math.max(0, Math.min(visible.length, offset))] ?? raw.length),
    toVisible: (bytes: number) => {
      const position = textOffset(raw, bytes)
      let result = 0
      for (let i = 0; i < offsets.length; i++) { if (offsets[i] <= position) result = i; else break }
      return result
    },
    offsets,
  }
}
export function replaceDisplayText(raw: string, next: string) {
  const previous = displayText(raw)
  let start = 0, end = previous.text.length, nextEnd = next.length
  while (start < end && start < nextEnd && previous.text[start] === next[start]) start++
  while (end > start && nextEnd > start && previous.text[end - 1] === next[nextEnd - 1]) { end--; nextEnd-- }
  return raw.slice(0, previous.offsets[start]) + next.slice(start, nextEnd).replace(/\|/g, '||') + raw.slice(previous.offsets[end])
}

// Measure the browser's visible caret; Lua still decides how its ScrollFrame
// should move. A hidden mirror shares the textarea's real font and wrapping.
export function measureInputCaret(input: HTMLTextAreaElement) {
  const computed=getComputedStyle(input),mirror=document.createElement('div'),marker=document.createElement('span')
  const properties=['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','lineHeight','letterSpacing','wordSpacing','textIndent','textTransform','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing','whiteSpace','overflowWrap','wordBreak'] as const
  for(const property of properties)mirror.style[property]=computed[property]
  Object.assign(mirror.style,{position:'fixed',left:'-10000px',top:'0',width:computed.width,height:'auto',visibility:'hidden',pointerEvents:'none'})
  mirror.setAttribute('aria-hidden','true')
  const active=input.selectionDirection==='backward'?input.selectionStart:input.selectionEnd
  mirror.textContent=input.value.slice(0,active)
  marker.textContent='\u200b';mirror.append(marker);document.body.append(mirror)
  const caret=marker.getBoundingClientRect(),origin=mirror.getBoundingClientRect()
  const result={cursorX:caret.left-origin.left,cursorY:-(caret.top-origin.top),cursorWidth:1,cursorHeight:parseFloat(computed.lineHeight)||parseFloat(computed.fontSize)||12}
  mirror.remove()
  return result
}
