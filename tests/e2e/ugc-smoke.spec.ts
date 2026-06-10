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

async function approvePending(request: APIRequestContext, token: string, id: string, authorId?: string) {
  const res = await request.post(`/api/admin/submissions/${id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: authorId ? { mode: 'existingAuthor', authorId } : { mode: 'createAuthor' },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test('UGC smoke: browse, copy, submit, approve, publish, and creator direct post', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '找一块能直接用的战术板' })).toBeVisible()

  const firstBoard = page.locator('.ps-card__link').first()
  await expect(firstBoard).toBeVisible()
  await firstBoard.click()
  await expect(page.getByRole('button', { name: /复制战术/ })).toBeVisible()
  await page.getByRole('button', { name: /复制战术/ }).click()
  await expect(page.getByText('已复制到剪贴板')).toBeVisible()

  await page.goto('/submit')
  await page.getByLabel('标题').fill('E2E 游客创作者投稿')
  await page.locator('#ps-submit-raid').selectOption('r-voidspire')
  await page.locator('#ps-submit-boss').selectOption('b-averzian')
  await page.getByRole('radio', { name: /申请创作者/ }).click()
  await page.getByLabel('作者名 / 投稿署名').fill('E2E 创作者')
  await page.getByLabel('用户名').fill('e2e_creator')
  await page.getByLabel('密码').fill('creator-password-123')
  await page.getByLabel('战术正文').fill('P1 E2E 分散\nP2 E2E 集合')
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(/账号已创建，投稿已进入审核/)).toBeVisible()

  const creatorToken = await page.evaluate(() => localStorage.getItem('planshare_creator_token'))
  expect(creatorToken).toBeTruthy()

  await page.goto('/admin')
  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByRole('tab', { name: '投稿审核' }).click()
  await expect(page.getByText('E2E 游客创作者投稿')).toBeVisible()
  await page.getByRole('button', { name: '查看' }).first().click()
  await page.getByRole('button', { name: '创建作者并发布' }).click()
  await expect(page.getByText('已发布')).toBeVisible()

  const admin = await adminToken(request)
  const submissions = await request.get('/api/admin/submissions', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  expect(submissions.ok()).toBeTruthy()
  const published = (await submissions.json()).find((item: { title: string }) => item.title === 'E2E 游客创作者投稿')
  expect(published?.boardId).toBeTruthy()
  expect(published?.authorId).toBeTruthy()

  await page.goto(`/board/${published.boardId}`)
  await expect(page.getByRole('heading', { name: 'E2E 游客创作者投稿' })).toBeVisible()

  const second = await submitCreatorReview(request, creatorToken!, 'two')
  await approvePending(request, admin, second.id, published.authorId)
  const third = await submitCreatorReview(request, creatorToken!, 'three')
  await approvePending(request, admin, third.id, published.authorId)

  await page.goto('/creator')
  await expect(page.getByRole('heading', { name: '我的战术板' })).toBeVisible()
  await page.getByLabel('标题').fill('E2E 创作者直发')
  await page.locator('#creator-board-raid').selectOption('r-voidspire')
  await page.locator('#creator-board-boss').selectOption('b-averzian')
  await page.getByLabel('战术正文').fill('P1 创作者直发\nP2 结束')
  await page.getByRole('button', { name: '直接发布' }).click()
  await expect(page.getByText('战术板已发布。')).toBeVisible()
})
