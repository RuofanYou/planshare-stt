import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { collectRuntimeFailures } from "./helpers/runtimeFailures";

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

test("桌面直接选目标、搜索技能与撤销，操作不请求数据", async ({ context, page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=mythic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    await expect(page.getByTestId("timeline-canvas")).toHaveAttribute("data-timeline-images-loaded", "true");
    const skills = page.getByRole("complementary", { name: "技能筛选" });
    await expect(skills.getByRole("searchbox")).toBeVisible();
    const requests: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/")) requests.push(request.url()); });
    const initial = await skills.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).checked));
    await skills.getByRole("button", { name: /^仅看 / }).first().click();
    await expect(skills.getByRole("checkbox").filter({ visible: true })).toHaveCount(initial.length);
    expect(await skills.getByRole("checkbox").evaluateAll(inputs => inputs.filter(input => (input as HTMLInputElement).checked).length)).toBe(1);
    await skills.getByRole("button", { name: "撤销", exact: true }).click();
    expect(await skills.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).checked))).toEqual(initial);
    await skills.getByRole("searchbox").fill("不存在的技能");
    await expect(skills.getByText(/未找到匹配技能/)).toBeVisible();
    await skills.getByRole("searchbox").fill("");
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "复制 Top10 作业" }).click();
    await expect(page.getByRole("button", { name: "Top10 作业已复制" })).toBeVisible();
    const canvas = page.getByTestId("timeline-canvas");
    expect((await canvas.boundingBox())!.y).toBeLessThan(600);
    await expect(canvas).toHaveAttribute("data-timeline-label-icon-collisions", "0");
    await page.screenshot({ path: `${SCREENSHOT_ROOT}/timeline-desktop.png`, fullPage: true });
    const nextResponse = page.waitForResponse(response => response.url().includes("/api/spec_ranking/mage-fire/vorasius?") && response.ok());
    await page.locator('button[data-boss-slug="vorasius"]').click();
    await nextResponse;
    await expect(page).toHaveURL(/mage-fire\/vorasius\?difficulty=mythic&metric=dps/);
    await expect(page.locator('[data-testid="timeline-workbench"]')).toHaveAttribute("data-content-state", "ready");
    const before = requests.length;
    await page.locator('button[data-boss-slug="vorasius"]').click();
    expect(requests.length).toBe(before);
    expect(failures).toEqual([]);
});

test("刷新和返回按目标恢复技能及时间视图", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const failures = collectRuntimeFailures(page);
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=heroic&metric=dps");
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    const skills = page.getByRole("complementary", { name: "技能筛选" });
    await skills.getByRole("button", { name: /^仅看 / }).first().click();
    const selection = await skills.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).checked));
    await page.getByRole("button", { name: "放大" }).click();
    await page.getByRole("button", { name: "向右平移" }).click();
    const canvas = page.getByTestId("timeline-canvas");
    const position = await canvas.getAttribute("data-timeline-pan-x");
    const scale = await canvas.getAttribute("data-timeline-zoom");
    await page.reload();
    await expect(page.locator("[data-player-row]")).toHaveCount(10);
    await expect(canvas).toHaveAttribute("data-timeline-pan-x", position!);
    await expect(canvas).toHaveAttribute("data-timeline-zoom", scale!);
    expect(await skills.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).checked))).toEqual(selection);
    await page.locator('button[data-boss-slug="vorasius"]').click();
    await expect(page.getByTestId("timeline-workbench")).toHaveAttribute("data-content-state", "ready");
    await skills.getByRole("button", { name: "恢复默认", exact: true }).click();
    await page.goBack();
    await expect(page.getByTestId("timeline-workbench")).toHaveAttribute("data-content-state", "ready");
    await expect(canvas).toHaveAttribute("data-timeline-pan-x", position!);
    expect(await skills.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).checked))).toEqual(selection);
    expect(failures).toEqual([]);
});

for (const width of [390, 430, 800, 2048]) {
    test(`${width}px 控件无溢出，技能筛选和键盘可用`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const failures = collectRuntimeFailures(page);
        await page.goto("/log/spec_ranking/warlock-demonology/imperator-averzian?difficulty=mythic&metric=dps");
        await expect(page.locator("[data-player-row]")).toHaveCount(10);
        const skills = page.getByRole("complementary", { name: "技能筛选" });
        if (width <= 1100) {
            await expect(skills.getByRole("searchbox")).toBeHidden();
            await skills.getByRole("button", { name: /^技能筛选/ }).click();
        }
        await expect(skills.getByRole("searchbox")).toBeVisible();
        await skills.getByRole("searchbox").focus();
        await page.keyboard.type("123456789");
        await expect(skills.getByText(/未找到匹配技能/)).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(skills.getByRole("button", { name: "全选", exact: true })).toBeFocused();
        await page.keyboard.press("Enter");
        await skills.getByRole("searchbox").fill("");
        await page.getByRole("combobox", { name: "全部专精", exact: true }).focus();
        await expectVisibleFocus(page.getByRole("combobox", { name: "全部专精", exact: true }));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `${SCREENSHOT_ROOT}/timeline-${width}.png`, fullPage: true });
        expect(failures).toEqual([]);
    });
}

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
    await expect(page.getByRole("heading", { name: "阿维兹安大帝 · 火焰法师" })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(failures).toEqual([]);
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


test("目录缺失技能仍可筛选并显示在时间轴", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const failures = collectRuntimeFailures(page);
    await page.route("**/log/api/spec_ranking/mage-fire/imperator-averzian?*", async route => {
        const response = await route.fetch();
        const body = await response.json();
        body.reports[0].fights[0].players[0].casts.push({ id: 987654321, ts: 45000 });
        await route.fulfill({ response, json: body });
    });
    await page.goto("/log/spec_ranking/mage-fire/imperator-averzian?difficulty=mythic&metric=dps");
    const skills = page.getByRole("complementary", { name: "技能筛选" });
    await expect(skills.getByRole("checkbox", { name: /技能 987654321/ })).toBeVisible();
    await skills.getByRole("searchbox").fill("987654321");
    await skills.getByRole("button", { name: "仅看 技能 987654321" }).click();
    await expect(page.getByTestId("timeline-canvas")).toHaveAttribute("data-timeline-images-loaded", "true");
    await expect(page.getByTestId("timeline-canvas")).toHaveAttribute("data-timeline-label-icon-collisions", "0");
    await page.screenshot({ path: `${SCREENSHOT_ROOT}/timeline-unknown-skill.png`, fullPage: true });
    expect(failures).toEqual([]);
});
