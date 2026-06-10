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
- 文档：更新 `AGENTS.md`、`DEPLOY.md`，新增本报告与续接文档。

## Blocked / 未完成
- M6 worker 契约对齐未完成：`worker/index.js` 与 `worker/schema.sql` 未同步新增字段和端点。原因：当前生产主线是 CloudBase Fastify；D1 worker 已明显落后，需要单独迁移和 wrangler 本地契约测试，半移植风险高。

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

## 高风险 diff
- `server/index.mjs`：新增多张表和大量路由，需人工重点审查迁移、审核晋升和审计写入。
- `src/pages/Admin.tsx` 与 `src/pages/admin/*`：后台拆分和批量审核涉及管理台核心操作，需人工重点点验审核队列。
- `playwright.config.ts`：使用 `localhost:5183` 和 `/tmp` 临时 SQLite，避免本机端口与生产数据冲突。

## 回滚方式
- 不合并 `overnight/ugc-ready-20260610` 分支即可回滚主干。
- 建议主干锚点 tag：`pre-overnight-20260610`。
- 本轮没有 push、没有部署、没有修改 `.env` 或生产数据。

## 人工复审建议
- 决定是否接受新创作者“3 次审核后直发”的产品阈值。
- 单独排期 M6：worker D1 schema/route 移植和双后端契约测试。
