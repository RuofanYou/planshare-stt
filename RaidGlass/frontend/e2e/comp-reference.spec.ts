import { isAbsolute, join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { collectRuntimeFailures } from "./helpers/runtimeFailures";

const COMP_API_PATH = "/log/api/comp_ranking/vorasius";

function requireScreenshotRoot() {
    const root = process.env.RAIDGLASS_SCREENSHOT_ROOT;
    if (!root || !isAbsolute(root)) {
        throw new Error("RAIDGLASS_SCREENSHOT_ROOT 必须由 E2E runner 提供绝对路径");
    }
    return root;
}

const SCREENSHOT_ROOT = requireScreenshotRoot();

function waitForCompRequest(page: Page) {
    return page.waitForRequest((request) => new URL(request.url()).pathname === COMP_API_PATH);
}

async function expectCanonicalPath(page: Page, expected: string) {
    await expect.poll(() => {
        const current = new URL(page.url());
        return `${current.pathname}${current.search}`;
    }).toBe(expected);
}

async function expectReadyResult(page: Page) {
    await expect(page.getByTestId("comp-rankings-view")).toBeVisible();
    await expect(page.locator("[data-player-row]")).not.toHaveCount(0);
    await expect(page.getByRole("region", { name: "阵容时间轴文字摘要" })).toBeAttached();
}

async function expectImagesLoaded(page: Page) {
    await expect.poll(() => page.evaluate(() => (
        Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
            .every((image) => image.complete && image.naturalWidth > 0)
    ))).toBe(true);
}

test("键盘提交阵容条件后进入规范地址并显示客户端过滤结果", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/comp_ranking/search");

    const boss = page.getByRole("button", { name: "沃拉修斯", exact: true });
    await boss.focus();
    await page.keyboard.press("Space");
    await expect(boss).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("combobox", { name: "坦克比较方式" }).selectOption("eq");
    await page.getByRole("spinbutton", { name: "坦克人数" }).fill("2");

    const compRequest = waitForCompRequest(page);
    const submit = page.getByRole("button", { name: "查看阵容参考" });
    await submit.focus();
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");

    const requestUrl = new URL((await compRequest).url());
    expect(requestUrl.pathname).toBe(COMP_API_PATH);
    expect(requestUrl.search).toBe("");
    await expectCanonicalPath(page, "/log/comp_ranking/vorasius?role=tank.eq.2");
    await expectReadyResult(page);
    await expectImagesLoaded(page);
    expect(failures).toEqual([]);

    await page.screenshot({
        path: join(SCREENSHOT_ROOT, "comp-desktop-1440x900.png"),
        fullPage: true,
    });
});

test("无匹配阵容显示空状态且条件只在客户端过滤", async ({ page }) => {
    const failures = collectRuntimeFailures(page);
    const compRequest = waitForCompRequest(page);
    await page.goto("/log/comp_ranking/vorasius?role=tank.eq.9");

    const requestUrl = new URL((await compRequest).url());
    expect(requestUrl.pathname).toBe(COMP_API_PATH);
    expect(requestUrl.search).toBe("");
    await expect(page.getByText("当前公开 Top10 样本中没有符合条件的阵容", { exact: true }))
        .toBeVisible();
    await expect(page.getByRole("link", { name: "修改条件" }))
        .toHaveAttribute("href", "/log/comp_ranking/search");
    await expect(page.locator("[data-player-row]")).toHaveCount(0);
    expect(failures).toEqual([]);
});

test("阵容 API 失败后重试同一目标并恢复结果", async ({ page }) => {
    let attempts = 0;
    await page.route(`**${COMP_API_PATH}`, async (route) => {
        attempts += 1;
        if (attempts === 1) {
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "generated comp failure" }),
            });
            return;
        }
        await route.continue();
    });

    const failures = collectRuntimeFailures(page);
    await page.goto("/log/comp_ranking/vorasius?role=tank.eq.2");

    await expect(page.getByRole("alert", { name: "阵容参考载入失败" })).toBeVisible();
    await page.getByRole("button", { name: "重试" }).click();

    await expect.poll(() => attempts).toBe(2);
    await expectReadyResult(page);
    expect(failures).toEqual([`http:503:${COMP_API_PATH}`]);
});

test("非法条件与未知首领都进入不可用页且不请求阵容 API", async ({ page }) => {
    const failures = collectRuntimeFailures(page);
    const compRequests: string[] = [];
    page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith("/log/api/comp_ranking/")) compRequests.push(url.pathname);
    });

    for (const path of [
        "/comp_ranking/vorasius?token=x",
        "/comp_ranking/unknown-boss?role=tank.eq.2",
    ]) {
        await page.goto(`/log${path}`);
        await expect(page.getByRole("heading", { level: 1, name: "没有找到这个页面" }))
            .toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(compRequests, `访问 ${path} 时不应请求阵容 API`).toEqual([]);
    }

    expect(failures).toEqual([]);
});

test("390x844 结果页无外层溢出且可见控件满足名称与 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/comp_ranking/vorasius?role=tank.eq.2");
    await expectReadyResult(page);
    await expectImagesLoaded(page);

    const audit = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;
        const timeline = document.querySelector<HTMLElement>("[data-testid='timeline-canvas']");
        const textAlternative = document.querySelector<HTMLElement>(
            "[role='region'][aria-label='阵容时间轴文字摘要']",
        );
        const isRendered = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0
                && rect.height > 0
                && style.display !== "none"
                && style.visibility !== "hidden";
        };
        const accessibleName = (element: HTMLElement) => {
            const labelledBy = element.getAttribute("aria-labelledby");
            const labelledText = labelledBy
                ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
                : "";
            const labels = "labels" in element
                ? Array.from((element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).labels ?? [])
                    .map((label) => label.textContent ?? "")
                    .join(" ")
                : "";
            return element.getAttribute("aria-label")
                || labelledText
                || labels
                || element.textContent
                || element.getAttribute("title")
                || "";
        };

        const controls = Array.from(document.querySelectorAll<HTMLElement>(
            "main a, main button, main input, main select, main textarea, main summary, "
                + "main [tabindex]:not([tabindex='-1'])",
        )).filter((element) => (
            !textAlternative?.contains(element) && isRendered(element)
        ));
        const unnamed = controls
            .filter((element) => !accessibleName(element).trim())
            .map((element) => element.outerHTML.slice(0, 160));
        const undersized = controls.flatMap((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width >= 44 && rect.height >= 44) return [];
            return [{
                tag: element.tagName,
                name: accessibleName(element).trim(),
                width: rect.width,
                height: rect.height,
            }];
        });
        const rogueOverflow = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
            .filter((element) => {
                if (timeline?.contains(element) || textAlternative?.contains(element)) return false;
                if (!isRendered(element)) return false;
                const rect = element.getBoundingClientRect();
                return rect.left < -1 || rect.right > clientWidth + 1;
            })
            .slice(0, 20)
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    tag: element.tagName,
                    name: accessibleName(element).trim().slice(0, 80),
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                };
            });

        return {
            documentWidth: document.documentElement.scrollWidth,
            clientWidth,
            playerColumnWidth: document.querySelector<HTMLElement>("[data-player-row]")
                ?.getBoundingClientRect().width ?? 0,
            timelineViewportWidth: timeline?.getBoundingClientRect().width ?? 0,
            controlCount: controls.length,
            unnamed,
            undersized,
            rogueOverflow,
        };
    });

    expect(audit.documentWidth).toBe(audit.clientWidth);
    expect(audit.playerColumnWidth).toBeGreaterThanOrEqual(164);
    expect(audit.playerColumnWidth).toBeLessThanOrEqual(184.5);
    expect(audit.timelineViewportWidth).toBeGreaterThanOrEqual(160);
    expect(audit.controlCount).toBeGreaterThan(0);
    expect(audit.unnamed).toEqual([]);
    expect(audit.undersized).toEqual([]);
    expect(audit.rogueOverflow).toEqual([]);
    expect(failures).toEqual([]);

    await page.screenshot({
        path: join(SCREENSHOT_ROOT, "comp-mobile-390x844.png"),
        fullPage: true,
    });
});
