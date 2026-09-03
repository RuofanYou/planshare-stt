import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { collectRuntimeFailures } from "./helpers/runtimeFailures";
import { commitTargetDraft, openTargetPicker } from "./target-picker";

const SCREENSHOT_ROOT = process.env.RAIDGLASS_SCREENSHOT_ROOT || "/tmp/raidglass-release-local";
mkdirSync(SCREENSHOT_ROOT, { recursive: true });

function waitForFireMageRanking(page: Page, difficulty: "heroic" | "mythic") {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.ok()
            && url.pathname === "/log/api/spec_ranking/mage-fire/imperator-averzian"
            && url.searchParams.get("difficulty") === difficulty;
    });
}

async function tabTo(page: Page, target: Locator, maxSteps = 16) {
    await expect(target).toBeVisible();
    for (let step = 0; step < maxSteps; step += 1) {
        if (await target.evaluate((element) => document.activeElement === element)) return;
        await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
}

async function expectVisibleFocus(target: Locator) {
    await expect(target).toBeFocused();
    expect(await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    })).toBe(true);
}

async function ensureTimelineOverflow(page: Page, canvas: Locator, minimumRange = 160) {
    const readMinimum = () => canvas.evaluate((element) => (
        Number(element.dataset.timelinePanMin)
    ));
    const zoomIn = page.getByRole("button", { name: "放大" });

    for (let attempt = 0; attempt < 6; attempt += 1) {
        if (await readMinimum() <= -minimumRange) return;
        await zoomIn.click();
    }
    await expect.poll(readMinimum).toBeLessThanOrEqual(-minimumRange);
}

async function hoverFirstPlayerCastUntilVisible(page: Page) {
    const timeline = page.getByTestId("timeline-canvas");
    const target = page.locator('[role="tooltip"]');
    const timelineBox = await timeline.boundingBox();
    const firstPlayerBox = await page.locator("[data-player-row]").first().boundingBox();
    if (!timelineBox || !firstPlayerBox) throw new Error("时间轴或首位玩家缺少可测几何");
    const y = firstPlayerBox.y + firstPlayerBox.height / 2 - timelineBox.y;
    const scanEnd = timelineBox.width - 8;

    for (let x = 24; x <= scanEnd; x += 8) {
        await timeline.hover({ position: { x, y } });
        if (await target.count() > 0) {
            await expect(target).toBeVisible();
            return target;
        }
    }
    throw new Error("首位玩家可见时间轴中未命中目标技能");
}

test("桌面端同页完成 Top10 作业", async ({ context, page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/");
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();
    await expect(page.getByText("选定首领、职业专精和难度，时间轴会在同一页自动更新。")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "设置" })).toHaveCount(0);
    const settingsToggle = page.getByRole("button", { name: "筛选与显示", exact: true });
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "技能图标" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();

    await commitTargetDraft(page, {
        boss: "imperator-averzian",
        className: "mage",
        specName: "火焰法师",
    });
    const heroicButton = page.getByRole("button", { name: "英雄难度" });
    const heroicRanking = waitForFireMageRanking(page, "heroic");
    await heroicButton.focus();
    await page.keyboard.press("Enter");
    await heroicRanking;
    await expect(heroicButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "更换目标：阿维兹安大帝 · 火焰法师" })).toBeVisible();
    await expect(page.locator("[data-freshness]")).not.toHaveAttribute("data-freshness", "loading");
    await expect(page.getByText("正在更新")).toHaveCount(0);
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    await expect(page.getByTestId("workbench-context")).not.toContainText(/\bDPS\b/);

    const timelineCanvas = page.getByTestId("timeline-canvas");
    await expect(timelineCanvas).toHaveAttribute("data-timeline-label-icon-collisions", "0");
    await expect.poll(() => timelineCanvas.evaluate((element) => (
        Number(element.dataset.timelineVisibleLabels ?? 0)
    ))).toBeGreaterThan(0);

    const localizedTooltip = await hoverFirstPlayerCastUntilVisible(page);
    await expect(localizedTooltip).toContainText(/[\u3400-\u9fff]/);
    await expect(localizedTooltip).not.toContainText(/[A-Za-z]{3}/);

    const copyButton = page.getByRole("button", { name: "复制 Top10 作业" });
    await page.keyboard.press("Tab");
    await expect(copyButton).toBeFocused();
    const focusIsVisible = await copyButton.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    });
    expect(focusIsVisible).toBe(true);
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Top10 作业已复制" })).toContainText("已复制");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId("workbench-context")).toHaveCount(1);
    await expect(copyButton).toBeEnabled();
    await expect(page.getByText("打开时间轴")).toHaveCount(0);

    const labelsBeforeSettings = await timelineCanvas.evaluate((element) => (
        Number(element.dataset.timelineVisibleLabels ?? 0)
    ));
    await settingsToggle.click();
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "技能图标" })).toBeVisible();
    await expect(timelineCanvas).toHaveAttribute("data-timeline-label-icon-collisions", "0");
    expect(await timelineCanvas.evaluate((element) => (
        Number(element.dataset.timelineVisibleLabels ?? 0)
    ))).toBe(labelsBeforeSettings);
    const dialogClose = page.getByRole("dialog", { name: "筛选与显示" })
        .locator("[data-dialog-close-control]");
    await dialogClose.click();
    const interruptClose = page.locator("[data-dialog-interrupt-control]");
    const interruptCloseLabel = await interruptClose.evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) return null;
        const label = button.getAttribute("aria-label");
        button.click();
        return label;
    });
    expect(interruptCloseLabel).toBe("取消关闭筛选与显示");
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");
    await expect(dialogClose).toHaveAccessibleName("关闭筛选与显示");
    await dialogClose.click();
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "false");

    const geometry = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-player-row]"));
        const firstFive = rows.slice(0, 5);
        const firstSeven = rows.slice(0, 7);
        const gap = (left: Element | null, right: Element | null) => {
            if (!left || !right) return Number.NEGATIVE_INFINITY;
            return right.getBoundingClientRect().left - left.getBoundingClientRect().right;
        };
        const canvas = document.querySelector<HTMLElement>("[data-testid='timeline-canvas']");
        const main = document.querySelector<HTMLElement>("main[aria-label='主要内容']");
        const appFrame = main?.parentElement;
        const footer = document.querySelector<HTMLElement>("footer");
        const lastRow = rows.at(-1);
        const appFrameRect = appFrame?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const lastRowRect = lastRow?.getBoundingClientRect();
        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            completeRows: firstSeven.filter((row) => row.getBoundingClientRect().bottom <= innerHeight).length,
            rowGaps: firstFive.map((row) => ({
                rankToName: gap(row.querySelector("[data-player-rank]"), row.querySelector("[title]")),
                nameToTotal: gap(row.querySelector("[title]"), row.querySelector("[data-player-total]")),
            })),
            collisions: Number(canvas?.dataset.timelineLabelCollisions ?? -1),
            iconCollisions: Number(canvas?.dataset.timelineLabelIconCollisions ?? -1),
            ninetySecondX: 90 * Number(canvas?.dataset.timelineZoom ?? 0),
            canvasWidth: canvas?.clientWidth ?? 0,
            imageErrors: document.querySelectorAll("[data-rg-image-error='true']").length,
            brandCenterError: (() => {
                const image = document.querySelector<HTMLElement>("a[aria-label='RaidGlass 首页'] img");
                const frame = image?.parentElement;
                if (!image || !frame) return Number.POSITIVE_INFINITY;
                const imageRect = image.getBoundingClientRect();
                const frameRect = frame.getBoundingClientRect();
                return Math.max(
                    Math.abs((imageRect.left + imageRect.width / 2) - (frameRect.left + frameRect.width / 2)),
                    Math.abs((imageRect.top + imageRect.height / 2) - (frameRect.top + frameRect.height / 2)),
                );
            })(),
            headingFont: getComputedStyle(document.querySelector("h1")!).fontFamily,
            lastRowInsideFrame: Boolean(
                appFrameRect && lastRowRect && lastRowRect.bottom <= appFrameRect.bottom + 1
            ),
            footerGap: appFrameRect && footerRect
                ? footerRect.top - appFrameRect.bottom
                : Number.NEGATIVE_INFINITY,
        };
    });

    expect(geometry.documentWidth).toBe(geometry.viewportWidth);
    expect(geometry.completeRows).toBeGreaterThanOrEqual(3);
    for (const gaps of geometry.rowGaps) {
        expect(gaps.rankToName).toBeGreaterThanOrEqual(8);
        expect(gaps.nameToTotal).toBeGreaterThanOrEqual(8);
    }
    expect(geometry.collisions).toBe(0);
    expect(geometry.iconCollisions).toBe(0);
    expect(geometry.ninetySecondX).toBeGreaterThan(0);
    expect(geometry.ninetySecondX).toBeLessThanOrEqual(geometry.canvasWidth);
    expect(geometry.imageErrors).toBe(0);
    expect(geometry.brandCenterError).toBeLessThanOrEqual(0.5);
    expect(geometry.headingFont).toMatch(/sans-serif/i);
    expect(geometry.headingFont).not.toMatch(/Georgia|Times New Roman|Noto Serif|Songti/i);
    expect(geometry.lastRowInsideFrame).toBe(true);
    expect(geometry.footerGap).toBeGreaterThanOrEqual(0);
    expect(failures).toEqual([]);

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/desktop-1440x1000.png`, fullPage: true });
});

test("2048px 宽屏工作台展开主画布并把上下文分成清晰层级", async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1060 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    await expect(page.getByTestId("timeline-canvas"))
        .toHaveAttribute("data-timeline-images-loaded", "true");

    const main = page.getByRole("main", { name: "主要内容" });
    const frame = main.locator("..");
    const workbench = page.getByTestId("timeline-workbench");
    const summary = page.getByTestId("workbench-context");
    const heading = page.getByRole("heading", {
        level: 2,
        name: "阿维兹安大帝 · 鲜血死亡骑士",
    });
    const targetTrigger = page.getByRole("button", {
        name: "更换目标：阿维兹安大帝 · 鲜血死亡骑士",
    });
    const metadata = summary.locator("dl");
    const copyButton = page.getByRole("button", { name: "复制 Top10 作业" });
    const firstPlayer = page.locator("[data-player-row]").first();

    const [
        frameBox,
        workbenchBox,
        summaryBox,
        headingBox,
        targetBox,
        metadataBox,
        copyBox,
        playerBox,
    ] = await Promise.all([
        frame.boundingBox(),
        workbench.boundingBox(),
        summary.boundingBox(),
        heading.boundingBox(),
        targetTrigger.boundingBox(),
        metadata.boundingBox(),
        copyButton.boundingBox(),
        firstPlayer.boundingBox(),
    ]);
    if (
        !frameBox
        || !workbenchBox
        || !summaryBox
        || !headingBox
        || !targetBox
        || !metadataBox
        || !copyBox
        || !playerBox
    ) {
        throw new Error("宽屏工作台缺少可测几何");
    }

    const documentGeometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
    }));

    expect(frameBox.width / 2048).toBeGreaterThanOrEqual(0.92);
    expect(frameBox.height).toBeGreaterThanOrEqual(900);
    expect(workbenchBox.width / frameBox.width).toBeGreaterThanOrEqual(0.78);
    expect(workbenchBox.width / frameBox.width).toBeLessThanOrEqual(0.9);
    expect(workbenchBox.y + workbenchBox.height).toBeGreaterThanOrEqual(1060 * 0.84);
    expect(summaryBox.height).toBeGreaterThanOrEqual(240);
    expect(Math.abs(headingBox.y - targetBox.y)).toBeLessThanOrEqual(28);
    expect(metadataBox.y).toBeGreaterThan(headingBox.y + headingBox.height);
    expect(Math.abs(metadataBox.y - copyBox.y)).toBeLessThanOrEqual(28);
    expect(copyBox.x).toBeGreaterThan(metadataBox.x + metadataBox.width);
    expect(playerBox.width).toBeGreaterThanOrEqual(286);
    expect(playerBox.width).toBeLessThanOrEqual(321);
    expect(playerBox.height).toBeGreaterThanOrEqual(52);
    expect(documentGeometry.documentWidth).toBe(documentGeometry.viewportWidth);
    expect(failures).toEqual([]);

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/wide-desktop-2048x1060.png`, fullPage: true });
});

test("分享路由复用统一工作台", async ({ page }) => {
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps");
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();
    expect(failures).toEqual([]);
});

test("移动端单人作业使用原生模态、显式复制并在目标切换时清理", async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);

    const copyTrigger = page.locator("[data-player-row]").first()
        .getByRole("button", { name: /^复制.+的作业$/ });
    await copyTrigger.click();
    const dialog = page.getByRole("dialog", { name: "复制单人作业" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭复制作业" })).toBeFocused();
    await expect.poll(() => dialog.evaluate((element) => (
        element.getAnimations().every((animation) => animation.playState === "finished")
    ))).toBe(true);

    const geometry = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const controls = Array.from(element.querySelectorAll<HTMLElement>("button, input, select"));
        return {
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            minControlSize: Math.min(...controls.map((control) => {
                const controlRect = control.getBoundingClientRect();
                return Math.min(controlRect.width, controlRect.height);
            })),
        };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(391);
    expect(geometry.bottom).toBeGreaterThanOrEqual(843);
    expect(geometry.bottom).toBeLessThanOrEqual(845);
    expect(geometry.minControlSize).toBeGreaterThanOrEqual(44);

    await page.getByRole("button", { name: "复制 STT 格式" }).click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_ROOT}/copy-note-mobile-390x844.png`, fullPage: true });

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(copyTrigger).toBeFocused();

    await copyTrigger.click();
    await expect(dialog).toBeVisible();
    const nextRanking = waitForFireMageRanking(page, "mythic");
    await page.evaluate(() => {
        history.pushState({}, "", "/log/spec_ranking/mage-fire/imperator-averzian?difficulty=mythic&metric=dps");
        window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await nextRanking;
    await expect(page.getByRole("button", { name: "更换目标：阿维兹安大帝 · 火焰法师" })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(failures).toEqual([]);
});

test("核心工作台可全程用键盘到达", async ({ page }) => {
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);

    const targetTrigger = page.getByRole("button", { name: /^更换目标：/ });
    await tabTo(page, targetTrigger);
    await expectVisibleFocus(targetTrigger);
    await page.keyboard.press("Enter");

    const targetDialog = page.getByRole("dialog", { name: "选择首领与专精" });
    await expect(targetDialog).toBeVisible();
    const targetControls = [
        targetDialog.getByRole("combobox", { name: "首领", exact: true }),
        targetDialog.getByRole("combobox", { name: "职业", exact: true }),
        targetDialog.getByRole("button", { name: "痛苦术士", exact: true }),
        targetDialog.getByRole("button", { name: "恶魔学识术士", exact: true }),
        targetDialog.getByRole("button", { name: "毁灭术士", exact: true }),
        targetDialog.getByRole("button", { name: "查看该时间轴" }),
    ];
    for (const target of targetControls) {
        await tabTo(page, target);
        await expectVisibleFocus(target);
    }
    await page.keyboard.press("Escape");
    await expect(targetDialog).toBeHidden();

    const targets = [
        page.getByRole("button", { name: "史诗难度" }),
        page.getByRole("button", { name: "英雄难度" }),
        page.getByRole("button", { name: "复制 Top10 作业" }),
        page.getByRole("button", { name: "筛选与显示", exact: true }),
    ];
    for (const target of targets) {
        await tabTo(page, target);
        await expectVisibleFocus(target);
    }

    const settingsToggle = targets.at(-1)!;
    await page.keyboard.press("Enter");
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");

    const iconToggle = page.getByRole("button", { name: "技能图标" });
    await tabTo(page, iconToggle);
    await expectVisibleFocus(iconToggle);
    await page.keyboard.press("Space");
    await expect(iconToggle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await expect(iconToggle).toHaveAttribute("aria-pressed", "true");
    expect(failures).toEqual([]);
});

test("密集时间轴的时间文字不覆盖技能图标", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/spec_ranking/mage-fire/vorasius?difficulty=heroic&metric=dps");
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();
    await expect(page.locator("[data-player-row]")).toHaveCount(10);

    const timelineCanvas = page.getByTestId("timeline-canvas");
    await expect(timelineCanvas).toHaveAttribute("data-timeline-label-icon-collisions", "0");
    await expect(timelineCanvas).toHaveAttribute("data-timeline-label-collisions", "0");
    await expect.poll(() => timelineCanvas.evaluate((element) => (
        Number(element.dataset.timelineVisibleLabels ?? 0)
    ))).toBeGreaterThan(0);
    expect(failures).toEqual([]);

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/dense-timeline-1440x1000.png`, fullPage: true });
});

test("移动端时间轴直接平移且页面无横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/");
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();
    await commitTargetDraft(page, {
        boss: "imperator-averzian",
        className: "mage",
        specName: "火焰法师",
    });
    const heroicRanking = waitForFireMageRanking(page, "heroic");
    await page.getByRole("button", { name: "英雄难度" }).click();
    await heroicRanking;
    await expect(page.locator("[data-freshness]")).not.toHaveAttribute("data-freshness", "loading");
    await expect(page.getByText("正在更新")).toHaveCount(0);
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    const firstMobilePlayer = page.locator("[data-player-row]").first();
    await expect(firstMobilePlayer).toBeVisible();
    expect(await firstMobilePlayer.evaluate((element) => (
        getComputedStyle(element.parentElement?.parentElement ?? element).contentVisibility
    ))).toBe("visible");

    const mobile = await page.evaluate(() => {
        const timelineScroll = document.querySelector<HTMLElement>("[data-timeline-scroll]");
        const timelineCanvas = document.querySelector<HTMLElement>("[data-testid='timeline-canvas']");
        const timelineVisual = document.querySelector<HTMLElement>("[data-testid='timeline-canvas-visual']");
        const firstPlayerRow = document.querySelector<HTMLElement>("[data-player-row]");
        const playerRows = Array.from(document.querySelectorAll<HTMLElement>("[data-player-row]"));
        const lastPlayerRow = playerRows.at(-1);
        const targetControl = document.querySelector<HTMLElement>("button[aria-label^='更换目标：']");
        const difficultyControl = document.querySelector<HTMLElement>("button[aria-label='英雄难度']")?.closest("fieldset")
            || Array.from(document.querySelectorAll<HTMLElement>("fieldset")).find((fieldset) => (
                fieldset.textContent?.includes("史诗难度") && fieldset.textContent?.includes("英雄难度")
            ));
        const main = document.querySelector("main");
        const visibleButtons = Array.from(main?.querySelectorAll<HTMLElement>("button") ?? [])
            .filter((button) => button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0);
        const unnamed = Array.from(main?.querySelectorAll<HTMLElement>("a,button,input,select") ?? [])
            .filter((element) => {
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return false;
                const labelledBy = element.getAttribute("aria-labelledby");
                const label = element.getAttribute("aria-label")
                    || (labelledBy ? document.getElementById(labelledBy)?.textContent : "")
                    || element.textContent
                    || element.getAttribute("title")
                    || "";
                return !label.trim();
            }).length;
        const rogueOverflow = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
            .filter((element) => {
                if (timelineScroll?.contains(element)) return false;
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1);
            })
            .slice(0, 20)
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    tag: element.tagName,
                    className: element.className,
                    label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || "",
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                };
            });
        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            timelineDomScrollable: Boolean(
                timelineScroll && timelineScroll.scrollWidth > timelineScroll.clientWidth
            ),
            timelinePanRange: Number(timelineVisual?.dataset.timelinePanMax ?? 0)
                - Number(timelineVisual?.dataset.timelinePanMin ?? 0),
            timelineOverflowX: timelineScroll ? getComputedStyle(timelineScroll).overflowX : "",
            timelineTouchAction: timelineCanvas ? getComputedStyle(timelineCanvas).touchAction : "",
            playerColumnWidth: firstPlayerRow?.getBoundingClientRect().width ?? 0,
            timelineViewportWidth: (timelineScroll?.clientWidth ?? 0) - (firstPlayerRow?.getBoundingClientRect().width ?? 0),
            minButtonSize: Math.min(...visibleButtons.map((button) => (
                Math.min(button.offsetWidth, button.offsetHeight)
            ))),
            timelineIntroducedWithoutScroll: Boolean(
                timelineVisual && timelineVisual.getBoundingClientRect().top < innerHeight - 44
            ),
            targetDifficultyStackGap: targetControl && difficultyControl
                ? difficultyControl.getBoundingClientRect().top - targetControl.getBoundingClientRect().bottom
                : Number.POSITIVE_INFINITY,
            targetDifficultyEdgeDelta: targetControl && difficultyControl
                ? Math.max(
                    Math.abs(targetControl.getBoundingClientRect().left - difficultyControl.getBoundingClientRect().left),
                    Math.abs(targetControl.getBoundingClientRect().right - difficultyControl.getBoundingClientRect().right),
                )
                : Number.POSITIVE_INFINITY,
            timelineRowBottomDelta: lastPlayerRow && timelineVisual
                ? Math.abs(
                    lastPlayerRow.getBoundingClientRect().bottom
                    - timelineVisual.getBoundingClientRect().bottom
                )
                : Number.POSITIVE_INFINITY,
            unnamed,
            rogueOverflow,
        };
    });

    expect(mobile.documentWidth).toBe(mobile.viewportWidth);
    expect(mobile.timelineDomScrollable).toBe(false);
    expect(mobile.timelinePanRange).toBeGreaterThan(0);
    expect(mobile.timelineOverflowX).toBe("hidden");
    expect(mobile.timelineTouchAction).toContain("pan-y");
    expect(mobile.playerColumnWidth).toBeGreaterThanOrEqual(164);
    expect(mobile.playerColumnWidth).toBeLessThanOrEqual(184.5);
    expect(mobile.timelineViewportWidth).toBeGreaterThanOrEqual(120);
    expect(mobile.minButtonSize).toBeGreaterThanOrEqual(44);
    expect(mobile.timelineIntroducedWithoutScroll).toBe(true);
    expect(mobile.targetDifficultyStackGap).toBeGreaterThanOrEqual(0);
    expect(mobile.targetDifficultyStackGap).toBeLessThanOrEqual(8);
    expect(mobile.targetDifficultyEdgeDelta).toBeLessThanOrEqual(4);
    expect(mobile.timelineRowBottomDelta).toBeLessThanOrEqual(1);
    expect(mobile.unnamed).toBe(0);
    expect(mobile.rogueOverflow).toEqual([]);
    expect(failures).toEqual([]);

    await firstMobilePlayer.scrollIntoViewIfNeeded();
    await expect(firstMobilePlayer).toBeInViewport({ ratio: 0.9 });

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/mobile-430x932.png`, fullPage: true });
});

test("430px 下完整显示长专精名称", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/log/");

    const targetDialog = await openTargetPicker(page);
    const longSpec = targetDialog.getByRole("button", { name: "恶魔学识术士" });
    await expect(longSpec).toBeVisible();
    const label = longSpec.locator("span");
    await expect(label).toHaveCount(1);
    const labelGeometry = await label.evaluate((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        textOverflow: getComputedStyle(element).textOverflow,
        whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    expect(labelGeometry.scrollWidth).toBeLessThanOrEqual(labelGeometry.clientWidth);
    expect(labelGeometry.scrollHeight).toBeLessThanOrEqual(labelGeometry.clientHeight);
    expect(labelGeometry.textOverflow).not.toBe("ellipsis");
    expect(labelGeometry.whiteSpace).toBe("normal");

    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    await expect.poll(() => page.evaluate(() => (
        Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
            .every((image) => image.complete && image.naturalWidth > 0)
    ))).toBe(true);
    await expect.poll(() => page.getByTestId("timeline-canvas").evaluate((element) => (
        Number(element.dataset.timelineVisibleLabels ?? 0)
    ))).toBeGreaterThan(0);
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/mobile-long-spec-430x932.png`, fullPage: true });
});

test("200% 放大近似视口完整重排核心控件", async ({ page }) => {
    await page.setViewportSize({ width: 215, height: 466 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/");
    await expect(page.getByTestId("timeline-workbench")).toBeVisible();

    const geometry = await page.evaluate(() => {
        const frame = document.querySelector<HTMLElement>("[class*='appFrame']");
        const brand = document.querySelector<HTMLElement>("a[aria-label='RaidGlass 首页']");
        const targetControl = document.querySelector<HTMLElement>("button[aria-label^='更换目标：']");
        const difficultyControl = Array.from(document.querySelectorAll<HTMLElement>("fieldset")).find((fieldset) => (
            fieldset.textContent?.includes("史诗难度") && fieldset.textContent?.includes("英雄难度")
        ));
        const difficultyButtons = Array.from(difficultyControl?.querySelectorAll<HTMLElement>("button") ?? []);
        const navLinks = Array.from(document.querySelectorAll<HTMLElement>("nav[aria-label='主导航'] a"));
        const overlaps = (left: DOMRect, right: DOMRect) => (
            Math.min(left.right, right.right) > Math.max(left.left, right.left)
            && Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
        );
        const frameRect = frame?.getBoundingClientRect();
        const brandRect = brand?.getBoundingClientRect();
        const targetRect = targetControl?.getBoundingClientRect();
        const difficultyRect = difficultyControl?.getBoundingClientRect();

        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            frameClipsContent: Boolean(frame && frame.scrollWidth > frame.clientWidth + 1),
            brandInsideFrame: Boolean(frameRect && brandRect
                && brandRect.left >= frameRect.left - 1
                && brandRect.right <= frameRect.right + 1),
            targetDifficultyOverlap: Boolean(targetRect && difficultyRect && overlaps(targetRect, difficultyRect)),
            minDifficultyButtonWidth: Math.min(...difficultyButtons.map((button) => button.getBoundingClientRect().width)),
            navLinksInsideFrame: Boolean(frameRect && navLinks.every((link) => {
                const rect = link.getBoundingClientRect();
                return rect.left >= frameRect.left - 1 && rect.right <= frameRect.right + 1;
            })),
        };
    });

    expect(geometry.documentWidth).toBe(geometry.viewportWidth);
    expect(geometry.frameClipsContent).toBe(false);
    expect(geometry.brandInsideFrame).toBe(true);
    expect(geometry.targetDifficultyOverlap).toBe(false);
    expect(geometry.minDifficultyButtonWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.navLinksInsideFrame).toBe(true);
    expect(failures).toEqual([]);

    await page.screenshot({ path: `${SCREENSHOT_ROOT}/zoom-200-215x466.png`, fullPage: true });
});

test("timeline wheel pans both directions and remains inside hard bounds", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);

    const canvas = page.getByTestId("timeline-canvas-visual");
    const content = canvas.locator(".konvajs-content");
    await ensureTimelineOverflow(page, canvas);
    const read = () => canvas.evaluate((element) => ({
        x: Number(element.dataset.timelinePanX),
        minX: Number(element.dataset.timelinePanMin),
        maxX: Number(element.dataset.timelinePanMax),
    }));

    const initial = await read();
    expect(initial.minX).toBeLessThan(0);

    await content.dispatchEvent("wheel", { deltaX: 120, deltaY: 0, deltaMode: 0 });
    const afterRight = await read();
    expect(afterRight.x).toBeLessThan(0);

    await content.dispatchEvent("wheel", { deltaX: -120, deltaY: 0, deltaMode: 0 });
    const afterLeft = await read();
    expect(afterLeft.x).toBeGreaterThan(afterRight.x);

    await content.dispatchEvent("wheel", {
        deltaX: 0,
        deltaY: 120,
        deltaMode: 0,
        shiftKey: true,
    });
    expect((await read()).x).toBeLessThan(afterLeft.x);

    for (let index = 0; index < 20; index += 1) {
        await content.dispatchEvent("wheel", { deltaX: 1000, deltaY: 0, deltaMode: 0 });
    }
    const atMinimum = await read();
    expect(atMinimum.x).toBeCloseTo(atMinimum.minX, 1);

    for (let index = 0; index < 20; index += 1) {
        await content.dispatchEvent("wheel", { deltaX: -1000, deltaY: 0, deltaMode: 0 });
    }
    const atMaximum = await read();
    expect(atMaximum.x).toBeCloseTo(atMaximum.maxX, 1);

    const beforeVertical = await read();
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    const allowed = await content.evaluate((element) => element.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 120,
    })));
    expect(allowed).toBe(true);
    expect((await read()).x).toBe(beforeVertical.x);

    const contentBox = await content.boundingBox();
    if (!contentBox) throw new Error("时间轴内容缺少可测几何");
    await page.mouse.move(contentBox.x + 20, contentBox.y + 20);
    await page.mouse.wheel(0, 320);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScrollY);
});

test("timeline drag hands off velocity and pointer down interrupts inertia", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);

    const canvas = page.getByTestId("timeline-canvas-visual");
    await ensureTimelineOverflow(page, canvas, 400);
    await canvas.locator(".konvajs-content").dispatchEvent("wheel", {
        deltaX: -2000,
        deltaY: 0,
        deltaMode: 0,
    });
    const gesture = await page.getByTestId("timeline-canvas").evaluate(async (element) => {
        const target = element as HTMLElement;
        const nativeSetPointerCapture = target.setPointerCapture;
        const nativeHasPointerCapture = target.hasPointerCapture;
        const nativeReleasePointerCapture = target.releasePointerCapture;
        target.setPointerCapture = () => {};
        target.hasPointerCapture = () => false;
        target.releasePointerCapture = () => {};

        const wait = (delay: number) => new Promise((resolve) => window.setTimeout(resolve, delay));
        const dispatch = (type: string, clientX: number, buttons: number) => {
            target.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                button: 0,
                buttons,
                clientX,
                clientY: 100,
                isPrimary: true,
                pointerId: 17,
                pointerType: "mouse",
            }));
        };

        try {
            dispatch("pointerdown", 360, 1);
            await wait(16);
            dispatch("pointermove", 300, 1);
            await wait(16);
            dispatch("pointermove", 240, 1);
            await wait(16);
            dispatch("pointermove", 160, 1);
            dispatch("pointerup", 160, 0);
            dispatch("pointerdown", 160, 1);

            const interruptedX = Number(target.dataset.timelinePanX);
            const velocity = Number(target.dataset.timelineLastMotionVelocity);
            const targetX = Number(target.dataset.timelineLastMotionTarget);
            const stopReason = target.dataset.timelineLastMotionStopReason;
            await wait(80);
            const heldX = Number(target.dataset.timelinePanX);

            dispatch("pointermove", 260, 1);
            const movedX = Number(target.dataset.timelinePanX);
            dispatch("pointercancel", 260, 0);

            return {
                velocity,
                targetX,
                stopReason,
                interruptedX,
                heldX,
                movedX,
                finalX: Number(target.dataset.timelinePanX),
                minX: Number(target.dataset.timelinePanMin),
                maxX: Number(target.dataset.timelinePanMax),
            };
        } finally {
            target.setPointerCapture = nativeSetPointerCapture;
            target.hasPointerCapture = nativeHasPointerCapture;
            target.releasePointerCapture = nativeReleasePointerCapture;
        }
    });

    expect(gesture.velocity).toBeLessThan(0);
    expect(gesture.targetX).toBeLessThan(gesture.interruptedX);
    expect(gesture.stopReason).toBe("pointerdown");
    expect(gesture.heldX).toBeCloseTo(gesture.interruptedX, 1);
    expect(gesture.movedX).toBeGreaterThan(gesture.interruptedX);
    expect(gesture.finalX).toBeGreaterThanOrEqual(gesture.minX - 0.5);
    expect(gesture.finalX).toBeLessThanOrEqual(gesture.maxX + 0.5);
});

test("timeline touch keeps horizontal drag and returns vertical intent to the page", async ({ browser }) => {
    const context = await browser.newContext({
        viewport: { width: 430, height: 700 },
        hasTouch: true,
        isMobile: true,
        locale: "zh-CN",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    try {
        await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
        await expect(page.locator("[data-player-row]")).toHaveCount(10);
        const viewport = page.getByTestId("timeline-canvas");
        const canvas = page.getByTestId("timeline-canvas-visual");
        await viewport.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        const viewportBox = await viewport.boundingBox();
        if (!box || !viewportBox) throw new Error("移动时间轴缺少可测几何");
        const readX = () => canvas.evaluate((element) => Number(element.dataset.timelinePanX));
        await page.evaluate(() => {
            const scope = window as typeof window & {
                __timelineTouchEvents?: Array<Record<string, string | number | boolean>>;
            };
            scope.__timelineTouchEvents = [];
            ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "touchend"]
                .forEach((type) => document.addEventListener(type, (event) => {
                    const pointer = event as PointerEvent;
                    const touch = event as TouchEvent;
                    scope.__timelineTouchEvents?.push({
                        type,
                        pointerType: pointer.pointerType || "",
                        button: Number.isFinite(pointer.button) ? pointer.button : -99,
                        isPrimary: pointer.isPrimary ?? false,
                        clientX: Number.isFinite(pointer.clientX)
                            ? pointer.clientX
                            : (touch.touches[0]?.clientX ?? -1),
                        clientY: Number.isFinite(pointer.clientY)
                            ? pointer.clientY
                            : (touch.touches[0]?.clientY ?? -1),
                        cancelable: event.cancelable,
                        defaultPrevented: event.defaultPrevented,
                    });
                }, true));
        });
        const readTouchEvents = () => page.evaluate(() => (
            (window as typeof window & {
                __timelineTouchEvents?: Array<Record<string, string | number | boolean>>;
            }).__timelineTouchEvents ?? []
        ));
        const dispatchTouch = async (
            type: "touchStart" | "touchMove" | "touchEnd",
            x?: number,
            y?: number,
        ) => {
            await cdp.send("Input.dispatchTouchEvent", {
                type,
                touchPoints: type === "touchEnd" ? [] : [{ x: x!, y: y! }],
            });
        };

        const horizontalY = viewportBox.y + Math.min(100, viewportBox.height / 2);
        const horizontalStartX = viewportBox.x + viewportBox.width - 24;
        const horizontalEndX = viewportBox.x + 20;
        await dispatchTouch("touchStart", horizontalStartX, horizontalY);
        await dispatchTouch(
            "touchMove",
            horizontalStartX - (horizontalStartX - horizontalEndX) / 2,
            horizontalY + 1,
        );
        await page.waitForTimeout(16);
        await dispatchTouch("touchMove", horizontalEndX, horizontalY + 1);
        await page.waitForTimeout(16);
        const horizontalX = await readX();
        expect(horizontalX, JSON.stringify(await readTouchEvents())).toBeLessThan(-70);
        await dispatchTouch("touchEnd");

        await expect.poll(() => canvas.getAttribute("data-timeline-motion")).toBe("idle");
        const beforeVerticalX = await readX();
        const beforeScrollY = await page.evaluate(() => window.scrollY);
        const verticalStartY = Math.min(viewportBox.y + viewportBox.height - 24, 620);
        const verticalX = viewportBox.x + viewportBox.width / 2;
        await page.evaluate(() => {
            const scope = window as typeof window & {
                __timelineTouchEvents?: Array<Record<string, string | number | boolean>>;
            };
            scope.__timelineTouchEvents = [];
        });
        await cdp.send("Input.synthesizeScrollGesture", {
            x: verticalX,
            y: verticalStartY,
            yDistance: -180,
            speed: 800,
            gestureSourceType: "touch",
        });

        const verticalEvents = await readTouchEvents();
        expect(verticalEvents.some((event) => (
            event.type === "pointermove" && event.defaultPrevented === false
        )), JSON.stringify(verticalEvents)).toBe(true);
        const verticalSurface = await viewport.evaluate((element, initialScrollY) => ({
            initialScrollY,
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
            touchAction: getComputedStyle(element).touchAction,
        }), beforeScrollY);
        expect(verticalSurface.scrollHeight).toBeGreaterThan(verticalSurface.clientHeight);
        expect(verticalSurface.touchAction).toContain("pan-y");
        expect(verticalSurface.scrollY).toBeGreaterThanOrEqual(verticalSurface.initialScrollY);
        expect(await readX()).toBeCloseTo(beforeVerticalX, 0);
    } finally {
        await context.close();
    }
});

test("timeline keyboard shortcuts only work inside canvas or toolbar", async ({ page }) => {
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    const timeline = page.getByTestId("timeline-canvas");
    const canvas = page.getByTestId("timeline-canvas-visual");
    const zoom = () => canvas.evaluate((element) => Number(element.dataset.timelineZoom));

    const copyButton = page.getByRole("button", { name: "复制 Top10 作业" });
    await copyButton.focus();
    const outsideZoom = await zoom();
    await page.keyboard.press("Shift+=");
    expect(await zoom()).toBe(outsideZoom);

    await timeline.focus();
    await expect(timeline).toBeFocused();
    await page.keyboard.press("Shift+=");
    expect(await zoom()).toBeGreaterThan(outsideZoom);
    await page.keyboard.press("0");
    expect(await zoom()).toBe(4);

    const zoomIn = page.getByRole("button", { name: "放大" });
    await zoomIn.focus();
    await page.keyboard.press("-");
    expect(await zoom()).toBeLessThan(4);
});

test("reduced motion clamps drag release without inertia or rebound", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    const canvas = page.getByTestId("timeline-canvas-visual");
    await expect(canvas).toHaveAttribute("data-timeline-reduced-motion", "true");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("时间轴缺少可测几何");

    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 280, box.y + 100, { steps: 2 });
    await page.mouse.up();

    await expect(canvas).toHaveAttribute("data-timeline-motion", "idle");
    const released = await canvas.evaluate((element) => Number(element.dataset.timelinePanX));
    await page.waitForTimeout(100);
    expect(await canvas.evaluate((element) => Number(element.dataset.timelinePanX)))
        .toBeCloseTo(released, 1);
    expect(released).toBe(0);
});

test("timeline pointer zoom preserves its world anchor and press feedback is immediate", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    const canvas = page.getByTestId("timeline-canvas-visual");
    const content = canvas.locator(".konvajs-content");
    await ensureTimelineOverflow(page, canvas);
    const box = await canvas.boundingBox();
    if (!box) throw new Error("时间轴缺少可测几何");

    await content.dispatchEvent("wheel", { deltaX: 240, deltaY: 0, deltaMode: 0 });
    const anchorX = 260;
    const before = await canvas.evaluate((element, anchor) => ({
        world: (anchor - Number(element.dataset.timelinePanX)) / Number(element.dataset.timelineZoom),
        scale: Number(element.dataset.timelineZoom),
    }), anchorX);

    await content.dispatchEvent("wheel", {
        deltaX: 0,
        deltaY: -120,
        deltaMode: 0,
        ctrlKey: true,
        clientX: box.x + anchorX,
        clientY: box.y + 100,
    });
    await expect.poll(() => canvas.evaluate((element) => Number(element.dataset.timelineZoom)))
        .toBeGreaterThan(before.scale);
    const after = await canvas.evaluate((element, anchor) => ({
        world: (anchor - Number(element.dataset.timelinePanX)) / Number(element.dataset.timelineZoom),
        scale: Number(element.dataset.timelineZoom),
    }), anchorX);
    const anchorPixelDrift = Math.abs(after.world - before.world) * after.scale;
    expect(anchorPixelDrift).toBeLessThanOrEqual(0.5);

    await page.mouse.move(box.x + 200, box.y + 100);
    await page.mouse.down();
    await expect(canvas).toHaveAttribute("data-timeline-input", "pressed");
    expect(await canvas.evaluate((element) => getComputedStyle(element).cursor)).toBe("grabbing");
    await page.mouse.up();
});
