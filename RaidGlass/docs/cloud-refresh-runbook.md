# Cloudflare 云刷新运行手册

所有命令从 `RaidGlass/edge` 或 `RaidGlass/frontend` 执行。配置权威是 `edge/wrangler.jsonc`、`edge/migrations/` 和 `frontend/wrangler.jsonc`。

## 1. 零付费边界

本项目只使用 Workers Free 可用的 D1、Queue、SQLite Durable Object、Cron 和 Pages。禁止开启付费订阅。免费日额度耗尽后 Cloudflare 会拒绝后续操作，旧排行继续保留，次日额度重置后再恢复刷新。

基础排行按每天四轮估算（不含主动技能缓存）：Queue 约 1128 ops/日，D1 刷新约 7480 行读写/日；均明显低于免费额度。

奶萨 HPS 的自然迅捷与先祖迅捷由 Refresh Worker 使用 WCL 公共 API 补采；账户小时用量达到 WCL 额度的 10% 后停止后续补采（单次请求可能跨过阈值）。Production 需要 `WCL_CLIENT_ID` 与 `WCL_CLIENT_SECRET` 两个 Secret，缺失或补采失败时继续发布原排行。

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
| Production | `raidglass-refresh` | `raidglass-web` | `raidglass-data` | `raidglass-refresh` | `0 * * * *` |
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

需要在 Preview 验证真实 WCL 补采时，另行用 `wrangler secret put --env preview` 写入 `WCL_CLIENT_ID` 与 `WCL_CLIENT_SECRET`，不要把值写入仓库或命令历史。

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

部署前确认 Production 已存在 `RETRY_TOKEN`、`WCL_CLIENT_ID`、`WCL_CLIENT_SECRET`；只检查名称，不读取或打印值。

确认 Production 只有一条每小时 Cron `0 * * * *`：UTC 0、6、12、18 点刷新排行，其余整点补采技能。首轮 D1 达到 `1683/1683` 前，PlanShare `/log` 网关保持未启用。

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


## Top10 全主动技能启用门槛

`WCL_ALL_CASTS` 在 Production 开启、Preview 关闭。真实 WCL 查询签名、额度与三角色样本须用线上日志验收；本地 fixture 通过不能代替线上结果。

1. 在受信任的测试环境配置 `WCL_CLIENT_ID`、`WCL_CLIENT_SECRET`。Production Secrets 不能读取回来；禁止打印密钥。
2. 保存现有公开排行 API 的三个 JSON，分别选输出、治疗、坦克，各文件第一个报告必须有可访问的玩家样本。执行：
   ```sh
   node scripts/probe-wcl-casts.mjs /tmp/dps-ranking.json /tmp/heal-ranking.json /tmp/tank-ranking.json > /tmp/raidglass-wcl-probe.json
   ```
   脚本只读 WCL，不写云端数据；输出原始事件页、相对施法时间、点数差、事件数和缓存字节。核对玩家归属与时间轴，账户点数差可能包含其他应用同期消耗。缺凭据、分页异常、身份错误或额度达到阈值均停止。
3. Production 已应用 `0002_wcl_samples.sql` 并启用补采后，按现有发布流程检查缓存复用、失败退避与实际技能交互。每页后检查账户点数；浏览、搜索、勾选不应产生 WCL 查询。
4. 每小时 Cron 在 UTC 0、6、12、18 点执行原有完整刷新，其余整点从已存排行投递最多 300 个未完成目标；两条路径的每条 Queue 消息最多 8 个目标，补采不请求 Lorrgs 排行。两条路径共用 WCL 10% 小时额度，额度暂停时停止本轮。回退时关闭 Production 变量并回滚 Worker，保留缓存表。

遇到玩家指出的单个排行缺少关键技能时，运维可用独立的 `CASTS_ADMIN_TOKEN` 调用 Production Refresh Worker 的 `POST /admin/backfill-casts`，JSON 为 `{"target_key":"spec/<boss>/<spec>/<difficulty>/<metric>"}`。每次仅补当前 Top10 的一页，复用 WCL 10% 小时额度与 D1 样本缓存；按返回的 `skill_completion` 逐页核对，额度暂停时停止。此入口不供前端调用，令牌只存 Cloudflare Secret；令牌不可读取，遗失时通过 `wrangler secret put` 轮换。

D1 Free 每账户每日行写入额度耗尽时，整轮刷新会跳过，补采会在查询 WCL 前停止；UTC 00:00 额度重置后再续采。已登记样本不会因排行刷新重写 `last_seen`，避免重复消耗行写入额度。

WCL 单份报告的 GraphQL 权限或查询错误只让对应样本退避；其余上游故障触发账户级短暂停止，避免一份私有报告拖住其他目标。
