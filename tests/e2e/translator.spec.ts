import { expect, test } from '@playwright/test'

const NSRT_SAMPLE = [
  'EncounterID:3178;Difficulty:Heroic;Name:Vaelgor;',
  'ph:1;time:19.9;tag:瑟瑟;spellid:322118;',
  'ph:2;time:35.8;tag:everyone;spellid:115310;',
].join('\n')

const MRT_SAMPLE = [
  '{time:0:14,pg3} 集合 |cff33937f玩家|r {spell:370553}',
  '{time:00:12} - role:HEALER {text}准备驱散{/text}',
].join('\n')

test('translator auto-detects NSRT, copies output, and keeps local layout usable', async ({ page }) => {
  await page.goto('/translator')
  await expect(page.getByRole('heading', { name: '战术格式翻译器' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByText('翻译器')).toBeVisible()

  await page.getByRole('textbox', { name: '输入' }).fill(NSRT_SAMPLE)

  const output = page.getByRole('textbox', { name: 'STT 输出' })
  await expect(output).toHaveValue(/名称 = Vaelgor \(Heroic\)/)
  await expect(output).toHaveValue(/作者 = NSRT 导入/)
  await expect(output).toHaveValue(/-- EncounterID: 3178/)
  await expect(output).toHaveValue(/\{time:00:19,p1\} \{瑟瑟\}\{spell:322118\}/)
  await expect(output).toHaveValue(/\{time:00:35,p2\} \{所有人\}\{spell:115310\}/)
  await expect(page.getByRole('status')).toContainText('格式：NSRT')
  await expect(page.getByRole('status')).toContainText('事件：2')
  await expect(page.getByRole('status')).toContainText('Phase：2')

  await page.getByRole('button', { name: '复制结果' }).click()
  await expect(page.getByRole('status')).toContainText('结果已复制')
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('名称 = Vaelgor (Heroic)')
})

test('translator handles manual MRT mode, boss phase expansion, and TR roundtrip', async ({ page }) => {
  await page.goto('/translator')
  await page.getByLabel('输入格式').selectOption('mrt')
  await page.getByLabel('MRT Boss 阶段').selectOption('3183')
  await page.getByRole('textbox', { name: '输入' }).fill(MRT_SAMPLE)

  const output = page.getByRole('textbox', { name: 'STT 输出' })
  await expect(output).toHaveValue(/名称 = MRT 导入/)
  await expect(output).toHaveValue(/-- EncounterID: 3183/)
  await expect(output).toHaveValue(/\{time:0:14,p2\} \{所有人\}集合 \{玩家\} \{spell:370553\}/)
  await expect(output).toHaveValue(/\{time:00:12\} \{healer\} 准备驱散/)
  await expect(page.getByRole('status')).toContainText('格式：MRT')
  await expect(page.getByRole('status')).toContainText('事件：2')
  await expect(page.getByRole('status')).toContainText('EncounterID：3183')

  await page.getByText('高级：STT -> TR 导出').click()
  await page.getByRole('button', { name: '导出 TR' }).click()
  const trOutput = page.locator('.ps-translator__textarea--tr')
  await expect(trOutput).toHaveValue(/^!TR:/)
  await expect(page.getByText('TR 已生成')).toBeVisible()

  const exportedTR = await trOutput.inputValue()
  await page.getByLabel('输入格式').selectOption('tr')
  await page.getByRole('textbox', { name: '输入' }).fill(exportedTR)
  await expect(output).toHaveValue(/名称 = TR 导入 \(encounterID=3183(?:\.0)?\)/)
  await expect(output).toHaveValue(/-- EncounterID: 3183(?:\.0)?/)
  await expect(output).toHaveValue(/\{time:00:12\}/)
})

test('translator keeps controls readable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.goto('/translator')
  await page.getByLabel('输入格式').selectOption('mrt')
  await page.getByLabel('MRT Boss 阶段').selectOption('3183')
  await page.getByRole('textbox', { name: '输入' }).fill(MRT_SAMPLE)

  await expect(page.getByRole('heading', { name: '战术格式翻译器' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'STT 输出' })).toHaveValue(/名称 = MRT 导入/)
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).resolves.toBeTruthy()
})
