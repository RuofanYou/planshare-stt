# PlanShare 部署说明

## 形态
单进程生产版：Fastify 一个 Node 进程同时托管前端构建产物 `dist/` 与 `/api/*`，数据存 SQLite（`server/planshare.db`）。前后端同源，无需 CORS/代理。

## 环境变量
| 变量 | 作用 | 缺省 |
|---|---|---|
| `ADMIN_PASSWORD` | 后台 `/admin` 登录密码 | `planshare-admin`（**上线必须改**） |
| `PORT` | 监听端口 | `3001` |
| `HOST` | 绑定地址 | `127.0.0.1`（容器/服务器用 `0.0.0.0`） |

本地用 `.env`（已 gitignore，含 `ADMIN_PASSWORD=rofan980218`）；托管平台请在其环境变量里设同名值，别公开 `.env`。

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

## 上线前清单
- [ ] `ADMIN_PASSWORD` 改成专用强密码（别用个人常用密码）。
- [ ] SQLite 在持久磁盘 + 备份。
- [ ] HTTPS（一键复制依赖安全上下文，非 HTTPS 会失效）。
- [ ] 海外/香港托管先免备案验证；转大陆服务器再办 ICP。
