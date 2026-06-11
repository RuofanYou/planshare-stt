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
- 创作者入口防呆补缺口：新用户直接打开 `/creator` 时，登录卡片必须给出“没有账号？去投稿申请创作者”入口，避免不知道账号从哪里创建。
- 创作者申请表防呆补缺口：密码不足 8 位时不能只让按钮变灰，需在密码框下方实时提示“还差几位”，并通过 `aria-describedby` 暴露给辅助技术。
- 创作者维护闭环补测：正式创作者直发后，Playwright 主链路必须继续覆盖编辑、下架、恢复发布，确保发错板后可自助撤下并恢复。
- 浏览用户治理闭环补测：普通访客在详情页举报后，管理员可在后台举报队列隐藏该板，公开详情页随后返回不可见。
- 创作者账号救援闭环补测：创作者忘记密码时，管理员可在后台账号区重置密码；旧密码失效，新密码能重新登录。
- 创作者治理闭环补缺口：后端已有暂停/恢复创作者账号能力，后台账号区补“暂停账号/恢复账号”按钮；暂停会撤销会话并阻止登录，恢复后可重新登录。
- 管理员治理追溯补缺口：后台新增“审计”页展示最近审计日志，能看到账号状态、重置密码、举报处理、审核等治理动作。
- 举报治理防绕过补缺口：创作者自助下架仍可自助恢复，但管理员因举报隐藏的板会记录 `hidden_by=admin`，创作者后台只显示“管理员隐藏”，不提供恢复发布，后端也拒绝 `isHidden:false` 绕过。
- 举报证据保全补缺口：举报创建时把当时的板标题、简介、正文、作者和更新时间快照写入 `reports`，后台举报队列直接显示举报时内容摘录，避免创作者或管理员后续编辑导致治理证据漂移。
- 创作者直发筛查补缺口：游客投稿已有内容筛查，但正式创作者直发/编辑曾只做字段校验；现已复用归一化黑名单，违规标题/简介/正文会返回 400，不创建也不污染已有公开板。
- 创作者账号生命周期补缺口：后台删除作者现在会拒绝已绑定创作者账号的作者，避免管理员把半公开/正式创作者的作者档案删成孤儿账号；需要治理时应暂停账号或隐藏作者，而不是删除绑定关系。
- 团本/BOSS 数据完整性补缺口：游客投稿、创作者直发/编辑、管理员新建/编辑板都会校验 `bossId` 必须属于所选 `raidId`，避免脚本绕过前端下拉造出筛选错乱的脏数据。

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

### UGC 生态补缺口：创作者入口防呆
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

### UGC 生态补缺口：申请密码长度提示
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails"

Running 1 test using 1 worker
·
1 passed (4.7s)
```

```text
CI=1 npm run test:e2e

Running 6 tests using 1 worker
······
6 passed (18.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.05s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (8.0s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:221:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.6s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:272:1 › creator can change password from dashboard and log in with the new password (1.9s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:310:1 › creator can withdraw a pending submission from dashboard (1.8s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:336:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:355:1 › submit draft survives reload without saving password or contact (1.2s)
6 passed (20.1s)
```

```text
in-app browser:
/submit 切到“申请创作者”后，密码框下方默认提示“用于以后登录创作者后台，至少 8 位。”。
输入 7 位密码后提示“密码至少 8 位，还差 1 位。”。
提交按钮保持 disabled，console errors=0。
```

### UGC 生态补缺口：创作者下架与恢复发布回归
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (9.3s)
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
✓ built in 2.06s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:66:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (8.2s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:231:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.7s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:282:1 › creator can change password from dashboard and log in with the new password (1.6s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:320:1 › creator can withdraw a pending submission from dashboard (1.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:346:1 › home search finds boards by boss and author names (2.8s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:365:1 › submit draft survives reload without saving password or contact (883ms)
6 passed (18.8s)
```

```text
Playwright:
正式创作者直发后点击“下架”，确认弹窗后该板显示“已下架”，只保留“恢复发布”操作。
下架状态不再显示“查看公开板”入口。
点击“恢复发布”后重新显示“已发布”和“查看公开板”。
```

### UGC 生态补缺口：举报到隐藏板闭环回归
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (11.2s)
```

```text
CI=1 npm run test:e2e

Running 7 tests using 1 worker
·······
7 passed (29.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.04s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:93:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (8.2s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:258:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.7s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:309:1 › creator can change password from dashboard and log in with the new password (2.1s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:347:1 › creator can withdraw a pending submission from dashboard (1.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:373:1 › home search finds boards by boss and author names (2.7s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:392:1 › submit draft survives reload without saving password or contact (1.2s)
✓  7 [chromium] › tests/e2e/ugc-smoke.spec.ts:424:1 › visitor can report a board and admin can hide it from public pages (8.9s)
7 passed (28.5s)
```

```text
Playwright:
临时公开板详情页点击“举报”，选择“内容有误”并提交后显示“举报已提交”。
管理员进入“举报”队列，可看到举报说明并点击“隐藏板”。
隐藏后公开 GET /api/boards/:id 返回 404，详情页显示“战术板加载失败，请稍后再试。”。
```

### UGC 生态补缺口：管理员重置创作者密码回归
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "admin can reset"

Running 1 test using 1 worker
·
1 passed (3.6s)
```

```text
CI=1 npm run test:e2e

Running 8 tests using 1 worker
········
8 passed (30.5s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.08s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:93:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (7.1s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:258:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.7s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:309:1 › creator can change password from dashboard and log in with the new password (1.6s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:347:1 › admin can reset a creator password and the creator can log in again (1.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:375:1 › creator can withdraw a pending submission from dashboard (1.7s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:401:1 › home search finds boards by boss and author names (3.0s)
✓  7 [chromium] › tests/e2e/ugc-smoke.spec.ts:420:1 › submit draft survives reload without saving password or contact (915ms)
✓  8 [chromium] › tests/e2e/ugc-smoke.spec.ts:452:1 › visitor can report a board and admin can hide it from public pages (8.9s)
8 passed (28.6s)
```

```text
Playwright:
管理员进入“创作者”页的“账号与密码”区，对指定创作者点击“重置密码”。
输入新密码并确认后，页面显示“已重置。请把新密码...”。
创作者旧密码登录失败，新密码登录后显示“投稿进度”。
```

### UGC 生态补缺口：管理员暂停与恢复创作者账号
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.51s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "admin can suspend"

Running 1 test using 1 worker
·
1 passed (4.2s)
```

```text
CI=1 npm run test:e2e

Running 9 tests using 1 worker
·········
9 passed (32.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.09s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:105:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (7.9s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:270:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.4s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:321:1 › creator can change password from dashboard and log in with the new password (2.3s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:359:1 › admin can reset a creator password and the creator can log in again (1.7s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:387:1 › admin can suspend and restore a creator account (2.1s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:420:1 › creator can withdraw a pending submission from dashboard (1.7s)
✓  7 [chromium] › tests/e2e/ugc-smoke.spec.ts:446:1 › home search finds boards by boss and author names (2.8s)
✓  8 [chromium] › tests/e2e/ugc-smoke.spec.ts:465:1 › submit draft survives reload without saving password or contact (944ms)
✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:497:1 › visitor can report a board and admin can hide it from public pages (8.9s)
9 passed (32.7s)
```

```text
Playwright:
管理员进入“创作者”页，在账号行点击“暂停账号”，状态变为“已暂停”并显示“恢复账号”。
被暂停创作者登录时显示“账号已被暂停，请联系管理员”。
管理员点击“恢复账号”后状态回到“正常”，创作者可重新登录并看到“投稿进度”。
```

### UGC 生态补缺口：后台审计日志可视化
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.57s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "admin can suspend"

Running 1 test using 1 worker
·
1 passed (4.7s)
```

```text
CI=1 npm run test:e2e

Running 9 tests using 1 worker
·········
9 passed (33.4s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.07s

1..42
# tests 42
# suites 0
# pass 42
# fail 0

✓  1 [chromium] › tests/e2e/ugc-smoke.spec.ts:105:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (8.0s)
✓  2 [chromium] › tests/e2e/ugc-smoke.spec.ts:270:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.1s)
✓  3 [chromium] › tests/e2e/ugc-smoke.spec.ts:321:1 › creator can change password from dashboard and log in with the new password (1.9s)
✓  4 [chromium] › tests/e2e/ugc-smoke.spec.ts:359:1 › admin can reset a creator password and the creator can log in again (1.4s)
✓  5 [chromium] › tests/e2e/ugc-smoke.spec.ts:387:1 › admin can suspend and restore a creator account (2.3s)
✓  6 [chromium] › tests/e2e/ugc-smoke.spec.ts:425:1 › creator can withdraw a pending submission from dashboard (1.6s)
✓  7 [chromium] › tests/e2e/ugc-smoke.spec.ts:451:1 › home search finds boards by boss and author names (2.8s)
✓  8 [chromium] › tests/e2e/ugc-smoke.spec.ts:470:1 › submit draft survives reload without saving password or contact (950ms)
✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:502:1 › visitor can report a board and admin can hide it from public pages (9.0s)
9 passed (32.2s)
```

```text
Playwright:
管理员暂停并恢复创作者账号后，进入“审计”页。
页面显示“审计日志”，并能在状态为 active 的审计行看到 `creator_account_update`。
```

### UGC 生态补缺口：管理员隐藏不可被创作者自行恢复
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.06s
```

```text
node --test server/creator-username-auth.test.mjs

1..21
# tests 21
# suites 0
# pass 21
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator dashboard blocks"

Running 1 test using 1 worker
·
1 passed (2.9s)
```

```text
CI=1 npm run test:e2e

Running 10 tests using 1 worker
··········
10 passed (32.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.12s

1..43
# tests 43
# suites 0
# pass 43
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:532:1 › visitor can report a board and admin can hide it from public pages (8.8s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:560:1 › creator dashboard blocks self-restore for boards hidden by admin reports (653ms)
10 passed (32.9s)
```

```text
Playwright:
正式创作者直发战术板后，游客举报，管理员处理为隐藏。
创作者登录后台后，该板显示“管理员隐藏”和“该战术板已被管理员隐藏，不能自行恢复发布。”。
页面没有“恢复发布”按钮；直接打创作者恢复接口返回 403，公开详情页仍为 404。
```

### UGC 生态补缺口：举报时内容快照
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.06s
```

```text
node --test server/ugc-ready.test.mjs --test-name-pattern "reports flow"

1..5
# tests 5
# suites 0
# pass 5
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (11.1s)
```

```text
Playwright:
访客举报后，测试用管理员 API 修改原板正文。
管理员打开举报队列时仍能看到“举报时正文：P1 举报测试 ...”，且看不到后续编辑文本。
随后管理员隐藏板，公开详情页返回不可见。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.08s

1..43
# tests 43
# suites 0
# pass 43
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:532:1 › visitor can report a board and admin can hide it from public pages (8.9s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:570:1 › creator dashboard blocks self-restore for boards hidden by admin reports (655ms)
10 passed (31.7s)
```

### UGC 生态补缺口：创作者直发内容筛查
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.10s
```

```text
node --test server/creator-username-auth.test.mjs --test-name-pattern "unsafe content"

1..22
# tests 22
# suites 0
# pass 22
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator direct publish screens"

Running 1 test using 1 worker
·
1 passed (3.1s)
```

```text
Playwright:
正式创作者登录后台后，在“我的战术板”直发表单输入命中归一化黑名单的正文。
点击“直接发布”后页面显示“战术内容包含暂不支持公开展示的内容”。
该标题没有进入“我的战术板”列表。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.07s

1..44
# tests 44
# suites 0
# pass 44
# fail 0

✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:570:1 › creator dashboard blocks self-restore for boards hidden by admin reports (454ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:621:1 › creator direct publish screens unsafe content in dashboard (958ms)
11 passed (33.8s)
```

### UGC 生态补缺口：创作者作者档案删除保护
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.14s
```

```text
node --test server/creator-username-auth.test.mjs --test-name-pattern "cannot delete"

1..23
# tests 23
# suites 0
# pass 23
# fail 0
```

```text
API:
管理员删除已绑定创作者账号的作者返回 409。
创作者随后访问 /api/creator/me 仍返回原 author，visibility=semi_public。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.03s

1..45
# tests 45
# suites 0
# pass 45
# fail 0

✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:570:1 › creator dashboard blocks self-restore for boards hidden by admin reports (5.7s)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:621:1 › creator direct publish screens unsafe content in dashboard (847ms)
11 passed (39.4s)
```

### UGC 生态补缺口：团本/BOSS/作者关系完整性
```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.19s
```

```text
node --test server/submissions.test.mjs --test-name-pattern "different raid"

1..8
# tests 8
# suites 0
# pass 8
# fail 0
```

```text
node --test server/creator-username-auth.test.mjs --test-name-pattern "different raid"

1..24
# tests 24
# suites 0
# pass 24
# fail 0
```

```text
node --test server/ugc-ready.test.mjs --test-name-pattern "admin can manage raids"

1..5
# tests 5
# suites 0
# pass 5
# fail 0
```

```text
API:
游客投稿使用 `r-voidspire` + `b-beloren` 返回 400。
创作者直发使用 `r-voidspire` + `b-beloren` 返回 400。
管理员新建/编辑板造成 raid/boss 错配时返回 400。
管理员新建/编辑板使用不存在的 authorId 时返回 400。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.03s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:570:1 › creator dashboard blocks self-restore for boards hidden by admin reports (651ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:621:1 › creator direct publish screens unsafe content in dashboard (814ms)
11 passed (33.6s)
```

### UGC 生态补缺口：普通用户视角防呆复测
```text
Browser 手动复测:
首页 -> 投稿 -> 创作者申请 -> 创作者后台 -> 本地管理员审核 -> 3 次通过自动晋升 -> trusted 直发。

结果:
- 必填项未齐时“提交审核”和“直接发布”保持禁用。
- 密码不足 8 位时页面显示“还差 N 位”。
- 用户名非法/重复会被拦截。
- 新创作者审核期能看到待审进度，但直发入口关闭。
- 3 次审核通过后自动变为正式创作者，出现直发、编辑、复制链接、下架入口。
- trusted 创作者直发含黑名单内容时被拦截，正常内容可发布。
- 修改密码时，两次新密码不一致现在会直接提示并禁用“更新密码”。
- 直发表单的“简介”改为“战术简介”，避免和作者资料“简介”混淆。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator can change password|creator direct publish screens"

Running 2 tests using 1 worker
··
2 passed (4.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.08s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:532:1 › visitor can report a board and admin can hide it from public pages (8.9s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:570:1 › creator dashboard blocks self-restore for boards hidden by admin reports (713ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:621:1 › creator direct publish screens unsafe content in dashboard (809ms)
11 passed (32.9s)
```

### UGC 生态补缺口：访客详情页点赞显示复测
```text
Browser 手动复测:
公开详情页 -> 基于此投稿 -> 返回详情页 -> 点赞。

结果:
- “基于此投稿”会把原战术板标题、团本、BOSS、正文带入投稿页，缺署名/账号时仍保持提交禁用。
- 访客点击点赞时，后端只持久化 +1；此前前端会把后端新计数再本地 +1，视觉上多显示一票。
- 已修复为：点击后先乐观 +1，后端返回后以后端 likeCount 真值显示，本会话按钮保持“已点赞”且不能重复加。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (11.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.11s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:541:1 › visitor can report a board and admin can hide it from public pages (9.0s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:579:1 › creator dashboard blocks self-restore for boards hidden by admin reports (5.7s)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:630:1 › creator direct publish screens unsafe content in dashboard (829ms)
11 passed (43.8s)
```

### UGC 生态补缺口：列表卡片点赞持久化
```text
代码复查:
src/components/LikeButton.tsx 原注释为“本地态切换，不持久化（mock）”。
src/components/BoardCard.tsx 在首页、团本页、作者页、相关推荐中复用该按钮。

结果:
- 访客在列表卡片点“点赞”以前只是本地动画，刷新后丢失。
- 已改为 BoardCard 调用 /api/boards/:id/like，LikeButton 用后端返回 likeCount 收敛显示。
- 首页卡片点赞后刷新仍显示 +1；详情页点赞仍保持只显示 +1，不叠加。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (12.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.02s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:554:1 › visitor can report a board and admin can hide it from public pages (9.0s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:592:1 › creator dashboard blocks self-restore for boards hidden by admin reports (697ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:643:1 › creator direct publish screens unsafe content in dashboard (943ms)
11 passed (35.8s)
```

### UGC 生态补缺口：作者主页公会引流闭环
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.4s)
```

```text
Browser 覆盖:
创作者后台保存简介、公会名、公会联系方式、招募说明后，点击“查看主页”。
作者主页显示公会名、招募说明、联系方式。
点击“复制联系方式”后按钮进入“已复制”状态。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.03s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  9 [chromium] › tests/e2e/ugc-smoke.spec.ts:560:1 › visitor can report a board and admin can hide it from public pages (9.0s)
✓ 10 [chromium] › tests/e2e/ugc-smoke.spec.ts:598:1 › creator dashboard blocks self-restore for boards hidden by admin reports (528ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:649:1 › creator direct publish screens unsafe content in dashboard (866ms)
11 passed (36.5s)
```

### UGC 生态补缺口：作者页点赞聚合同步
```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "author page likes"

Running 1 test using 1 worker
·
1 passed (2.5s)
```

```text
行为:
访客打开作者主页，记录“获赞”统计。
在作者主页作品卡点击“点赞”。
作品卡变为“已点赞”，作者页“获赞”统计同步 +1。
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.11s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  8 [chromium] › tests/e2e/ugc-smoke.spec.ts:528:1 › author page likes update author aggregate stats (518ms)
✓ 11 [chromium] › tests/e2e/ugc-smoke.spec.ts:613:1 › creator dashboard blocks self-restore for boards hidden by admin reports (709ms)
✓ 12 [chromium] › tests/e2e/ugc-smoke.spec.ts:664:1 › creator direct publish screens unsafe content in dashboard (1.0s)
12 passed (37.4s)
```

### UGC 生态补缺口：复制失败防呆
```text
普通用户探索:
在内置浏览器打开 /board/p-midnight-m9 后点击“复制战术”。
Browser 工具没有虚拟剪贴板时，原页面没有给出失败提示，用户会以为按钮没反应。
```

```text
修复:
- src/lib/clipboard.ts 现在尊重 document.execCommand('copy') 的 false 返回值，不再把失败误判成成功。
- src/components/CopyButton.tsx 统一调用 copyToClipboard，正文小复制按钮失败时短暂显示“复制失败”，并通过 aria-live 说明“复制失败，请手动选中文本复制”。
- src/pages/BoardDetail.tsx 顶部“复制战术”和“复制链接”失败时显示同一句可见 toast。
```

```text
测试决策:
作者页点赞聚合测试原本会在数字滚动动画从 0 递增时过早读取“获赞”，导致期望值偶发变成 1。
已改为先等待作者“获赞”统计追平卡片点赞数，再点击点赞；这是测试前提修正，不弱化业务断言。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "copy actions"

Running 1 test using 1 worker
·
1 passed (2.7s)
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "author page likes"

Running 1 test using 1 worker
·
1 passed (3.6s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   8 [chromium] › tests/e2e/ugc-smoke.spec.ts:528:1 › author page likes update author aggregate stats (1.4s)
✓   9 [chromium] › tests/e2e/ugc-smoke.spec.ts:549:1 › copy actions show a visible failure state when clipboard is blocked (769ms)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:709:1 › creator direct publish screens unsafe content in dashboard (895ms)
13 passed (37.8s)
```

### UGC 生态补缺口：投稿缺项实时提示
```text
普通用户探索:
投稿页原本只有“提交审核”禁用态，新手不知道还差哪一项。
已新增实时提示：
- 空白普通投稿显示“还差：标题、团本、BOSS、投稿署名、战术正文”。
- 申请创作者但密码不足 8 位显示“还差：登录密码至少 8 位”。
- 信息补齐后显示“信息已补齐，可以提交审核。”。
```

```text
Browser 覆盖:
打开 /submit。
当前内置浏览器有本机自动草稿，页面显示“还差：投稿署名”，说明缺项提示会基于已保存草稿实时收敛。
按钮保持禁用，无前端 error。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails|submit draft"

Running 2 tests using 1 worker
··
2 passed (5.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.95s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   2 [chromium] › tests/e2e/ugc-smoke.spec.ts:328:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.5s)
✓  10 [chromium] › tests/e2e/ugc-smoke.spec.ts:590:1 › submit draft survives reload without saving password or contact (1.1s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:712:1 › creator direct publish screens unsafe content in dashboard (780ms)
13 passed (36.5s)
```

### UGC 生态补缺口：创作者直发 / 编辑缺项实时提示
```text
普通用户探索:
正式创作者后台“直接发布”和“保存修改”按钮禁用时，也需要告诉创作者还差哪一项。
已新增：
- 空直发表单显示“还差：标题、团本、BOSS、战术正文”。
- 直发表单补齐后显示“信息已补齐，可以直接发布。”。
- 编辑已发布板时显示“信息已补齐，可以保存修改。”；标题或正文为空时显示对应缺项。
```

```text
Browser/Playwright 覆盖:
本地 API 创建 preview_mq8vj30b 创作者并完成 3 次审核晋升。
独立 Playwright 注入本地 token 后打开 /creator：
{
  "readiness": [
    "还差：标题、团本、BOSS、战术正文"
  ],
  "directDisabled": true,
  "url": "http://localhost:5183/creator"
}
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (12.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (10.7s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:715:1 › creator direct publish screens unsafe content in dashboard (750ms)
13 passed (37.4s)
```

### UGC 生态补缺口：首页搜索空结果转投稿
```text
普通用户探索:
浏览用户搜索不存在的 BOSS/作者时，原提示只说“可以先按团本浏览”，没有把用户自然引导到“投稿补一份”。
已改为：
“暂时没搜到匹配的板子，可以先按团本浏览，或投稿补一份。”
其中“投稿补一份”是 /submit 链接。
```

```text
Browser/Playwright 覆盖:
搜索“不存在的虚空大章鱼”。
页面提示:
{
  "hint": "暂时没搜到匹配的板子，可以先按团本浏览，或投稿补一份。",
  "url": "http://localhost:5183/submit"
}
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "home search"

Running 1 test using 1 worker
·
1 passed (5.4s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   7 [chromium] › tests/e2e/ugc-smoke.spec.ts:514:1 › home search finds boards by boss and author names (3.2s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:724:1 › creator direct publish screens unsafe content in dashboard (771ms)
13 passed (43.8s)
```

### UGC 生态补缺口：投稿成功后的回流入口
```text
普通用户探索:
普通投稿成功后原本只有“投稿已进入审核”的文字，没有下一步按钮。
已新增：
- 普通投稿成功后显示“回首页浏览”。
- 申请创作者成功后保留“进入创作者后台”，同时也显示“回首页浏览”。
```

```text
Browser/Playwright 覆盖:
本地普通投稿成功后：
{
  "hasHomeLink": true,
  "url": "http://localhost:5183/"
}
说明“回首页浏览”可见并能跳回首页。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke|submit draft"

Running 2 tests using 1 worker
··
2 passed (14.6s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (10.8s)
✓  10 [chromium] › tests/e2e/ugc-smoke.spec.ts:604:1 › submit draft survives reload without saving password or contact (1.9s)
13 passed (43.2s)
```

### UGC 生态补缺口：举报成功处理说明
```text
普通用户探索:
举报成功后原本只显示“举报已提交”，没有告诉用户后续会进入哪里处理。
已改为显示“举报已提交，已进入管理员处理队列。”，并确认提交表单会收起，避免用户误以为需要重复提交。
```

```text
Browser/Playwright 覆盖:
本地创建测试板并提交举报后：
{
  "status": "举报已提交，已进入管理员处理队列。",
  "submitButtons": 0
}
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (11.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  11 [chromium] › tests/e2e/ugc-smoke.spec.ts:641:1 › visitor can report a board and admin can hide it from public pages (8.9s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:731:1 › creator direct publish screens unsafe content in dashboard (786ms)
13 passed (38.2s)
```

### UGC 生态补缺口：不可见战术板提示
```text
普通用户探索:
举报处理或创作者下架后，公开 URL 返回 404。原前端把 `board not found` 显示为“战术板加载失败，请稍后再试。”，用户会误以为系统故障。
已改为显示：
“这块战术板已不可见，可能已下架或被管理员隐藏。”
```

```text
Browser/Playwright 覆盖:
本地创建一块板，管理员隐藏后打开公开 URL：
{
  "hasUnavailableText": true,
  "url": "http://localhost:5183/board/p-mq8w49kv-ahxcta"
}
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (11.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  11 [chromium] › tests/e2e/ugc-smoke.spec.ts:641:1 › visitor can report a board and admin can hide it from public pages (8.9s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:731:1 › creator direct publish screens unsafe content in dashboard (845ms)
13 passed (39.0s)
```

### UGC 生态补缺口：投稿草稿手动清空
```text
普通用户探索:
投稿页会自动保存本机草稿，适合防误关页面；但如果用户填错一堆内容，或共享电脑上残留旧草稿，只能逐项删除。
已新增“清空草稿”按钮：只有当前有可见草稿且还未提交成功时出现，点击后清空表单并移除本机草稿。
```

```text
Browser 覆盖:
在 http://localhost:5183/submit 点“清空草稿”后：
{
  "boss": "",
  "clearButtons": 0,
  "content": "",
  "raid": "",
  "submitter": null,
  "title": ""
}

说明：内置浏览器当前缺少虚拟剪贴板能力，`fill` 不稳定；本轮仍用内置浏览器完成点击与页面状态验证。
localStorage 是否被移除由 Playwright 专项测试覆盖。
控制台只有既有 React Router v7 future warning 和 THREE.Clock deprecated warning，没有本轮新增错误。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "submit draft"

Running 1 test using 1 worker
·
1 passed (4.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓  10 [chromium] › tests/e2e/ugc-smoke.spec.ts:604:1 › submit draft survives reload without saving password or contact (1.9s)
13 passed (36.6s)
```

### UGC 生态补缺口：创作者后台草稿可放弃
```text
普通创作者探索:
创作者后台的作者资料、直发战术板、编辑战术板都会自动保存在本机；这能防误关页面，但也会让“填错了想从头来”的用户卡住。
尤其是编辑战术板：取消编辑后，下次再点编辑仍可能恢复旧草稿，用户会误以为取消没有生效。

已新增：
- 资料草稿：清空资料草稿
- 直发草稿：清空直发草稿
- 编辑草稿：放弃编辑草稿

这些按钮只在确实存在本机草稿时出现，点击后会清掉对应 localStorage 草稿；“取消”仍只负责收起编辑，不偷偷丢草稿。
```

```text
Browser 覆盖:
内置浏览器打开 http://localhost:5183/creator，确认创作者入口页可见：
- 用户名 / 密码
- 登录按钮
- 没有账号？去投稿申请创作者

本轮需要登录后的填表验证；内置浏览器当前缺少虚拟剪贴板能力，输入动作不稳定。
因此登录后的交互证明走 Playwright：真实打开页面、填表、刷新、点击清空/放弃按钮，并断言 localStorage 对应草稿键已清掉。
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (10.7s)
✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:795:1 › creator direct publish screens unsafe content in dashboard (5.8s)
13 passed (49.2s)
```

### UGC 生态补缺口：创作者注册确认密码
```text
普通创作者探索:
申请创作者时原本只输入一次密码。因为本项目明确不做邮箱/短信/第三方登录，用户如果第一次注册时手滑输错密码，账号创建后就可能无法自助登录，只能找管理员重置。
已新增“确认密码”字段；两次密码不一致时：
- 页面显示“两次密码不一致。”
- 提交按钮保持禁用
- “还差”提示会显示“确认密码一致”

密码和确认密码仍不写入投稿草稿，刷新后都会清空。
```

```text
Browser 覆盖:
内置浏览器打开 http://localhost:5183/submit，点击“申请创作者”后确认：
{
  "hasPassword": true,
  "hasConfirm": true,
  "hasConfirmHint": true,
  "hasNoDraftPasswordCopy": true
}

控制台只有既有 React Router v7 future warning 和 THREE.Clock deprecated warning，没有本轮新增错误。
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails|submit draft"

Running 2 tests using 1 worker
··
2 passed (6.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   2 [chromium] › tests/e2e/ugc-smoke.spec.ts:382:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (2.1s)
✓  10 [chromium] › tests/e2e/ugc-smoke.spec.ts:660:1 › submit draft survives reload without saving password or contact (1.9s)
13 passed (39.7s)
```

### UGC 生态补缺口：登录创作者投稿身份提示
```text
普通创作者探索:
登录后的创作者从“继续投稿 / 修改后重投”进入 `/submit` 时，后端会自动把投稿挂到当前创作者账号下；但页面原本仍显示“普通投稿 / 申请创作者”，用户会不确定这次投稿是否会计入自己的 3 次审核晋升进度。

已改为：
- 已登录创作者进入投稿页时显示“已登录为 ...；这次投稿会进入你的创作者后台审核进度”
- 发布身份区域改为只读说明：“使用当前创作者账号投稿；通过审核后会累计到直发资格”
- 隐藏“申请创作者”选项，避免重复申请账号
- 提交成功后显示“投稿已进入你的创作者审核进度”，并提供“进入创作者后台”
```

```text
Browser 覆盖:
游客状态打开 http://localhost:5183/submit，确认仍保留游客入口：
{
  "url": "http://localhost:5183/submit",
  "hasVisitorChoice": true,
  "hasCreatorSessionBanner": false
}

控制台只有既有 React Router v7 future warning 和 THREE.Clock deprecated warning，没有本轮新增错误。
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.88s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator can withdraw"

Running 1 test using 1 worker
·
1 passed (6.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   6 [chromium] › tests/e2e/ugc-smoke.spec.ts:546:1 › creator can withdraw a pending submission from dashboard (4.0s)
13 passed (41.6s)
```

### UGC 生态补缺口：团本空 BOSS 转投稿
```text
普通浏览用户探索:
首页搜索空结果已经能“投稿补一份”，但用户按团本/BOSS 浏览时，如果某个 BOSS 没有板，只看到“这个 BOSS 还没有战术板”，没有下一步。
已给团本页空 BOSS 状态新增“投稿补一份”，点击后进入 `/submit?raidId=...&bossId=...`，投稿页会自动预选团本和 BOSS，并提示“已带入团本和 BOSS，补上标题与战术正文即可提交。”
难度筛选为空时仍优先显示“查看全部难度”，避免用户只是筛错难度就被引导投稿。
```

```text
Browser 覆盖:
正常有板团本页 http://localhost:5183/raid/r-voidspire：
{
  "hasRaidTitle": true,
  "hasCard": true,
  "hasEmptyText": false,
  "hasEmptySubmitAction": false
}

控制台只有既有 React Router v7 future warning 和 THREE.Clock deprecated warning，没有本轮新增错误。
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "empty boss"

Running 1 test using 1 worker
·
1 passed (2.9s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.93s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   8 [chromium] › tests/e2e/ugc-smoke.spec.ts:612:1 › empty boss category can route visitors into a prefilled submission (1.4s)
14 passed (48.7s)
```

### UGC 生态补缺口：新创作者直发门槛文案一致
```text
普通创作者探索:
从 /submit 真实申请创作者后进入 /creator，后台上半部分写“首个战术板通过审核后会开放直接发布”，下方审核状态又写“前 3 个战术板通过审核后开放直发、编辑、下架和恢复发布”。
实际业务规则是累计 3 次审核通过后才晋升 trusted。旧文案会让新手误以为 1 次通过就能直发。

已统一改为“资料可半公开展示；前 3 个战术板通过审核后会开放直接发布。”，并在 UGC 主链 E2E 加断言：
- 新创作者后台必须显示 3 次门槛文案
- 不允许再出现“首个战术板通过审核后会开放直接发布。”

继续追查后发现第二个相同误导点：首个战术板通过后，作者主页已正式公开，但账号还在审核期，资料区仍会因为 `author.visibility=approved` 显示“上方可直接发布和维护你的战术板。”
已把 `canDirectPublish` 传入资料编辑组件，区分三种状态：
- 半公开主页：前 3 个战术板通过审核后开放直发
- 已公开但审核期：资料已展示在作者主页；累计 3 次审核通过后会开放直接发布
- trusted：资料会展示在作者主页；上方可直接发布和维护你的战术板
```

```text
Browser 覆盖:
内置浏览器以普通用户路径提交创作者申请后进入 http://localhost:5183/creator：
{
  "hasThree": true,
  "hasOldOne": false,
  "snippet": "资料可半公开展示；前 3 个战术板通过审核后会开放直接发布。"
}

控制台只有既有 React Router v7 future warning 和 THREE.Clock deprecated warning，没有本轮新增错误。
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.6s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s

1..47
# tests 47
# suites 0
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (10.4s)
✓  14 [chromium] › tests/e2e/ugc-smoke.spec.ts:848:1 › creator direct publish screens unsafe content in dashboard (739ms)
14 passed (42.1s)
```

### UGC 生态补缺口：系统拦截后可修改重投
```text
普通创作者探索:
创作者投稿如果被系统标记为 spam，后台原本只显示“被拦截 / 没有进入人工审核”。这对小白是死路：不知道为什么被拦、也没有下一步。
同时 `content_blacklist` 这类机器码可能直接出现在“系统拦截：...”后面。

已改为：
- spam 状态也显示“修改后重投”，和未通过、已撤回保持一致
- `content_blacklist` 显示为“内容风险”
- 点击“修改后重投”会把原标题、团本、BOSS、正文带回投稿页；用户改掉问题内容后可重新提交审核
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.09s
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "spam-screened"

Running 1 test using 1 worker
·
1 passed (3.9s)
```

### UGC 生态补缺口：误举报可驳回且不误伤公开板
```text
普通浏览用户探索:
举报通道已有“隐藏板”和“驳回举报”两种后台处理动作，但自动化只覆盖了隐藏板。
UGC 治理不能只会下架，误举报被驳回后公开板必须继续可访问，并且后台要有 `report_dismiss` 审计证据。

已补验证：
- 后端集成测试：驳回举报返回 dismissed；原板 `/api/boards/:id` 仍 200；审计日志包含 `report_dismiss`
- Playwright：访客举报 -> 管理员驳回举报 -> 页面显示“已驳回” -> 回到公开板详情仍能看到标题
- 原有“隐藏板后公开详情 404”路径继续覆盖
```

```text
node --test --test-concurrency=1 server/ugc-ready.test.mjs

1..5
# tests 5
# pass 5
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (12.0s)
```

### UGC 生态补缺口：管理员驳回后创作者可按备注重投
```text
普通创作者探索:
后端已经会把管理员驳回备注返回到创作者投稿进度，前端也有“修改后重投”，但缺少真实浏览器链路覆盖。
对创作者自循环来说，被驳回不能只是一个失败状态，必须能看到原因、带回原稿、修改后重新进入审核。

继续追查后发现后台单条驳回/标垃圾只能写死“后台驳回 / 后台标记垃圾”，创作者仍不知道具体要改什么。
已在投稿展开详情中新增“处理备注”输入框；管理员填写后，驳回/标垃圾会把这句话作为 reviewNote 传给后端。

已补 Playwright：
- 创建创作者投稿
- 管理员后台填写“请补充站位和时间轴 ...”并点“驳回”
- 创作者登录后看到“未通过”和具体管理员备注
- 点“修改后重投”进入投稿页，标题、团本、BOSS、正文自动带回
- 修改正文后重新提交，进入创作者审核进度
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "rejected submission"

Running 1 test using 1 worker
·
1 passed (5.7s)
```

```text
npm run build

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.31s
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# pass 47
# fail 0

✓   7 [chromium] › tests/e2e/ugc-smoke.spec.ts:589:1 › creator can fix and retry a rejected submission from dashboard (3.2s)
16 passed (49.1s)
```

### UGC 生态补缺口：管理员标垃圾后创作者也可按备注重投
```text
普通创作者探索:
系统自动拦截 spam 已覆盖“修改后重投”，但管理员人工“标记垃圾”也是创作者会遇到的治理结果。
如果这条路没有浏览器回归，后续可能出现创作者看不到管理员说明、或不能从垃圾状态重投的断点。

已补 Playwright：
- 创建创作者投稿
- 管理员后台展开投稿，填写“处理备注：请去掉无关招募广告 ...”
- 管理员点“标记垃圾”
- 创作者登录后看到“被拦截”和具体管理员备注
- 点“修改后重投”带回原稿，修改后重新进入审核
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "admin-spammed"

Running 1 test using 1 worker
·
1 passed (5.1s)
```

### UGC 生态补缺口：举报太频繁时给访客明确提示
```text
普通浏览用户探索:
举报通道已经有限流规则：同 IP 每小时最多 5 次。
但开放 UGC 后，用户最怕的是“点了没反应”或“不知道为什么失败”。
所以补了一条真实浏览器回归：同一个访客连续举报 6 次，前 5 次成功，第 6 次必须在页面上看到“举报太频繁，请稍后再试”。

已补 Playwright：
- 打开公开板详情
- 连续提交 5 次举报并确认进入管理员处理队列
- 第 6 次举报触发限流
- 页面以 role=alert 显示可读错误，不是静默失败
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "report rate limit"

Running 1 test using 1 worker
·
1 passed (3.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# pass 47
# fail 0

✓  15 [chromium] › tests/e2e/ugc-smoke.spec.ts:889:1 › report rate limit shows a visible visitor-facing error (1.9s)
18 passed (54.0s)
```

### UGC 生态补缺口：创作者用户名格式提交前拦截
```text
普通创作者探索:
我按新用户视角在投稿页申请创作者，故意填 `bad name`。
原行为：页面底部显示“信息已补齐，可以提交审核”，按钮可点；点了以后才由后端返回“用户名只能包含小写英文、数字、下划线或短横线”。
问题：小白会以为自己填对了，直到提交才失败。

已修复：
- `src/pages/Submit.tsx` 增加和后端一致的用户名格式判断：3-24 位，小写英文、数字、_、-
- 非法用户名时，用户名下方直接显示规则
- 底部状态变为“还差：登录用户名格式”
- “提交审核”保持禁用
- Playwright 防呆测试改为断言提交前拦截，而不是等后端报错
```

```text
浏览器手动验证:
hint: 用户名需要 3-24 位，只能使用小写英文、数字、下划线或短横线。
status: 还差：登录用户名格式
submitDisabled: true
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails"

Running 1 test using 1 worker
·
1 passed (3.9s)
```

```text
普通创作者手动链路:
- 首页可浏览，投稿页缺字段时显示“还差：标题、团本、BOSS、战术正文”
- 申请创作者：密码不一致时按钮禁用；非法用户名提交前禁用
- 合法申请后显示“账号已创建，投稿已进入审核”，并提供“进入创作者后台”
- 新创作者后台可看到投稿进度，审核期没有直发入口，并提示还需 2 次通过
- 管理员后台投稿审核角标从 1 -> 2 -> 1 -> 清空，审核无需改代码
- 创作者累计 3 次通过后自动出现“我的战术板”和“直接发布”
- 直发风险内容被拦截，正常内容可发布
- 已发布板可编辑保存；下架/恢复链路由 UGC smoke 自动化覆盖
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# pass 47
# fail 0

✓   2 [chromium] › tests/e2e/ugc-smoke.spec.ts:387:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.3s)
✓  18 [chromium] › tests/e2e/ugc-smoke.spec.ts:1024:1 › creator direct publish screens unsafe content in dashboard (775ms)
18 passed (53.7s)
```

### UGC 生态补缺口：创作者危险操作改为页面内二次确认
```text
普通创作者探索:
创作者后台有两个容易误点的动作：撤回待审投稿、下架已发布战术板。
原行为使用浏览器原生 confirm 弹窗，虽然能阻止误点，但体验割裂，也会阻塞内置浏览器预览。
后台管理台同类下架/删除已经是页面内确认，所以创作者侧也收敛成一致的页面内确认。

已修复：
- 点“撤回投稿”先显示页面内确认条，点“取消”保持待审核，点“确认撤回”才撤回
- 点“下架”先显示页面内确认条，点“取消”保持已发布，点“确认下架”才下架
- 下架后仍保留“恢复发布”，管理员隐藏的板仍不能由创作者自行恢复
- 不再依赖浏览器原生 confirm 弹窗
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "withdraw a pending"

Running 1 test using 1 worker
·
1 passed (6.6s)
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..47
# tests 47
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (11.9s)
✓   6 [chromium] › tests/e2e/ugc-smoke.spec.ts:557:1 › creator can withdraw a pending submission from dashboard (4.3s)
18 passed (59.6s)
```

### UGC 生态补缺口：举报“其它”必须补充说明
```text
普通浏览用户探索:
举报理由里有“其它”，但此前可以不写任何说明就提交。
这类举报进入后台后管理员无法判断，开放 UGC 后会制造治理噪音。

已修复：
- 前端选择“其它”时，补充说明变为必填
- 空说明时页面显示“选择其它原因时请补充说明。”，提交按钮禁用
- 填写说明后才允许提交
- 后端 `/api/boards/:id/reports` 同步拒绝空说明，避免绕过前端
```

```text
node --test --test-concurrency=1 server/ugc-ready.test.mjs

1..5
# tests 5
# pass 5
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can report"

Running 1 test using 1 worker
·
1 passed (12.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s

1..47
# tests 47
# pass 47
# fail 0

✓  16 [chromium] › tests/e2e/ugc-smoke.spec.ts:924:1 › visitor can report a board and admin can hide it from public pages (10.0s)
18 passed (1.0m)
```

### UGC 生态补缺口：投稿被系统拦截时不再误报进入审核
```text
普通浏览用户探索:
游客投稿如果命中内容筛查，后端会返回 `status: spam`，不会进入人工审核。
原页面只要接口返回 201 就统一显示“投稿已进入审核”，这会让用户误以为管理员会处理。

已修复：
- 投稿页保存后端返回的 submission.status 和 spamReason
- status=spam 时显示“投稿已被系统拦截，未进入人工审核：内容风险。请修改后重新提交。”
- 被拦截后不清空表单，用户可以直接改正文重新提交
- 正常 pending 投稿仍保持原来的成功提示和清空草稿行为
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "spam-screened visitor"

Running 1 test using 1 worker
·
1 passed (3.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s

1..47
# tests 47
# pass 47
# fail 0

✓  15 [chromium] › tests/e2e/ugc-smoke.spec.ts:900:1 › spam-screened visitor submission stays editable and is not described as queued (824ms)
19 passed (55.6s)
```

### UGC 生态补缺口：创作者登录页补齐“还差”提示
```text
普通创作者探索:
投稿、直发、编辑都有“还差”提示，但创作者登录页只有禁用按钮。
小白看到按钮点不了时，不一定知道是用户名没填、密码没填，还是页面卡住。

已修复：
- 空登录表单显示“还差：用户名、密码”
- 只填用户名时显示“还差：密码”
- 用户名和密码都填完后显示“信息已补齐，可以登录。”
- 表单提交时如果仍未补齐会直接返回，不触发登录请求
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator can change password"

Running 1 test using 1 worker
·
1 passed (3.8s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.89s

1..47
# tests 47
# pass 47
# fail 0

✓   3 [chromium] › tests/e2e/ugc-smoke.spec.ts:453:1 › creator can change password from dashboard and log in with the new password (1.7s)
19 passed (54.4s)
```

### UGC 生态补缺口：创作者修改密码页补齐“还差”提示
```text
普通创作者探索:
创作者进入账号安全区改密码时，原来按钮会禁用，但页面没有像投稿/登录一样明确说还差哪一项。
对小白用户来说，这会像“按钮坏了”。

已修复：
- 空密码表单显示“还差：当前密码、新密码至少 8 位、确认新密码”
- 只填当前密码时显示“还差：新密码至少 8 位、确认新密码”
- 新密码太短时显示“还差：新密码至少 8 位”
- 两次新密码不一致时显示“还差：确认新密码一致”
- 三项都合格后才显示“信息已补齐，可以更新密码。”
- 表单未补齐时不会触发改密码请求
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator can change password"

Running 1 test using 1 worker
·
1 passed (3.7s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.88s

1..47
# tests 47
# pass 47
# fail 0

✓   3 [chromium] › tests/e2e/ugc-smoke.spec.ts:453:1 › creator can change password from dashboard and log in with the new password (1.7s)
19 passed (54.2s)
```

### UGC 生态补缺口：用户修正表单后旧错误自动消失
```text
普通创作者探索:
申请创作者时，如果第一次提交撞到“用户名已被占用”，用户改了用户名以后，旧错误还留在页面上会让人误以为“改了也没用”。

已修复：
- 投稿表单记录用户当前填写内容的指纹
- 只有用户真的修改了表单后，才清掉本地错误和上一次接口错误
- 接口刚返回错误时不会被立刻清掉，用户仍能看见真正原因
- 防呆测试新增“重复用户名 -> 改用户名 -> 旧错误消失 -> 表单重新显示可提交”

决策记录：
- 曾尝试覆盖“禁用提交按钮时按 Enter 触发表单错误”，实际浏览器不会提交禁用按钮对应的表单。
- 该路径不是普通用户可触达路径，改为覆盖真实可触达的重复用户名服务端错误清除。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator application guardrails"

Running 1 test using 1 worker
·
1 passed (3.5s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# pass 47
# fail 0

✓   2 [chromium] › tests/e2e/ugc-smoke.spec.ts:392:1 › creator application guardrails handle missing fields, invalid usernames, and duplicates (1.6s)
19 passed (54.9s)
```

### UGC 生态补缺口：游客投稿成功后可复制投稿编号
```text
普通浏览用户探索:
游客不一定想注册创作者账号，但他也可能提交一份战术板。
原成功提示只把投稿 ID 混在一句话里；小白不一定知道这是后续询问进度的凭证，也不方便复制。

已修复：
- 普通投稿、创作者申请投稿、创作者审核期投稿成功后都显示“投稿编号：xxx”
- 成功区新增“复制投稿编号”按钮
- 复制成功显示“已复制投稿编号。”
- 复制失败显示“复制失败，请手动记录投稿编号。”
- 不改变审核流；游客仍不会拥有创作者后台，编号只作为和管理员沟通的凭证
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "submit draft survives reload"

Running 1 test using 1 worker
·
1 passed (4.3s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..47
# tests 47
# pass 47
# fail 0

✓  14 [chromium] › tests/e2e/ugc-smoke.spec.ts:862:1 › submit draft survives reload without saving password or contact (2.3s)
19 passed (1.0m)
```

### UGC 生态补缺口：创作者账号错误不会在修正后残留
```text
普通创作者探索:
登录输错密码后，用户改成正确密码时，旧的“用户名或密码错误”如果还挂着，会让人误以为仍然错。
修改密码时输错当前密码后，用户改成正确当前密码时，旧的“当前密码不正确”也不该继续显示。

已修复：
- 创作者登录表单在用户名或密码变化后清掉上一次登录错误
- 修改密码表单在当前密码、新密码、确认新密码变化后清掉上一次接口错误和本地错误
- 错误刚返回时不会被立刻清掉；只有用户继续修改输入时才清理
- 浏览器测试覆盖“错误出现 -> 修改输入 -> 旧错误消失 -> 下一步成功”
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator can change password"

Running 1 test using 1 worker
·
1 passed (4.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.96s

1..47
# tests 47
# pass 47
# fail 0

✓   3 [chromium] › tests/e2e/ugc-smoke.spec.ts:456:1 › creator can change password from dashboard and log in with the new password (1.7s)
19 passed (1.0m)
```

### UGC 生态补缺口：创作者日常操作成功提示不误导下一次编辑
```text
普通创作者探索:
创作者保存资料后，如果继续改资料，旧的“资料已保存。”还留着，会让人误以为新改动也已经保存。
直发一块板成功后，如果开始写下一块板，旧的“战术板已发布。”也不该继续显示。

已修复：
- 作者主页资料任一字段变化后，清掉上一次保存成功/失败状态
- 直发表单任一字段变化后，清掉上一次发布成功/失败状态
- 编辑战术板时任一字段变化后，清掉上一次保存失败状态
- 成功提交后的表单清空仍保留成功提示；只有用户继续输入下一份内容时才清理
- 浏览器主链覆盖“资料保存成功 -> 二次编辑 -> 旧成功提示消失”和“直发成功 -> 开始下一块草稿 -> 旧成功提示消失”

修复记录：
- 首次实现时把带参数的 resetCreateForm 直接传给按钮，TypeScript 报错：
  `Type '(clearStatus?: boolean) => void' is not assignable to type 'MouseEventHandler<HTMLButtonElement>'`
- 已改为 `onClick={() => resetCreateForm()}` 后重新验证通过。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (12.9s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.90s

1..47
# tests 47
# pass 47
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (11.9s)
19 passed (1.0m)
```

### UGC 生态补缺口：举报失败后继续修改会清掉旧错误
```text
普通浏览用户探索:
访客举报如果触发限流，会看到“举报太频繁，请稍后再试”。
如果他继续改举报说明，旧错误还挂在表单上，会让人误以为页面没有响应。

已修复：
- 举报表单打开/关闭时清掉上一次接口错误
- 修改举报理由时清掉上一次接口错误
- 修改补充说明时清掉上一次接口错误
- 如果再次提交仍然命中限流，会重新显示新的错误
- 不改变后端限流规则，只改善失败后的恢复反馈
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "report rate limit"

Running 1 test using 1 worker
·
1 passed (4.3s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.88s

1..47
# tests 47
# pass 47
# fail 0

✓  16 [chromium] › tests/e2e/ugc-smoke.spec.ts:954:1 › report rate limit shows a visible visitor-facing error (7.3s)
19 passed (1.2m)
```

### UGC 生态补缺口：点赞失败不再静默
```text
普通浏览用户探索:
用户在首页卡片或详情页点赞时，如果网络/API 失败，原来只会把数字回滚，没有任何解释。
小白会以为自己没点上，或者页面坏了。

已修复：
- 首页/作者页卡片点赞失败时显示“点赞失败，请稍后再试。”
- 详情页侧栏点赞失败时显示同样的可见提示
- 失败后点赞数回滚到后端原值
- 失败提示带 role=status，读屏也能感知
- 不改变成功点赞语义；成功后仍只允许本会话内点一次，后端真值继续接管
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "like actions show"

Running 1 test using 1 worker
·
1 passed (3.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.92s

1..47
# tests 47
# pass 47
# fail 0

✓  13 [chromium] › tests/e2e/ugc-smoke.spec.ts:834:1 › like actions show a visible failure state when the API rejects the click (629ms)
20 passed (56.3s)
```

### UGC 生态补缺口：重复正文拦截说清楚不会重复进审核
```text
普通浏览用户探索:
用户把同一段正文在同一网络下重复投稿时，系统会直接拦截，避免审核队列被重复内容占满。
原提示只说“同一网络下重复正文”，小白不一定明白这条不会进入审核，可能继续反复点提交。

已修复：
- duplicate_content 的人话说明改为“同一网络下重复正文，系统不会重复进入审核”
- 拦截提示仍明确说“未进入人工审核”，避免用户误以为已经排队
- 表单内容保留，用户可以直接修改正文后重新提交
- 后端防刷规则不变，本轮只补清晰提示和浏览器回归覆盖
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "duplicate visitor submission"

Running 1 test using 1 worker
·
1 passed (3.3s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 2.02s

1..47
# tests 47
# pass 47
# fail 0

✓  17 [chromium] › tests/e2e/ugc-smoke.spec.ts:980:1 › duplicate visitor submission explains that the same content will not enter review twice (1.2s)
21 passed (1.0m)
```

### UGC 生态补缺口：创作者后台重复正文拦截说清楚
```text
创作者用户探索:
创作者在审核期内从后台看到被系统拦截的投稿时，投稿页已经说清楚“重复正文不会重复进入审核”，但后台投稿进度仍只显示“同一网络下重复正文”。
小白从投稿页回到后台后会再次困惑：到底是不是还在排队、要不要继续等管理员。

已修复：
- 创作者后台 duplicate_content 文案统一为“同一网络下重复正文，系统不会重复进入审核”
- 后台仍显示“被拦截 / 没有进入人工审核”，不把 spam 状态误说成待审核
- 被拦截的重复正文投稿仍可点“修改后重投”，带回原表单内容
- 修改正文后可以重新进入创作者审核进度

决策记录：
- 滥用/限流相关 E2E 用例必须显式设置独立 X-Forwarded-For。否则整套浏览器测试串跑时，不同用例会共享默认来源并误触投稿限流，导致测试没有测到目标防线。
- 本次没有放宽后端限流；只修正测试前提，并统一创作者后台的人话提示。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "creator dashboard explains duplicate"

Running 1 test using 1 worker
·
1 passed (4.6s)
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "spam-screened visitor submission"

Running 1 test using 1 worker
·
1 passed (3.0s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..47
# tests 47
# pass 47
# fail 0

✓   9 [chromium] › tests/e2e/ugc-smoke.spec.ts:718:1 › creator dashboard explains duplicate content screening and keeps retry editable (2.3s)
✓  17 [chromium] › tests/e2e/ugc-smoke.spec.ts:1029:1 › spam-screened visitor submission stays editable and is not described as queued (1.1s)
22 passed (1.1m)
```

### UGC 生态补缺口：游客投稿编号可自助查询状态
```text
普通浏览用户探索:
普通游客投稿成功后只有一个投稿编号，但之前没有自助查询入口。
这会导致用户不知道投稿是待审核、已发布、被驳回还是被系统拦截，只能等管理员沟通，普通用户自循环断在这里。

已修复：
- 新增公开只读接口 GET /api/submissions/:id/receipt
- 返回有限状态：投稿编号、标题、状态、审核备注、拦截原因、公开板 ID、创建/处理时间
- 不返回联系方式、sourceKey、正文、后台完整投稿字段，避免把管理员视角数据公开出去
- 投稿页新增“查询投稿状态”面板，可手动输入投稿编号
- 投稿成功区新增“查看审核状态”
- 待审核显示“管理员还没有处理，请稍后再来查”
- 审核通过后显示“已发布”，并提供“打开战术板”入口
- 未通过/被系统拦截/已撤回用非绿色状态提示，避免把失败状态误看成成功

决策记录：
- 不做邮箱/短信/第三方登录，符合本次非目标；普通游客只用投稿编号完成状态查询。
- 投稿编号查询接口只做有限公开状态，不复用管理员投稿响应，避免泄露联系方式与来源信息。
- 用户如果已经停留在同一编号查询页，重新点“查询”刷新状态；测试按这个真实动作覆盖审核通过后的更新。
```

```text
node --test --test-concurrency=1 server/submissions.test.mjs

1..8
# tests 8
# pass 8
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor can check submission receipt"

Running 1 test using 1 worker
·
1 passed (3.2s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.94s

1..47
# tests 47
# pass 47
# fail 0

✓  17 [chromium] › tests/e2e/ugc-smoke.spec.ts:1029:1 › visitor can check submission receipt and open the approved board (964ms)
23 passed (1.1m)
```

### UGC 生态补缺口：投稿编号查询接口限流
```text
普通浏览用户探索:
投稿编号查询是公开接口。它让游客能自助查状态，但如果不限流，开放 UGC 后可能被脚本反复扫编号或压接口。

已修复：
- GET /api/submissions/:id/receipt 增加持久化限流
- 同一来源每小时最多查询 30 次
- 不存在的投稿编号也会计入限流，避免被用于枚举
- 前端查询面板会显示“查询太频繁，请稍后再试”
- 不改变正常查询、投稿、审核、公开板跳转流程

决策记录：
- 限流粒度沿用现有 sourceKey / X-Forwarded-For 语义，和投稿、举报、点赞防线一致。
- 阈值先设为 30 次 / 小时：足够正常用户偶尔刷新状态，也能挡住明显脚本扫号。
```

```text
node --test --test-concurrency=1 server/submissions.test.mjs

1..9
# tests 9
# pass 9
# fail 0
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "submission receipt rate limit"

Running 1 test using 1 worker
·
1 passed (2.7s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.91s

1..48
# tests 48
# pass 48
# fail 0

✓  18 [chromium] › tests/e2e/ugc-smoke.spec.ts:1063:1 › submission receipt rate limit shows a visible visitor-facing error (5.6s)
24 passed (1.2m)
```

### UGC 生态补缺口：创作者直发成功后立即可打开和分享
```text
创作者用户探索:
正式创作者直发成功后，原来只显示“战术板已发布。”。
虽然下方“我的战术板”列表里有公开板入口和复制链接，但新手发布完成后不一定知道要往下找，分享闭环不够直接。

已修复：
- 直发成功提示区新增“查看刚发布的公开板”
- 直发成功提示区新增“复制刚发布链接”
- 复制成功显示“刚发布的链接已复制。”
- 用户继续输入下一块板时，旧成功提示和复制提示会清掉
- 下方已发布板列表原有“查看公开板 / 复制链接”保持不变

决策记录：
- 不新增弹窗或跳转，避免打断连续发布；只在成功提示区补下一步动作。
- 复制链接复用现有 copyToClipboard，失败时继续提示用户打开公开页后从地址栏复制。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (13.4s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.93s

1..48
# tests 48
# pass 48
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (11.7s)
24 passed (1.0m)
```

### UGC 生态补缺口：创作者作者主页可直接复制分享
```text
创作者用户探索:
创作者保存作者简介、公会信息后，已有“查看主页”，但没有“复制主页链接”。
小白想把作者主页发给队友或公会时，还要先打开页面再从地址栏复制，分享闭环不够直接。

已修复：
- 作者主页资料区新增“复制主页链接”
- 复制成功显示“作者主页链接已复制。”
- 用户继续修改资料时，旧的复制成功提示会清掉
- 原有“查看主页”保留，仍可直接检查公开展示效果

决策记录：
- 不新增独立分享弹窗；直接复用已有 copyToClipboard 和页面内状态提示。
- 这是作者主页分享闭环，不改变作者资料保存接口和公开字段范围。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "UGC smoke"

Running 1 test using 1 worker
·
1 passed (14.1s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.93s

1..48
# tests 48
# pass 48
# fail 0

✓   1 [chromium] › tests/e2e/ugc-smoke.spec.ts:135:1 › UGC smoke: browse, copy, submit, approve, publish, and creator direct post (12.0s)
24 passed (1.1m)
```

### UGC 生态补缺口：投稿未通过后可重新投稿
```text
普通浏览用户探索:
游客拿投稿编号查询状态时，如果投稿被驳回、被系统拦截或已撤回，页面原来只展示失败状态。
小白看到“未通过”后不知道下一步是回首页、重新填表，还是联系管理员，开放 UGC 后会形成断点。

已修复：
- rejected / spam / withdrawn 状态显示“重新投稿”
- 点击后清空投稿编号、清空查询结果、移除 URL 上的 receipt 参数
- 回到干净投稿表单，并重新显示“还差”缺项提示
- 不回填原投稿正文、联系方式或来源信息

决策记录：
- 公开投稿编号只用于状态查询，不用于反查正文或联系方式；因此重新投稿从空表单开始，保护投稿隐私。
- approved 状态的 URL 自动查询已由既有 Playwright 覆盖；本轮新增 rejected 手动查询后重投，覆盖小白最常见的“拿编号来查”路径。
```

```text
CI=1 npx playwright test tests/e2e/ugc-smoke.spec.ts --grep "visitor rejected receipt"

Running 1 test using 1 worker
·
1 passed (2.7s)
```

```text
npm run verify

vite v5.4.21 building for production...
✓ 571 modules transformed.
✓ built in 1.94s

1..48
# tests 48
# pass 48
# fail 0

✓  18 [chromium] › tests/e2e/ugc-smoke.spec.ts:1072:1 › visitor rejected receipt can return to a clean resubmission form (564ms)
25 passed (1.0m)
```

## 已知问题
- M5 已完成第一轮按职责拆分，`src/pages/Admin.tsx` 从 2242 行降到 1593 行；作者/战术板表单仍留在主文件，后续可继续细拆但不阻塞本次 UGC 开放。
- M6 已完成 worker schema/路由同步和核心读接口契约测试；worker 仍不是当前业务权威。
- Vite 构建仍有 chunk size warning，属于既有体积问题，本轮未处理。
- 浏览器控制台有 React Router v7 future warning，非本轮错误。

## 发现但未处理
- Admin 页面作者/战术板表单仍可继续拆成 `pages/admin/*` 子组件，但 M5 的审核效率与核心拆分已完成。
- worker D1 版本已补核心契约测试；后续如要让 D1 承担生产流量，还需要单独做写接口压力和迁移演练。
