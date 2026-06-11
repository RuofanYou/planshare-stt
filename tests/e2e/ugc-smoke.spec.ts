import { expect, test, type APIRequestContext } from '@playwright/test'

const ADMIN_PASSWORD = 'test-admin-password'

function hashSuffix(value: string) {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return hash
}

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
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': `203.0.113.${Math.abs(hashSuffix(suffix)) % 200}`,
    },
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
    headers: { 'X-Forwarded-For': `198.51.100.${Math.abs(hashSuffix(suffix)) % 200}` },
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
  const body = await res.json()
  return {
    username,
    password,
    title,
    contentText,
    token: body.creatorAuth?.token as string | undefined,
    authorId: body.creatorAuth?.author?.id as string | undefined,
  }
}

async function createTrustedCreator(request: APIRequestContext, suffix: string) {
  const creator = await createCreatorApplication(request, suffix)
  expect(creator.token).toBeTruthy()
  expect(creator.authorId).toBeTruthy()
  const admin = await adminToken(request)

  const submissions = await request.get('/api/admin/submissions', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  expect(submissions.ok()).toBeTruthy()
  const first = (await submissions.json()).find((item: { title: string }) => item.title === creator.title)
  expect(first?.id).toBeTruthy()
  await approvePending(request, admin, first.id, creator.authorId)

  const second = await submitCreatorReview(request, creator.token!, `${suffix}-two`)
  await approvePending(request, admin, second.id, creator.authorId)
  const third = await submitCreatorReview(request, creator.token!, `${suffix}-three`)
  await approvePending(request, admin, third.id, creator.authorId)

  return { ...creator, admin, token: creator.token!, authorId: creator.authorId! }
}

async function approvePending(request: APIRequestContext, token: string, id: string, authorId?: string) {
  const res = await request.post(`/api/admin/submissions/${id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: authorId ? { mode: 'existingAuthor', authorId } : { mode: 'createAuthor' },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function createAdminBoard(request: APIRequestContext, suffix: string) {
  const admin = await adminToken(request)
  const author = await request.post('/api/authors', {
    headers: { Authorization: `Bearer ${admin}` },
    data: { name: `E2E 举报作者 ${suffix}` },
  })
  expect(author.status()).toBe(201)
  const authorBody = await author.json()

  const board = await request.post('/api/boards', {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      title: `E2E 举报处理 ${suffix}`,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 举报处理 ${suffix}`,
      contentText: `P1 举报测试 ${suffix}\nP2 集合`,
      authorId: authorBody.id,
      isFeatured: false,
    },
  })
  expect(board.status()).toBe(201)
  return { admin, board: await board.json() }
}

test('UGC smoke: browse, copy, submit, approve, publish, and creator direct post', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creatorUsername = `e2e_${runId}`
  const firstTitle = `E2E 游客创作者投稿 ${runId}`
  const directTitle = `E2E 创作者直发 ${runId}`

  await page.goto('/')
  await expect(page.getByRole('heading', { name: '找一块能直接用的战术板' })).toBeVisible()

  const firstCard = page.locator('.ps-card').first()
  await expect(firstCard).toBeVisible()
  const firstCardTitle = (await firstCard.locator('.ps-card__title').innerText()).trim()
  const cardLike = firstCard.getByRole('button', { name: '点赞' })
  const cardLikeBeforeText = (await cardLike.textContent()) ?? ''
  const cardLikeBefore = Number(cardLikeBeforeText.replace(/[^\d]/g, ''))
  expect(Number.isFinite(cardLikeBefore)).toBeTruthy()
  await cardLike.click()
  await expect(firstCard.getByRole('button', { name: '已点赞' })).toContainText(String(cardLikeBefore + 1))
  await page.reload()
  const likedCard = page.locator('.ps-card', { hasText: firstCardTitle })
  await expect(likedCard.getByRole('button', { name: '点赞' })).toContainText(String(cardLikeBefore + 1))

  const firstBoard = likedCard.locator('.ps-card__link')
  await expect(firstBoard).toBeVisible()
  await firstBoard.click()
  await expect(page.getByRole('button', { name: /复制战术/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '复制链接' })).toBeVisible()
  const likeButton = page.getByRole('button', { name: '点赞' })
  const likeBeforeText = (await likeButton.textContent()) ?? ''
  const likeBefore = Number(likeBeforeText.replace(/[^\d]/g, ''))
  expect(Number.isFinite(likeBefore)).toBeTruthy()
  await likeButton.click()
  const likedButton = page.getByRole('button', { name: '已点赞' })
  await expect(likedButton).toContainText(String(likeBefore + 1))
  await page.waitForTimeout(500)
  await expect(likedButton).not.toContainText(String(likeBefore + 2))
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
  await page.getByLabel('密码', { exact: true }).fill('creator-password-123')
  await page.getByLabel('确认密码').fill('creator-password-123')
  await page.getByLabel('战术正文').fill(`P1 E2E 分散 ${runId}\nP2 E2E 集合`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/账号已创建，投稿已进入审核/)).toBeVisible()
  await expect(page.getByRole('link', { name: '进入创作者后台' })).toBeVisible()
  await expect(page.getByRole('link', { name: '回首页浏览' })).toBeVisible()

  const creatorToken = await page.evaluate(() => localStorage.getItem('planshare_creator_token'))
  expect(creatorToken).toBeTruthy()

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
  await expect(page.getByText(firstTitle)).toBeVisible()
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()
  await expect(page.getByText('资料可半公开展示；前 3 个战术板通过审核后会开放直接发布。')).toBeVisible()
  await expect(page.getByText('首个战术板通过审核后会开放直接发布。')).toHaveCount(0)

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
  await expect(page.getByText('资料已展示在作者主页；累计 3 次审核通过后会开放直接发布。')).toBeVisible()
  await expect(page.getByText('资料会展示在作者主页；上方可直接发布和维护你的战术板。')).toHaveCount(0)
  await expect(page.getByText('资料草稿会自动保存在本机；保存成功后清空。')).toBeVisible()

  await page.getByLabel('简介').fill(`E2E 资料草稿 ${runId}`)
  await page.getByLabel('公会名').fill(`E2E 公会 ${runId}`)
  await page.getByLabel('公会联系方式').fill(`E2E 联系 ${runId}`)
  await page.getByLabel('招募说明').fill(`E2E 招募 ${runId}`)

  await page.reload()
  await expect(page.getByText('资料草稿会自动保存在本机；保存成功后清空。')).toBeVisible()
  await expect(page.getByRole('button', { name: '清空资料草稿' })).toBeVisible()
  await expect(page.getByLabel('简介')).toHaveValue(`E2E 资料草稿 ${runId}`)
  await expect(page.getByLabel('公会名')).toHaveValue(`E2E 公会 ${runId}`)
  await expect(page.getByLabel('公会联系方式')).toHaveValue(`E2E 联系 ${runId}`)
  await expect(page.getByLabel('招募说明')).toHaveValue(`E2E 招募 ${runId}`)
  await page.getByRole('button', { name: '清空资料草稿' }).click()
  await expect(page.getByRole('button', { name: '清空资料草稿' })).toHaveCount(0)
  await expect(page.getByLabel('简介')).toHaveValue('')
  await expect(page.getByLabel('公会名')).toHaveValue('')
  await expect(page.getByLabel('公会联系方式')).toHaveValue('')
  await expect(page.getByLabel('招募说明')).toHaveValue('')
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_profile_draft_v1')).length,
    ),
  ).resolves.toBe(0)
  await page.getByLabel('简介').fill(`E2E 资料草稿 ${runId}`)
  await page.getByLabel('公会名').fill(`E2E 公会 ${runId}`)
  await page.getByLabel('公会联系方式').fill(`E2E 联系 ${runId}`)
  await page.getByLabel('招募说明').fill(`E2E 招募 ${runId}`)
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('资料已保存。')).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_profile_draft_v1')).length,
    ),
  ).resolves.toBe(0)
  await page.getByLabel('简介').fill(`E2E 二次资料草稿 ${runId}`)
  await expect(page.getByText('资料已保存。')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '清空资料草稿' })).toBeVisible()
  await page.getByRole('button', { name: '清空资料草稿' }).click()
  await expect(page.getByLabel('简介')).toHaveValue(`E2E 资料草稿 ${runId}`)
  await page.getByRole('link', { name: '查看主页' }).click()
  await expect(page.getByRole('heading', { name: `E2E 公会 ${runId}` })).toBeVisible()
  await expect(page.getByText(`E2E 招募 ${runId}`)).toBeVisible()
  await expect(page.getByText(`E2E 联系 ${runId}`)).toBeVisible()
  await page.getByRole('button', { name: '复制联系方式' }).click()
  await expect(page.getByRole('button', { name: /已复制/ })).toBeVisible()

  const second = await submitCreatorReview(request, creatorToken!, `${runId}-two`)
  await approvePending(request, admin, second.id, published.authorId)
  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '还需 1 次审核通过' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toHaveCount(0)

  const third = await submitCreatorReview(request, creatorToken!, `${runId}-three`)
  await approvePending(request, admin, third.id, published.authorId)

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  await expect(page.getByText('资料会展示在作者主页；上方可直接发布和维护你的战术板。')).toBeVisible()
  await expect(page.getByText('直发草稿会自动保存在本机；成功发布后清空。')).toBeVisible()
  await expect(page.getByText('还差：标题、团本、BOSS、战术正文')).toBeVisible()
  await page.getByLabel('标题').fill(directTitle)
  await page.locator('#creator-board-raid').selectOption('r-voidspire')
  await page.locator('#creator-board-boss').selectOption('b-averzian')
  await page.locator('#creator-board-description').fill(`E2E 直发草稿 ${runId}`)
  await page.getByLabel('战术正文').fill('P1 创作者直发\nP2 结束')
  await expect(page.getByText('信息已补齐，可以直接发布。')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  await expect(page.getByRole('button', { name: '清空直发草稿' })).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(directTitle)
  await expect(page.locator('#creator-board-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#creator-board-boss')).toHaveValue('b-averzian')
  await expect(page.locator('#creator-board-description')).toHaveValue(`E2E 直发草稿 ${runId}`)
  await expect(page.getByLabel('战术正文')).toHaveValue('P1 创作者直发\nP2 结束')
  await page.getByRole('button', { name: '清空直发草稿' }).click()
  await expect(page.getByRole('button', { name: '清空直发草稿' })).toHaveCount(0)
  await expect(page.getByLabel('标题')).toHaveValue('')
  await expect(page.locator('#creator-board-raid')).toHaveValue('')
  await expect(page.locator('#creator-board-boss')).toHaveValue('')
  await expect(page.locator('#creator-board-description')).toHaveValue('')
  await expect(page.getByLabel('战术正文')).toHaveValue('')
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_board_draft_v1')).length,
    ),
  ).resolves.toBe(0)
  await page.getByLabel('标题').fill(directTitle)
  await page.locator('#creator-board-raid').selectOption('r-voidspire')
  await page.locator('#creator-board-boss').selectOption('b-averzian')
  await page.locator('#creator-board-description').fill(`E2E 直发草稿 ${runId}`)
  await page.getByLabel('战术正文').fill('P1 创作者直发\nP2 结束')

  await page.getByRole('button', { name: '直接发布' }).click()
  await expect(page.getByText('战术板已发布。')).toBeVisible()
  await page.getByLabel('标题').fill(`E2E 下一块直发草稿 ${runId}`)
  await expect(page.getByText('战术板已发布。')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '清空直发草稿' })).toBeVisible()
  await page.getByRole('button', { name: '清空直发草稿' }).click()
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
  await expect(directBoardRow.getByText('信息已补齐，可以保存修改。')).toBeVisible()
  await directBoardRow.getByLabel('标题').fill(`${directTitle} 修订`)
  await directBoardRow.getByLabel('战术正文').fill('P1 创作者直发修订\nP2 结束')

  await page.reload()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  const reloadedDirectBoardRow = page.locator('.ps-creator__board', { hasText: directTitle })
  await reloadedDirectBoardRow.getByRole('button', { name: '编辑' }).click()
  await expect(reloadedDirectBoardRow.getByRole('button', { name: '放弃编辑草稿' })).toBeVisible()
  await expect(reloadedDirectBoardRow.getByLabel('标题')).toHaveValue(`${directTitle} 修订`)
  await expect(reloadedDirectBoardRow.getByLabel('战术正文')).toHaveValue('P1 创作者直发修订\nP2 结束')
  await reloadedDirectBoardRow.getByRole('button', { name: '放弃编辑草稿' }).click()
  await expect(reloadedDirectBoardRow.getByRole('button', { name: '放弃编辑草稿' })).toHaveCount(0)
  await expect(reloadedDirectBoardRow.getByRole('button', { name: '编辑' })).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_board_edit_draft_v1')).length,
    ),
  ).resolves.toBe(0)
  await reloadedDirectBoardRow.getByRole('button', { name: '编辑' }).click()
  await expect(reloadedDirectBoardRow.getByLabel('标题')).toHaveValue(directTitle)
  await expect(reloadedDirectBoardRow.getByLabel('战术正文')).toHaveValue('P1 创作者直发\nP2 结束')
  await reloadedDirectBoardRow.getByLabel('标题').fill(`${directTitle} 修订`)
  await reloadedDirectBoardRow.getByLabel('战术正文').fill('P1 创作者直发修订\nP2 结束')
  await reloadedDirectBoardRow.getByRole('button', { name: '保存修改' }).click()
  await expect(reloadedDirectBoardRow.getByText(`${directTitle} 修订`)).toBeVisible()
  await expect(
    page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('planshare_creator_board_edit_draft_v1')).length,
    ),
  ).resolves.toBe(0)

  await reloadedDirectBoardRow.getByRole('button', { name: '下架' }).click()
  await expect(reloadedDirectBoardRow.getByRole('alertdialog')).toContainText('确定下架这个战术板？')
  await reloadedDirectBoardRow.getByRole('button', { name: '取消' }).click()
  await expect(reloadedDirectBoardRow.getByText('已发布')).toBeVisible()
  await expect(reloadedDirectBoardRow.getByRole('alertdialog')).toHaveCount(0)
  await reloadedDirectBoardRow.getByRole('button', { name: '下架' }).click()
  await reloadedDirectBoardRow.getByRole('button', { name: '确认下架' }).click()
  await expect(reloadedDirectBoardRow.getByText('已下架')).toBeVisible()
  await expect(reloadedDirectBoardRow.getByRole('button', { name: '恢复发布' })).toBeVisible()
  await expect(reloadedDirectBoardRow.getByRole('link', { name: '查看公开板' })).toHaveCount(0)

  await reloadedDirectBoardRow.getByRole('button', { name: '恢复发布' }).click()
  await expect(reloadedDirectBoardRow.getByText('已发布')).toBeVisible()
  await expect(reloadedDirectBoardRow.getByRole('link', { name: '查看公开板' })).toBeVisible()
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
    await page.getByLabel('密码', { exact: true }).fill('creator-password-123')
    await page.getByLabel('确认密码').fill('creator-password-123')
    await page.getByLabel('战术正文').fill(`P1 防呆验证 ${title}\nP2 集合`)
  }

  await page.goto('/creator')
  await expect(page.getByRole('link', { name: '没有账号？去投稿申请创作者' })).toBeVisible()
  await page.getByRole('link', { name: '没有账号？去投稿申请创作者' }).click()
  await expect(page).toHaveURL(/\/submit$/)

  await page.goto('/submit')
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()
  await expect(page.getByText('还差：标题、团本、BOSS、投稿署名、战术正文')).toBeVisible()

  await page.getByRole('radio', { name: /申请创作者/ }).click()
  await page.getByLabel('标题').fill(`缺密码防呆 ${runId}`)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('作者名 / 投稿署名').fill(`防呆创作者 ${runId}`)
  await page.getByLabel('用户名').fill(`short_${runId}`)
  await expect(page.getByText('用于以后登录创作者后台，至少 8 位。')).toBeVisible()
  await page.getByLabel('密码', { exact: true }).fill('1234567')
  await expect(page.getByText('密码至少 8 位，还差 1 位。')).toBeVisible()
  await page.getByLabel('战术正文').fill('P1 缺密码')
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()
  await expect(page.getByText('还差：登录密码至少 8 位')).toBeVisible()

  await page.getByLabel('密码', { exact: true }).fill('creator-password-123')
  await page.getByLabel('确认密码').fill('creator-password-456')
  await expect(page.getByText('两次密码不一致。')).toBeVisible()
  await expect(page.getByText('还差：确认密码一致')).toBeVisible()
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()

  await page.goto('/submit')
  await fillCreatorApplication(`非法用户名防呆 ${runId}`, 'Bad Name')
  await expect(page.getByText('用户名需要 3-24 位，只能使用小写英文、数字、下划线或短横线。')).toBeVisible()
  await expect(page.getByText('还差：登录用户名格式')).toBeVisible()
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()

  await page.getByLabel('用户名').fill(creatorUsername)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/账号已创建，投稿已进入审核/)).toBeVisible()

  await page.evaluate(() => localStorage.removeItem('planshare_creator_token'))
  await page.goto('/submit')
  await fillCreatorApplication(`重复用户名防呆 ${runId}`, creatorUsername.toUpperCase())
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText('这个用户名已被占用')).toBeVisible()
  await page.getByLabel('用户名').fill(`${creatorUsername}_ok`)
  await expect(page.getByText('这个用户名已被占用')).toHaveCount(0)
  await expect(page.getByText('信息已补齐，可以提交审核。')).toBeVisible()
})

test('creator can change password from dashboard and log in with the new password', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, runId)
  const nextPassword = 'creator-password-456'

  await page.goto('/creator')
  await expect(page.getByText('还差：用户名、密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeDisabled()
  await page.getByLabel('用户名').fill(creator.username)
  await expect(page.getByText('还差：密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeDisabled()
  await page.getByLabel('密码').fill(creator.password)
  await expect(page.getByText('信息已补齐，可以登录。')).toBeVisible()
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '修改密码' })).toBeVisible()

  await expect(page.getByText('还差：当前密码、新密码至少 8 位、确认新密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '更新密码' })).toBeDisabled()
  await page.getByLabel('当前密码').fill('wrong-password')
  await expect(page.getByText('还差：新密码至少 8 位、确认新密码')).toBeVisible()
  await page.getByLabel('新密码', { exact: true }).fill('short')
  await page.getByLabel('确认新密码').fill('short')
  await expect(page.getByText('还差：新密码至少 8 位')).toBeVisible()
  await expect(page.getByRole('button', { name: '更新密码' })).toBeDisabled()
  await page.getByLabel('新密码', { exact: true }).fill(nextPassword)
  await expect(page.getByText('还差：确认新密码一致')).toBeVisible()
  await page.getByLabel('确认新密码').fill(nextPassword)
  await expect(page.getByText('信息已补齐，可以更新密码。')).toBeVisible()
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page.getByText('当前密码不正确')).toBeVisible()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  await page.getByLabel('当前密码').fill(creator.password)
  await expect(page.getByText('当前密码不正确')).toHaveCount(0)
  await page.getByLabel('确认新密码').fill('mismatch-password')
  await expect(page.getByText('两次新密码不一致。')).toBeVisible()
  await expect(page.getByRole('button', { name: '更新密码' })).toBeDisabled()

  await page.getByLabel('确认新密码').fill(nextPassword)
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page.getByText('密码已更新。')).toBeVisible()

  await page.getByRole('button', { name: '退出登录' }).click()
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('用户名或密码错误')).toBeVisible()

  await page.getByLabel('密码').fill(nextPassword)
  await expect(page.getByText('用户名或密码错误')).toHaveCount(0)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '后台' })).toBeVisible()
})

test('admin can reset a creator password and the creator can log in again', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `reset_${runId}`)
  const resetPassword = `creator-reset-${runId}`

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '创作者' }).click()

  const accountRow = page.locator('.ps-admin__row-card', { hasText: creator.username })
  await expect(accountRow).toBeVisible()
  await accountRow.getByRole('button', { name: '重置密码' }).click()
  await accountRow.getByLabel('新密码').fill(resetPassword)
  await accountRow.getByRole('button', { name: '确认重置' }).click()
  await expect(accountRow.getByText(`已重置。请把新密码「${resetPassword}」发给用户；离开本行后后台不会再显示它。`)).toBeVisible()

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('用户名或密码错误')).toBeVisible()

  await page.getByLabel('密码').fill(resetPassword)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
})

test('admin can suspend and restore a creator account', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `suspend_${runId}`)

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '创作者' }).click()

  const accountRow = page.locator('.ps-admin__row-card', { hasText: creator.username })
  await expect(accountRow.getByText('正常')).toBeVisible()
  await accountRow.getByRole('button', { name: '暂停账号' }).click()
  await expect(accountRow.getByText('已暂停')).toBeVisible()
  await expect(accountRow.getByRole('button', { name: '恢复账号' })).toBeVisible()

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('账号已被暂停，请联系管理员')).toBeVisible()

  await page.goto('/admin')
  await page.getByRole('tab', { name: '创作者' }).click()
  await accountRow.getByRole('button', { name: '恢复账号' }).click()
  await expect(accountRow.getByText('正常')).toBeVisible()

  await page.getByRole('tab', { name: '审计' }).click()
  await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible()
  const restoreAuditRow = page.locator('.ps-admin__row-card', { hasText: '"status":"active"' })
  await expect(restoreAuditRow.getByText('creator_account_update')).toBeVisible()

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
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

  await page.getByRole('button', { name: '撤回投稿' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('确定撤回这条待审投稿？')
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await page.getByRole('button', { name: '撤回投稿' }).click()
  await page.getByRole('button', { name: '确认撤回' }).click()
  await expect(page.getByText('已撤回', { exact: true })).toBeVisible()
  await expect(page.getByText('创作者已自行撤回')).toBeVisible()
  await expect(page.getByRole('button', { name: '撤回投稿' })).toHaveCount(0)

  await page.getByRole('button', { name: '修改后重投' }).click()
  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByText(`已登录为 自助创作者 withdraw_${runId}`)).toBeVisible()
  await expect(page.getByText('使用当前创作者账号投稿；通过审核后会累计到直发资格。')).toBeVisible()
  await expect(page.getByRole('radio', { name: /申请创作者/ })).toHaveCount(0)
  await expect(page.getByLabel('标题')).toHaveValue(creator.title)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('战术正文')).toHaveValue(creator.contentText)
  await page.getByLabel('标题').fill(`${creator.title} 重投`)
  await page.getByLabel('战术正文').fill(`${creator.contentText}\nP3 修改后重投`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入你的创作者审核进度/)).toBeVisible()
  await expect(page.getByRole('link', { name: '进入创作者后台' })).toBeVisible()
  await page.getByRole('link', { name: '进入创作者后台' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()
  await expect(page.getByText(`${creator.title} 重投`)).toBeVisible()
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()
})

test('creator can fix and retry a rejected submission from dashboard', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `reject_${runId}`)
  const reviewNote = `请补充站位和时间轴 ${runId}`

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '投稿审核' }).click()
  const rejectedRow = page.locator('.ps-admin__row-card', { hasText: creator.title })
  await expect(rejectedRow).toBeVisible()
  await rejectedRow.getByRole('button', { name: '查看' }).click()
  await rejectedRow.getByLabel('处理备注').fill(reviewNote)
  await rejectedRow.getByRole('button', { name: '驳回' }).click()
  await expect(rejectedRow.getByText('已驳回', { exact: true })).toBeVisible()

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  const rejectedCreatorRow = page.locator('.ps-creator__submission', { hasText: creator.title })
  await expect(rejectedCreatorRow.getByText('未通过')).toBeVisible()
  await expect(rejectedCreatorRow.getByText(`管理员备注：${reviewNote}`)).toBeVisible()
  await rejectedCreatorRow.getByRole('button', { name: '修改后重投' }).click()

  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByText(`已登录为 自助创作者 reject_${runId}`)).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(creator.title)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('战术正文')).toHaveValue(creator.contentText)

  await page.getByLabel('标题').fill(`${creator.title} 修正版`)
  await page.getByLabel('战术正文').fill(`${creator.contentText}\nP3 按备注补充站位`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入你的创作者审核进度/)).toBeVisible()
})

test('creator can fix and retry a spam-screened submission from dashboard', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `retryspam_${runId}`)
  const spamTitle = `E2E 拦截后重投 ${runId}`

  const spam = await request.post('/api/submissions', {
    headers: {
      Authorization: `Bearer ${creator.token}`,
      'X-Forwarded-For': `203.0.113.${Math.abs(hashSuffix(`retryspam_${runId}`)) % 200}`,
    },
    data: {
      title: spamTitle,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 拦截后重投 ${runId}`,
      contentText: `这是一条博 彩广告 ${runId}`,
      submitterName: `自助创作者 retryspam_${runId}`,
      wantsCreatorProfile: false,
    },
  })
  expect(spam.status()).toBe(201)
  const spamBody = await spam.json()
  expect(spamBody.status).toBe('spam')

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  const spamRow = page.locator('.ps-creator__submission', { hasText: spamTitle })
  await expect(spamRow.getByText('被拦截')).toBeVisible()
  await expect(spamRow.getByText('系统拦截：内容风险')).toBeVisible()
  await spamRow.getByRole('button', { name: '修改后重投' }).click()

  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByText(`已登录为 自助创作者 retryspam_${runId}`)).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(spamTitle)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('战术正文')).toHaveValue(`这是一条博 彩广告 ${runId}`)

  await page.getByLabel('标题').fill(`${spamTitle} 修正版`)
  await page.getByLabel('战术正文').fill(`P1 修正后重投 ${runId}\nP2 集合`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入你的创作者审核进度/)).toBeVisible()
})

test('creator dashboard explains duplicate content screening and keeps retry editable', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `cdp_${runId}`)
  const sourceIp = `203.0.113.${(Math.abs(hashSuffix(`creatordupe_${runId}`)) % 100) + 50}`
  const duplicateContent = `P1 创作者重复正文 ${runId}\nP2 集合`
  const firstTitle = `E2E 创作者重复首投 ${runId}`
  const duplicateTitle = `E2E 创作者重复二投 ${runId}`

  const first = await request.post('/api/submissions', {
    headers: {
      Authorization: `Bearer ${creator.token}`,
      'X-Forwarded-For': sourceIp,
    },
    data: {
      title: firstTitle,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 创作者重复首投 ${runId}`,
      contentText: duplicateContent,
      submitterName: `自助创作者 creatordupe_${runId}`,
      wantsCreatorProfile: false,
    },
  })
  expect(first.status()).toBe(201)
  expect((await first.json()).status).toBe('pending')

  const duplicate = await request.post('/api/submissions', {
    headers: {
      Authorization: `Bearer ${creator.token}`,
      'X-Forwarded-For': sourceIp,
    },
    data: {
      title: duplicateTitle,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 创作者重复二投 ${runId}`,
      contentText: duplicateContent,
      submitterName: `自助创作者 creatordupe_${runId}`,
      wantsCreatorProfile: false,
    },
  })
  expect(duplicate.status()).toBe(201)
  const duplicateBody = await duplicate.json()
  expect(duplicateBody.status).toBe('spam')
  expect(duplicateBody.spamReason).toBe('duplicate_content')

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  const duplicateRow = page.locator('.ps-creator__submission', { hasText: duplicateTitle })
  await expect(duplicateRow.getByText('被拦截')).toBeVisible()
  await expect(duplicateRow.getByText('系统拦截：同一网络下重复正文，系统不会重复进入审核')).toBeVisible()
  await duplicateRow.getByRole('button', { name: '修改后重投' }).click()

  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByText(`已登录为 自助创作者 cdp_${runId}`)).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(duplicateTitle)
  await expect(page.getByLabel('战术正文')).toHaveValue(duplicateContent)

  await page.getByLabel('战术正文').fill(`${duplicateContent}\nP3 明确补充一条新内容`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入你的创作者审核进度/)).toBeVisible()
})

test('creator can fix and retry an admin-spammed submission from dashboard', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createCreatorApplication(request, `adminspam_${runId}`)
  const reviewNote = `请去掉无关招募广告 ${runId}`

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '投稿审核' }).click()
  const spamRow = page.locator('.ps-admin__row-card', { hasText: creator.title })
  await expect(spamRow).toBeVisible()
  await spamRow.getByRole('button', { name: '查看' }).click()
  await spamRow.getByLabel('处理备注').fill(reviewNote)
  await spamRow.getByRole('button', { name: '标记垃圾' }).click()
  await expect(spamRow.getByText('垃圾', { exact: true })).toBeVisible()

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '投稿进度' })).toBeVisible()

  const creatorSpamRow = page.locator('.ps-creator__submission', { hasText: creator.title })
  await expect(creatorSpamRow.getByText('被拦截')).toBeVisible()
  await expect(creatorSpamRow.getByText(`管理员备注：${reviewNote}`)).toBeVisible()
  await creatorSpamRow.getByRole('button', { name: '修改后重投' }).click()

  await expect(page).toHaveURL(/\/submit$/)
  await expect(page.getByText(`已登录为 自助创作者 adminspam_${runId}`)).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(creator.title)
  await expect(page.getByLabel('战术正文')).toHaveValue(creator.contentText)

  await page.getByLabel('标题').fill(`${creator.title} 去广告版`)
  await page.getByLabel('战术正文').fill(`${creator.contentText}\nP3 已按备注移除无关内容`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入你的创作者审核进度/)).toBeVisible()
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

  await page.goto('/')
  await expect(button).toBeEnabled()
  await search.fill('不存在的虚空大章鱼')
  await button.click()
  await expect(page.getByText('暂时没搜到匹配的板子，可以先按团本浏览，或')).toBeVisible()
  await expect(page.getByRole('link', { name: '投稿补一份' })).toBeVisible()
  await page.getByRole('link', { name: '投稿补一份' }).click()
  await expect(page).toHaveURL(/\/submit$/)
})

test('empty boss category can route visitors into a prefilled submission', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const admin = await adminToken(request)
  const raidId = `r-empty-${runId}`
  const bossId = `b-empty-${runId}`

  const raid = await request.post('/api/admin/raids', {
    headers: { Authorization: `Bearer ${admin}` },
    data: { id: raidId, name: `E2E 空团本 ${runId}`, patch: '12.0.e2e' },
  })
  expect(raid.status()).toBe(201)
  const boss = await request.post('/api/admin/bosses', {
    headers: { Authorization: `Bearer ${admin}` },
    data: { id: bossId, raidId, name: `E2E 空 BOSS ${runId}`, order: 1 },
  })
  expect(boss.status()).toBe(201)

  await page.goto(`/raid/${raidId}`)
  await expect(page.getByRole('heading', { name: `E2E 空团本 ${runId}` })).toBeVisible()
  await expect(page.getByText('这个 BOSS 还没有战术板。')).toBeVisible()
  await page.getByRole('button', { name: '投稿补一份' }).click()

  await expect(page).toHaveURL(new RegExp(`/submit\\?raidId=${raidId}&bossId=${bossId}`))
  await expect(page.getByText('已带入团本和 BOSS，补上标题与战术正文即可提交。')).toBeVisible()
  await expect(page.locator('#ps-submit-raid')).toHaveValue(raidId)
  await expect(page.locator('#ps-submit-boss')).toHaveValue(bossId)
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled()
})

test('author page likes update author aggregate stats', async ({ page }) => {
  await page.goto('/author/a-nike')
  await expect(page.getByRole('heading', { name: '妮可' })).toBeVisible()

  const likesStat = page.locator('.ps-author__stat', { hasText: '获赞' })
  const firstCard = page.locator('.ps-card').first()
  const cardLikeText = (await firstCard.getByRole('button', { name: '点赞' }).textContent()) ?? ''
  const likesBefore = Number(cardLikeText.replace(/[^\d]/g, ''))
  expect(Number.isFinite(likesBefore)).toBeTruthy()
  await expect
    .poll(async () => {
      const likesText = (await likesStat.locator('.ps-author__stat-num').textContent()) ?? ''
      return Number(likesText.replace(/[^\d]/g, ''))
    })
    .toBe(likesBefore)

  await firstCard.getByRole('button', { name: '点赞' }).click()
  await expect(firstCard.getByRole('button', { name: '已点赞' })).toBeVisible()
  await expect(likesStat.locator('.ps-author__stat-num')).toContainText(String(likesBefore + 1))
})

test('like actions show a visible failure state when the API rejects the click', async ({ page }) => {
  await page.route('**/api/boards/*/like', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'like failed' }),
    }),
  )

  await page.goto('/')
  const firstCard = page.locator('.ps-card').first()
  const cardLike = firstCard.getByRole('button', { name: '点赞' })
  const cardLikeBeforeText = ((await cardLike.textContent()) ?? '').trim()
  await cardLike.click()
  await expect(firstCard.getByRole('status').getByText('点赞失败，请稍后再试。')).toBeVisible()
  await expect(firstCard.getByRole('button', { name: '点赞' })).toContainText(cardLikeBeforeText)

  const href = await firstCard.locator('.ps-card__link').getAttribute('href')
  expect(href).toBeTruthy()
  await page.goto(href!)
  const detailLike = page.locator('.ps-detail__meta-block--like')
  await expect(detailLike.getByRole('button', { name: '点赞' })).toBeVisible()
  await detailLike.getByRole('button', { name: '点赞' }).click()
  await expect(detailLike.getByRole('status').getByText('点赞失败，请稍后再试。')).toBeVisible()
})

test('copy actions show a visible failure state when clipboard is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const blockedClipboard = {
      writeText: () => Promise.reject(new Error('clipboard blocked')),
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: blockedClipboard,
    })
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => blockedClipboard,
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    })
    Object.defineProperty(Document.prototype, 'execCommand', {
      configurable: true,
      value: () => false,
    })
  })

  await page.goto('/board/p-midnight-m9')
  await expect(page.evaluate(() => navigator.clipboard.writeText('x').then(() => 'ok', () => 'blocked'))).resolves.toBe(
    'blocked',
  )
  await expect(page.evaluate(() => document.execCommand('copy'))).resolves.toBe(false)
  await page.getByRole('button', { name: '复制战术' }).click()
  await expect(page.getByRole('status').getByText('复制失败，请手动选中文本复制')).toBeVisible()

  const planRegion = page.getByRole('region', { name: '战术正文' })
  await planRegion.getByRole('button', { name: '复制' }).click()
  await expect(planRegion.getByRole('button', { name: '复制失败' })).toBeVisible()

  await page.getByRole('button', { name: '复制链接' }).click()
  await expect(page.getByRole('status').getByText('复制失败，请手动选中文本复制')).toBeVisible()
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
  await page.getByLabel('密码', { exact: true }).fill('creator-password-123')
  await page.getByLabel('确认密码').fill('creator-password-123')
  await page.getByLabel('联系方式（可选）', { exact: true }).fill('secret-contact')
  await page.getByLabel('战术正文').fill(`P1 草稿保护 ${runId}\nP2 集合`)

  await page.reload()
  await expect(page.getByRole('button', { name: '清空草稿' })).toBeVisible()
  await expect(page.getByLabel('标题')).toHaveValue(draftTitle)
  await expect(page.locator('#ps-submit-raid')).toHaveValue('r-voidspire')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('b-averzian')
  await expect(page.getByLabel('作者名 / 投稿署名')).toHaveValue(`草稿作者 ${runId}`)
  await expect(page.getByLabel('用户名')).toHaveValue(`draft_${runId}`)
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('确认密码')).toHaveValue('')
  await expect(page.getByLabel('联系方式（可选）', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('战术正文')).toHaveValue(`P1 草稿保护 ${runId}\nP2 集合`)

  await page.getByRole('button', { name: '清空草稿' }).click()
  await expect(page.getByRole('button', { name: '清空草稿' })).toHaveCount(0)
  await expect(page.getByLabel('标题')).toHaveValue('')
  await expect(page.locator('#ps-submit-raid')).toHaveValue('')
  await expect(page.locator('#ps-submit-boss')).toHaveValue('')
  await expect(page.getByLabel('投稿署名')).toHaveValue('')
  await expect(page.getByLabel('战术正文')).toHaveValue('')
  await expect(page.evaluate(() => localStorage.getItem('planshare_submit_draft_v1'))).resolves.toBeNull()

  await page.getByLabel('标题').fill(draftTitle)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('投稿署名').fill(`草稿作者 ${runId}`)
  await page.getByLabel('战术正文').fill(`P1 草稿保护 ${runId}\nP2 集合`)

  await page.getByRole('radio', { name: /普通投稿/ }).click()
  await expect(page.getByText('信息已补齐，可以提交审核。')).toBeVisible()
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()
  await expect(page.getByText(/投稿编号：/)).toBeVisible()
  await expect(page.getByRole('button', { name: '复制投稿编号' })).toBeVisible()
  await page.getByRole('button', { name: '复制投稿编号' }).click()
  await expect(page.getByRole('status').getByText('已复制投稿编号。')).toBeVisible()
  await expect(page.getByRole('link', { name: '回首页浏览' })).toBeVisible()
  await page.getByRole('link', { name: '回首页浏览' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '找一块能直接用的战术板' })).toBeVisible()
  await expect(page.evaluate(() => localStorage.getItem('planshare_submit_draft_v1'))).resolves.toBeNull()
})

test('visitor can check submission receipt and open the approved board', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const title = `游客状态查询 ${runId}`

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.100.${(Math.abs(hashSuffix(`receipt_${runId}`)) % 100) + 80}` })
  await page.goto('/submit')
  await page.getByLabel('标题').fill(title)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('投稿署名').fill(`状态游客 ${runId}`)
  await page.getByLabel('战术正文').fill(`P1 状态查询 ${runId}\nP2 集合`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()
  await expect(page.getByRole('link', { name: '查看审核状态' })).toBeVisible()

  const successText = await page.locator('.ps-submit__success').innerText()
  const submissionId = successText.match(/投稿编号：(s-[^。]+)/)?.[1]
  expect(submissionId).toBeTruthy()
  await page.getByRole('link', { name: '查看审核状态' }).click()
  await expect(page).toHaveURL(new RegExp(`/submit\\?receipt=${submissionId}`))
  await expect(page.getByLabel('投稿编号')).toHaveValue(submissionId!)
  await expect(page.getByText('待审核', { exact: true })).toBeVisible()
  await expect(page.getByText('管理员还没有处理，请稍后再来查。')).toBeVisible()

  const admin = await adminToken(request)
  const approved = await approvePending(request, admin, submissionId!)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('已发布', { exact: true })).toBeVisible()
  await expect(page.getByText('这份投稿已经公开，可以直接打开战术板。')).toBeVisible()
  await page.getByRole('link', { name: '打开战术板' }).click()
  await expect(page).toHaveURL(new RegExp(`/board/${approved.board.id}`))
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

test('submission receipt rate limit shows a visible visitor-facing error', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const sourceIp = `198.51.100.${(Math.abs(hashSuffix(`receiptlimit_${runId}`)) % 40) + 180}`
  const created = await request.post('/api/submissions', {
    headers: { 'X-Forwarded-For': sourceIp },
    data: {
      title: `状态查询限流 ${runId}`,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `状态查询限流 ${runId}`,
      contentText: `P1 状态查询限流 ${runId}\nP2 集合`,
      submitterName: `限流游客 ${runId}`,
      wantsCreatorProfile: false,
    },
  })
  expect(created.status()).toBe(201)
  const body = await created.json()

  for (let index = 0; index < 30; index += 1) {
    const receipt = await request.get(`/api/submissions/${body.id}/receipt`, {
      headers: { 'X-Forwarded-For': sourceIp },
    })
    expect(receipt.status()).toBe(200)
  }

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': sourceIp })
  await page.goto('/submit')
  await page.getByLabel('投稿编号').fill(body.id)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('alert')).toContainText('查询太频繁，请稍后再试')
})

test('spam-screened visitor submission stays editable and is not described as queued', async ({ page }) => {
  const runId = Date.now().toString(36)
  const spamTitle = `游客拦截提示 ${runId}`
  const spamContent = `这是一条博 彩广告 ${runId}`

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.100.${(Math.abs(hashSuffix(`spam_${runId}`)) % 100) + 150}` })
  await page.goto('/submit')
  await page.getByLabel('标题').fill(spamTitle)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('投稿署名').fill(`拦截游客 ${runId}`)
  await page.getByLabel('战术正文').fill(spamContent)
  await page.getByRole('button', { name: '提交审核' }).click()

  await expect(page.getByRole('alert')).toContainText('投稿已被系统拦截，未进入人工审核：内容风险。请修改后重新提交。')
  await expect(page.getByText('投稿已进入审核，不会立刻公开')).toHaveCount(0)
  await expect(page.getByLabel('标题')).toHaveValue(spamTitle)
  await expect(page.getByLabel('战术正文')).toHaveValue(spamContent)
  await page.getByLabel('战术正文').fill(`P1 已移除风险内容 ${runId}\nP2 集合`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()
})

test('duplicate visitor submission explains that the same content will not enter review twice', async ({ page }) => {
  const runId = Date.now().toString(36)
  const duplicateContent = `P1 重复正文拦截 ${runId}\nP2 集合`

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.100.${(Math.abs(hashSuffix(`dupe_${runId}`)) % 100) + 50}` })
  await page.goto('/submit')

  await page.getByLabel('标题').fill(`重复正文首投 ${runId}`)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('投稿署名').fill(`重复游客 ${runId}`)
  await page.getByLabel('战术正文').fill(duplicateContent)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()

  await page.getByLabel('标题').fill(`重复正文二投 ${runId}`)
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByLabel('投稿署名').fill(`重复游客 ${runId}`)
  await page.getByLabel('战术正文').fill(duplicateContent)
  await page.getByRole('button', { name: '提交审核' }).click()

  await expect(page.getByRole('alert')).toContainText(
    '投稿已被系统拦截，未进入人工审核：同一网络下重复正文，系统不会重复进入审核。请修改后重新提交。',
  )
  await expect(page.getByLabel('标题')).toHaveValue(`重复正文二投 ${runId}`)
  await expect(page.getByLabel('战术正文')).toHaveValue(duplicateContent)

  await page.getByLabel('战术正文').fill(`${duplicateContent}\nP3 明确补充一条新内容`)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/投稿已进入审核，不会立刻公开/)).toBeVisible()
})

test('report rate limit shows a visible visitor-facing error', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const { board } = await createAdminBoard(request, `limit_${runId}`)
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.100.${(Math.abs(hashSuffix(`report_${runId}`)) % 100) + 100}` })

  await page.goto(`/board/${board.id}`)
  await expect(page.getByRole('heading', { name: board.title })).toBeVisible()

  for (let index = 1; index <= 5; index += 1) {
    await page.getByRole('button', { name: '举报' }).click()
    await page.locator('#ps-report-reason').selectOption('other')
    await page.locator('#ps-report-detail').fill(`E2E 限流前 ${runId}-${index}`)
    await page.getByRole('button', { name: '提交举报' }).click()
    await expect(page.getByText('举报已提交，已进入管理员处理队列。')).toBeVisible()
    await expect(page.getByRole('button', { name: '提交举报' })).toHaveCount(0)
  }

  await page.getByRole('button', { name: '举报' }).click()
  await page.locator('#ps-report-reason').selectOption('other')
  await page.locator('#ps-report-detail').fill(`E2E 限流触发 ${runId}`)
  await page.getByRole('button', { name: '提交举报' }).click()
  await expect(page.getByRole('alert').getByText('举报太频繁，请稍后再试')).toBeVisible()
  await page.locator('#ps-report-detail').fill(`E2E 限流后继续修改 ${runId}`)
  await expect(page.getByRole('alert').getByText('举报太频繁，请稍后再试')).toHaveCount(0)
  await page.getByRole('button', { name: '提交举报' }).click()
  await expect(page.getByRole('alert').getByText('举报太频繁，请稍后再试')).toBeVisible()
})

test('visitor can report a board and admin can hide it from public pages', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const { board } = await createAdminBoard(request, runId)
  const dismissedCase = await createAdminBoard(request, `dismiss_${runId}`)
  const detail = `E2E 举报说明 ${runId}`
  const dismissDetail = `E2E 误报说明 ${runId}`
  const snapshotContent = `P1 举报测试 ${runId}`

  await page.goto(`/board/${dismissedCase.board.id}`)
  await expect(page.getByRole('heading', { name: dismissedCase.board.title })).toBeVisible()
  await page.getByRole('button', { name: '举报' }).click()
  await page.locator('#ps-report-reason').selectOption('other')
  await expect(page.getByText('选择其它原因时请补充说明。')).toBeVisible()
  await expect(page.getByRole('button', { name: '提交举报' })).toBeDisabled()
  await page.locator('#ps-report-detail').fill(dismissDetail)
  await expect(page.getByRole('button', { name: '提交举报' })).toBeEnabled()
  await page.getByRole('button', { name: '提交举报' }).click()
  await expect(page.getByText('举报已提交，已进入管理员处理队列。')).toBeVisible()

  await page.goto(`/board/${board.id}`)
  await expect(page.getByRole('heading', { name: board.title })).toBeVisible()
  await page.getByRole('button', { name: '举报' }).click()
  await page.locator('#ps-report-reason').selectOption('wrong-info')
  await page.locator('#ps-report-detail').fill(detail)
  await page.getByRole('button', { name: '提交举报' }).click()
  await expect(page.getByText('举报已提交，已进入管理员处理队列。')).toBeVisible()
  await expect(page.getByRole('button', { name: '提交举报' })).toHaveCount(0)

  const admin = await adminToken(request)
  const updateBoard = await request.put(`/api/boards/${board.id}`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: { contentText: `P1 已被后续编辑 ${runId}\nP2 集合` },
  })
  expect(updateBoard.status()).toBe(200)

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '举报' }).click()
  const dismissedRow = page.locator('.ps-admin__row-card', { hasText: dismissedCase.board.id })
  await expect(dismissedRow.getByText(dismissDetail)).toBeVisible()
  await dismissedRow.getByRole('button', { name: '驳回举报' }).click()
  await expect(dismissedRow.getByText('已驳回')).toBeVisible()

  await page.goto(`/board/${dismissedCase.board.id}`)
  await expect(page.getByRole('heading', { name: dismissedCase.board.title })).toBeVisible()

  await page.goto('/admin')
  await page.getByRole('tab', { name: '举报' }).click()
  const reportRow = page.locator('.ps-admin__row-card', { hasText: board.id })
  await expect(reportRow.getByText(detail)).toBeVisible()
  await expect(reportRow.getByText(`举报时正文：${snapshotContent}`, { exact: false })).toBeVisible()
  await expect(reportRow.getByText(`已被后续编辑 ${runId}`)).toHaveCount(0)
  await reportRow.getByRole('button', { name: '隐藏板' }).click()
  await expect(reportRow.getByText('已隐藏')).toBeVisible()

  const hidden = await request.get(`/api/boards/${board.id}`)
  expect(hidden.status()).toBe(404)
  await page.goto(`/board/${board.id}`)
  await expect(page.getByText('这块战术板已不可见，可能已下架或被管理员隐藏。')).toBeVisible()
})

test('creator dashboard blocks self-restore for boards hidden by admin reports', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createTrustedCreator(request, `adminhide_${runId}`)
  const directTitle = `E2E 管理员隐藏创作者板 ${runId}`

  const boardRes = await request.post('/api/creator/boards', {
    headers: { Authorization: `Bearer ${creator.token}` },
    data: {
      title: directTitle,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `E2E 管理员隐藏创作者板 ${runId}`,
      contentText: `P1 管理员隐藏 ${runId}\nP2 集合`,
    },
  })
  expect(boardRes.status()).toBe(201)
  const board = await boardRes.json()

  const reportRes = await request.post(`/api/boards/${board.id}/reports`, {
    data: { reason: 'wrong-info', detail: `E2E 管理隐藏 ${runId}` },
  })
  expect(reportRes.status()).toBe(201)
  const report = await reportRes.json()

  const hideRes = await request.post(`/api/admin/reports/${report.id}/hide-board`, {
    headers: { Authorization: `Bearer ${creator.admin}` },
    data: { note: 'E2E 管理员确认隐藏' },
  })
  expect(hideRes.status()).toBe(200)

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  const boardRow = page.locator('.ps-creator__board', { hasText: directTitle })
  await expect(boardRow.locator('.ps-tag__label').getByText('管理员隐藏', { exact: true })).toBeVisible()
  await expect(boardRow.getByText('该战术板已被管理员隐藏，不能自行恢复发布。')).toBeVisible()
  await expect(boardRow.getByRole('button', { name: '恢复发布' })).toHaveCount(0)

  const republish = await request.put(`/api/creator/boards/${board.id}`, {
    headers: { Authorization: `Bearer ${creator.token}` },
    data: { isHidden: false },
  })
  expect(republish.status()).toBe(403)
  const publicBoard = await request.get(`/api/boards/${board.id}`)
  expect(publicBoard.status()).toBe(404)
})

test('creator direct publish screens unsafe content in dashboard', async ({ page, request }) => {
  const runId = Date.now().toString(36)
  const creator = await createTrustedCreator(request, `screen_${runId}`)
  const blockedTitle = `E2E 直发筛查 ${runId}`

  await page.goto('/creator')
  await page.getByLabel('用户名').fill(creator.username)
  await page.getByLabel('密码').fill(creator.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()

  await page.locator('#creator-board-title').fill(blockedTitle)
  await page.locator('#creator-board-raid').selectOption('r-voidspire')
  await page.locator('#creator-board-boss').selectOption('b-averzian')
  await page.locator('#creator-board-description').fill('E2E 直发筛查')
  await page.locator('#creator-board-content').fill(`这是一条博 彩广告 ${runId}`)
  await page.getByRole('button', { name: '直接发布' }).click()
  await expect(page.getByText('战术内容包含暂不支持公开展示的内容')).toBeVisible()
  await expect(page.locator('.ps-creator__board', { hasText: blockedTitle })).toHaveCount(0)
})
