# PlanShare 开发约定

## 项目定位
- PlanShare 是独立网页平台，不是 WoW AddOn。
- 当前主要用于 STT 战术板展示与分享，后续可扩展为模板、工具、小游戏或个人作品集合。
- 本目录内开发时，优先遵守本文件；仓库根目录的通用 KISS/SSOT/DRY/SOLID 与禁止 `rm` 仍然有效。
- 本目录允许 Codex 对 PlanShare 范围内的改动全自动执行 `git commit`，无需每次单独确认；不要把 PlanShare 之外的无关改动一起提交。

## 技术栈
- 前端：React + Vite + TypeScript。
- 后端业务权威：`server/index.mjs`（Fastify + SQLite）。
- `worker/index.js` 是 Cloudflare D1 移植版，只有做双后端契约对齐时才改；常规业务先改 Fastify 主线。
- 后端/API 托管：Cloudflare Worker `planshare-api` + D1 `planshare`。
- 前端托管：Cloudflare Pages `zhaobanzi`。

## 前端审美与设计系统
- `DESIGN.md` 是 PlanShare 前端审美与组件设计的单一真相来源，改页面、组件、配色、动效、布局前必须先读。
- 视觉方向必须对齐 `DESIGN.md`：2026 暗色液态玻璃、暖黑基底、魔兽金、砖红 CTA、现代史诗奇幻氛围。
- 颜色、字号、圆角、玻璃 blur、阴影、动效优先使用 `src/styles/tokens.css` 与 `src/styles/tailwind.css` 里的令牌；不要在组件里随手硬编码 hex、rgba、blur、阴影数值。
- 新页面或大改版要保持“真实可用体验优先”，不要做营销落地页；战术板复制、浏览、筛选、作者展示等核心路径优先。

## 线上资源
- 主分享地址：https://zhaobanzi.pages.dev
- 历史 CloudBase 环境 ID：`planshare-d4gi9p3web9f2c235`（当前不作为生产部署目标）
- Cloudflare Worker API 源站：`https://planshare-api.a549617612.workers.dev`
- Cloudflare Pages 的 `public/_worker.js` 会把 `/api/*` 代理到 Worker API。
- 不再使用 `planshare-now.pages.dev`；Cloudflare Pages 里旧项目已删除。

## 开发与构建
- 本地开发优先读 `package.json` 脚本。
- 常用本地命令：
  ```sh
  npm run dev
  npm run build
  npm run test
  npm run test:e2e
  npm run verify
  npm run serve
  ```
- 前端静态构建使用：
  ```sh
  npm run build
  ```
- SPA 直链依赖 `public/_redirects`，不要删除；它用于让 `/board/:id` 等路径回落到 `index.html`。
- `src/api/client.ts` 是前端 API 源站配置的单一入口；Cloudflare Pages 生产默认走相对路径 `/api/*`，由 `public/_worker.js` 代理到 Worker。

## 部署
- 当前线上形态：
  - 前端静态站：Cloudflare Pages，项目名 `zhaobanzi`，域名 `https://zhaobanzi.pages.dev`
  - 后端/API：Cloudflare Worker `planshare-api`
  - 数据库：Cloudflare D1 `planshare`
- 部署顺序：先 D1 迁移，再 Worker API，再 Pages：
  ```sh
  npx wrangler d1 migrations apply planshare --remote
  npx wrangler deploy
  npm run build
  npx wrangler pages deploy dist --project-name zhaobanzi --branch main --commit-dirty=true --skip-caching
  ```
- Cloudflare 相关 CLI：
  ```sh
  npx wrangler login
  npx wrangler pages project list
  npx wrangler pages deployment list --project-name zhaobanzi
  ```
- Cloudflare 部署 API 偶尔会 `fetch failed`，通常重试即可；不要因此改业务代码。
- 腾讯 CloudBase 是历史/备用部署链路；当前生产部署不要走 `tcb`，除非用户明确要求恢复 CloudBase。
- Cloudflare Worker 是当前生产 API 后端；改 `worker/index.js` 或 D1 schema 后必须用 wrangler 部署并验证。
- 验证公网前端和 API：
  ```sh
  curl -L https://zhaobanzi.pages.dev/
  curl -L https://zhaobanzi.pages.dev/api/raids
  curl -L https://planshare-api.a549617612.workers.dev/api/raids
  ```

## 禁止误套 WoW 插件流程
- 不要执行 `Tools/deploySTT.sh`、`Tools/deployADT.sh`、`Tools/deploySSS.sh`。
- 不要按 Lua/AddOn、本地化或 TOC 版本规则处理 PlanShare。
- 不要为了 PlanShare 改动正式服 AddOns 目录。

## 运营约束
- 现阶段主目标是快速分享和低成本验证，不做过度工程化。
- Cloudflare 免费额度仍需关注 Worker/D1 调用量与写入量。
- 如果后续要求大陆生产级直连且无风险提示，主线仍是：购买域名 -> ICP 备案 -> 绑定腾讯 CloudBase 或 EdgeOne。
