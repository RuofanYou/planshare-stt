# PlanShare UGC Ready Overnight Notes

## 当前状态
- 分支：`overnight/ugc-ready-20260610`
- 本地主线后端：`server/index.mjs`（Fastify + SQLite），本轮业务实现以它为权威。
- 已通过：`npm run verify`
- 本地预览：`http://localhost:5183/`，使用 `/tmp/planshare-preview.db` 临时 SQLite。
- 未执行：`wrangler deploy`、`wrangler pages deploy`、`tcb`、`git push`、生产 URL 写请求。
- 未修改：`.env`、生产数据、`server/planshare.db`。

## 决策记录
- 新创作者默认 `trust_level=review`，旧库启动迁移默认 `trusted`，用于保留老作者直发行为。
- 新创作者累计 3 次审核通过后自动晋升为 `trusted`；被驳回或 spam 时重置累计通过次数。
- 同 IP 重复正文、蜜罐字段、归一化黑名单命中都落为 `spam`，但重复用户名优先返回 409，避免垃圾判定掩盖账号冲突。
- 限流状态从内存迁到 SQLite `rate_limits`，保持原窗口语义并支持重启后继续生效。
- Playwright 固定使用 `localhost:5183`，因为本机 Vite 只监听 IPv6 `::1`，`127.0.0.1:5183` 检测会失败。
- e2e 使用 `/tmp/planshare-e2e-*.db` 临时 SQLite；预览使用 `/tmp/planshare-preview.db`。
- M5 拆分优先按后台职责边界切：投稿审核、举报队列、团本/BOSS 管理先从 `Admin.tsx` 移到 `src/pages/admin/*`，避免一次性重写整个后台。
- M5 批量操作只复用既有单条审核 API，不新增后端批量端点；这样保持服务端审核语义单一，前端只负责批量调度。

## 验证输出

### npm run build
```text
> planshare@0.1.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 566 modules transformed.
✓ built in 6.36s
```

### npm test
```text
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### npm run test:e2e
```text
✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post
1 passed
```

### npm run verify
```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

1..38
# tests 38
# pass 38
# fail 0
✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (18.9s)
1 passed (26.2s)
```

### M5 npm run verify
```text
> planshare@0.1.0 verify
> tsc -b && vite build && node --test --test-concurrency=1 server/*.test.mjs && playwright test

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 7.31s

1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (30.0s)
1 passed (35.6s)
```

## 已知问题
- M5 已完成第一轮按职责拆分，`src/pages/Admin.tsx` 从 2242 行降到 1593 行；作者/战术板表单仍留在主文件，后续可继续细拆但不阻塞本次 UGC 开放。
- `worker/index.js` / `worker/schema.sql` 仍未同步本轮 Fastify 新能力，M6 未完成。
- Vite 构建仍有 chunk size warning，属于既有体积问题，本轮未处理。
- 浏览器控制台有 React Router v7 future warning，非本轮错误。

## 发现但未处理
- Admin 页面作者/战术板表单仍可继续拆成 `pages/admin/*` 子组件，但 M5 的审核效率与核心拆分已完成。
- worker D1 版本需要专门契约测试和迁移实现，不应在未充分验证时半移植。
