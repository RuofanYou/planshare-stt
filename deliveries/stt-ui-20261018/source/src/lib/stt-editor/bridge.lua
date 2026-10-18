local T,C,L=unpack(__STT_WEB_NS)
local gui,sem=T.SemanticTimelineGUI,T.SemanticTimelineEditor
local root
local function box()return assert(gui.rawEditorFrame and gui.rawEditorFrame.editBox,'editor_not_ready')end
local function document()return T.PlanEditorSession:GetSnapshot()end
local function replace(text,source)
    local ok,reason=gui.ReplaceEditorText(text,box():GetCursorPosition(),source,gui.CaptureEditorDocumentIdentity())
    assert(ok,reason)
end
local layers={BACKGROUND=0,BORDER=1,ARTWORK=2,OVERLAY=3,HIGHLIGHT=4}
local strata={BACKGROUND=0,LOW=1,MEDIUM=2,HIGH=3,DIALOG=4,FULLSCREEN=5,FULLSCREEN_DIALOG=6,TOOLTIP=7}
local lastNodes={}
-- Optional metadata must not rebuild/reorder the drawer beneath a pointer.
local pendingPlanMetadata={}
local metadataSearchDirty,metadataSearchReady=false,false
local function flushSpellMetadata()
    if __STT_WEB_MOUSE_BUTTON then return end
    if next(pendingPlanMetadata) then
        local function affected(text)
            for _,token in ipairs(T.TimelineSyntax.ExtractSpellTokens(text or ''))do
                if pendingPlanMetadata[tonumber(token.spellID)]then return true end
            end
            return false
        end
        local d=document()
        local refresh=affected(box():GetText())or(d and affected(T.BossReference:GetText(d)))
        pendingPlanMetadata={}
        if refresh then sem:WipeCompiledPlanCache();gui.RefreshData('web_metadata')end
    end
    if metadataSearchReady then
        metadataSearchReady=false
        if metadataSearchDirty then
            metadataSearchDirty=false
            local drawer=T.SkillDrawer and T.SkillDrawer.IsOpen and T.SkillDrawer.IsOpen()and _G.STT_SkillDrawer
            if drawer and drawer.searchBox and drawer.searchBox:GetText():match('%S')then T.SkillDrawer.Render()end
        end
    end
end
local function markUI(frame)
    __STT_WEB_DIRTY_FRAMES[frame]=true
    for _,child in ipairs(frame.__sttWebUI.children)do markUI(child)end
end
local function same(a,b,depth)
    if a==b then return true end
    if type(a)~=type(b)or type(a)~='table'or (depth or 0)>3 then return false end
    for k,v in pairs(a)do if not same(v,b[k],(depth or 0)+1)then return false end end
    for k in pairs(b)do if a[k]==nil then return false end end
    return true
end
local function nodeData(f,clip,isVisible,alpha)
    if not isVisible or f.__sttWebUI.kind=='Font'or f.__sttWebUI.kind=='MaskTexture'then return nil,false end
    -- Unanchored FontStrings still provide font measurements, but have no
    -- drawable position. Native menus keep one such region for sizing rows.
    -- EditBox text has an implicit native position supplied by its owner.
    if f.__sttWebUI.kind=='FontString'and #f.__sttWebUI.points==0 and not f.__sttWebUI.nativeEditOwner then return nil,false end
    local x,y,w,h=f:_Rect();local parent=f.__sttWebUI.parent;local parentState=parent and parent.__sttWebUI
    -- Clipped-out Lua regions still participate in native layout and scroll
    -- logic, but do not need a browser node or a cross-VM snapshot.
    if clip and f.__sttWebUI.kind~='EditBox'and f.__sttWebUI.kind~='Slider'and not f.__sttWebUI.focused and f~=__STT_WEB_MOUSE_FRAME then
        local top=UIParent:GetHeight()-y-h
        local left,right,bottom=x,x+w,top+h
        local minX,maxX,minY,maxY=0,0,0,0
        for _,offset in pairs(f.__sttWebUI.vertexOffsets or {})do
            minX=math.min(minX,offset[1]or 0);maxX=math.max(maxX,offset[1]or 0)
            minY=math.min(minY,-(offset[2]or 0));maxY=math.max(maxY,-(offset[2]or 0))
        end
        left,right,top,bottom=left+minX,right+maxX,top+minY,bottom+maxY
        local insets=f.__sttWebUI.hitRectInsets
        if insets then left=math.min(left,x+insets[1]);right=math.max(right,x+w-insets[2]);top=math.min(top,UIParent:GetHeight()-y-h+insets[3]);bottom=math.max(bottom,UIParent:GetHeight()-y-insets[4])end
        if f.__sttWebUI.rotation and f.__sttWebUI.rotation~=0 then
            local cx,cy=x+w/2,UIParent:GetHeight()-y-h/2
            local dx=math.max(math.abs(left-cx),math.abs(right-cx));local dy=math.max(math.abs(top-cy),math.abs(bottom-cy));local radius=math.sqrt(dx*dx+dy*dy)
            left,right,top,bottom=cx-radius,cx+radius,cy-radius,cy+radius
        end
        if right<clip.left-2 or left>clip.right+2 or bottom<clip.top-2 or top>clip.bottom+2 then return nil,false end
    end
    local visible=true
    if f.__sttWebUI.layer=='HIGHLIGHT'then visible=parentState and parentState.hovered==true end
    if f.__sttWebUI.buttonState then
        local state=parentState.enabled==false and 'Disabled'or parentState.pressed and 'Pushed'or 'Normal'
        visible=f.__sttWebUI.buttonState=='Thumb' or f.__sttWebUI.buttonState==state or f.__sttWebUI.buttonState=='Highlight'and parentState.hovered or f.__sttWebUI.buttonState=='Checked'and parentState.checked
    end
    local label=''
    local masks={}
    for mask in pairs(f.__sttWebUI.masks or{})do
        local mx,my,mw,mh=mask:_Rect();local s=mask.__sttWebUI
        masks[#masks+1]={texture=s.texture,texCoord=s.texCoord,x=mx,y=UIParent:GetHeight()-my-mh,width=mw,height=mh}
    end
    if f.__sttWebUI.kind=='Button'or f.__sttWebUI.kind=='CheckButton'or f.__sttWebUI.kind=='EditBox'then
        label=type(f.__sttWebUI._text)=='string'and f.__sttWebUI._text or ''
        if label==''then
            -- Native labels may live in a higher foreground frame to remain
            -- above clipped duration bars. Descend through noninteractive
            -- regions, while keeping nested controls' names independent.
            local function collect(owner)
                for _,c in ipairs(owner.__sttWebUI.children)do
                    local s=c.__sttWebUI
                    if s.shown then
                        if s.kind=='FontString'then label=label..(s._text or '')
                        elseif s.kind~='Button'and s.kind~='CheckButton'and s.kind~='EditBox'then collect(c)end
                    end
                end
            end
            collect(f)
        end
    end
    return {id=f.__sttWebUI.id,kind=f.__sttWebUI.kind,name=f.__sttWebUI.name,label=label,x=x,y=UIParent:GetHeight()-y-h,width=w,height=h,
        text=f.__sttWebUI._text,font=f.__sttWebUI.font,textColor=f.__sttWebUI.textColor,shadowColor=f.__sttWebUI.shadowColor,shadowOffset=f.__sttWebUI.shadowOffset,justifyH=f.__sttWebUI.justifyH,justifyV=f.__sttWebUI.justifyV,wordWrap=f.__sttWebUI.wordWrap,
        texture=f.__sttWebUI.texture,atlas=f.__sttWebUI.atlas,color=f.__sttWebUI.color,texCoord=f.__sttWebUI.texCoord,vertexColor=f.__sttWebUI.vertexColor,rotation=f.__sttWebUI.rotation,blendMode=f.__sttWebUI.blendMode,alpha=alpha,
        gradient=f.__sttWebUI.gradient,vertexOffsets=f.__sttWebUI.vertexOffsets,desaturated=f.__sttWebUI.desaturated,desaturation=f.__sttWebUI.desaturation,masks=masks,
        nativeTextRegion=f.__sttWebUI.nativeEditOwner~=nil or f.__sttWebUI.nativeTextRegion~=nil,spacing=f.__sttWebUI.spacing,
        composing=f.__sttWebUI.composing==true or(f.__sttWebUI.nativeEditOwner and f.__sttWebUI.nativeEditOwner.__sttWebUI.composing==true)or false,
        z=(strata[f.__sttWebUI.frameStrata]or 2)*100000+f.__sttWebUI.frameLevel*100+(layers[f.__sttWebUI.layer]or 0)*10+(f.__sttWebUI.subLayer or 0),
        backdrop=f.__sttWebUI.backdrop,backdropColor=f.__sttWebUI.backdropColor,backdropBorderColor=f.__sttWebUI.backdropBorderColor,clip=clip,
        mouse=f.__sttWebUI.mouse==true,mouseWheel=f.__sttWebUI.mouseWheel==true,dragButtons=f.__sttWebUI.dragButtons,enabled=f.__sttWebUI.enabled~=false,checked=f.__sttWebUI.checked==true,multiLine=f.__sttWebUI.multiLine==true,numeric=f.__sttWebUI.numeric==true,
        value=f.__sttWebUI.value,minValue=f.__sttWebUI.minValue,maxValue=f.__sttWebUI.maxValue,valueStep=f.__sttWebUI.valueStep,orientation=f.__sttWebUI.orientation,
        textInsets=f.__sttWebUI.textInsets,hitRectInsets=f.__sttWebUI.hitRectInsets,focused=f.__sttWebUI.focused==true,cursor=f.__sttWebUI.cursor,highlight=f.__sttWebUI.highlight,maxLetters=f.__sttWebUI.maxLetters,
        isEditorText=gui.rawEditorFrame and gui.rawEditorFrame.editBox==f,lines=f.__sttWebUI.lines},visible
end
local function uiTree()
    __STT_WEB_RELAYOUT()
    local delta,hidden={},{ }
    local visibilityCache,alphaCache,clipCache={},{},{}
    local noClip={}
    local function visibleFor(f)
        local cached=visibilityCache[f]
        if cached~=nil then return cached end
        local state=f.__sttWebUI
        local visible=state.shown and(not state.parent or visibleFor(state.parent))or false
        visibilityCache[f]=not not visible
        return visibilityCache[f]
    end
    local function alphaFor(f)
        local cached=alphaCache[f]
        if cached~=nil then return cached end
        local state=f.__sttWebUI
        local alpha=(state.alpha or 1)*(state.parent and alphaFor(state.parent)or 1)
        alphaCache[f]=alpha
        return alpha
    end
    local function cachedClipFor(f)
        local parent=f.__sttWebUI.parent or UIParent
        local cached=clipCache[parent]
        if cached~=nil then if cached==noClip then return nil end;return cached end
        local path={}
        while parent and parent~=UIParent do path[#path+1]=parent;parent=parent.__sttWebUI.parent end
        local clip
        for i=#path,1,-1 do
            local ancestor=path[i]
            if ancestor.__sttWebUI.clipsChildren or ancestor.__sttWebUI.kind=='ScrollFrame'then
                local x,y,w,h=ancestor:_Rect();local top=UIParent:GetHeight()-y-h
                local nextClip={left=x,top=top,right=x+w,bottom=top+h}
                if clip then nextClip.left=math.max(clip.left,nextClip.left);nextClip.top=math.max(clip.top,nextClip.top);nextClip.right=math.min(clip.right,nextClip.right);nextClip.bottom=math.min(clip.bottom,nextClip.bottom)end
                clip=nextClip
            end
        end
        clipCache[f.__sttWebUI.parent or UIParent]=clip or noClip
        return clip
    end
    local function update(f,clip)
        local node,visible=nodeData(f,clip,visibleFor(f),alphaFor(f));local id=f.__sttWebUI.id
        if not visible or not node then
            if lastNodes[id]then lastNodes[id]=nil;hidden[#hidden+1]=id end
        elseif not same(node,lastNodes[id])then lastNodes[id]=node;delta[#delta+1]=node end
    end
    if __STT_WEB_FULL_REFRESH then
        local visible={}
        local function visit(f,clip)
            if not visibleFor(f)then return end
            local node,drawn=nodeData(f,clip,true,alphaFor(f))
            if node and drawn then visible[node.id]=true;if not same(node,lastNodes[node.id])then lastNodes[node.id]=node;delta[#delta+1]=node end
            elseif node and lastNodes[node.id]then lastNodes[node.id]=nil;hidden[#hidden+1]=node.id end
            local nextClip=clip
            if f.__sttWebUI.clipsChildren or f.__sttWebUI.kind=='ScrollFrame'then
                local x,y,w,h=f:_Rect();local top=UIParent:GetHeight()-y-h
                nextClip={left=x,top=top,right=x+w,bottom=top+h}
                if clip then nextClip.left=math.max(clip.left,nextClip.left);nextClip.top=math.max(clip.top,nextClip.top);nextClip.right=math.min(clip.right,nextClip.right);nextClip.bottom=math.min(clip.bottom,nextClip.bottom)end
            end
            for _,child in ipairs(f.__sttWebUI.children)do visit(child,nextClip)end
        end
        for _,f in ipairs(UIParent.__sttWebUI.children)do visit(f,nil)end
        for id in pairs(lastNodes)do if not visible[id]then lastNodes[id]=nil;hidden[#hidden+1]=id end end
        __STT_WEB_FULL_REFRESH=false
    else
        for f in pairs(__STT_WEB_DIRTY_FRAMES)do update(f,cachedClipFor(f))end
    end
    for f in pairs(__STT_WEB_DIRTY_FRAMES)do __STT_WEB_DIRTY_FRAMES[f]=nil end
    table.sort(delta,function(a,b)if a.z==b.z then return a.id<b.id end;return a.z<b.z end)
    table.sort(hidden)
    return {width=UIParent:GetWidth(),height=UIParent:GetHeight(),nodes=delta,hidden=hidden,delta=true,revision=__STT_WEB_REVISION}
end
local function state(includeStorage)
    local d=document()
    -- Review temporarily clears/replaces the visible editor buffer. Persist
    -- the active editing document, never the transient review projection.
    local text=box():GetText()
    if gui.IsAnalysisMode and gui.IsAnalysisMode()and d and type(d.draft)=='string'then text=d.draft end
    local result={text=text,document=d,message=__STT_EDITOR_MESSAGE,ui=uiTree(),mode=gui.GetActiveLeftMode()}
    if T.UITheme then result.appearance={mode=T.UITheme:GetMode(),palette=T.UITheme:GetPalette(),explicit=T.UITheme:HasExplicitChoice()}end
    if includeStorage or __STT_WEB_STORAGE_DIRTY then
        result.documents=C.DB.PlanDocuments
        result.references=STT_DB and STT_DB.bossReferences or {}
        result.storageChanged=__STT_WEB_STORAGE_DIRTY==true
        __STT_WEB_STORAGE_DIRTY=nil
    end
    return result
end
local function input(args)
    __STT_WEB_NOW=args.now or __STT_WEB_NOW or 0
    __STT_WEB_EPOCH=args.epoch or __STT_WEB_EPOCH
    if args.x then __STT_WEB_CURSOR_X=args.x;__STT_WEB_CURSOR_Y=UIParent:GetHeight()-(args.y or 0)end
    if args.hitIDs then
        __STT_WEB_HIT_IDS={};for _,id in ipairs(args.hitIDs)do __STT_WEB_HIT_IDS[id]=true end
        __STT_WEB_HIT_REVISION=args.hitRevision
    end
    if args.shift~=nil then __STT_WEB_SHIFT=args.shift;__STT_WEB_CTRL=args.ctrl;__STT_WEB_ALT=args.alt end
end
local function globalMouse(event,button)
    local listeners={}
    for _,frame in ipairs(__STT_WEB_FRAMES)do if frame.__sttWebUI.events[event]then listeners[#listeners+1]=frame end end
    for _,frame in ipairs(listeners)do if frame.__sttWebUI.events[event]then frame:_Fire('OnEvent',event,button)end end
end
local function cancelPointer()
    local timeline=gui.GetHorizontalTimeline and gui.GetHorizontalTimeline()
    if timeline then
        if timeline.FinishChipDrag then timeline:FinishChipDrag(false)end
        if timeline.StopMiddleDrag then timeline:StopMiddleDrag('MiddleButton')end
        if timeline.StopPlayheadDrag then timeline:StopPlayheadDrag('LeftButton')end
    end
    if T.TimelineSelectionBox and T.TimelineSelectionBox.Clear then T.TimelineSelectionBox.Clear('browser_pointer_cancel')end
    if __STT_WEB_MOUSE_FRAME then __STT_WEB_MOUSE_FRAME.__sttWebUI.pressed=false;markUI(__STT_WEB_MOUSE_FRAME)end
    __STT_WEB_MOUSE_BUTTON=nil;__STT_WEB_MOUSE_FRAME=nil
end
local function createUI(args)
    UIParent:SetSize(args.width or 1200,args.height or 800)
    if root then return end
    root=CreateFrame('Frame','STT_WEB_UI_ROOT',UIParent);root:SetAllPoints(UIParent)
    gui.CreateInterface(root)
    -- The original button remains the entry point; WCL supplies the browser roster.
    assert(gui.syncRaidBtn,'roster_button_missing'):SetScript('OnClick',function()__STT_WEB_WCL_REQUESTED=true end)
end
function __STT_EDITOR_CALL(action,args)
    args=args or {};input(args)
    __STT_EDITOR_MESSAGE=''
    if action=='open'then
        if args.documents then C.DB.PlanDocuments=args.documents end
        if args.references then STT_DB=STT_DB or {};STT_DB.bossReferences=args.references end
        if args.appearance and T.UITheme then
            if args.appearance.palette then assert(T.UITheme:SetPalette(args.appearance.palette))end
            if args.appearance.mode then assert(T.UITheme:SetMode(args.appearance.mode))end
        end
        createUI(args)
        if args.boss then
            assert(gui.SwitchEditorDocumentToBossKey(args.boss,args.scope,'web_restore',{
                profileID=T.Profile:GetActiveProfileID(),difficulty=args.difficulty
            }),'web_restore_target_failed')
        end
        if args.text then replace(args.text,'web_restore')end
        __STT_WEB_READY=true
    elseif action=='resize'then UIParent:SetSize(args.width,args.height)
    elseif action=='frame'then
        local elapsed=args.elapsed or 0
        __STT_WEB_NOW=args.now or (__STT_WEB_NOW or 0)+elapsed
        local priorRevision=__STT_WEB_REVISION
        __STT_EDITOR_PUMP_TIMERS()
        flushSpellMetadata()
        local runner=T.TimelineRunner;local playing=runner and runner.GetState and runner:GetState().playing==true
        -- Scripts can unregister themselves or start another native driver.
        -- Iterating the live weak table makes Fengari next() invalid after a
        -- callback deletes its current key. New drivers begin next frame.
        local listeners={}
        for f in pairs(__STT_WEB_ONUPDATE)do listeners[#listeners+1]=f end
        table.sort(listeners,function(a,b)return a.__sttWebUI.id<b.__sttWebUI.id end)
        for _,f in ipairs(listeners)do if __STT_WEB_ONUPDATE[f]and f:IsVisible()then f:_Fire('OnUpdate',elapsed)end end
        local updateNext=__STT_WEB_MOUSE_BUTTON~=nil or next(__STT_WEB_CONTINUOUS_ONUPDATE)~=nil or playing or priorRevision~=__STT_WEB_REVISION
        if args.revision==__STT_WEB_REVISION then return {revision=__STT_WEB_REVISION,updateNext=updateNext}end
        return {ui=uiTree(),updateNext=updateNext}
    elseif action=='uiEvent'then
        local f=assert(__STT_WEB_FRAMES[args.id],'unknown_ui_node')
        local event=args.event
        if not f:IsVisible()then return state()end
        if event=='OnMouseDown'then
            globalMouse('GLOBAL_MOUSE_DOWN',args.button)
            __STT_WEB_MOUSE_BUTTON=args.button;__STT_WEB_MOUSE_FRAME=f;f.__sttWebUI.pressed=true;__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f)
            f:_Fire(event,args.button)
        elseif event=='OnMouseUp'then
            f:_Fire(event,args.button);__STT_WEB_MOUSE_BUTTON=nil;__STT_WEB_MOUSE_FRAME=nil;f.__sttWebUI.pressed=false;__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f)
            globalMouse('GLOBAL_MOUSE_UP',args.button)
        elseif event=='OnPointerCancel'then cancelPointer()
        elseif event=='OnClick'then
            local button=args.button or 'LeftButton';local registered=f.__sttWebUI.clickButtons
            local allowed=not registered or #registered==0
            for _,click in ipairs(registered or {})do if click==button..'Up'or click=='AnyUp'then allowed=true;break end end
            if f:IsEnabled()and allowed then f:_Fire(event,button,false);__STT_WEB_STORAGE_DIRTY=true end
        elseif event=='OnMouseWheel'then
            -- Browser nodes are flat siblings; use the native wheel receiver.
            local receiver=f
            while receiver and (not receiver.__sttWebUI.mouseWheel or not receiver:GetScript(event))do receiver=receiver:GetParent()end
            if not receiver then local result=state();result.wheelHandled=false;return result end
            receiver:_Fire(event,assert(args.delta))
        elseif event=='OnEnter'or event=='OnLeave'then f.__sttWebUI.hovered=event=='OnEnter';__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f);f:_Fire(event)
        elseif event=='OnTextChanged'then
            assert(type(args.text)=='string');f:SetUserText(args.text,args.cursor)
            if args.cursorY then f:_Fire('OnCursorChanged',args.cursorX or 0,args.cursorY,args.cursorWidth or 1,args.cursorHeight or 12)end
        elseif event=='OnCompositionChanged'then f.__sttWebUI.composing=args.composing==true;__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f)
        elseif event=='OnEditFocusGained'then f:SetFocus()
        elseif event=='OnEditFocusLost'then f:ClearFocus()
        elseif event=='OnCursorChanged'then
            f.__sttWebUI.cursor=args.cursor;f.__sttWebUI.highlight=args.highlight;__STT_WEB_DIRTY_FRAMES[f]=true
            if args.cursorY then f:_Fire('OnCursorChanged',args.cursorX or 0,args.cursorY,args.cursorWidth or 1,args.cursorHeight or 12)end
        elseif event=='OnValueChanged'then f:SetValue(args.value,true)
        else f:_Fire(event,args.button)end
    elseif action=='cancelPointer'then cancelPointer()
    elseif action=='pointer'then
        local function move(f)
            if f.__sttWebUI.moving then local x,y=GetCursorPosition();f:ClearAllPoints();f:SetPoint('BOTTOMLEFT',UIParent,'BOTTOMLEFT',f.__sttWebUI.moveOrigin[1]+x-f.__sttWebUI.moving[1],f.__sttWebUI.moveOrigin[2]+y-f.__sttWebUI.moving[2])end
        end
        if __STT_WEB_MOVING_FRAMES then
            for f in pairs(__STT_WEB_MOVING_FRAMES)do move(f)end
        else
            for _,f in ipairs(__STT_WEB_FRAMES)do move(f)end
        end
    return {revision=__STT_WEB_REVISION}
    elseif action=='key'then
        __STT_WEB_KEY_ACTIVE=true;__STT_WEB_KEY_CONSUMED=false;__STT_WEB_KEY_NAME=tostring(args.key or '')
        local focused=__STT_WEB_FOCUS
        local event=args.down and 'OnKeyDown'or 'OnKeyUp'
        if focused and focused:IsVisible()then focused:_Fire(event,args.key);if args.down then if args.key=='ESCAPE'then focused:_Fire('OnEscapePressed')elseif args.key=='ENTER'then focused:_Fire('OnEnterPressed')elseif args.key=='TAB'then focused:_Fire('OnTabPressed')end end end
        local consumed=false
        local candidates={}
        if not focused then
            for _,f in ipairs(__STT_WEB_FRAMES)do if f.__sttWebUI.keyboard and f:IsVisible()then candidates[#candidates+1]=f end end
            table.sort(candidates,function(a,b)local x,y=a.__sttWebUI,b.__sttWebUI;return (strata[x.frameStrata]or 2)*10000+x.frameLevel>(strata[y.frameStrata]or 2)*10000+y.frameLevel end)
            for _,f in ipairs(candidates)do f:_Fire(event,args.key);if f.__sttWebUI.propagateKeyboard==false then consumed=true;break end end
        else
            -- Native EditBoxes keep editing even when propagation to the game
            -- is disabled. Only the original keyboard router's consumed
            -- decision suppresses the browser's own text-editing default.
            consumed=__STT_WEB_KEY_CONSUMED==true
        end
        __STT_WEB_KEY_ACTIVE=false
        return {consumed=consumed}
    elseif action=='spellIDs'then
        local seen,ids={},{}
        local function add(text)for _,token in ipairs(T.TimelineSyntax.ExtractSpellTokens(text or ''))do local id=tonumber(token.spellID);if id and not seen[id]then seen[id]=true;ids[#ids+1]=id end end end
        add(box():GetText());local d=document();if d then add(T.BossReference:GetText(d))end
        local drawer=T.SkillDrawer and T.SkillDrawer.IsOpen and T.SkillDrawer.IsOpen()and _G.STT_SkillDrawer
        if drawer then
            local viewport=drawer.scroll and drawer.scroll.scroll
            for _,row in ipairs(drawer.cards or {})do
                local id=tonumber(row.spellID)
                if id and row:IsVisible()and (not viewport or row:GetBottom()<viewport:GetTop()and row:GetTop()>viewport:GetBottom())and not seen[id]then
                    seen[id]=true;ids[#ids+1]=id
                end
            end
        end
        local pending={};for id in pairs(__STT_WEB_PENDING_SPELLS)do if not seen[id]then pending[#pending+1]=id end end
        table.sort(pending);for _,id in ipairs(pending)do ids[#ids+1]=id end
        return ids
    elseif action=='spellMetadata'then
        local updated={}
        for _,s in ipairs(args.spells)do
            local prior=__STT_WEB_SPELLS[s.id]
            if not prior or prior.name~=s.name or prior.iconID~=s.icon or prior.castTime~=s.castTime then
                __STT_WEB_SPELLS[s.id]={name=s.name,spellID=s.id,iconID=s.icon,castTime=s.castTime}
                updated[s.id]=true;pendingPlanMetadata[s.id]=true
            end
            __STT_WEB_PENDING_SPELLS[s.id]=nil
        end
        if next(updated)then
            __STT_WEB_SPELL_REVISION=(__STT_WEB_SPELL_REVISION or 0)+1
            -- Invalidate lazily: typing/filter changes use fresh search data,
            -- while background batches keep existing row identities and order.
            T.SkillPickerLogic.ResetSpellSearchIndex();metadataSearchDirty=true
            local drawer=T.SkillDrawer and T.SkillDrawer.IsOpen and T.SkillDrawer.IsOpen()and _G.STT_SkillDrawer
            if drawer then
                for _,row in ipairs(drawer.cards or {})do
                    local id=tonumber(row.spellID)
                    if id and updated[id]and not row.isHeader then
                        local info=__STT_WEB_SPELLS[id]
                        row.spellName=info.name;row.spellIcon=info.iconID
                        if row.icon then row.icon:SetTexture(info.iconID or 134400)end
                    end
                end
                T.SkillDrawer.RefreshSessionText()
            end
            flushSpellMetadata()
        end
    elseif action=='spellMetadataComplete'then
        metadataSearchReady=true;flushSpellMetadata()
    elseif action=='appearance'then
        assert(T.UITheme,'theme_unavailable')
        if args.palette then assert(T.UITheme:SetPalette(args.palette))end
        if args.mode then assert(T.UITheme:SetMode(args.mode))end
        __STT_WEB_STORAGE_DIRTY=true
    elseif action=='text'then replace(args.text,'web_import')
    elseif action=='roster'then
        local counters, lines, unknown = {}, {}, 0
        for _, member in ipairs(args.members or {}) do
            local specID = tonumber(member.specID)
            if not specID then
                local class = tostring(member.className or ""):upper():gsub("[^A-Z]", "")
                local spec = tostring(member.specName or ""):upper():gsub("[^A-Z]", "")
                for _, id in ipairs(__STT_SPEC_CLASSES[class] or {}) do
                    if tostring(T.SkillPickerLogic.GetSpecBucket(id) or ""):gsub("_", "") == spec then specID = id; break end
                end
            end
            local alias = T.SpecAliases.Resolve(specID)
            local name = assert(member.name, "missing_name")
            assert(not name:find("[%s,;=|%[%]{}#\r\n]"), "invalid_player_name")
            if member.server and member.server ~= "" then name = name .. "-" .. member.server end
            if alias then
                counters[alias] = (counters[alias] or 0) + 1
                lines[#lines + 1] = alias .. counters[alias] .. "=" .. name
            else lines[#lines + 1] = name; unknown = unknown + 1 end
        end
        assert(#lines > 0, "empty_roster")
        local text, reason = T.TimelineTextEdit.ReplaceOrMergePersonnelSection(box():GetText(), lines, "overwrite")
        assert(text, reason); replace(text, "wcl_roster")
        __STT_EDITOR_MESSAGE = "已导入 " .. #lines .. " 名成员" .. (unknown > 0 and ("；" .. unknown .. " 人需要补充专精") or "")
    elseif action~='snapshot'then error('unknown_editor_action: '..tostring(action))end
    local result=state(action=='open');if action=='uiEvent'and args.event=='OnMouseWheel'then result.wheelHandled=true end;result.wclRequested=__STT_WEB_WCL_REQUESTED==true;__STT_WEB_WCL_REQUESTED=nil;return result
end
