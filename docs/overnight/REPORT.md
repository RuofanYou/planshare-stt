# PlanShare UGC Ready Report

## 完成清单
- M0 验证地基：新增 `npm run verify`，聚合 TypeScript、Vite build、Node API 集成测试、Playwright 冒烟。
- M0 API 测试：新增 `server/test-helpers.mjs` 与 `server/ugc-ready.test.mjs`，覆盖公开读接口、筛选、详情、点赞限流、投稿、审核、创作者、举报、团本/BOSS。
- M0 Playwright：新增 `tests/e2e/ugc-smoke.spec.ts`，走通浏览、复制、游客创作者投稿、管理员审核、公开板、创作者直发。
- M1 信任等级：`creator_accounts` 增 `trust_level`、`approved_submission_count`，新创作者 3 次通过后自动 trusted，驳回/spam 重置，旧库迁移默认 trusted。
- M2 滥用防护：限流持久化到 SQLite，黑名单归一化匹配，重复正文 spam，投稿蜜罐字段，审计日志。
- M3 举报通道：详情页举报入口、`reports` 表、后台举报队列、隐藏板/驳回举报、举报限流。
- M4 团本/BOSS 管理：后台新增团本与 BOSS，删除前检查关联板/投稿/BOSS。
- M5 审核效率与拆分：`Admin.tsx` 从 2242 行降到 1593 行，投稿审核、举报队列、团本/BOSS 管理拆到 `src/pages/admin/*`；审核队列新增待审角标、全选待审、批量驳回、批量标记垃圾。
- M6 双后端契约对齐：`worker/schema.sql` 同步 `trust_level`、`approved_submission_count`、`rate_limits`、`audit_logs`、`reports`；`worker/index.js` 同步信任等级、举报、审计、团本/BOSS 管理与核心 worker 响应结构；新增 `server/worker-contract.test.mjs` 对 Fastify 与 wrangler dev --local 做核心读接口契约测试。
- 普通用户防呆补测：修正创作者后台过早开放直发入口的问题；审核期只显示“还需 N 次审核通过”，第三次通过后才显示“我的战术板”和“直接发布”。补测空表单、缺密码、非法用户名、重复用户名、三次审核晋升和直发。
- 文档：更新 `AGENTS.md`、`DEPLOY.md`，新增本报告与续接文档。

## Blocked / 未完成
- 无。

## 验证证据
```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

vite v5.4.21 building for production...
✓ 566 modules transformed.
✓ built in 11.47s

1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (18.9s)
1 passed (26.2s)
```

### M5 验证
```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 7.31s

1..38
# tests 38
# pass 38
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (30.0s)
1 passed (35.6s)
```

### M6 验证
```text
npx wrangler d1 execute planshare --local --persist-to /tmp/planshare-worker-schema-*/ --file worker/schema.sql
🚣 17 commands executed successfully.

npx wrangler d1 execute planshare --local --persist-to /tmp/planshare-worker-schema-*/ --file worker/seed.sql
🚣 31 commands executed successfully.

node --test --test-concurrency=1 server/worker-contract.test.mjs
ok 1 - Fastify and Worker core read APIs keep the same HTTP response structure
1..1
# tests 1
# pass 1
# fail 0
```

### 最终验证
```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 5.20s

1..39
# tests 39
# suites 0
# pass 39
# fail 0
# cancelled 0
# skipped 0
# todo 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (4.5s)
1 passed (6.3s)
```

### 普通用户防呆补测验证
```text
> planshare@0.1.0 test:e2e
> playwright test

Running 2 tests using 1 worker
··
  2 passed (9.8s)
```

```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.15s

1..39
# tests 39
# suites 0
# pass 39
# fail 0
# cancelled 0
# skipped 0
# todo 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (14.1s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:118:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (7.3s)
2 passed (25.0s)
```

```text
in-app browser:
/creator 显示创作者登录页，无 Application error。
/submit 显示投稿入口和申请创作者选项，空表单提交按钮禁用，无 Application error。
```

## 高风险 diff
- `server/index.mjs`：新增多张表和大量路由，需人工重点审查迁移、审核晋升和审计写入。
- `src/pages/Admin.tsx` 与 `src/pages/admin/*`：后台拆分和批量审核涉及管理台核心操作，需人工重点点验审核队列。
- `playwright.config.ts`：使用 `localhost:5183` 和 `/tmp` 临时 SQLite，避免本机端口与生产数据冲突。
- `src/pages/Creator.tsx`：直发入口现在同时依赖作者已通过和账号信任等级 trusted，避免新创作者审核期误以为能直接发布。
- `worker/index.js`：D1 移植版同步了 Fastify 的 UGC 字段与核心治理端点；当前由契约测试守核心读结构，但生产权威仍是 Fastify。

## 回滚方式
- 不合并 `overnight/ugc-ready-20260610` 分支即可回滚主干。
- 建议主干锚点 tag：`pre-overnight-20260610`。
- 本轮没有 push、没有部署、没有修改 `.env` 或生产数据。

## 人工复审建议
- 决定是否接受新创作者“3 次审核后直发”的产品阈值。
- worker 若未来承接生产流量，需要单独做 D1 写接口压测、远端迁移演练和回滚预案。
