import { expect, test } from '@playwright/test'

function resultCount(page: import('@playwright/test').Page) {
  return page.getByTestId('loot-results-count')
}

type FilterGroup = 'source' | 'class' | 'slot' | 'weapon' | 'armor' | 'other' | 'stat'

function filterGroup(page: import('@playwright/test').Page, name: FilterGroup) {
  return page.getByTestId('loot-filter-' + name)
}

function filterChip(page: import('@playwright/test').Page, name: FilterGroup, label: string) {
  return filterGroup(page, name).getByRole('button', { name: label, exact: true })
}

test('loot groups raid priest results and removes external item links', async ({ page }) => {
  await page.goto('/loot')
  await expect(page.getByRole('heading', { name: '魔兽世界 12.1 装备掉落查询' })).toBeVisible()
  await expect(page.getByTestId('loot-vault-motion')).toBeVisible()
  await expect(page.getByTestId('loot-collected-count')).toContainText('577')
  await expect(resultCount(page)).toContainText('577')
  await expect(page.locator('.ps-loot__filter-group')).toHaveCount(7)
  await expect(filterGroup(page, 'source').getByRole('button')).toHaveText(['全部', '团本', '大秘境', '地下堡', '其它'])

  await filterChip(page, 'source', '团本').click()
  await filterChip(page, 'class', '牧师').click()
  await expect(resultCount(page)).toContainText('50')
  await expect(page.getByTestId('loot-source-group')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: '团本', exact: true })).toBeVisible()
  const raidInstance = page.getByTestId('loot-instance-group').filter({ hasText: '烈毒之渊' })
  await expect(raidInstance).toContainText('盘魂者内克扎莉（M1）')
  await expect(raidInstance).toContainText('布甲')
  await expect(page.getByTestId('loot-instance-group').filter({ hasText: '套装' })).toBeVisible()
  await expect(page.locator('.ps-loot__variant').first()).toContainText(/（\d+\/\d+） · \d+ 装等/)
  await expect(page.locator('a[href*="wowhead"]')).toHaveCount(0)
  await expect(page.getByText('数据更新时间')).toHaveCount(0)
  await expect(page.getByText('数据整理参考')).toHaveCount(0)
  await expect(page.getByText('构建说明')).toHaveCount(0)
})

test('loot dynamically disables unavailable options and clears an invalid pair after a source change', async ({ page }) => {
  await page.goto('/loot')
  await filterChip(page, 'source', '大秘境').click()
  await filterChip(page, 'class', '牧师').click()
  await filterChip(page, 'slot', '远程').click()

  await filterChip(page, 'source', '团本').click()
  await expect(filterChip(page, 'class', '全部')).toHaveAttribute('aria-pressed', 'true')
  await expect(filterChip(page, 'slot', '全部')).toHaveAttribute('aria-pressed', 'true')
  await expect(resultCount(page)).toContainText('218')

  await filterChip(page, 'slot', '远程').click()
  await expect(filterChip(page, 'class', '牧师')).toBeDisabled()

  await filterChip(page, 'source', '其它').click()
  await expect(filterChip(page, 'slot', '饰品')).toBeDisabled()
})

test('loot chip groups filter reliable equipment type and real stat values', async ({ page }) => {
  await page.goto('/loot')
  await filterChip(page, 'armor', '布甲').click()
  await expect(resultCount(page)).not.toContainText('577')
  await expect(filterChip(page, 'armor', '布甲')).toHaveAttribute('aria-pressed', 'true')
  await expect(filterChip(page, 'weapon', '全部')).toHaveAttribute('aria-pressed', 'true')

  await filterChip(page, 'stat', '智力').click()
  await expect(resultCount(page)).not.toContainText('0')
  await expect(filterChip(page, 'stat', '智力')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('.ps-loot__filters').getByRole('button', { name: '清除筛选' }).click()
  await expect(resultCount(page)).toContainText('577')
})

test('loot filter groups keep one content start line and breathable chip rhythm', async ({ page }) => {
  await page.goto('/loot')
  const layout = await page.locator('.ps-loot__filter-group').first().evaluate(() => {
    const groups = [...document.querySelectorAll('.ps-loot__filter-group')]
    const chipLists = groups.map((group) => group.querySelector('.ps-loot__chip-list'))
    const chip = document.querySelector('.ps-loot__filter-chip')
    return {
      chipStarts: chipLists.map((list) => Math.round(list?.getBoundingClientRect().left ?? 0)),
      listGap: getComputedStyle(chipLists[0] as Element).columnGap,
      listRowGap: getComputedStyle(chipLists[0] as Element).rowGap,
      chipHeight: chip?.getBoundingClientRect().height ?? 0,
    }
  })
  expect(new Set(layout.chipStarts).size).toBe(1)
  expect(Number.parseFloat(layout.listGap)).toBeGreaterThanOrEqual(12)
  expect(Number.parseFloat(layout.listRowGap)).toBeGreaterThanOrEqual(12)
  expect(layout.chipHeight).toBeGreaterThanOrEqual(36)
})

test('loot follows Wowhead stat order and keeps weapon structure before attributes', async ({ page }) => {
  await page.goto('/loot')
  const clothCard = page.locator('.ps-loot__card').filter({ hasText: '怒潮护腕' }).first()
  await expect(clothCard.locator('.ps-loot__stat > span:first-child')).toHaveText([
    '护甲',
    '敏捷/智力',
    '耐力',
    '暴击',
    '精通',
  ])

  const weaponCard = page.locator('.ps-loot__card').filter({ hasText: '远古构造体的烈毒短刀' }).first()
  await expect(weaponCard).toBeVisible()
  await expect(weaponCard.locator('.ps-loot__stat > span:first-child')).toHaveText([
    '伤害下限',
    '伤害上限',
    '每秒伤害',
    '敏捷',
    '耐力',
    '急速',
    '全能',
  ])
})

test('loot exposes verified trinket details and semantic stat colors', async ({ page }) => {
  await page.goto('/loot')
  await filterChip(page, 'source', '团本').click()
  await filterChip(page, 'slot', '饰品').click()
  await expect(resultCount(page)).toContainText('15')

  await expect(page.getByTestId('loot-item-toggle')).toHaveCount(0)
  const effect = page.getByTestId('loot-effect').filter({ visible: true }).first()
  await expect(effect).toContainText('饰品详情')
  await expect(effect).not.toContainText('$')
  await expect(page.locator('a[href*="wowhead"]')).toHaveCount(0)
  await expect(page.locator('.ps-loot__stat--haste, .ps-loot__stat--critical').filter({ visible: true }).first()).toBeVisible()

  await filterChip(page, 'source', '地下堡').click()
  await expect(resultCount(page)).toContainText('4')
  const sporeRow = page.locator('.ps-loot__cards .ps-loot__card').filter({ hasText: '附魔孢子' })
  const sporeEffect = sporeRow.getByTestId('loot-effect')
  await expect(sporeEffect).toBeVisible()
  await expect(sporeEffect).toContainText('没有独立的使用效果')
  await expect(sporeEffect).toContainText('精通')
})

test('loot clears the Chinese search and restores results from the empty state', async ({ page }) => {
  await page.goto('/loot')
  await page.getByLabel('中文装备名搜索').fill('绝不会存在的装备名称')
  await expect(page.getByText('没有找到符合条件的装备。')).toBeVisible()
  await page.locator('.ps-loot__filters').getByRole('button', { name: '清除筛选' }).click()
  await expect(page.getByLabel('中文装备名搜索')).toHaveValue('')
  await expect(resultCount(page)).toContainText('577')

  await page.reload()
  await expect(resultCount(page)).toContainText('577')
  await expect(page.getByTestId('loot-source-group').first()).toBeVisible()
})

test('loot keeps the same grouped structure in the mobile result list without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/loot')
  await expect(page.getByRole('heading', { name: '魔兽世界 12.1 装备掉落查询' })).toBeVisible()
  await expect(page.getByTestId('loot-source-group').first()).toBeVisible()
  await expect(page.getByTestId('loot-instance-group').first()).toBeVisible()
  await expect(page.locator('.ps-loot__cards .ps-loot__card').first()).toBeVisible()
  await expect(page.locator('.ps-loot__cards .ps-loot__variant').first()).toContainText('装等')
  await expect(page.locator('.ps-loot__table-wrap')).toHaveCount(0)
  await expect(page.locator('.ps-loot__cards .ps-loot__card').filter({ has: page.getByTestId('loot-effect') }).first()).toBeVisible()
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).resolves.toBeTruthy()
})
