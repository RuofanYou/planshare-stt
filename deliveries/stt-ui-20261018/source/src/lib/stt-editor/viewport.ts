// aa79370: ui_skin.lua (GUI 1100), gui.lua (side margin 32),
// timeline_event_editor.lua (window 560), skill_drawer.lua (348 + 4 + 32 - 8).
// The popup is centered on UIParent, so reserve its attachment on both sides.
export const EDITOR_MIN_LOGICAL_WIDTH=Math.max(1100+32*2,560+2*(348+4+32-8+32))
export const EDITOR_MIN_DISPLAY_SCALE=.85
export function editorViewport(width:number,height:number){
  const scale=Math.max(EDITOR_MIN_DISPLAY_SCALE,Math.min(1,width/EDITOR_MIN_LOGICAL_WIDTH))
  return {width:Math.max(width/scale,EDITOR_MIN_LOGICAL_WIDTH),height:Math.max(1,height/scale),scale}
}
export function editorPoint(x:number,y:number,host:HTMLElement|null,scale:number){
  const bounds=host?.getBoundingClientRect()
  return {x:(x-(bounds?.left||0)+(host?.scrollLeft||0))/scale,y:(y-(bounds?.top||0)+(host?.scrollTop||0))/scale}
}
