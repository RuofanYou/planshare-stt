# STT 网页编辑器（本地）

在 PlanShare 执行 `npm run dev`，打开 `http://localhost:5173/editor`。

网页只读加载固定版本的 STT Lua。当前基线是 `cd55ba805c0d98b0261418751b5b70ce8db75cd9`，97 个 Lua 文件的合并摘要为 `55d75ec14957`；在本仓从该 Git 版本同步，在独立的 PlanShare 检出中使用已提交的同版资产。切换基线后重新运行同步与检查。Atlas 切片来自本地 Retail `12.1.0.69875`，映射文件 SHA-256 为 `b699ad97304714e3fb991f359a22f596befe0dc49e8aeafe8478915a8e364698`；STT 字体 SHA-256 为 `f7cf7e9da575fc0dff09ab136d0963aa677d8157c80da9bac24ecf053087a144`。`/editor` 由原 Lua 创建 Frame 树，React 负责浏览器事件、存草稿、复制和导出。

- `npm run sync:stt-editor` 同步所需 Lua、官方插件字体和控件图片；Atlas 切片图来自 Retail `12.1.0.69875` 的 `UiTextureAtlas` 系列表。
- `npm run check:stt-editor` 检查 Lua 摘要、Atlas 数据与本地图片，并确认 Boss 参考轴函数在加载后未被网站覆盖。
- `npm run test:editor` 运行 Lua 宿主、WCL 接口和默认 `/editor` 的 Playwright 流程。
- `npm run build:editor` 构建本地前端，不发布网站。

浏览器本机保存方案正文与所需上下文。清除站点数据会清除草稿，重要文本请先复制或导出。WCL 使用本地 Fastify 路由及 `.env.local` 凭据，不将凭据送进浏览器。技能名称/图标元数据可缺省，STT Lua 仍保存实际方案文本。

宿主实现编辑器调用到的 WoW Frame、FontString、Texture、输入焦点、计时器、锚点和事件。原 Lua 仍决定控件、布局、选择、拖动和文本修改。网页已验证默认参考轴、双击弹窗、单个及多个事件拖动、撤销重做、滑块纹理与分隔线拖动；技能抽屉按可见条目请求图标元数据。当前游戏安装包含此基线之外的改动，因此不能以当前安装界面作为此版最终对照。浏览器内尚有游戏原生材质缺口：`UI-StatusBar` 使用 CSS 近似绘制，`common-dropdown-c-button-arrow-down` 使用 CSS 箭头，Tooltip Backdrop 边框尚非原始纹理；这些区域的视觉复刻仍未验收。真实 WCL 报告查询也未完成，仅固定响应与错误路径通过。
