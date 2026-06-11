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
- UGC 生态补缺口：新增创作者后台“投稿进度”，创作者能看到自己的待审、已通过、未通过、被拦截投稿；审核通过可跳公开板，驳回可修改后重投。
- 浏览用户补缺口：战术详情页新增“复制链接”，方便把 UGC 板子发给队友；“复制战术”仍是主操作。
- 浏览用户发现补缺口：首页搜索现在匹配标题、正文、团本名、BOSS 名、作者名，解决“文案说能搜 BOSS/作者但实际搜不到”的断点。
- 浏览转创作补缺口：战术详情页新增“基于此投稿”，投稿页可按源板自动预填团本、BOSS、难度和正文，让纠错/改版投稿不需要手动搬运内容。
- 投稿者补缺口：投稿页新增本地草稿保护，刷新后恢复非敏感投稿内容；密码与联系方式不保存，成功提交后清空草稿。
- 创作者自循环补缺口：创作者后台新增自助修改密码；旧密码错误、确认密码不一致、成功改密、旧密码失效、新密码登录均已覆盖。
- 创作者直发补缺口：正式创作者“直接发布”表单新增按账号隔离的本地草稿保护，刷新不丢稿，成功发布后清空。
- 创作者投稿纠错补缺口：创作者可在后台撤回自己的待审投稿；撤回后不再进入管理员审核，后台显示“已撤回”，并写审计日志。
- 创作者重投补缺口：被驳回或已撤回投稿可一键带回投稿页草稿，保留原标题、团本、BOSS、难度、简介、正文和署名，方便修改后重投。
- 创作者分发补缺口：创作者“我的战术板”列表新增“查看公开板”和“复制链接”，直发后可以立刻确认公开效果并分享给队友。
- 创作者维护补缺口：编辑已发布战术板时新增按 board id 隔离的本地草稿保护，刷新不丢修改，保存成功后清空。
- 创作者资料维护补缺口：作者主页资料编辑新增按 author id 隔离的本地草稿保护，刷新不丢简介、公会、招募和联系方式，保存成功后清空。
- 创作者入口防呆补缺口：未注册用户直接进 `/creator` 时，登录卡片新增“没有账号？去投稿申请创作者”入口，可一键回到投稿申请流程。
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

### UGC 生态补缺口验证
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

### 浏览用户分享验证
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

### 首页搜索发现验证
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

### 浏览转创作验证
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

### 投稿草稿保护验证
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

### 创作者自助改密码验证
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
旧密码错误显示“当前密码不正确”；确认密码不一致显示“两次新密码不一致。”；正确修改后显示“密码已更新。”。
无 framework overlay，console errors=0。
```

### 创作者直发草稿保护验证
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

### 创作者撤回待审投稿验证
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

### 创作者修改后重投验证
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

### 创作者后台分享公开板验证
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

### 创作者编辑草稿保护验证
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

### 创作者资料草稿保护验证
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

### 创作者入口防呆验证
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails"

Running 1 test using 1 worker
·
1 passed (4.3s)
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (19.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.03s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (8.0s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:221:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.4s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:269:1 › creator can change password from dashboard and log in with the new password (1.7s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:307:1 › creator can withdraw a pending submission from dashboard (1.6s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:333:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:352:1 › submit draft survives reload without saving password or contact (1.2s)
6 passed (19.6s)
```

```text
in-app browser:
/creator 登录卡片中“没有账号？去投稿申请创作者”入口数量为 1。
点击后跳转到 http://localhost:5183/submit。
/submit 页面显示“提交你的战术板”和“申请创作者”。
framework overlay=false，console errors=0。
```

## 高风险 diff
- `server/index.mjs`：新增多张表和大量路由，需人工重点审查迁移、审核晋升和审计写入。
- `src/pages/Admin.tsx` 与 `src/pages/admin/*`：后台拆分和批量审核涉及管理台核心操作，需人工重点点验审核队列。
- `playwright.config.ts`：使用 `localhost:5183` 和 `/tmp` 临时 SQLite，避免本机端口与生产数据冲突。
- `src/pages/Creator.tsx`：直发入口现在同时依赖作者已通过和账号信任等级 trusted，避免新创作者审核期误以为能直接发布。
- `src/pages/Creator.tsx` 与 `server/index.mjs`：创作者自助改密码会更新密码哈希并撤销其他旧会话；需人工重点复核“当前会话保留、其他会话撤销”的安全取舍。
- `src/pages/Creator.tsx`：创作者直发草稿存储在浏览器 localStorage，并按账号 ID 隔离；需人工复核多账号共用浏览器时的草稿可见性符合预期。
- `src/lib/clipboard.ts`：抽出剪贴板 fallback 给详情页和创作者后台共用；需人工复核旧详情页复制 toast 行为未退化。
- `src/pages/Creator.tsx`：编辑草稿存储在浏览器 localStorage，并按 board id 隔离；需人工复核多账号共用同一浏览器时是否符合运营预期。
- `src/pages/Creator.tsx`：资料草稿存储在浏览器 localStorage，并按 author id 隔离；需人工复核公会联系方式本地暂存的隐私预期。
- `server/index.mjs` 与 `src/data/types.ts`：投稿状态新增 `withdrawn`；需人工复核运营报表或外部脚本是否假设投稿状态只有四种。
- `server/index.mjs` 与 `src/pages/Creator.tsx`：创作者投稿进度现在返回并使用原投稿正文，用于“修改后重投”；需人工复核该数据只暴露给投稿所属创作者。
- `server/index.mjs`：驳回/spam 投稿现在保留 `author_id`，让创作者可以看到失败状态；需确认这符合运营上“失败记录对创作者可见”的预期。
- `worker/index.js`：D1 移植版同步了 Fastify 的 UGC 字段与核心治理端点；当前由契约测试守核心读结构，但生产权威仍是 Fastify。

## 回滚方式
- 不合并 `overnight/ugc-ready-20260610` 分支即可回滚主干。
- 建议主干锚点 tag：`pre-overnight-20260610`。
- 本轮没有 push、没有部署、没有修改 `.env` 或生产数据。

## 人工复审建议
- 决定是否接受新创作者“3 次审核后直发”的产品阈值。
- worker 若未来承接生产流量，需要单独做 D1 写接口压测、远端迁移演练和回滚预案。
