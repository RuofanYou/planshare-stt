import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { collectRuntimeFailures } from "./helpers/runtimeFailures";

const SCREENSHOT_ROOT = process.env.RAIDGLASS_SCREENSHOT_ROOT;
if (!SCREENSHOT_ROOT) {
    throw new Error("RAIDGLASS_SCREENSHOT_ROOT must be provided by the E2E runner");
}
mkdirSync(SCREENSHOT_ROOT, { recursive: true });

test("帮助页桌面目录持续吸附且内容语义完整", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const failures = collectRuntimeFailures(page);

    await page.goto("/log/help");
    await expect(page.getByRole("heading", { level: 1, name: "RaidGlass 使用帮助" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "本页目录", exact: true })).toBeVisible();
    await expect(page.getByRole("main", { name: "主要内容" }).locator("img, picture, video, iframe, link[rel='stylesheet']"))
        .toHaveCount(0);

    const headingLevels = await page.getByRole("main", { name: "主要内容" })
        .locator("h1, h2, h3")
        .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
    expect(headingLevels.filter((level) => level === 1)).toHaveLength(1);
    headingLevels.slice(1).forEach((level, index) => {
        expect(level - headingLevels[index]).toBeLessThanOrEqual(1);
    });

    await page.evaluate(() => window.scrollTo(0, 650));
    await expect.poll(async () => {
        const box = await page.getByRole("navigation", { name: "本页目录", exact: true }).boundingBox();
        return box?.y ?? Number.NEGATIVE_INFINITY;
    }).toBeGreaterThanOrEqual(15);
    const stickyBox = await page.getByRole("navigation", { name: "本页目录", exact: true }).boundingBox();
    const topbarBox = await page.getByRole("banner").boundingBox();
    if (!stickyBox || !topbarBox) throw new Error("桌面帮助目录或顶栏缺少可测几何");
    const stickyGap = stickyBox.y - (topbarBox.y + topbarBox.height);
    expect(stickyGap).toBeGreaterThanOrEqual(12);
    expect(stickyGap).toBeLessThanOrEqual(24);

    const directoryHeights = await page.getByRole("navigation", { name: "本页目录", exact: true })
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    expect(Math.min(...directoryHeights)).toBeGreaterThanOrEqual(44);
    expect(failures).toEqual([]);

    await page.screenshot({
        path: join(SCREENSHOT_ROOT, "help-desktop-1440x1000.png"),
        fullPage: true,
    });
});

for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
]) {
    test(`${viewport.width}px 帮助页无裁切且移动目录满足 44px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const failures = collectRuntimeFailures(page);

        await page.goto("/log/help");
        const summary = page.locator("summary").filter({ hasText: "本页目录" });
        await expect(summary).toBeVisible();
        await summary.click();

        const mobileDirectory = page.getByRole("navigation", { name: "本页目录（移动）" });
        await expect(mobileDirectory).toBeVisible();
        const geometry = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const rogue = Array.from(document.querySelectorAll<HTMLElement>("body *"))
                .filter((element) => {
                    const style = getComputedStyle(element);
                    if (style.display === "none" || style.visibility === "hidden") return false;
                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
                })
                .map((element) => ({
                    tag: element.tagName,
                    left: Math.round(element.getBoundingClientRect().left),
                    right: Math.round(element.getBoundingClientRect().right),
                }));
            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth,
                rogue,
            };
        });
        const linkHeights = await mobileDirectory.getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));

        expect(geometry.documentWidth).toBe(geometry.viewportWidth);
        expect(geometry.rogue).toEqual([]);
        expect(Math.min(...linkHeights)).toBeGreaterThanOrEqual(44);
        expect(failures).toEqual([]);

        await page.screenshot({
            path: join(SCREENSHOT_ROOT, `help-mobile-${viewport.width}x${viewport.height}.png`),
            fullPage: true,
        });
    });
}

test("跳到主要内容、SPA 焦点恢复与减少动态效果可复验", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/help");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "跳到主要内容" });
    await expect(skipLink).toBeFocused();
    const skipLinkBox = await skipLink.boundingBox();
    if (!skipLinkBox) throw new Error("跳到主要内容缺少可测几何");
    expect(skipLinkBox.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    const main = page.getByRole("main", { name: "主要内容" });
    await expect(main).toBeFocused();
    expect(await main.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");

    const primaryCompLink = page.getByRole("navigation", { name: "主导航" })
        .getByRole("link", { name: "阵容参考", exact: true });
    await primaryCompLink.click();
    await expect(page).toHaveURL(/\/comp_ranking\/search$/);
    await expect(main).toBeFocused();
    expect(await main.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");

    const motion = await primaryCompLink.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            animationName: style.animationName,
            transitionDuration: style.transitionDuration,
            transitionDelay: style.transitionDelay,
        };
    });
    expect(motion).toEqual({
        animationName: "none",
        transitionDuration: "0s",
        transitionDelay: "0s",
    });
    expect(failures).toEqual([]);
});
