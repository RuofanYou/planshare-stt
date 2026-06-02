# PlanShare 部署说明

## 形态
单进程生产版：Fastify 一个 Node 进程同时托管前端构建产物 `dist/` 与 `/api/*`，数据存 SQLite（`server/planshare.db`）。前后端同源，无需 CORS/代理。

## 环境变量
| 变量 | 作用 | 缺省 |
|---|---|---|
| `ADMIN_PASSWORD` | 后台 `/admin` 登录密码 | `planshare-admin`（**上线必须改**） |
| `PORT` | 监听端口 | `3001` |
| `HOST` | 绑定地址 | `127.0.0.1`（容器/服务器用 `0.0.0.0`） |
| `CORS_ORIGINS` | 额外允许调用 API 的前端来源，英文逗号分隔 | 默认允许 `https://zhaobanzi.pages.dev` 与本地开发地址 |
| `DATABASE_PATH` | SQLite 数据库文件路径 | `server/planshare.db`；CloudRun 持久卷建议 `/data/planshare.db` |

本地可不设 `ADMIN_PASSWORD`，默认只用于 `127.0.0.1` 开发。托管平台必须在环境变量里设专用强密码；公网绑定时如果未设置或仍用默认值，服务会拒绝启动。

## 本地生产运行
```bash
npm ci
npm run build      # 产出 dist/
npm run serve      # node --env-file=.env server/index.mjs，访问 http://localhost:8080
```

## 临时公网分享（当前用的方式）
从本机起隧道，拿到 `*.trycloudflare.com` 的 HTTPS 链接：
```bash
cloudflared tunnel --url http://localhost:8080
```
⚠️ 这是把**你这台 Mac**对外，Mac 休眠/关机/断网即失效；链接每次重启会变。仅适合先发出去验证，不是 24/7 托管。

## 永久 24/7 托管（二选一）
### A. 小 VPS（推荐，不依赖 git）
1. 服务器装 Node 22；把项目传上去（scp / rsync）。
2. `npm ci && npm run build`。
3. 用 pm2 或 systemd 常驻：`ADMIN_PASSWORD=你的强密码 PORT=8080 HOST=0.0.0.0 node server/index.mjs`。
4. 前面套 Caddy（自动 HTTPS）或 Cloudflare 反代到 8080。
5. `server/planshare.db` 放持久磁盘 + 定时备份（`cp planshare.db 备份/…`）。

### B. PaaS + Docker（Railway / Render / Fly）
用根目录 `Dockerfile`；在平台设 `ADMIN_PASSWORD`，**给 SQLite 挂持久卷**（否则重启丢数据），平台注入 `PORT`，`HOST=0.0.0.0`。

## SQLite 持久化
后端跑在腾讯 CloudBase，不等于容器内文件天然永久保存。SQLite 是一个文件，必须写到持久卷目录里。

推荐配置：
- CloudBase Run 使用低成本模式：`0.25C/0.5GB`、`minNum=0`、`maxNum=1`。
- CloudRun 挂 CFS 持久卷到容器目录 `/data`。
- CloudRun 环境变量增加 `DATABASE_PATH=/data/planshare.db`。
- `cloudbaserc.json` 已声明挂载：`/data -> planshare-data`。
- `ADMIN_PASSWORD` 不写入仓库；远端数据导出/导入脚本会从现有 CloudRun 服务读取后用于管理员登录。
- 本地 CloudBase CLI 暂不支持创建 `framework.requirement.addons`；CFS addon `planshare-data` 需要在 CloudBase 控制台创建一次，之后 CLI 只负责部署绑定。

当前代码默认仍写 `server/planshare.db`，这样本地开发不受影响；只有设置了 `DATABASE_PATH` 才切到持久卷。

首次切换持久化时：
```bash
npm run cloudrun:persistent:preflight
npm run remote:export
# 在 CloudBase 控制台创建 CFS addon：planshare-data，并挂载到 /data
# 在 CloudBase Run 环境变量设置 DATABASE_PATH=/data/planshare.db
# CloudBase Run 规格调整为 0.25C/0.5GB、minNum=0、maxNum=1
npm run remote:import
```

确认持久化生效后，后续后端部署只需要发代码，不再每次导出/导入数据库；`remote:export` 保留为人工备份。

## 已内置的基础安全措施
- CORS 白名单：默认只允许 `https://zhaobanzi.pages.dev`、`http://localhost:5173`、`http://127.0.0.1:5173` 调用 API；需要新增域名时用 `CORS_ORIGINS`。
- 后台登录限流：同一客户端 15 分钟内最多尝试 5 次，超出返回 429。
- 点赞限流：同一客户端每分钟最多 60 次点赞，同一块板每分钟最多 5 次点赞。
- 浏览计数去重：同一客户端同一块板 10 分钟内只增加 1 次浏览量，降低刷接口导致的 SQLite 写入压力。
- Cloudflare Pages 安全头：`public/_headers` 设置 CSP、禁止 iframe 嵌入、禁用常见浏览器权限。

## 上线前清单
- [ ] `ADMIN_PASSWORD` 改成专用强密码（至少 20 位随机字符串，别用个人常用密码）。
- [ ] SQLite 在持久磁盘 + 备份；CloudRun 建议挂 CFS 到 `/data` 并设置 `DATABASE_PATH=/data/planshare.db`。
- [ ] HTTPS（一键复制依赖安全上下文，非 HTTPS 会失效）。
- [ ] 海外/香港托管先免备案验证；转大陆服务器再办 ICP。
