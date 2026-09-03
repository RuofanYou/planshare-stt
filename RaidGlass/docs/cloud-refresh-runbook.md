# Cloudflare 云刷新运行手册

所有命令从 `RaidGlass/edge` 或 `RaidGlass/frontend` 执行。配置权威是 `edge/wrangler.jsonc`、`edge/migrations/` 和 `frontend/wrangler.jsonc`。

## 1. 零付费边界

本项目只使用 Workers Free 可用的 D1、Queue、SQLite Durable Object、Cron 和 Pages。禁止开启付费订阅。免费日额度耗尽后 Cloudflare 会拒绝后续操作，旧排行继续保留，次日额度重置后再恢复刷新。

按每天四轮估算：Queue 约 1128 ops/日，D1 刷新约 7480 行读写/日；均明显低于免费额度。

## 2. 本地门禁

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

## 3. 只读盘点

```bash
cd RaidGlass/edge
npx wrangler whoami
npx wrangler d1 list
npx wrangler queues list
npx wrangler deployments list --name raidglass-refresh
npx wrangler deployments list --name raidglass-refresh-preview

cd ../frontend
npx wrangler deployments list --name raidglass-web
npx wrangler deployments list --name raidglass-web-preview
```

固定资源：

| 环境 | Refresh Worker | Web Worker | D1 | Queue | Cron |
|---|---|---|---|---|---|
| Production | `raidglass-refresh` | `raidglass-web` | `raidglass-data` | `raidglass-refresh` | `0 */6 * * *` |
| Preview | `raidglass-refresh-preview` | `raidglass-web-preview` | `raidglass-data-preview` | `raidglass-refresh-preview` | 默认空 |

资源存在时直接复用。数据库结构只通过迁移应用：

```bash
cd RaidGlass/edge
npm run migrate:preview
npm run migrate:production
```

Durable Object 由严格 `wrangler deploy` 按 `exports` 配置创建和升级。

### 阵容缺口一次性种子

若公开上游仍缺少 `lura` 或 `rotmire`，先从仓库保留的 WCL 原始证据生成 SQL。脚本只填补没有排行的行，不能覆盖已经恢复的云端排行：

```bash
cd RaidGlass/edge
SEED_SQL="${TMPDIR:-/tmp}/raidglass-reference-comp-seed-$(uuidgen).sql"
node scripts/reference-comp-seed.mjs --output "$SEED_SQL"
npx wrangler d1 execute RANKING_DB --remote --env preview --file "$SEED_SQL" --config wrangler.jsonc
mv "$SEED_SQL" "$HOME/.Trash/raidglass-reference-comp-seed-$(date +%Y%m%d-%H%M%S).sql"
```

Production 使用同一份已审查源码重新生成 SQL，去掉 `--env preview` 后执行。种子行必须显示 `refresh_status=stale`、`last_error_code=reference_seed_only`；下一轮真实刷新会写入当前上游错误码，并保留历史排行。

## 4. Preview

在同一个受控终端会话生成并保留临时 shell 变量，禁止打印：

```bash
cd RaidGlass/edge
PREVIEW_RETRY_TOKEN="$(openssl rand -base64 48 | tr -d '\n')"
jq -nc --arg token "$PREVIEW_RETRY_TOKEN" '{RETRY_TOKEN:$token}' \
  | npx wrangler secret bulk --env preview --config wrangler.jsonc
npm run deploy:preview
```

确认部署后的 Preview Worker `/health` 返回 `ok=true`。永久 Cron 必须为空。真实刷新验收时临时启用一分钟 Cron：

```bash
npm run cron:preview:minute
```

一旦全局状态出现 `active_run_id`，立即清空 Preview Cron：

```bash
npm run cron:disable:preview
```

查看状态：

```bash
npx wrangler d1 execute RANKING_DB --remote --env preview \
  --command "SELECT payload_json FROM global_status WHERE singleton = 1" \
  --config wrangler.jsonc
npx wrangler queues info raidglass-refresh-preview
```

完整门槛：`expected_count=1683`、`available_count=1683`、`spec_available=1674`、`comp_available=9`、`unchecked_count=0`、无重叠 run。合法 `reports=[]` 仍算可用，但必须在页面显示暂无数据；请求失败、404、错误 JSON 和身份不匹配不能转换为空结果。随后抽查治疗、坦克、近战、远程和三个指标，并演练复用、局部失败、首次缺数据、手动 retry 和重复 run。

构建候选并部署 Preview Web Worker：

```bash
cd ../frontend
CACHE_ROOT="$HOME/.codex/cache/raidglass"
RAIDGLASS_CACHE_ROOT="$CACHE_ROOT" npm run build:candidate
RELEASE_ID="<candidate-release-id>"
CANDIDATE="$CACHE_ROOT/site-publish/releases/$RELEASE_ID"

RAIDGLASS_PUBLIC_DIR="$CANDIDATE/public" \
RAIDGLASS_BUILD_DIR="$CANDIDATE/build" \
npm run verify:artifact

RAIDGLASS_BUILD_DIR="$CANDIDATE/build" npm run deploy:preview
```

在真实 Preview 完成桌面和 430px 流程：选择目标、切换难度、时间轴拖动与缩放、筛选、复制、WCL 链接、阵容搜索和 URL 刷新恢复。

## 5. Production

生成独立 secret 并部署 Refresh Worker：

```bash
cd RaidGlass/edge
PRODUCTION_RETRY_TOKEN="$(openssl rand -base64 48 | tr -d '\n')"
jq -nc --arg token "$PRODUCTION_RETRY_TOKEN" '{RETRY_TOKEN:$token}' \
  | npx wrangler secret bulk --env="" --config wrangler.jsonc
npm run deploy:production
```

确认 Production Cron 为 `0 */6 * * *`。首轮 D1 达到 `1683/1683` 前，PlanShare `/log` 网关保持未启用。

首轮完成后，使用 Preview 已验收的同一候选 build 部署 Production Web Worker，再部署 PlanShare Pages 网关。`frontend/wrangler.jsonc` 是 Web Worker、静态资源和 Production/Preview D1 绑定的配置权威。

```bash
cd RaidGlass/frontend
RAIDGLASS_BUILD_DIR="$CANDIDATE/build" npm run deploy:production

cd ../..
npm run deploy:pages
```

立即核对 `/log/snapshot-manifest.json`、`/log/api/health`、`/log/api/admin/refresh-state`、四类角色样本、阵容样本、桌面和 430px 关键流程。

## 6. 连续周期验收

Production 切换后观察连续 3 个完整六小时周期，累计至少 18 小时。每轮记录：

- run ID、开始和完成时间。
- 1683/1683、1674/1674、9/9。
- fresh/stale/unchecked。
- Queue backlog、重试和身份错误。
- `/log/api/health` 与一个专精、一个阵容样本。

任一轮未达到 1683 可用、发生重叠、出现异常积压、身份错误或数据丢失，连续计数清零。已记录且可复现的公开上游缺口可保持 `stale`，其错误码和旧排行必须连续一致。三轮通过后，云链成为生产动态数据权威，才进入本地 automation、旧 cache 和临时 worktree 清理。

## 7. 回滚

```bash
cd RaidGlass/edge
npm run cron:disable:production
```

随后将 `raidglass-web` 回滚到上一份已验证版本，Refresh Worker 重部署上一份已验证源码。保留 Durable Object namespace 和 D1 数据。确认数据污染时才使用 D1 Time Travel，回滚完成后重新执行线上关键流程。

官方依据：[D1 bindings](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)、[Queues batching and retries](https://developers.cloudflare.com/queues/configuration/batching-retries/)。
