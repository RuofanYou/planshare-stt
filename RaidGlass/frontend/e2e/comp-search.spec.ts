import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { collectRuntimeFailures } from "./helpers/runtimeFailures";

const SCREENSHOT_ROOT = process.env.RAIDGLASS_SCREENSHOT_ROOT || "/tmp/raidglass-release-local";
mkdirSync(SCREENSHOT_ROOT, { recursive: true });

async function expectTouchTarget(locator: Locator) {
    const box = await locator.boundingBox();
    expect(box, "控件应有可测几何").not.toBeNull();
    expect(box!.width, "控件宽度应至少为 44px").toBeGreaterThanOrEqual(44);
    expect(box!.height, "控件高度应至少为 44px").toBeGreaterThanOrEqual(44);
}

async function chooseBoss(page: Page) {
    const boss = page.getByRole("button", { name: "阿维兹安大帝", exact: true });
    await boss.click();
    await expect(boss).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("comp-search-step")).toHaveCount(3);
}

test("桌面阵容搜索按需披露并保持单一阅读顺序", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/comp_ranking/search");

    await expect(page.getByTestId("comp-search-step")).toHaveCount(1);
    await expect(page.getByRole("group", { name: "职责人数" })).toHaveCount(0);
    await expect(page.getByText("更多筛选")).toHaveCount(0);

    await chooseBoss(page);
    await expect(page.getByRole("group", { name: "职责人数" })).toBeVisible();
    const advanced = page.locator("details").filter({ hasText: "更多筛选" });
    await expect(advanced).not.toHaveAttribute("open", "");
    await advanced.locator("summary").click();
    await expect(page.getByRole("group", { name: "击杀时间" })).toBeVisible();
    await expect(page.getByRole("group", { name: "专精人数" })).toBeVisible();

    await page.getByRole("spinbutton", { name: "坦克人数" }).fill("0");
    await expect(page.getByRole("img", { name: "坦克 0人" })).toBeVisible();
    await expect(page.locator(".boss-selection__name")).toHaveCSS("color", "rgb(111, 69, 22)");
    await page.screenshot({ path: `${SCREENSHOT_ROOT}/comp-search-desktop-1440x1000.png`, fullPage: true });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(failures).toEqual([]);
});

test("移动端阵容搜索保持 44px 触控和无横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/comp_ranking/search");
    await chooseBoss(page);

    await expectTouchTarget(page.getByRole("button", { name: "阿维兹安大帝", exact: true }));
    await expectTouchTarget(page.getByRole("spinbutton", { name: "坦克人数" }));
    await expectTouchTarget(page.getByRole("combobox", { name: "坦克比较方式" }));
    await expectTouchTarget(page.locator("details summary"));
    await expectTouchTarget(page.getByRole("button", { name: "查看阵容参考" }));

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/comp-search-mobile-390x844.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(failures).toEqual([]);
});
