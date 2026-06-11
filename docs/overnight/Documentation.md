# PlanShare UGC Ready Overnight Notes

## 当前状态
- 分支：`overnight/ugc-ready-20260610`
- 本地主线后端：`server/index.mjs`（Fastify + SQLite），本轮业务实现以它为权威。
- 已通过：`npm run verify`
- 本地预览：`http://localhost:5183/`，使用 `/tmp/planshare-preview-progress.db` 临时 SQLite。
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
- M6 契约测试只比较核心公开读接口的 HTTP JSON 结构，不把 worker 重新升为业务权威；worker 仍是 D1 移植版。
- M6 wrangler 本地 D1 使用 `--persist-to /tmp/planshare-worker-contract-*` 临时目录，避免污染仓库 `.wrangler` 或远端 D1。
- 普通用户补测发现创作者后台早放开了直发入口：作者主页通过后，但账号还没累计 3 次通过时，前端曾错误显示“直接发布”。已改为只有 `trust_level=trusted` 才显示直发入口，审核期显示还差几次通过。
- 投稿页成功态以服务端实际返回 `creatorAuth.token` 为准；如果申请创作者的投稿被判 spam，不再误显示“账号已创建”。
- Playwright 冒烟用例的标题、用户名和正文都加唯一后缀，避免本地重复回归时被“同 IP 重复正文”防线误判。
- UGC 生态补缺口：创作者需要看到自己的投稿进度，否则投稿后只能等管理员，无法知道待审、通过、驳回或被拦截。已新增 `GET /api/creator/submissions` 与创作者后台“投稿进度”。
- 管理员驳回或标记 spam 时保留投稿的 `author_id`；不发布板子，但让创作者仍能在自己的进度列表看到失败原因和管理员备注。
- 创作者投稿列表按 `created_at DESC, id DESC` 排序，避免同秒提交时“最新投稿”顺序不稳定。
- 浏览用户补缺口：详情页新增“复制链接”，让用户可以把战术板发给队友；“复制战术”仍保留为主按钮。
- 浏览用户发现补缺口：首页搜索文案承诺可搜 BOSS/作者，但旧实现只搜标题、简介、正文。已扩展搜索索引到团本名、BOSS 名、作者名。
- 浏览转创作补缺口：详情页新增“基于此投稿”，打开投稿页时自动带入源板团本、BOSS、难度和正文，降低二创/纠错投稿成本。
- 投稿者补缺口：投稿页新增本地草稿保护，刷新后恢复标题、团本、BOSS、难度、正文、署名和公开资料；密码与联系方式不保存，提交成功后清空草稿。
- 创作者自循环补缺口：创作者登录后可自助修改密码；当前密码错误返回 400 不清登录态，成功后保留当前会话并撤销其他旧会话，同时写 `audit_logs`。
- 创作者直发补缺口：正式创作者直接发布长战术板时也需要草稿保护；草稿按创作者账号 ID 存 localStorage，刷新后恢复，成功发布后清空。
- 创作者投稿纠错补缺口：创作者自己的待审投稿可撤回，状态置为 `withdrawn` 并写审计日志；已处理投稿和他人投稿不可撤回。
- 创作者重投补缺口：被驳回或已撤回投稿点击“修改后重投”会把原标题、团本、BOSS、难度、简介、正文和署名写入投稿页草稿，再跳转 `/submit`，避免长战术板手动复制。
- 创作者分发补缺口：正式创作者在“我的战术板”列表可直接“查看公开板”和“复制链接”，发布后不必绕到首页搜索才能分享。
- 创作者维护补缺口：编辑已发布战术板时也有本地草稿保护，按 board id 隔离；刷新后恢复未保存修改，保存成功后清空。
- 创作者资料维护补缺口：作者主页资料编辑也有本地草稿保护，按 author id 隔离；刷新后恢复简介、公会、招募和联系方式，保存成功后清空。

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

### M6 worker schema + seed
```text
npx wrangler d1 execute planshare --local --persist-to /tmp/planshare-worker-schema-*/ --file worker/schema.sql
🚣 17 commands executed successfully.

npx wrangler d1 execute planshare --local --persist-to /tmp/planshare-worker-schema-*/ --file worker/seed.sql
🚣 31 commands executed successfully.
```

### M6 contract test
```text
node --test --test-concurrency=1 server/worker-contract.test.mjs

# Subtest: Fastify and Worker core read APIs keep the same HTTP response structure
ok 1 - Fastify and Worker core read APIs keep the same HTTP response structure
1..1
# tests 1
# pass 1
# fail 0
```

### Final npm run verify
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

### 普通用户防呆补测 npm run test:e2e
```text
> planshare@0.1.0 test:e2e
> playwright test

Running 2 tests using 1 worker
··
  2 passed (9.8s)
```

### 普通用户防呆补测 npm run verify
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

### in-app browser 页面检查
```text
/creator: 显示“创作者后台”登录页，包含用户名和密码，无 Application error。
/submit: 显示“提交你的战术板”，包含“申请创作者”，空表单提交按钮禁用，无 Application error。
```

### UGC 生态补缺口：创作者投稿进度
```text
node --test --test-concurrency=1 server/creator-username-auth.test.mjs

1..18
# tests 18
# suites 0
# pass 18
# fail 0
```

```text
CI=1 npm run test:e2e

Running 2 tests using 1 worker
··
  2 passed (40.6s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 4.08s

1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (5.3s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:127:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.8s)
2 passed (10.2s)
```

```text
in-app browser:
/creator 使用本地预览创作者登录后显示“投稿进度”和待审核投稿“预览投稿进度 ...”，无 Application error。
```

### UGC 生态补缺口：浏览用户分享
```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 3.05s
```

```text
CI=1 npm run test:e2e

Running 2 tests using 1 worker
··
  2 passed (9.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.10s

1..40
# tests 40
# suites 0
# pass 40
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (4.1s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:130:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.0s)
2 passed (7.9s)
```

```text
in-app browser:
/board/p-midnight-m9 显示“复制战术”和“复制链接”，无 Application error。
```

### UGC 生态补缺口：首页搜索发现
```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.05s
```

```text
CI=1 npm run test:e2e

Running 3 tests using 1 worker
···
  3 passed (11.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.04s

1..40
# tests 40
# suites 0
# pass 40
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (4.0s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:130:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.8s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:173:1 › home search finds boards by boss and author names (2.7s)
3 passed (10.4s)
```

```text
in-app browser:
/ 首页显示搜索框 placeholder="搜索 BOSS、作者、技能名或关键词"，无 Application error。
注：Browser 插件本轮无法向 input 填字，报 virtual clipboard 缺失；实际搜索行为已由 Playwright 真实浏览器用例覆盖。
```

### UGC 生态补缺口：浏览转创作
```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.34s
```

```text
CI=1 npm run test:e2e

Running 3 tests using 1 worker
···
  3 passed (13.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.07s

1..40
# tests 40
# suites 0
# pass 40
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.4s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:137:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.0s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:180:1 › home search finds boards by boss and author names (2.7s)
3 passed (13.0s)
```

```text
in-app browser:
/board/p-midnight-m9 显示“基于此投稿”，无 Application error。
/submit?from=p-midnight-m9 显示“已带入源战术板内容”，标题、团本、BOSS、正文均已预填。
```

### UGC 生态补缺口：投稿草稿保护
```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.39s
```

```text
CI=1 npm run test:e2e

Running 4 tests using 1 worker
····
  4 passed (13.4s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.08s

1..40
# tests 40
# suites 0
# pass 40
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:42:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.7s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:137:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.0s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:180:1 › home search finds boards by boss and author names (2.7s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:199:1 › submit draft survives reload without saving password or contact (876ms)
4 passed (14.2s)
```

```text
in-app browser:
/submit 显示“草稿会自动保存在本机；密码和联系方式不会保存。”，无 Application error。
```

### UGC 生态补缺口：创作者自助改密码
```text
node --test --test-concurrency=1 server/creator-username-auth.test.mjs

# Subtest: creator can change password without losing current session
ok 9 - creator can change password without losing current session

1..19
# tests 19
# pass 19
# fail 0
```

```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.04s
```

```text
CI=1 npm run test:e2e

Running 5 tests using 1 worker
·····
5 passed (15.7s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.01s

1..41
# tests 41
# suites 0
# pass 41
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:64:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.3s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:159:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.0s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:202:1 › creator can change password from dashboard and log in with the new password (2.0s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:240:1 › home search finds boards by boss and author names (2.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:259:1 › submit draft survives reload without saving password or contact (1.1s)
5 passed (16.1s)
```

```text
in-app browser:
/creator 登录本地临时创作者账号后显示“账号安全 / 修改密码”和“投稿进度”。
旧密码错误显示“当前密码不正确”，仍停留在创作者后台。
确认密码不一致显示“两次新密码不一致。”。
正确修改后显示“密码已更新。”；无 framework overlay，console errors=0。
```

### UGC 生态补缺口：创作者直发草稿保护
```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.04s
```

```text
CI=1 npm run test:e2e

Running 5 tests using 1 worker
·····
5 passed (16.9s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.09s

1..41
# tests 41
# suites 0
# pass 41
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:64:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (7.0s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:175:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.1s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:218:1 › creator can change password from dashboard and log in with the new password (2.1s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:256:1 › home search finds boards by boss and author names (2.8s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:275:1 › submit draft survives reload without saving password or contact (1.3s)
5 passed (17.1s)
```

```text
Playwright:
正式创作者直发区显示“直发草稿会自动保存在本机；成功发布后清空。”。
填写标题、团本、BOSS、简介、正文后刷新页面，字段均恢复。
点击“直接发布”成功后，localStorage 中 `planshare_creator_board_draft_v1*` 草稿键数量为 0。

in-app browser:
/creator 登录页可正常加载，无 framework overlay。
本轮 Browser 运行时缺 virtual clipboard，无法通过 Browser API 输入登录字段；真实登录、刷新恢复、发布清空由 Playwright 浏览器验证覆盖。
```

### UGC 生态补缺口：创作者撤回待审投稿
```text
node --test --test-concurrency=1 server/creator-username-auth.test.mjs

# Subtest: creator can withdraw their own pending submission before admin review
ok 3 - creator can withdraw their own pending submission before admin review

1..20
# tests 20
# pass 20
# fail 0
```

```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.10s
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (15.4s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.07s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:65:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.2s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:176:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.8s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:219:1 › creator can change password from dashboard and log in with the new password (2.0s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:257:1 › creator can withdraw a pending submission from dashboard (817ms)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:276:1 › home search finds boards by boss and author names (2.7s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:295:1 › submit draft survives reload without saving password or contact (1.4s)
6 passed (16.9s)
```

```text
in-app browser:
/creator 页面可见，无 framework overlay，console errors=0。
真实撤回点击、确认框、状态变“已撤回”由 Playwright 浏览器用例覆盖。
```

### UGC 生态补缺口：创作者修改后重投
```text
node --test --test-concurrency=1 server/creator-username-auth.test.mjs

# Subtest: creator can see their own submission review progress
ok 2 - creator can see their own submission review progress

1..20
# tests 20
# pass 20
# fail 0
```

```text
npm run build

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.12s
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (17.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 570 modules transformed.
✓ built in 2.03s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.4s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:177:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.0s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:220:1 › creator can change password from dashboard and log in with the new password (1.6s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:258:1 › creator can withdraw a pending submission from dashboard (1.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:284:1 › home search finds boards by boss and author names (2.3s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:303:1 › submit draft survives reload without saving password or contact (1.2s)
6 passed (17.0s)
```

```text
Playwright:
撤回待审投稿后点击“修改后重投”，跳转 `/submit`。
投稿页标题、团本、BOSS、战术正文均从原投稿草稿恢复。

in-app browser:
/creator 页面可见，无 framework overlay，console errors=0。
```

### UGC 生态补缺口：创作者后台分享公开板
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.05s
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (18.3s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.01s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.6s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:182:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.5s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:225:1 › creator can change password from dashboard and log in with the new password (1.7s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:263:1 › creator can withdraw a pending submission from dashboard (1.8s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:289:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:308:1 › submit draft survives reload without saving password or contact (948ms)
6 passed (17.3s)
```

```text
Playwright:
创作者直发成功后，“我的战术板”列表显示“查看公开板”和“复制链接”。
点击“复制链接”后显示“链接已复制。”。

in-app browser:
/creator 页面可见，无 framework overlay，console errors=0。
```

### UGC 生态补缺口：创作者编辑草稿保护
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.04s
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (17.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.02s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (7.3s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:201:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.1s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:244:1 › creator can change password from dashboard and log in with the new password (1.8s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:282:1 › creator can withdraw a pending submission from dashboard (1.8s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:308:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:327:1 › submit draft survives reload without saving password or contact (809ms)
6 passed (18.8s)
```

```text
Playwright:
创作者编辑已发布板时显示“编辑草稿会自动保存在本机；保存成功后清空。”。
修改标题和正文后刷新页面，再点编辑，草稿恢复。
保存成功后 `planshare_creator_board_edit_draft_v1*` localStorage 草稿键数量为 0。

in-app browser:
/creator 页面可见，无 framework overlay，console errors=0。
```

### UGC 生态补缺口：创作者资料草稿保护
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.04s
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (17.7s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.06s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (6.6s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:221:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.2s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:264:1 › creator can change password from dashboard and log in with the new password (1.9s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:302:1 › creator can withdraw a pending submission from dashboard (1.8s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:328:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:347:1 › submit draft survives reload without saving password or contact (888ms)
6 passed (18.1s)
```

```text
Playwright:
创作者资料区显示“资料草稿会自动保存在本机；保存成功后清空。”。
修改简介、公会名、公会联系方式、招募说明后刷新页面，字段均恢复。
保存成功后 `planshare_creator_profile_draft_v1*` localStorage 草稿键数量为 0。

in-app browser:
/creator 页面可见，无 framework overlay，console errors=0。
```

## 已知问题
- M5 已完成第一轮按职责拆分，`src/pages/Admin.tsx` 从 2242 行降到 1593 行；作者/战术板表单仍留在主文件，后续可继续细拆但不阻塞本次 UGC 开放。
- M6 已完成 worker schema/路由同步和核心读接口契约测试；worker 仍不是当前业务权威。
- Vite 构建仍有 chunk size warning，属于既有体积问题，本轮未处理。
- 浏览器控制台有 React Router v7 future warning，非本轮错误。

## 发现但未处理
- Admin 页面作者/战术板表单仍可继续拆成 `pages/admin/*` 子组件，但 M5 的审核效率与核心拆分已完成。
- worker D1 版本已补核心契约测试；后续如要让 D1 承担生产流量，还需要单独做写接口压力和迁移演练。
