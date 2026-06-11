import { expect, test, type APIRequestContext } from '@playwright/test'

const ADMIN_PASSWORD = 'test-admin-password'

async function adminToken(request: APIRequestContext) {
  const res = await request.post('/api/admin/login', {
    data: { password: ADMIN_PASSWORD },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return body.token as string
}

async function submitCreatorReview(request: APIRequestContext, token: string, suffix: string) {
  const res = await request.post('/api/submissions', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `E2E 晋升审核 ${suffix}`,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 晋升审核 ${suffix}`,
      contentText: `P1 E2E 晋升 ${suffix}\nP2 集合`,
      submitterName: 'E2E 创作者',
      wantsCreatorProfile: false,
    },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

async function createCreatorApplication(request: APIRequestContext, suffix: string) {
  const username = `self_${suffix}`
  const password = 'creator-password-123'
  const title = `E2E 自助账号 ${suffix}`
  const contentText = `P1 自助账号 ${suffix}\nP2 集合`
  const res = await request.post('/api/submissions', {
    data: {
      title,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 自助账号 ${suffix}`,
      contentText,
      submitterName: `自助创作者 ${suffix}`,
      wantsCreatorProfile: true,
      creatorUsername: username,
      creatorPassword: password,
    },
  })
  expect(res.status()).toBe(201)
  return { username, password, title, contentText }
}

async function approvePending(request: APIRequestContext, token: string, id: string, authorId?: string) {
  const res = await request.post(`/api/admin/submissions/${id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: authorId ? { mode: 'existingAuthor', authorId } : { mode: 'createAuthor' },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test('UGC smoke: browse, copy, submit, approve, publish, and creator direct post', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creatorUsername = `e2e_${runId}`
  const firstTitle = `E2E 游客创作者投稿 ${runId}`
  const directTitle = `E2E 创作者直发 ${runId}`

  await page.goto('/')
  await expect(page.getByRole('heading', { name: '找一块能直接用的战术板' })).toBeVisible()

  const firstBoard = page.locator('.ps-card__link').first()
  await expect(firstBoard).toBeVisible()
  await firstBoard.click()
  await expect(page.getByRole('button', { name: /复制战术/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '复制链接' })).toBeVisible()
  await page.getByRole('button', { name: '复制链接' }).click()
  await expect(page.getByText('链接已复制')).toBeVisible()
  await page.getByRole('button', { name: /复制战术/ }).click()
  await expect(page.getByText('已复制到剪贴板')).toBeVisible()
  await expect(page.getByRole('link', { name: '基于此投稿' })).toBeVisible()
  await page.getByRole('link', { name: '基于此投稿' }).click()
  await expect(page).toHaveURL(/\/submit\?from=/)
  await expect(page.getByText('已带入源战术板内容，修改后提交审核。')).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(/基于 .+ 的调整/)
  await expect(page.locator('#ps-submit-raid')).not.toHaveValue('')
  await expect(page.locator('#ps-submit-boss')).not.toHaveValue('')
  await expect(page.getByLabel('战术正文')).not.toHaveValue('')

  await page.getByLabel('标题').fill(firstTitle)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByRole('radio', { name: /申请创作者/ }).click()
  await page.getByLabel('作者名 / 投稿署名').fill('E2E 创作者')
  await page.getByLabel('用户名').fill(creatorUsername)
  await page.getByLabel('密码').fill('creator-password-123')
  await page.getByLabel('战术正文').fill(`P1 E2E 分散 ${runId}\nP2 E2E 集合`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/账号已创建，投稿已进入审核/)).toBeVisible()

  const creatorToken = await page.evaluate(() => localStorage.getItem('planshare_creator_token'))
  expect(creatorToken).toBeTruthy()

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
  await expect(page.getByText(firstTitle)).toBeVisible()
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '投稿审核' }).click()
  await expect(page.getByText(firstTitle)).toBeVisible()
  const firstSubmissionRow = page.locator('.ps-admin__row-card', { hasText: firstTitle })
  await firstSubmissionRow.getByRole('button', { name: '查看' }).click()
  await firstSubmissionRow.getByRole('button', { name: '创建作者并发布' }).click()
  await expect(firstSubmissionRow.getByText('已发布')).toBeVisible()

  const admin = await adminToken(request)
  const submissions = await request.get('/api/admin/submissions', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  expect(submissions.ok()).toBeTruthy()
  const published = (await submissions.json()).find((item: { title: string }) => item.title === firstTitle)
  expect(published?.boardId).toBeTruthy()
  expect(published?.authorId).toBeTruthy()

  await page.goto(`/board/${published.boardId}`)
  await expect(page.getByRole('heading', { name: firstTitle })).toBeVisible()

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '还需 2 次审核通过' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
  await expect(page.getByText(firstTitle)).toBeVisible()
  await expect(page.getByText('已通过')).toBeVisible()
  await expect(page.getByRole('link', { name: '查看公开板' })).toBeVisible()
  await expect(page.getByText('资料草稿会自动保存在本机；保存成功后清空。')).toBeVisible()

  await page.getByLabel('简介').fill(`E2E 资料草稿 ${runId}`)
  await page.getByLabel('公会名').fill(`E2E 公会 ${runId}`)
  await page.getByLabel('公会联系方式').fill(`E2E 联系 ${runId}`)
  await page.getByLabel('招募说明').fill(`E2E 招募 ${runId}`)

  await page.reload()
  await expect(page.getByText('资料草稿会自动保存在本机；保存成功后清空。')).toBeVisible()
  await expect(page.getByLabel('简介')).toHaveValue(`E2E 资料草稿 ${runId}`)
  await expect(page.getByLabel('公会名')).toHaveValue(`E2E 公会 ${runId}`)
  await expect(page.getByLabel('公会联系方式')).toHaveValue(`E2E 联系 ${runId}`)
  await expect(page.getByLabel('招募说明')).toHaveValue(`E2E 招募 ${runId}`)
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('资料已保存。')).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_profile_draft_v1')).length,
    ),
  ).resolves.toBe(0)

  const second = await submitCreatorReview(request, creatorToken!, `${runId}-two`)
  await approvePending(request, admin, second.id, published.authorId)
  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '还需 1 次审核通过' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toHaveCount(0)

  const third = await submitCreatorReview(request, creatorToken!, `${runId}-three`)
  await approvePending(request, admin, third.id, published.authorId)

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  await expect(page.getByText('直发草稿会自动保存在本机；成功发布后清空。')).toBeVisible()
  await page.getByLabel('标题').fill(directTitle)
  await page.locator('#creator-board-raid').selectOption('r-voidspire')
  await page.locator('#creator-board-boss').selectOption('b-averzian')
  await page.locator('#creator-board-description').fill(`E2E 直发草稿 ${runId}`)
  await page.getByLabel('战术正文').fill('P1 创作者直发\nP2 结束')

  await page.reload()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(directTitle)
  await expect(page.locator('#creator-board-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#creator-board-boss')).toHaveValue('b-averzian')
  await expect(page.locator('#creator-board-description')).toHaveValue(`E2E 直发草稿 ${runId}`)
  await expect(page.getByLabel('战术正文')).toHaveValue('P1 创作者直发\nP2 结束')

  await page.getByRole('button', { name: '直接发布' }).click()
  await expect(page.getByText('战术板已发布。')).toBeVisible()
  const directBoardRow = page.locator('.ps-creator__board', { hasText: directTitle })
  await expect(directBoardRow.getByRole('link', { name: '查看公开板' })).toBeVisible()
  await expect(directBoardRow.getByRole('button', { name: '复制链接' })).toBeVisible()
  await directBoardRow.getByRole('button', { name: '复制链接' }).click()
  await expect(directBoardRow.getByText('链接已复制。')).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_board_draft_v1')).length,
    ),
  ).resolves.toBe(0)

  await directBoardRow.getByRole('button', { name: '编辑' }).click()
  await expect(directBoardRow.getByText('编辑草稿会自动保存在本机；保存成功后清空。')).toBeVisible()
  await directBoardRow.getByLabel('标题').fill(`${directTitle} 修订`)
  await directBoardRow.getByLabel('战术正文').fill('P1 创作者直发修订\nP2 结束')

  await page.reload()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  const reloadedDirectBoardRow = page.locator('.ps-creator__board', { hasText: directTitle })
  await reloadedDirectBoardRow.getByRole('button', { name: '编辑' }).click()
  await expect(reloadedDirectBoardRow.getByLabel('标题')).toHaveValue(`${directTitle} 修订`)
  await expect(reloadedDirectBoardRow.getByLabel('战术正文')).toHaveValue('P1 创作者直发修订\nP2 结束')
  await reloadedDirectBoardRow.getByRole('button', { name: '保存修改' }).click()
  await expect(reloadedDirectBoardRow.getByText(`${directTitle} 修订`)).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_board_edit_draft_v1')).length,
    ),
  ).resolves.toBe(0)
})

test('creator application guardrails handle missing fields, invalid usernames, and duplicates', async ({ page }) => {
  const runId = Date.now().toString(36)
  const creatorUsername = `guard_${runId}`

  async function fillCreatorApplication(title: string, username: string) {
    await page.getByLabel('标题').fill(title)
    await page.locator('#ps-submit-raid').selectOption('r-voidspire')
    await page.locator('#ps-submit-boss').selectOption('b-averzian')
    await page.getByRole('radio', { name: /申请创作者/ }).click()
    await page.getByLabel('作者名 / 投稿署名').fill(`防呆创作者 ${runId}`)
    await page.getByLabel('用户名').fill(username)
    await page.getByLabel('密码').fill('creator-password-123')
    await page.getByLabel('战术正文').fill(`P1 防呆验证 ${title}\nP2 集合`)
  }

  await page.goto('/submit')
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()

  await page.getByRole('radio', { name: /申请创作者/ }).click()
  await page.getByLabel('标题').fill(`缺密码防呆 ${runId}`)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('作者名 / 投稿署名').fill(`防呆创作者 ${runId}`)
  await page.getByLabel('用户名').fill(`short_${runId}`)
  await page.getByLabel('战术正文').fill('P1 缺密码')
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()

  await page.goto('/submit')
  await fillCreatorApplication(`非法用户名防呆 ${runId}`, 'Bad Name')
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText('用户名只能包含小写英文、数字、下划线或短横线')).toBeVisible()

  await page.getByLabel('用户名').fill(creatorUsername)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/账号已创建，投稿已进入审核/)).toBeVisible()

  await page.evaluate(() => localStorage.removeItem('planshare_creator_token'))
  await page.goto('/submit')
  await fillCreatorApplication(`重复用户名防呆 ${runId}`, creatorUsername.toUpperCase())
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText('这个用户名已被占用')).toBeVisible()
})

test('creator can change password from dashboard and log in with the new password', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, runId)
  const nextPassword = 'creator-password-456'

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '修改密码' })).toBeVisible()

  await page.getByLabel('当前密码').fill('wrong-password')
  await page.getByLabel('新密码', { exact: true }).fill(nextPassword)
  await page.getByLabel('确认新密码').fill(nextPassword)
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page.getByText('当前密码不正确')).toBeVisible()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  await page.getByLabel('当前密码').fill(creator.password)
  await page.getByLabel('确认新密码').fill('mismatch-password')
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page.getByText('两次新密码不一致。')).toBeVisible()

  await page.getByLabel('确认新密码').fill(nextPassword)
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page.getByText('密码已更新。')).toBeVisible()

  await page.getByRole('button', { name: '退出登录' }).click()
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('用户名或密码错误')).toBeVisible()

  await page.getByLabel('密码').fill(nextPassword)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '后台' })).toBeVisible()
})

test('creator can withdraw a pending submission from dashboard', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `withdraw_${runId}`)

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
  await expect(page.getByText(creator.title)).toBeVisible()
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '撤回投稿' }).click()
  await expect(page.getByText('已撤回', { exact: true })).toBeVisible()
  await expect(page.getByText('创作者已自行撤回')).toBeVisible()
  await expect(page.getByRole('button', { name: '撤回投稿' })).toHaveCount(0)

  await page.getByRole('button', { name: '修改后重投' }).click()
  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByLabel('标题')).toHaveValue(creator.title)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('战术正文')).toHaveValue(creator.contentText)
})

test('home search finds boards by boss and author names', async ({ page }) => {
  await page.goto('/')
  const search = page.getByPlaceholder('搜索 BOSS、作者、技能名或关键词')
  const button = page.getByRole('button', { name: '搜索' })
  await expect(button).toBeEnabled()

  await search.fill('元首阿福扎恩')
  await button.click()
  await expect(page).toHaveURL(/\/board\/p-averzian-m1$/)
  await expect(page.getByRole('heading', { name: '元首阿福扎恩 · M' })).toBeVisible()

  await page.goto('/')
  await expect(button).toBeEnabled()
  await search.fill('妮可')
  await button.click()
  await expect(page).toHaveURL(/\/board\/p-beloren-nike$/)
  await expect(page.locator('.ps-detail__author', { hasText: '妮可' })).toBeVisible()
})

test('submit draft survives reload without saving password or contact', async ({ page }) => {
  const runId = Date.now().toString(36)
  const draftTitle = `草稿保护 ${runId}`

  await page.goto('/submit')
  await expect(page.getByText('草稿会自动保存在本机；密码和联系方式不会保存。')).toBeVisible()
  await page.getByLabel('标题').fill(draftTitle)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByRole('radio', { name: /申请创作者/ }).click()
  await page.getByLabel('作者名 / 投稿署名').fill(`草稿作者 ${runId}`)
  await page.getByLabel('用户名').fill(`draft_${runId}`)
  await page.getByLabel('密码').fill('creator-password-123')
  await page.getByLabel('联系方式（可选）', { exact: true }).fill('secret-contact')
  await page.getByLabel('战术正文').fill(`P1 草稿保护 ${runId}\nP2 集合`)

  await page.reload()
  await expect(page.getByLabel('标题')).toHaveValue(draftTitle)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('作者名 / 投稿署名')).toHaveValue(`草稿作者 ${runId}`)
  await expect(page.getByLabel('用户名')).toHaveValue(`draft_${runId}`)
  await expect(page.getByLabel('密码')).toHaveValue('')
  await expect(page.getByLabel('联系方式（可选）', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('战术正文')).toHaveValue(`P1 草稿保护 ${runId}\nP2 集合`)

  await page.getByRole('radio', { name: /普通投稿/ }).click()
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()
  await expect(page.evaluate(() => localStorage.getItem('planshare_submit_draft_v1'))).resolves.toBeNull()
})
