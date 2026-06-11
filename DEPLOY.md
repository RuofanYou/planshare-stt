# PlanShare 部署说明

## 形态
当前公网生产链路在 Cloudflare：
- 前端静态站：Cloudflare Pages，项目名 `zhaobanzi`，域名 `https://zhaobanzi.pages.dev`。
- API 后端：Cloudflare Worker `planshare-api`，数据存 Cloudflare D1 数据库 `planshare`。
- Pages 内置 `public/_worker.js` 会把 `/api/*` 代理到 `https://planshare-api.a549617612.workers.dev`，前端代码默认仍用相对路径 `/api/*`。

本地主线后端仍是 `server/index.mjs`（Fastify + SQLite），用于本地开发和完整测试；`worker/index.js` / `worker/schema.sql` 是 Cloudflare 生产后端实现，部署前必须保持与 Fastify 的核心接口契约一致。

## 环境变量
| 变量 | 作用 | 缺省 |
|---|---|---|
| `ADMIN_PASSWORD` | 后台 `/admin` 登录密码 | `planshare-admin`（**上线必须改**） |
| `PORT` | 监听端口 | `3001` |
| `HOST` | 绑定地址 | `127.0.0.1`（容器/服务器用 `0.0.0.0`） |
| `CORS_ORIGINS` | 额外允许调用 API 的前端来源，英文逗号分隔 | 默认允许 `https://zhaobanzi.pages.dev` 与本地开发地址 |
| `DATABASE_PATH` | 本地 / Fastify SQLite 数据库文件路径 | `server/planshare.db` |

本地可不设 `ADMIN_PASSWORD`，默认只用于 `127.0.0.1` 开发。托管平台必须在环境变量里设专用强密码；公网绑定时如果未设置或仍用默认值，服务会拒绝启动。

创作者登录使用站内用户名 + 密码，不依赖邮箱验证、邮件发送、SMTP、Resend、Mailjet、微信或 QQ 登录。忘记密码由管理员人工重置。

## 本地生产运行
```bash
npm ci
npm run build      # 产出 dist/
npm run serve      # node --env-file=.env server/index.mjs，访问 http://localhost:8080
```

## 临时公网分享
从本机起隧道，拿到 `*.trycloudflare.com` 的 HTTPS 链接：
```bash
cloudflared tunnel --url http://localhost:8080
```
⚠️ 这是把**你这台 Mac**对外，Mac 休眠/关机/断网即失效；链接每次重启会变。仅适合先发出去验证，不是 24/7 托管。

## 永久 24/7 托管
当前推荐和实际使用的是 Cloudflare Pages + Worker + D1。

### Cloudflare 生产部署
1. 部署 D1 迁移：
   ```bash
   npx wrangler d1 migrations apply planshare --remote
   ```
2. 部署 Worker API：
   ```bash
   npx wrangler deploy
   ```
3. 构建并部署 Pages：
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name zhaobanzi --branch main --commit-dirty=true --skip-caching
   ```
4. 验证：
   ```bash
   curl -L https://zhaobanzi.pages.dev/
   curl -L https://zhaobanzi.pages.dev/api/raids
   curl -L https://planshare-api.a549617612.workers.dev/api/raids
   ```

上线前必须确认 Worker 已配置 `ADMIN_PASSWORD` secret，且 D1 迁移已应用。

## 备用托管方案
### A. 小 VPS（推荐，不依赖 git）
1. 服务器装 Node 22；把项目传上去（scp / rsync）。
2. `npm ci && npm run build`。
3. 用 pm2 或 systemd 常驻：`ADMIN_PASSWORD=你的强密码 PORT=8080 HOST=0.0.0.0 node server/index.mjs`。
4. 前面套 Caddy（自动 HTTPS）或 Cloudflare 反代到 8080。
5. `server/planshare.db` 放持久磁盘 + 定时备份（`cp planshare.db 备份/…`）。

### B. PaaS + Docker（Railway / Render / Fly）
用根目录 `Dockerfile`；在平台设 `ADMIN_PASSWORD`，**给 SQLite 挂持久卷**（否则重启丢数据），平台注入 `PORT`，`HOST=0.0.0.0`。

## SQLite 持久化（仅 Fastify / 备用托管）
Fastify 备用部署使用 SQLite 文件；如果部署到容器或 VPS，必须写到持久卷目录里。

当前 Cloudflare 生产不使用 SQLite 文件，生产数据在 D1。

## 已内置的基础安全措施
- CORS 白名单：默认只允许 `https://zhaobanzi.pages.dev`、`http://localhost:5173`、`http://127.0.0.1:5173` 调用 API；需要新增域名时用 `CORS_ORIGINS`。
- 后台与创作者登录限流：同一客户端 15 分钟内最多尝试 5 次，超出返回 429。
- 点赞限流：同一客户端每分钟最多 60 次点赞，同一块板每分钟最多 5 次点赞；限流状态落 SQLite，服务重启不丢窗口。
- 投稿滥用防护：蜜罐字段、归一化黑名单、同 IP 重复正文投稿自动标记为 `spam`。
- 创作者信任等级：新创作者前 3 次发布走审核，通过 3 次后自动进入直发；驳回或 spam 会重置进度。
- 审计日志：管理员审核、板/作者/账号/团本/BOSS/举报处理，以及创作者发布/下架都会写入 `audit_logs`。
- 举报通道：公开板详情页可举报，后台可驳回举报或隐藏对应板；同 IP 每小时最多 5 次举报。
- 浏览计数去重：同一客户端同一块板 10 分钟内只增加 1 次浏览量，降低刷接口导致的 SQLite 写入压力。
- Cloudflare Pages 安全头：`public/_headers` 设置 CSP、禁止 iframe 嵌入、禁用常见浏览器权限。
- 聚合验证：`npm run verify` 会依次执行 TypeScript 构建、Vite 构建、Node API 集成测试和 Playwright 冒烟。

## 上线前清单
- [ ] `ADMIN_PASSWORD` 改成专用强密码（至少 20 位随机字符串，别用个人常用密码）。
- [ ] SQLite 在持久磁盘 + 备份；CloudRun 建议挂 CFS 到 `/data` 并设置 `DATABASE_PATH=/data/planshare.db`。
- [ ] HTTPS（一键复制依赖安全上下文，非 HTTPS 会失效）。
- [ ] 海外/香港托管先免备案验证；转大陆服务器再办 ICP。
