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
    if not isVisible or f.__sttWebUI.kind=='Font'then return nil,false end
    local x,y,w,h=f:_Rect();local parent=f.__sttWebUI.parent;local parentState=parent and parent.__sttWebUI
    local visible=true
    if f.__sttWebUI.layer=='HIGHLIGHT'then visible=parentState and parentState.hovered==true end
    if f.__sttWebUI.buttonState then
        local state=parentState.enabled==false and 'Disabled'or parentState.pressed and 'Pushed'or 'Normal'
        visible=f.__sttWebUI.buttonState=='Thumb' or f.__sttWebUI.buttonState==state or f.__sttWebUI.buttonState=='Highlight'and parentState.hovered or f.__sttWebUI.buttonState=='Checked'and parentState.checked
    end
    local label=''
    if f.__sttWebUI.kind=='Button'or f.__sttWebUI.kind=='CheckButton'or f.__sttWebUI.kind=='EditBox'then
        label=type(f.__sttWebUI._text)=='string'and f.__sttWebUI._text or ''
        if label==''then for _,c in ipairs(f.__sttWebUI.children)do if c.__sttWebUI.kind=='FontString'and c.__sttWebUI.shown then label=label..(c.__sttWebUI._text or '')end end end
    end
    return {id=f.__sttWebUI.id,kind=f.__sttWebUI.kind,name=f.__sttWebUI.name,label=label,x=x,y=UIParent:GetHeight()-y-h,width=w,height=h,
        text=f.__sttWebUI._text,font=f.__sttWebUI.font,textColor=f.__sttWebUI.textColor,shadowColor=f.__sttWebUI.shadowColor,shadowOffset=f.__sttWebUI.shadowOffset,justifyH=f.__sttWebUI.justifyH,justifyV=f.__sttWebUI.justifyV,wordWrap=f.__sttWebUI.wordWrap,
        texture=f.__sttWebUI.texture,atlas=f.__sttWebUI.atlas,color=f.__sttWebUI.color,texCoord=f.__sttWebUI.texCoord,vertexColor=f.__sttWebUI.vertexColor,rotation=f.__sttWebUI.rotation,blendMode=f.__sttWebUI.blendMode,alpha=alpha,
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
    local result={text=box():GetText(),document=d,message=__STT_EDITOR_MESSAGE,ui=uiTree(),mode=gui.GetActiveLeftMode()}
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
        createUI(args)
        if args.boss then
            local target=assert(T.PlanStore:BuildTarget(T.Profile:GetActiveProfileID(),args.boss,args.difficulty,args.scope),'invalid_document')
            assert(T.PlanEditorSession:SwitchTarget(target,'web_restore'))
            if args.scope~=gui.GetActiveEditorTab()then assert(gui.SwitchEditorTab(args.scope,'web_restore'))end
            gui.RefreshData('web_restore')
        end
        if args.text then replace(args.text,'web_restore')end
        __STT_WEB_READY=true
    elseif action=='resize'then UIParent:SetSize(args.width,args.height)
    elseif action=='frame'then
        local elapsed=args.elapsed or 0
        local priorRevision=__STT_WEB_REVISION
        __STT_EDITOR_PUMP_TIMERS()
        local runner=T.TimelineRunner;local playing=runner and runner.GetState and runner:GetState().playing==true
        for f in pairs(__STT_WEB_ONUPDATE)do if f:IsVisible()then f:_Fire('OnUpdate',elapsed)end end
        local updateNext=__STT_WEB_MOUSE_BUTTON~=nil or next(__STT_WEB_CONTINUOUS_ONUPDATE)~=nil or playing or priorRevision~=__STT_WEB_REVISION
        if args.revision==__STT_WEB_REVISION then return {revision=__STT_WEB_REVISION,updateNext=updateNext}end
        return {ui=uiTree(),updateNext=updateNext}
    elseif action=='uiEvent'then
        local f=assert(__STT_WEB_FRAMES[args.id],'unknown_ui_node')
        local event=args.event
        if not f:IsVisible()then return state()end
        if event=='OnMouseDown'then
            __STT_WEB_MOUSE_BUTTON=args.button;__STT_WEB_MOUSE_FRAME=f;f.__sttWebUI.pressed=true;__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f)
            f:_Fire(event,args.button)
        elseif event=='OnMouseUp'then
            f:_Fire(event,args.button);__STT_WEB_MOUSE_BUTTON=nil;__STT_WEB_MOUSE_FRAME=nil;f.__sttWebUI.pressed=false;__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f)
        elseif event=='OnPointerCancel'then cancelPointer()
        elseif event=='OnClick'then
            local button=args.button or 'LeftButton';local registered=f.__sttWebUI.clickButtons
            local allowed=not registered or #registered==0
            for _,click in ipairs(registered or {})do if click==button..'Up'then allowed=true;break end end
            if f:IsEnabled()and allowed then f:_Fire(event,button,false);__STT_WEB_STORAGE_DIRTY=true end
        elseif event=='OnMouseWheel'then f:_Fire(event,assert(args.delta))
        elseif event=='OnEnter'or event=='OnLeave'then f.__sttWebUI.hovered=event=='OnEnter';__STT_WEB_REVISION=__STT_WEB_REVISION+1;markUI(f);f:_Fire(event)
        elseif event=='OnTextChanged'then
            assert(type(args.text)=='string');f:SetUserText(args.text,args.cursor)
        elseif event=='OnEditFocusGained'then f:SetFocus()
        elseif event=='OnEditFocusLost'then f:ClearFocus()
        elseif event=='OnCursorChanged'then f.__sttWebUI.cursor=args.cursor;f.__sttWebUI.highlight=args.highlight;__STT_WEB_DIRTY_FRAMES[f]=true
        elseif event=='OnValueChanged'then f:SetValue(args.value,true)
        else f:_Fire(event,args.button)end
    elseif action=='cancelPointer'then cancelPointer()
    elseif action=='pointer'then
        for _,f in ipairs(__STT_WEB_FRAMES)do if f.__sttWebUI.moving then local x,y=GetCursorPosition();f:ClearAllPoints();f:SetPoint('BOTTOMLEFT',UIParent,'BOTTOMLEFT',f.__sttWebUI.moveOrigin[1]+x-f.__sttWebUI.moving[1],f.__sttWebUI.moveOrigin[2]+y-f.__sttWebUI.moving[2])end end
    return {revision=__STT_WEB_REVISION}
    elseif action=='key'then
        local focused=__STT_WEB_FOCUS
        local event=args.down and 'OnKeyDown'or 'OnKeyUp'
        if focused and focused:IsVisible()then focused:_Fire(event,args.key);if args.down then if args.key=='ESCAPE'then focused:_Fire('OnEscapePressed')elseif args.key=='ENTER'then focused:_Fire('OnEnterPressed')elseif args.key=='TAB'then focused:_Fire('OnTabPressed')end end end
        local consumed=false
        local candidates={}
        if not focused then
            for _,f in ipairs(__STT_WEB_FRAMES)do if f.__sttWebUI.keyboard and f:IsVisible()then candidates[#candidates+1]=f end end
            table.sort(candidates,function(a,b)local x,y=a.__sttWebUI,b.__sttWebUI;return (strata[x.frameStrata]or 2)*10000+x.frameLevel>(strata[y.frameStrata]or 2)*10000+y.frameLevel end)
            for _,f in ipairs(candidates)do f:_Fire(event,args.key);if f.__sttWebUI.propagateKeyboard==false then consumed=true;break end end
        else consumed=(args.ctrl or args.alt)and focused.__sttWebUI.propagateKeyboard==false end
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
        return ids
    elseif action=='spellMetadata'then
        __STT_WEB_SPELL_REVISION=(__STT_WEB_SPELL_REVISION or 0)+1
        for _,s in ipairs(args.spells)do __STT_WEB_SPELLS[s.id]={name=s.name,spellID=s.id,iconID=s.icon,castTime=s.castTime}end
        T.SkillPickerLogic.ResetSpellSearchIndex();sem:WipeCompiledPlanCache();gui.RefreshData('web_metadata')
        if T.SkillDrawer and T.SkillDrawer.IsOpen and T.SkillDrawer.IsOpen()then T.SkillDrawer.Render()end
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
    local result=state(action=='open');result.wclRequested=__STT_WEB_WCL_REQUESTED==true;__STT_WEB_WCL_REQUESTED=nil;return result
end
