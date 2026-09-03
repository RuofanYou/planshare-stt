# RaidGlass

RaidGlass 是部署在 [zhaobanzi.pages.dev/log](https://zhaobanzi.pages.dev/log/) 的魔兽世界 Top10 时间轴参考站。

生产链保持单一：Cloudflare Cron 每 6 小时触发刷新，Queue 分发 Midnight Season 2 的 1683 个目标（1674 个专精、9 个阵容），SQLite Durable Object 协调单轮状态，D1 保存动态排行，`raidglass-web` 提供静态资源与同源 API，PlanShare Pages 网关承载 `/log/*`。整条链使用 Cloudflare Workers Free 能力；免费额度耗尽时请求会失败并保留旧排行，项目不自动升级付费。

## 单一权威

- 排行矩阵：`contracts/ranking-matrix.mjs`
- 云刷新：`edge/`
- D1 结构：`edge/migrations/`
- Web Worker、API 与前端：`frontend/`
- 静态元数据与图片：`reference/`（与当前 S1 D1 合同一致的固定发布输入）
- 动态排行与刷新状态：Production/Preview 各自独立的 D1 数据库
- 生产源码：整合验收完成后的 `main`

Web 构建不包含动态排行，也没有静态排行回退。回滚使用上一份已验证的 `raidglass-web` Worker 版本；PlanShare Pages 只维护 `/log` 网关绑定。

旧域名只保留 `legacy-wowlogs-redirect/` 的 301 兼容跳转，不再承载应用与数据。

当公开上游暂时缺少某个阵容目标时，`edge/scripts/reference-comp-seed.mjs` 可把仓库内已保留、可追溯的 WCL 原始证据一次性写入空 D1 行。种子始终标记为 `stale/reference_seed_only`，只填补尚无排行的目标；后续公开 GET 恢复后会由正常刷新覆盖。

## 文档

- [生产架构](docs/production-architecture.md)
- [Cloudflare 云刷新运行手册](docs/cloud-refresh-runbook.md)
- [Apple 交互规范](docs/apple-interaction-spec.md)

## 本地门禁

```bash
cd RaidGlass/edge
npm ci
npm test
npm run dry-run:production
npm run dry-run:preview

cd ../frontend
npm ci
npm run typecheck
npm run test:unit
npm run test:node
npm run test:e2e
```

构建并验证隔离发布候选：

```bash
cd RaidGlass/frontend
RAIDGLASS_CACHE_ROOT="$HOME/.codex/cache/raidglass" npm run build:candidate

RAIDGLASS_PUBLIC_DIR="<candidate-public-dir>" \
RAIDGLASS_BUILD_DIR="<candidate-build-dir>" \
npm run verify:artifact
```

## 安全边界

- 上游固定为 `https://api2.lorrgs.io`，只执行公开 GET。
- 只访问专精排行、专精 `/info` 和阵容排行；禁止 `/load`、`/dirty`、WCL OAuth 和远端写请求。
- Production 与 Preview 使用独立 D1、Queue、Worker、Durable Object 和 `RETRY_TOKEN`。
- Token、本机绝对路径和发布凭据不得写入源码、构建、日志或回执。
- Production 发布必须经过本地完整门禁，并将同一候选 build 依次部署到 `raidglass-web-preview` 与 `raidglass-web`。
