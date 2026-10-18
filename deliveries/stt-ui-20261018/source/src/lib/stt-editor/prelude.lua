-- Browser implementation of the UI primitives used by the unmodified STT editor.
unpack = table.unpack
strsplit = function(sep, value) local out={};local from=1;while true do local a,b=value:find(sep,from,true);if not a then out[#out+1]=value:sub(from);break end;out[#out+1]=value:sub(from,a-1);from=b+1 end;return unpack(out) end
strtrim = function(value) return (tostring(value or ''):gsub('^%s+',''):gsub('%s+$','')) end
strmatch,strfind,strsub,strlen=string.match,string.find,string.sub,string.len
strlower,strupper,strformat=string.lower,string.upper,string.format
tinsert,tremove,tconcat=table.insert,table.remove,table.concat
wipe=function(t)for k in pairs(t)do t[k]=nil end;return t end
GetLocale=function()return 'zhCN'end
UnitName=function()return '玩家'end
UnitGUID=function()return 'web-player'end
GetTime=function()return __STT_WEB_NOW or 0 end
GetTimePreciseSec=GetTime
debugprofilestop=function()return __STT_WEB_NOW_MS and __STT_WEB_NOW_MS()or GetTime()*1000 end
time=function()return math.floor(__STT_WEB_EPOCH or GetTime())end
issecretvalue=function()return false end
GetNumGroupMembers=function()return 0 end
InCombatLockdown=function()return false end
GetRealmName=function()return 'Web'end
UnitClass=function()return '玩家','DRUID'end
C_AddOns={GetAddOnMetadata=function()return 'web'end}
__STT_WEB_TIMERS={}
local function timer(seconds, callback, repeatCount)
    assert(type(callback)=='function','timer callback required')
    local t={due=GetTime()+math.max(0,seconds),interval=seconds,callback=callback,remaining=repeatCount,canceled=false}
    function t:Cancel()self.canceled=true end
    function t:IsCancelled()return self.canceled end
    __STT_WEB_TIMERS[#__STT_WEB_TIMERS+1]=t;return t
end
C_Timer={NewTimer=function(s,f)return timer(s,f)end,After=function(s,f)timer(s,f)end,NewTicker=function(s,f,n)return timer(s,f,n or math.huge)end}
function __STT_EDITOR_PUMP_TIMERS()
    local pending=__STT_WEB_TIMERS;__STT_WEB_TIMERS={}
    for _,t in ipairs(pending)do
        if not t.canceled then
            if t.due<=GetTime()then
                t.callback(t)
                if t.remaining and t.remaining>1 and not t.canceled then t.remaining=t.remaining-1;t.due=GetTime()+t.interval;__STT_WEB_TIMERS[#__STT_WEB_TIMERS+1]=t end
            else __STT_WEB_TIMERS[#__STT_WEB_TIMERS+1]=t end
        end
    end
end
__STT_WEB_FRAMES={}
__STT_WEB_ONUPDATE=setmetatable({},{__mode='k'})
__STT_WEB_MOVING_FRAMES=setmetatable({},{__mode='k'})
__STT_WEB_CONTINUOUS_ONUPDATE=setmetatable({},{__mode='k'})
__STT_WEB_DIRTY_FRAMES=setmetatable({},{__mode='k'})
__STT_WEB_FULL_REFRESH=true
__STT_WEB_READY=false
__STT_WEB_REVISION=0
local rectDependents=setmetatable({},{__mode='k'})
local fallbackRelative=setmetatable({},{__mode='k'})
local function addDependent(relative,frame)
    if not relative then return end
    rectDependents[relative]=rectDependents[relative]or setmetatable({},{__mode='k'})
    rectDependents[relative][frame]=true
end
local function removeDependent(relative,frame)
    local dependents=relative and rectDependents[relative]
    if dependents then dependents[frame]=nil end
end
local function markTree(frame,seen)
    if not frame or seen[frame]then return end
    seen[frame]=true;__STT_WEB_DIRTY_FRAMES[frame]=true
    for _,child in ipairs(frame.__sttWebUI.children)do markTree(child,seen)end
end
local function changed(frame,subtree)
    __STT_WEB_REVISION=__STT_WEB_REVISION+1
    if not frame then __STT_WEB_FULL_REFRESH=true
    elseif subtree then markTree(frame,{})
    else __STT_WEB_DIRTY_FRAMES[frame]=true end
end
local M={}
local sequence=0
local create
function M:_InvalidateRelativeLayout(seen)
    -- Cached dependent rectangles resolve this rectangle first. Once both its
    -- geometry and render work are already pending, repeated setters need not
    -- invalidate the same dependency subtree again. Native edit regions are
    -- uncached views of their owner and cannot use that invariant.
    if not self.__sttWebUI.rect and __STT_WEB_DIRTY_FRAMES[self]and not self.__sttWebUI.nativeEditOwner then return end
    seen=seen or{}
    if seen[self]then return end
    seen[self]=true
    self.__sttWebUI.rect=nil
    __STT_WEB_DIRTY_FRAMES[self]=true
    for child in pairs(rectDependents[self]or{})do child:_InvalidateRelativeLayout(seen)end
end
local function fraction(anchor)
    return anchor:find('LEFT')and 0 or anchor:find('RIGHT')and 1 or .5,anchor:find('BOTTOM')and 0 or anchor:find('TOP')and 1 or .5
end
function M:_Measure()
    assert(__STT_WEB_MEASURE_TEXT,'browser font measurement unavailable')
    if self.__sttWebUI.nativeEditOwner then self:_Rect()end
    local width=self.__sttWebUI.width or 0
    if width<=0 and #self.__sttWebUI.points>1 and not self.__sttWebUI.resolving then width=self:GetWidth()end
    if self.__sttWebUI.nativeEditOwner then width=self:GetWidth()end
    return __STT_WEB_MEASURE_TEXT(self.__sttWebUI._text or '',self.__sttWebUI.font and self.__sttWebUI.font[1] or STANDARD_TEXT_FONT,self.__sttWebUI.font and self.__sttWebUI.font[2] or 12,self.__sttWebUI.font and self.__sttWebUI.font[3] or '',width,self.__sttWebUI.wordWrap==true)
end
function M:_Rect()
    local edit=self.__sttWebUI.nativeEditOwner
    if edit then
        local x,y,w,h=edit:_Rect();local s=edit.__sttWebUI;local i=s.textInsets or {0,0,0,0}
        self.__sttWebUI._text=s._text;self.__sttWebUI.font=s.font;self.__sttWebUI.textColor=s.textColor
        self.__sttWebUI.justifyH=s.justifyH;self.__sttWebUI.justifyV=s.justifyV;self.__sttWebUI.wordWrap=s.multiLine
        self.__sttWebUI.spacing=s.spacing
        return x+i[1],y+i[4],math.max(0,w-i[1]-i[2]),math.max(0,h-i[3]-i[4])
    end
    if self.__sttWebUI.rect then return unpack(self.__sttWebUI.rect)end
    if self.__sttWebUI.resolving then return 0,0,self.__sttWebUI.width or 0,self.__sttWebUI.height or 0 end
    self.__sttWebUI.resolving=true
    local px,py,pw,ph=0,0,0,0
    if self.__sttWebUI.parent then px,py,pw,ph=self.__sttWebUI.parent:_Rect()end
    local w,h=self.__sttWebUI.width,self.__sttWebUI.height
    if self.__sttWebUI.kind=='FontString'and(w==nil or h==nil)then local tw,th=self:_Measure();w=w or tw;h=h or th end
    w,h=w or 0,h or 0
    local x,y=px,py
    local left,right,centerX,bottom,top,centerY
    for _,p in ipairs(self.__sttWebUI.points)do
        local relative=p[2]or self.__sttWebUI.parent
        local rx,ry,rw,rh=px,py,pw,ph
        if relative and relative~=self then rx,ry,rw,rh=relative:_Rect()end
        local fx,fy=fraction(p[1]);local rfx,rfy=fraction(p[3]);local tx,ty=rx+rfx*rw+p[4],ry+rfy*rh+p[5]
        if fx==0 then left=tx elseif fx==1 then right=tx else centerX=tx end
        if fy==0 then bottom=ty elseif fy==1 then top=ty else centerY=ty end
    end
    if left and right then w=math.max(0,right-left)end
    if bottom and top then h=math.max(0,top-bottom)end
    if self.__sttWebUI.kind=='EditBox'and self.__sttWebUI.multiLine and not(bottom and top)and __STT_WEB_MEASURE_TEXT then
        local s=self.__sttWebUI;local i=s.textInsets or{0,0,0,0};local font=s.font or{STANDARD_TEXT_FONT,12,''}
        local _,height=__STT_WEB_MEASURE_TEXT(s._text or'',font[1],font[2],font[3],math.max(1,w-i[1]-i[2]),true)
        h=math.max(h,height+i[3]+i[4])
    end
    x=left or(right and right-w)or(centerX and centerX-w/2)or px
    y=bottom or(top and top-h)or(centerY and centerY-h/2)or py
    if self.__sttWebUI.scrollParent then x=x-(self.__sttWebUI.scrollParent.__sttWebUI.scrollX or 0);y=y+(self.__sttWebUI.scrollParent.__sttWebUI.scrollY or 0)end
    if self.__sttWebUI.clampedToScreen and UIParent and self~=UIParent then x=math.max(0,math.min(UIParent:GetWidth()-w,x));y=math.max(0,math.min(UIParent:GetHeight()-h,y))end
    self.__sttWebUI.rect={x,y,w,h};self.__sttWebUI.resolving=nil
    return x,y,w,h
end
function M:SetPoint(anchor,relative,relativeAnchor,x,y)
    if type(relative)=='number'then x,y,relative,relativeAnchor=relative,relativeAnchor,self.__sttWebUI.parent,anchor
    elseif relative==nil then relative,relativeAnchor,x,y=self.__sttWebUI.parent,anchor,0,0
    else
        if type(relative)=='string'then relative=assert(_G[relative],'unknown anchor frame '..relative)end
        if type(relativeAnchor)=='number'then x,y,relativeAnchor=relativeAnchor,x,anchor end
    end
    local point={anchor,relative or self.__sttWebUI.parent,relativeAnchor or anchor,tonumber(x)or 0,tonumber(y)or 0}
    for i,p in ipairs(self.__sttWebUI.points)do
        if p[1]==anchor then
            if p[2]~=point[2]or p[3]~=point[3]or p[4]~=point[4]or p[5]~=point[5]then
                removeDependent(p[2],self)
                self.__sttWebUI.points[i]=point
                addDependent(point[2],self)
                self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame')
            end
            return
        end
    end
    if #self.__sttWebUI.points==0 then removeDependent(fallbackRelative[self],self);fallbackRelative[self]=nil end
    self.__sttWebUI.points[#self.__sttWebUI.points+1]=point
    addDependent(point[2],self)
    self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame')
end
function M:GetPoint(i)local p=self.__sttWebUI.points[i or 1];if p then return unpack(p)end end
function M:GetNumPoints()return #self.__sttWebUI.points end
function M:ClearAllPoints()
    if #self.__sttWebUI.points==0 then return end
    for _,point in ipairs(self.__sttWebUI.points)do removeDependent(point[2],self)end
    self.__sttWebUI.points={}
    local parent=self.__sttWebUI.parent
    if parent then fallbackRelative[self]=parent;addDependent(parent,self)end
    self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame')
end
function M:SetAllPoints(target)self:ClearAllPoints();self:SetPoint('TOPLEFT',target or self.__sttWebUI.parent,'TOPLEFT',0,0);self:SetPoint('BOTTOMRIGHT',target or self.__sttWebUI.parent,'BOTTOMRIGHT',0,0)end
function M:SetSize(w,h)if self.__sttWebUI.width~=w or self.__sttWebUI.height~=h then self.__sttWebUI.width,self.__sttWebUI.height=w,h;self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame');self:_UpdateThumb()end end
function M:SetWidth(w)if self.__sttWebUI.width~=w then self.__sttWebUI.width=w;self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame');self:_UpdateThumb()end end
function M:SetHeight(h)if self.__sttWebUI.height~=h then self.__sttWebUI.height=h;self:_InvalidateRelativeLayout();changed(self,self.__sttWebUI.clipsChildren or self.__sttWebUI.kind=='ScrollFrame');self:_UpdateThumb()end end
function M:GetWidth()local _,_,w=self:_Rect();return w end
function M:GetHeight()local _,_,_,h=self:_Rect();return h end
function M:GetSize()local _,_,w,h=self:_Rect();return w,h end
function M:GetLeft()local x=self:_Rect();return x end
function M:GetBottom()local _,y=self:_Rect();return y end
function M:GetRight()return self:GetLeft()+self:GetWidth()end
function M:GetTop()return self:GetBottom()+self:GetHeight()end
function M:GetCenter()return self:GetLeft()+self:GetWidth()/2,self:GetBottom()+self:GetHeight()/2 end
function M:GetRect()return self:_Rect()end
function M:GetName()return self.__sttWebUI.name end
function M:GetObjectType()return self.__sttWebUI.kind end
function M:IsObjectType(t)return self.__sttWebUI.kind==t or t=='Frame'and self.__sttWebUI.kind~='Texture'and self.__sttWebUI.kind~='FontString'end
function M:GetParent()return self.__sttWebUI.parent end
function M:SetParent(p)
    if self.__sttWebUI.parent==p then return end
    if self.__sttWebUI.parent then for i,v in ipairs(self.__sttWebUI.parent.__sttWebUI.children)do if v==self then table.remove(self.__sttWebUI.parent.__sttWebUI.children,i);break end end end
    if #self.__sttWebUI.points==0 then removeDependent(fallbackRelative[self],self);fallbackRelative[self]=nil end
    self.__sttWebUI.parent=p;if p then p.__sttWebUI.children[#p.__sttWebUI.children+1]=self end;self:_InvalidateRelativeLayout();changed(self,true);__STT_WEB_FULL_REFRESH=true
    if #self.__sttWebUI.points==0 and p then fallbackRelative[self]=p;addDependent(p,self)end
end
function M:GetChildren()local r={};for _,c in ipairs(self.__sttWebUI.children)do if c.__sttWebUI.kind~='Texture'and c.__sttWebUI.kind~='FontString'then r[#r+1]=c end end;return unpack(r)end
function M:GetRegions()local r={};for _,c in ipairs(self.__sttWebUI.children)do if c.__sttWebUI.kind=='Texture'or c.__sttWebUI.kind=='FontString'then r[#r+1]=c end end;return unpack(r)end
function M:IsShown()return self.__sttWebUI.shown end
function M:IsVisible()return self.__sttWebUI.shown and(not self.__sttWebUI.parent or self.__sttWebUI.parent:IsVisible())end
function M:SetShown(v)
    v=not not v;if self.__sttWebUI.shown==v then return end
    self.__sttWebUI.shown=v;changed(self,true);self:_Fire(v and 'OnShow'or 'OnHide')
end
function M:Show()self:SetShown(true)end
function M:Hide()self:SetShown(false)end
function M:SetScript(event,fn)
    local had=self.__sttWebUI.scripts[event]~=nil
    self.__sttWebUI.scripts[event]=fn
    if event=='OnUpdate'then
        if fn then __STT_WEB_ONUPDATE[self]=true;if __STT_WEB_READY then __STT_WEB_CONTINUOUS_ONUPDATE[self]=true end
        else __STT_WEB_ONUPDATE[self]=nil;__STT_WEB_CONTINUOUS_ONUPDATE[self]=nil end
    end
    if had~=(fn~=nil)then changed(self)end
end
function M:GetScript(event)return self.__sttWebUI.scripts[event]end
function M:HookScript(event,fn)local prior=self.__sttWebUI.scripts[event];self:SetScript(event,function(...)if prior then prior(...)end;fn(...)end)end
function M:_Fire(event,...)local fn=self.__sttWebUI.scripts[event];if fn then return fn(self,...)end end
function M:HasScript()return true end
function M:SetText(text)
    text=tostring(text or '');if self.__sttWebUI._text==text then return end;self.__sttWebUI._text=text
    if self.__sttWebUI.kind=='FontString'or self.__sttWebUI.kind=='EditBox'then self:_InvalidateRelativeLayout()end
    changed(self)
    if self.__sttWebUI.kind=='FontString'then
        local owner=self.__sttWebUI.parent
        while owner do changed(owner);if owner.__sttWebUI.kind=='Button'or owner.__sttWebUI.kind=='CheckButton'then break end;owner=owner.__sttWebUI.parent end
    end
    if self.__sttWebUI.fontString then self.__sttWebUI.fontString:SetText(text)end
    if self.__sttWebUI.kind=='EditBox'then changed(self,true);self:_Fire('OnTextChanged',false)end
end
function M:GetText()return self.__sttWebUI._text end
function M:SetUserText(text,cursor)
    text=tostring(text or '');if self.__sttWebUI._text==text then return end
    self.__sttWebUI._text=text;self.__sttWebUI.cursor=math.max(0,math.min(#text,cursor or #text));self.__sttWebUI.highlight=nil;self:_InvalidateRelativeLayout();changed(self,true);self:_Fire('OnTextChanged',true)
end
function M:SetFormattedText(format,...)self:SetText(string.format(format,...))end
function M:Insert(value)
    -- Native C methods operate on the underlying display buffer, even when Lua
    -- overrides GetText/SetText for source decoration.
    local s=self.__sttWebUI;local text=s._text;local a=s.cursor or #text;local b=a
    if s.highlight then a=math.max(0,s.highlight[1]or 0);b=s.highlight[2]or #text;if b<0 then b=#text end end
    M.SetText(self,text:sub(1,a)..value..text:sub(b+1));M.SetCursorPosition(self,a+#value);s.highlight=nil
end
function M:SetFont(path,size,flags)
    self.__sttWebUI.font={path,size,flags or ''}
    if self.__sttWebUI.kind=='FontString'then self:_InvalidateRelativeLayout()end
    changed(self,true)
    return true
end
function M:GetFont()local s=self.__sttWebUI;return unpack((s.nativeEditOwner and s.nativeEditOwner.__sttWebUI.font or s.font)or {STANDARD_TEXT_FONT,12,''})end
function M:SetFontObject(object)
    local objectName=object
    if type(object)=='string'then object=_G[object]end
    assert(type(object)=='table','unknown font object '..tostring(objectName));self:SetFont(object:GetFont());self.__sttWebUI.textColor=object.__sttWebUI.textColor
end
function M:GetFontObject()return self end
function M:GetStringWidth()local width=self:_Measure();return width end
function M:GetUnboundedStringWidth()return self:GetStringWidth()end
function M:GetStringHeight()local _,height=self:_Measure();return height end
function M:GetTextHeight()return self:GetStringHeight()end
function M:GetSpacing()return self.__sttWebUI.spacing or 0 end
function M:CanWordWrap()return self.__sttWebUI.wordWrap~=false end
function M:CanNonSpaceWrap()return self.__sttWebUI.nonSpaceWrap~=false end
function M:GetIndentedWordWrap()return self.__sttWebUI.indentedWordWrap==true end
function M:SetIndentedWordWrap(v)self.__sttWebUI.indentedWordWrap=v;changed(self)end
function M:SetMaxLines(v)self.__sttWebUI.maxLines=v;changed(self)end
function M:GetNumLines()return math.max(1,math.ceil(self:GetStringHeight()/math.max(1,select(2,self:GetFont())+self:GetSpacing())))end
function M:GetTextInsets()return unpack(self.__sttWebUI.textInsets or{0,0,0,0})end
function M:IsInIMECompositionMode()return self.__sttWebUI.composing==true end
function M:SetHyperlinksEnabled(v)self.__sttWebUI.hyperlinksEnabled=v;changed(self)end
function M:SetFontString(f)self.__sttWebUI.fontString=f;if self.__sttWebUI._text~=''then f:SetText(self.__sttWebUI._text)end end
function M:GetFontString()return self.__sttWebUI.fontString end
function M:SetFocus()
    if __STT_WEB_FOCUS==self then return end
    if __STT_WEB_FOCUS then __STT_WEB_FOCUS:ClearFocus()end
    __STT_WEB_FOCUS=self;self.__sttWebUI.focused=true;changed(self);self:_Fire('OnEditFocusGained')
end
function M:ClearFocus()if not self.__sttWebUI.focused then return end;self.__sttWebUI.focused=false;if __STT_WEB_FOCUS==self then __STT_WEB_FOCUS=nil end;changed(self);self:_Fire('OnEditFocusLost')end
function M:HasFocus()return self.__sttWebUI.focused==true end
function M:SetCursorPosition(v)self.__sttWebUI.cursor=math.max(0,math.min(#self.__sttWebUI._text,v));changed(self)end
function M:GetCursorPosition()return self.__sttWebUI.cursor or 0 end
function M:HighlightText(a,b)self.__sttWebUI.highlight={a or 0,b or #self.__sttWebUI._text};changed(self)end
function M:GetNumLetters()return #(self.__sttWebUI._text:gsub('[\128-\191]','')) end
function M:SetTexture(texture)
    if self.__sttWebUI.texture==texture and self.__sttWebUI.atlas==nil and self.__sttWebUI.color==nil then return true end
    self.__sttWebUI.texture=texture;self.__sttWebUI.atlas=nil;self.__sttWebUI.color=nil;changed(self);return true
end
function M:GetTexture()return self.__sttWebUI.texture end
function M:SetAtlas(atlas,useSize)
    local a=__STT_WEB_ATLAS and __STT_WEB_ATLAS[atlas]
    local sameCoords=true
    local nextCoords=a and{a.leftTexCoord,a.rightTexCoord,a.topTexCoord,a.bottomTexCoord}or nil
    local oldCoords=self.__sttWebUI.texCoord
    if nextCoords then
        sameCoords=oldCoords and #oldCoords==#nextCoords
        if sameCoords then for i=1,#nextCoords do if oldCoords[i]~=nextCoords[i]then sameCoords=false;break end end end
    else sameCoords=oldCoords==nil end
    if self.__sttWebUI.atlas==atlas and self.__sttWebUI.texture==(a and a.file or nil)and self.__sttWebUI.color==nil and sameCoords then
        if useSize and a then self:SetSize(a.width,a.height)end
        return a~=nil
    end
    self.__sttWebUI.atlas=atlas;self.__sttWebUI.texture=nil;self.__sttWebUI.color=nil
    if a then
        self.__sttWebUI.texture=a.file;self.__sttWebUI.texCoord={a.leftTexCoord,a.rightTexCoord,a.topTexCoord,a.bottomTexCoord}
        if useSize then self:SetSize(a.width,a.height)end
    end
    changed(self);return a~=nil
end
C_Texture={GetAtlasInfo=function(name)return __STT_WEB_ATLAS and __STT_WEB_ATLAS[name]end}
function M:GetAtlas()return self.__sttWebUI.atlas end
function CreateColor(r,g,b,a)
    local c={r=r,g=g,b=b,a=a==nil and 1 or a}
    function c:GetRGBA()return self.r,self.g,self.b,self.a end
    function c:GetRGB()return self.r,self.g,self.b end
    return c
end
function M:SetGradient(direction,low,high)
    local gradient={direction=direction,low={low:GetRGBA()},high={high:GetRGBA()}}
    local old=self.__sttWebUI.gradient;local same=old and old.direction==direction
    if same then for i=1,4 do if old.low[i]~=gradient.low[i]or old.high[i]~=gradient.high[i]then same=false;break end end end
    if not same then self.__sttWebUI.gradient=gradient;changed(self)end
end
function M:SetGradientAlpha(direction,r1,g1,b1,a1,r2,g2,b2,a2)self:SetGradient(direction,CreateColor(r1,g1,b1,a1),CreateColor(r2,g2,b2,a2))end
function M:SetVertexOffset(index,x,y)
    local offsets=self.__sttWebUI.vertexOffsets or{};local old=offsets[index]
    if old and old[1]==x and old[2]==y then return end
    offsets[index]={x,y};self.__sttWebUI.vertexOffsets=offsets;changed(self)
end
function M:GetVertexOffset(index)local p=self.__sttWebUI.vertexOffsets and self.__sttWebUI.vertexOffsets[index];return p and p[1]or 0,p and p[2]or 0 end
function M:SetSnapToPixelGrid(v)self.__sttWebUI.snapToPixelGrid=v end
function M:SetTexelSnappingBias(v)self.__sttWebUI.texelSnappingBias=v end
function M:SetDesaturated(v)self.__sttWebUI.desaturated=not not v;changed(self)end
function M:SetDesaturation(v)self.__sttWebUI.desaturation=v;changed(self)end
function M:SetColorTexture(...)
    local next={...};local old=self.__sttWebUI.color
    local same=old and self.__sttWebUI.texture==nil and self.__sttWebUI.atlas==nil and #old==#next
    if same then for i=1,#next do if old[i]~=next[i]then same=false;break end end end
    if same then return end
    self.__sttWebUI.color=next;self.__sttWebUI.texture=nil;self.__sttWebUI.atlas=nil;changed(self)
end
function M:SetDrawLayer(layer,sub)sub=sub or 0;if self.__sttWebUI.layer==layer and self.__sttWebUI.subLayer==sub then return end;self.__sttWebUI.layer,self.__sttWebUI.subLayer=layer,sub;changed(self)end
function M:GetDrawLayer()return self.__sttWebUI.layer,self.__sttWebUI.subLayer end
function M:GetAlpha()return self.__sttWebUI.alpha or 1 end
function M:GetEffectiveAlpha()return self:GetAlpha()*(self.__sttWebUI.parent and self.__sttWebUI.parent:GetEffectiveAlpha()or 1)end
function M:GetFrameLevel()return self.__sttWebUI.frameLevel end
function M:GetFrameStrata()return self.__sttWebUI.frameStrata end
function M:GetEffectiveScale()return (self.__sttWebUI.scale or 1)*(self.__sttWebUI.parent and self.__sttWebUI.parent:GetEffectiveScale()or 1)end
function M:GetScale()return self.__sttWebUI.scale or 1 end
function M:RegisterUnitEvent(event,...)self.__sttWebUI.events[event]={...}end
function M:RegisterEvent(event)self.__sttWebUI.events[event]=true end
function M:UnregisterEvent(event)self.__sttWebUI.events[event]=nil end
function M:UnregisterAllEvents()self.__sttWebUI.events={}end
function M:IsEventRegistered(event)return self.__sttWebUI.events[event]==true end
function M:SetAttribute(k,v)self.__sttWebUI.attributes[k]=v end
function M:GetAttribute(k)return self.__sttWebUI.attributes[k]end
function M:RegisterForDrag(...)self.__sttWebUI.dragButtons={...}end
function M:RegisterForClicks(...)self.__sttWebUI.clickButtons={...}end
function M:IsMouseOver()
    if __STT_WEB_HIT_IDS and __STT_WEB_HIT_REVISION==__STT_WEB_REVISION then return self:IsVisible()and __STT_WEB_HIT_IDS[self.__sttWebUI.id]==true end
    local x,y=GetCursorPosition();return self:IsVisible()and x>=self:GetLeft()and x<=self:GetRight()and y>=self:GetBottom()and y<=self:GetTop()
end
function M:SetVerticalScroll(v)if self.__sttWebUI.scrollY~=v then self.__sttWebUI.scrollY=v;self.__sttWebUI.scrollChild:_InvalidateRelativeLayout();changed(self);self:_Fire('OnVerticalScroll',v)end end
function M:GetVerticalScroll()return self.__sttWebUI.scrollY or 0 end
function M:SetHorizontalScroll(v)if self.__sttWebUI.scrollX~=v then self.__sttWebUI.scrollX=v;self.__sttWebUI.scrollChild:_InvalidateRelativeLayout();changed(self);self:_Fire('OnHorizontalScroll',v)end end
function M:GetHorizontalScroll()return self.__sttWebUI.scrollX or 0 end
function M:SetScrollChild(c)self.__sttWebUI.scrollChild=c;c.__sttWebUI.scrollParent=self;c:SetParent(self);changed(self,true);__STT_WEB_FULL_REFRESH=true end
function M:GetScrollChild()return self.__sttWebUI.scrollChild end
function M:GetVerticalScrollRange()return math.max(0,(self.__sttWebUI.scrollChild and self.__sttWebUI.scrollChild:GetHeight()or 0)-self:GetHeight())end
function M:GetHorizontalScrollRange()return math.max(0,(self.__sttWebUI.scrollChild and self.__sttWebUI.scrollChild:GetWidth()or 0)-self:GetWidth())end
function M:_UpdateThumb()
    local thumb=self.__sttWebUI.ThumbTexture
    if not thumb then return end
    local minimum,maximum=self:GetMinMaxValues()
    local fraction=maximum>minimum and math.max(0,math.min(1,((self.__sttWebUI.value or minimum)-minimum)/(maximum-minimum)))or 0
    thumb:ClearAllPoints()
    if self.__sttWebUI.orientation=='VERTICAL'then thumb:SetPoint('CENTER',self,'BOTTOM',0,(self:GetHeight()-thumb:GetHeight())*fraction+thumb:GetHeight()/2)
    else thumb:SetPoint('CENTER',self,'LEFT',(self:GetWidth()-thumb:GetWidth())*fraction+thumb:GetWidth()/2,0)end
end
function M:SetValue(v,userInput)v=math.max(self.__sttWebUI.minValue or 0,math.min(self.__sttWebUI.maxValue or 1,v));if self.__sttWebUI.value~=v then self.__sttWebUI.value=v;self:_UpdateThumb();changed(self);self:_Fire('OnValueChanged',v,userInput==true)end end
function M:GetValue()return self.__sttWebUI.value or 0 end
function M:SetMinMaxValues(a,b)if self.__sttWebUI.minValue==a and self.__sttWebUI.maxValue==b then return end;self.__sttWebUI.minValue,self.__sttWebUI.maxValue=a,b;self:_UpdateThumb();changed(self)end
function M:GetMinMaxValues()return self.__sttWebUI.minValue or 0,self.__sttWebUI.maxValue or 1 end
function M:SetChecked(v)v=not not v;if self.__sttWebUI.checked==v then return end;self.__sttWebUI.checked=v;changed(self,true)end
function M:GetChecked()return self.__sttWebUI.checked==true end
function M:SetEnabled(v)v=not not v;if self.__sttWebUI.enabled==v then return end;self.__sttWebUI.enabled=v;changed(self,true);self:_Fire(v and 'OnEnable' or 'OnDisable')end
-- Native Enable/Disable do not dispatch through an AddOn override of SetEnabled.
function M:Enable()M.SetEnabled(self,true)end
function M:Disable()M.SetEnabled(self,false)end
function M:IsEnabled()return self.__sttWebUI.enabled~=false end
function M:StartMoving()self.__sttWebUI.moving={GetCursorPosition()};self.__sttWebUI.moveOrigin={self:GetLeft(),self:GetBottom()};__STT_WEB_MOVING_FRAMES[self]=true end
function M:StopMovingOrSizing()self.__sttWebUI.moving=nil;self.__sttWebUI.sizing=nil;__STT_WEB_MOVING_FRAMES[self]=nil end
function M:Raise()
    local level=self:GetFrameLevel()
    for _,frame in ipairs(__STT_WEB_FRAMES)do
        local s=frame.__sttWebUI
        if frame~=self and s.kind~='Texture'and s.kind~='FontString'and s.kind~='MaskTexture'and s.kind~='Font'and frame:IsVisible()and s.frameStrata==self.__sttWebUI.frameStrata then
            local parent=frame
            while parent and parent~=self do parent=parent.__sttWebUI.parent end
            if not parent then level=math.max(level,s.frameLevel+1)end
        end
    end
    M.SetFrameLevel(self,level)
end
function M:Lower()M.SetFrameLevel(self,math.max(0,self.__sttWebUI.frameLevel-1))end
for method,field in pairs({SetTextColor='textColor',SetShadowColor='shadowColor',SetShadowOffset='shadowOffset',SetTexCoord='texCoord',SetVertexColor='vertexColor',SetTextInsets='textInsets',SetHitRectInsets='hitRectInsets',SetBackdropColor='backdropColor',SetBackdropBorderColor='backdropBorderColor',SetNormalFontObject='normalFontObject',SetHighlightFontObject='highlightFontObject',SetDisabledFontObject='disabledFontObject'})do M[method]=function(self,...)local next={...};local old=self.__sttWebUI[field]or{};local same=#old==#next;for i=1,#next do if old[i]~=next[i]then same=false;break end end;if not same then self.__sttWebUI[field]=next;changed(self)end end end
for method,field in pairs({SetAlpha='alpha',SetJustifyH='justifyH',SetJustifyV='justifyV',SetWordWrap='wordWrap',SetNonSpaceWrap='nonSpaceWrap',SetSpacing='spacing',SetRotation='rotation',SetBlendMode='blendMode',SetMultiLine='multiLine',SetAutoFocus='autoFocus',SetMaxLetters='maxLetters',SetCountInvisibleLetters='countInvisible',SetFrameLevel='frameLevel',SetFrameStrata='frameStrata',SetMovable='movable',EnableMouse='mouse',EnableMouseWheel='mouseWheel',EnableKeyboard='keyboard',SetPropagateKeyboardInput='propagateKeyboard',SetPropagateMouseClicks='propagateClicks',SetPropagateMouseMotion='propagateMotion',SetClipsChildren='clipsChildren',SetClampedToScreen='clampedToScreen',SetToplevel='toplevel',SetValueStep='valueStep',SetOrientation='orientation',SetObeyStepOnDrag='obeyStep',SetBackdrop='backdrop',SetScale='scale',SetNumeric='numeric',SetMaxBytes='maxBytes',SetBlinkSpeed='blinkSpeed'})do M[method]=function(self,v)
    if self.__sttWebUI[field]==v then return end
    self.__sttWebUI[field]=v
    local measured=self.__sttWebUI.kind=='FontString'and(method=='SetWordWrap'or method=='SetSpacing')
    if method=='SetScale'or measured then self:_InvalidateRelativeLayout()end
    changed(self,method=='SetAlpha'or method=='SetFrameLevel'or method=='SetFrameStrata'or method=='SetScale'or method=='SetClipsChildren')
    if method=='SetOrientation'then self:_UpdateThumb()end
end end
-- Raising/releveling a window preserves each descendant's relative level.
-- Otherwise a reopened dialog's mouse surface covers its own controls.
function M:SetFrameLevel(level)
    level=math.max(0,math.min(10000,level))
    local delta=level-self.__sttWebUI.frameLevel
    if delta==0 then return end
    local function shift(frame)
        local s=frame.__sttWebUI;s.frameLevel=math.max(0,math.min(10000,s.frameLevel+delta))
        for _,child in ipairs(s.children)do shift(child)end
    end
    shift(self);changed(self,true)
end
function M:CreateTexture(name,layer,template,sub)local r=create('Texture',name,self);r.__sttWebUI.layer=layer or 'ARTWORK';r.__sttWebUI.subLayer=sub or 0;return r end
function M:CreateMaskTexture(name,layer,template,sub)local r=self:CreateTexture(name,layer,template,sub);r.__sttWebUI.kind='MaskTexture';return r end
function M:AddMaskTexture(mask)self.__sttWebUI.masks=self.__sttWebUI.masks or{};self.__sttWebUI.masks[mask]=true;addDependent(mask,self);changed(self)end
function M:RemoveMaskTexture(mask)if self.__sttWebUI.masks then self.__sttWebUI.masks[mask]=nil;removeDependent(mask,self);changed(self)end end
function M:CreateFontString(name,layer,template)local r=create('FontString',name,self);r.__sttWebUI.layer=layer or 'ARTWORK';if template then r:SetFontObject(template)end;return r end
for _,state in ipairs({'Normal','Highlight','Pushed','Disabled','Checked','DisabledChecked','Thumb'})do
    M['Set'..state..'Texture']=function(self,value,blendMode)
        local key=state..'Texture';if type(value)=='table'then self.__sttWebUI[key]=value else self.__sttWebUI[key]=self.__sttWebUI[key]or self:CreateTexture(nil,state=='Highlight'and 'HIGHLIGHT'or 'ARTWORK');self.__sttWebUI[key]:SetTexture(value);if state~='Thumb'then self.__sttWebUI[key]:SetAllPoints()end end;self.__sttWebUI[key].__sttWebUI.buttonState=state;if state=='Highlight'then self.__sttWebUI[key]:SetBlendMode(blendMode or 'ADD')end;if state=='Thumb'then self:_UpdateThumb()end;changed(self,true)
    end
    M['Get'..state..'Texture']=function(self)return self.__sttWebUI[state..'Texture']end
    M['Set'..state..'Atlas']=function(self,value)self['Set'..state..'Texture'](self,nil);self.__sttWebUI[state..'Texture']:SetAtlas(value)end
end
create=function(kind,name,parent)
    sequence=sequence+1
    local r=setmetatable({__sttWebUI={id=sequence,kind=kind,name=name,parent=parent,shown=true,children={},points={},scripts={},events={},attributes={},_text='',frameLevel=parent and parent.__sttWebUI.frameLevel+1 or 0,frameStrata=parent and parent.__sttWebUI.frameStrata or 'MEDIUM'}}, {__index=M})
    if parent then parent.__sttWebUI.children[#parent.__sttWebUI.children+1]=r end
    if parent then fallbackRelative[r]=parent;addDependent(parent,r)end
    if name then _G[name]=r end
    __STT_WEB_FRAMES[r.__sttWebUI.id]=r;changed(r);return r
end
STANDARD_TEXT_FONT='Interface\\AddOns\\STT\\media\\fonts\\stt_dragonflight_zhcn.ttf'
for _,name in ipairs({'GameFontNormal','GameFontNormalSmall','GameFontNormalLarge','GameFontHighlight','GameFontHighlightSmall','GameFontDisable','GameFontDisableSmall','ChatFontNormal','ChatFontSmall','NumberFontNormal','GameFontHighlightLarge'})do
    local f=create('Font',name,nil);f.__sttWebUI.font={STANDARD_TEXT_FONT,name:find('Small')and 12 or name:find('Large')and 16 or 14,''};f.__sttWebUI.textColor=name:find('Disable')and {.5,.5,.5,1}or name:find('Normal')and {1,.82,0,1}or {1,1,1,1}
end
UIParent=create('Frame','UIParent',nil);UIParent:SetSize(1920,1080)
function CreateFrame(kind,name,parent,template)
    local f=create(kind,name,parent or UIParent);f.template=template;f.__sttWebUI.mouse=kind=='Button'or kind=='CheckButton'or kind=='EditBox'or kind=='Slider'
    if kind=='EditBox'then
        local body=f:CreateFontString(nil,'ARTWORK');body.__sttWebUI.nativeEditOwner=f
        body.__sttWebUI.font={STANDARD_TEXT_FONT,12,''};body.__sttWebUI.wordWrap=true
        f.__sttWebUI.nativeTextRegion=body
    end
    return f
end
function GetScreenWidth()return UIParent:GetWidth()end
function GetScreenHeight()return UIParent:GetHeight()end
function GetPhysicalScreenSize()return GetScreenWidth(),GetScreenHeight()end
function GetCursorPosition()return __STT_WEB_CURSOR_X or 0,__STT_WEB_CURSOR_Y or 0 end
function IsMouseButtonDown(button)
    if button==nil then return __STT_WEB_MOUSE_BUTTON~=nil end
    return __STT_WEB_MOUSE_BUTTON==button
end
function IsShiftKeyDown()return __STT_WEB_SHIFT==true end
function IsControlKeyDown()return __STT_WEB_CTRL==true end
function IsAltKeyDown()return __STT_WEB_ALT==true end
function IsModifierKeyDown()return IsShiftKeyDown()or IsControlKeyDown()or IsAltKeyDown()end
function GetCurrentKeyBoardFocus()return __STT_WEB_FOCUS end
function MouseIsOver(f)return f:IsMouseOver()end
function hooksecurefunc(object,key,fn)
    if type(object)=='string'then fn,key,object=key,object,_G end
    local prior=assert(object[key],'missing hook target');object[key]=function(...)local values=table.pack(prior(...));fn(...);return unpack(values,1,values.n)end
end
PixelUtil={SetSize=function(o,...)o:SetSize(...)end,SetWidth=function(o,...)o:SetWidth(...)end,SetHeight=function(o,...)o:SetHeight(...)end,SetPoint=function(o,...)o:SetPoint(...)end,GetNearestPixelSize=function(v)return v end}
function __STT_WEB_RELAYOUT()
    local full=__STT_WEB_FULL_REFRESH
    for pass=1,8 do
        local resized=false
        local frames={}
        if full then
            for _,f in ipairs(__STT_WEB_FRAMES)do frames[#frames+1]=f end
            full=false
        else
            for f in pairs(__STT_WEB_DIRTY_FRAMES)do frames[#frames+1]=f end
        end
        for _,f in ipairs(frames)do
            if f.__sttWebUI.kind~='FontString'and f.__sttWebUI.kind~='Font'and((f.__sttWebUI.kind~='Texture'and f.__sttWebUI.kind~='MaskTexture')or f.__sttWebUI.scripts.OnSizeChanged)then
                local w,h=f:GetSize()
                if f.__sttWebUI.layoutWidth~=w or f.__sttWebUI.layoutHeight~=h then f.__sttWebUI.layoutWidth,f.__sttWebUI.layoutHeight=w,h;if f.__sttWebUI.scripts.OnSizeChanged then f:_Fire('OnSizeChanged',w,h);resized=true end end
            end
        end
        if not resized then return end
    end
    error('UI layout did not settle')
end
GameTooltip=CreateFrame('GameTooltip','GameTooltip');GameTooltip:SetSize(300,100);GameTooltip:Hide();GameTooltip.__sttWebUI.lines={}
-- GameTooltip normally receives its opaque reading surface from Blizzard XML.
-- Keep the native material names visible to the asset audit; the host still
-- reports the missing original border instead of pretending it was reproduced.
GameTooltip:SetBackdrop({bgFile='Interface\\Tooltips\\UI-Tooltip-Background',edgeFile='Interface\\Tooltips\\UI-Tooltip-Border',edgeSize=14,insets={left=3,right=3,top=3,bottom=3}})
GameTooltip:SetBackdropColor(0,0,0,.94);GameTooltip:SetBackdropBorderColor(.6,.6,.6,1)
GameTooltip.GetOwner=function(self)return self.__sttWebUI.owner end
GameTooltip.ClearLines=function(self)self.__sttWebUI.lines={};self.__sttWebUI._text=''end
GameTooltip.AddLine=function(self,text,r,g,b,wrap)
    text=tostring(text or '')
    self.__sttWebUI.lines[#self.__sttWebUI.lines+1]={text=text,color={r or 1,g or 1,b or 1,1},wrap=wrap}
    self.__sttWebUI._text=self.__sttWebUI._text..(self.__sttWebUI._text~=''and '\n'or '')..text
    local width=0
    for _,line in ipairs(self.__sttWebUI.lines)do local measured=__STT_WEB_MEASURE_TEXT(line.text,STANDARD_TEXT_FONT,12,'',0,false);width=math.max(width,measured)end
    self:SetSize(math.max(self.__sttWebUI.minimumWidth or 0,math.min(480,width+24)),#self.__sttWebUI.lines*16+16)
    changed(self)
end
GameTooltip.AddDoubleLine=function(self,left,right)self:AddLine(tostring(left or '')..'  '..tostring(right or ''))end
GameTooltip.SetText=function(self,text)self:ClearLines();self:AddLine(text)end
GameTooltip.SetMinimumWidth=function(self,w)self.__sttWebUI.minimumWidth=w;self:SetWidth(math.max(w,self:GetWidth()))end
GameTooltip.SetSpellByID=function(self,id)local info=C_Spell.GetSpellInfo(id);self:SetText(info.name);return true end
GameTooltip.SetOwner=function(self,owner,anchor,x,y)
    self.__sttWebUI.owner=owner;self:ClearAllPoints()
    if anchor=='ANCHOR_LEFT'then self:SetPoint('TOPRIGHT',owner,'TOPLEFT',(x or 0)-8,y or 0)
    elseif anchor=='ANCHOR_TOP'then self:SetPoint('BOTTOM',owner,'TOP',x or 0,(y or 0)+8)
    else self:SetPoint('TOPLEFT',owner,'TOPRIGHT',(x or 0)+8,y or 0)end
    self:SetFrameStrata('TOOLTIP');self:SetClampedToScreen(true)
end
__STT_WEB_NS = {}
__STT_WEB_SPELLS = {}
-- Platform metadata replacing GetSpecializationInfoByID, not STT alias rules.
__STT_SPEC_CLASSES = {
    DEATHKNIGHT={250,251,252}, DEMONHUNTER={577,581,1480}, DRUID={102,103,104,105},
    EVOKER={1467,1468,1473}, HUNTER={253,254,255}, MAGE={62,63,64}, MONK={268,269,270},
    PALADIN={65,66,70}, PRIEST={256,257,258}, ROGUE={259,260,261}, SHAMAN={262,263,264},
    WARLOCK={265,266,267}, WARRIOR={71,72,73},
}
GetSpecializationInfoByID = function(id)
    for class, ids in pairs(__STT_SPEC_CLASSES) do
        for _, candidate in ipairs(ids) do if candidate == id then return id, nil, nil, nil, nil, class end end
    end
end
C_ClassColor = {GetClassColor=function(class)
    local colors={DEATHKNIGHT={.77,.12,.23},DEMONHUNTER={.64,.19,.79},DRUID={1,.49,.04},EVOKER={.2,.58,.5},
        HUNTER={.67,.83,.45},MAGE={.25,.78,.92},MONK={0,1,.6},PALADIN={.96,.55,.73},PRIEST={1,1,1},
        ROGUE={1,.96,.41},SHAMAN={0,.44,.87},WARLOCK={.53,.53,.93},WARRIOR={.78,.61,.43}}
    local c=colors[class]; if c then return {r=c[1],g=c[2],b=c[3]} end
end}

function __STT_EDITOR_HOST()
    local T, C, L = unpack(__STT_WEB_NS)
    setmetatable(L, { __index = function(_, key) return key end })
    T.RegisterLocaleOverlay = function(_, locale, loader) if locale == "zhCN" then loader() end end
    T.RegisterColdFile = function(_, loader) loader() end
    T.Assets = T.Assets or { defs = {} }
    T.Assets.defs = T.Assets.defs or {}
    T.Assets.Define = T.Assets.Define or function(_, key, spec)
        if type(key) == "string" and type(spec) == "table" and type(spec.factory) == "function" then
            T.Assets.defs[key] = spec
            if spec.targetTable and spec.targetKey then spec.targetTable[spec.targetKey] = spec.factory() end
            return true
        end
        return false
    end
    T.debug = function(message, ...)
        local rendered=select('#',...)>0 and string.format(message,...)or tostring(message)
        -- Observe the pinned router's existing result without replacing its
        -- handler, matching shortcuts ourselves, or executing them twice.
        if __STT_WEB_KEY_ACTIVE and rendered:match('^%[STT_KEYBOARD_ROUTE%] phase=matched source=editbox ')
            and rendered:find(' key='..__STT_WEB_KEY_NAME..' ',1,true)
            and rendered:find(' consumed=true ',1,true)and rendered:match(' reason=handler_result$')then __STT_WEB_KEY_CONSUMED=true end
        if __STT_WEB_LOG then __STT_WEB_LOG(rendered)end
    end
    T.msg = function(message) __STT_EDITOR_MESSAGE = tostring(message or "") end
    T.LogDebugEvent = function(name,fields) local out={tostring(name)};for _,key in ipairs({'cause','reason','result'})do if fields and fields[key]then out[#out+1]=key..'='..tostring(fields[key])end end;T.debug(table.concat(out,' '))end
    T.Profile = { Peek = function() return C.DB end, GetActiveID = function() return 1 end }
    -- Existing upstream export exposes pure timeline methods without constructing WoW frames.
    T.TestAPI = {}
    T.EnsureAddonDBProfile = function() return C.DB end
    T.GetAddonDBProfile = T.EnsureAddonDBProfile
    C.DB.PlanDocuments = {}
    T.SemanticTimeline = { GetResolveSource = function()
        local current = T.PlanEditorSession and T.PlanEditorSession:GetSnapshot()
        return C.DB.webResolveSource or current and current.scope or "team"
    end }
    local spellInfo
    __STT_WEB_PENDING_SPELLS={}
    local function requestSpell(id)
        id=tonumber(id)
        if id and id>0 and not __STT_WEB_SPELLS[id]then __STT_WEB_PENDING_SPELLS[id]=true end
        return id
    end
    C_Spell = { GetSpellInfo = function(id)
        requestSpell(id)
        if __STT_WEB_SPELLS[tonumber(id)] then return __STT_WEB_SPELLS[tonumber(id)] end
        if not spellInfo then
            spellInfo = {}
            for _, buckets in pairs(T.Data and T.Data.ClassSpells or {}) do
                for _, spells in pairs(buckets) do
                    for sid, entry in pairs(spells) do spellInfo[sid] = { name = entry.name, spellID = sid, iconID = 134400 } end
                end
            end
        end
        local known = spellInfo[tonumber(id)]
        if known then return known end
        -- Keep an event visible while optional browser metadata is loading or unavailable.
        return { name = "技能" .. tostring(id), spellID = tonumber(id), iconID = 134400 }
    end, GetSpellTexture = function(id) requestSpell(id);return __STT_WEB_SPELLS[tonumber(id)] and __STT_WEB_SPELLS[tonumber(id)].iconID or 134400 end }
end

function __STT_EDITOR_AFTER_LOAD()
    local T, C = unpack(__STT_WEB_NS)
    if T.Profile and T.Profile.EnsureBindingForChar then
        local profileID = T.Profile:EnsureBindingForChar()
        local profile = T.Profile:Peek(profileID)
        if profile then
            C.DB = profile
            C.DB.PlanDocuments = type(C.DB.PlanDocuments) == "table" and C.DB.PlanDocuments or {}
        end
    end
end
