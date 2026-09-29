import { test, expect } from '@playwright/test'

test('RaidPlan link produces a copyable STT board string', async ({ page }) => {
  const code = '77e628xft5dspgd3'
  await page.route(`**/api/raidplan/${code}`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code, version: 2, revision: 1, steps: 2, nodes: [] }),
  }))
  await page.goto('/rp2s')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'RaidPlan 转视觉画板' })).toBeVisible()
  await page.getByLabel('RaidPlan 链接').fill(`https://raidplan.io/plan/${code}`)
  await page.getByRole('button', { name: '生成画板字符串' }).click()
  await expect(page.getByRole('status')).toContainText('已生成 2 页画板')
  await expect(page.getByLabel('STT 画板字符串')).toHaveValue(/^STT-RAIDPLAN:5:/)
  await page.getByRole('button', { name: '复制字符串' }).click()
  await expect(page.getByRole('status')).toContainText('结果已复制')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/^STT-RAIDPLAN:5:/)

  await page.getByLabel('RaidPlan 链接').fill('https://example.com/plan/' + code)
  await expect(page.getByLabel('STT 画板字符串')).toHaveCount(0)
  await page.getByRole('button', { name: '生成画板字符串' }).click()
  await expect(page.getByRole('status')).toContainText('链接应为')
})
