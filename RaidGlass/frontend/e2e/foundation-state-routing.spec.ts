import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectTarget } from "./target-picker";

const BOSS_NAMES: Record<string, string> = {
    "imperator-averzian": "阿维兹安大帝",
    vorasius: "沃拉修斯",
};

const SPEC_NAMES: Record<string, string> = {
    "warlock-affliction": "痛苦术士",
    "warlock-demonology": "恶魔学识术士",
};

async function expectTarget(
    page: Page,
    target: { boss: string; spec: string; difficulty: "mythic" | "heroic"; metric: string },
) {
    const address = `/log/spec_ranking/${target.spec}/${target.boss}`
        + `?difficulty=${target.difficulty}&metric=${target.metric}`;
    await expect.poll(() => {
        const current = new URL(page.url());
        return `${current.pathname}${current.search}`;
    }).toBe(address);
    await expect(page.getByRole("heading", {
        name: `${BOSS_NAMES[target.boss]} · ${SPEC_NAMES[target.spec]}`,
    })).toBeVisible();
    await expect(page.getByRole("button", {
        name: target.difficulty === "mythic" ? "史诗难度" : "英雄难度",
    })).toHaveAttribute("aria-pressed", "true");
}

test("首页使用唯一规范 URL", async ({ page }) => {
    const initial = {
        boss: "imperator-averzian",
        spec: "warlock-affliction",
        difficulty: "mythic" as const,
        metric: "dps",
    };
    const changedBoss = { ...initial, boss: "vorasius" };
    const changedSpec = { ...changedBoss, spec: "warlock-demonology" };
    const changedDifficulty = { ...changedSpec, difficulty: "heroic" as const };

    await page.goto("/log/");
    await expectTarget(page, initial);

    await selectTarget(page, { boss: changedBoss.boss });
    await expectTarget(page, changedBoss);

    await selectTarget(page, { specName: "恶魔学识术士" });
    await expectTarget(page, changedSpec);

    await page.getByRole("button", { name: "英雄难度" }).click();
    await expectTarget(page, changedDifficulty);

    await page.goBack();
    await expectTarget(page, changedSpec);
    await page.goBack();
    await expectTarget(page, changedBoss);
    await page.goBack();
    await expectTarget(page, initial);

    await page.goForward();
    await expectTarget(page, changedBoss);
    await page.goForward();
    await expectTarget(page, changedSpec);
    await page.goForward();
    await expectTarget(page, changedDifficulty);
});

test("元数据失败后可以重试", async ({ page }) => {
    let classAttempts = 0;
    await page.route("**/log/api/classes", async (route) => {
        classAttempts += 1;
        if (classAttempts === 1) {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({ error: "generated bootstrap failure" }),
            });
            return;
        }
        await route.continue();
    });

    await page.goto("/log/");

    await expect(page.getByRole("alert", { name: "目标目录载入失败" })).toBeVisible();
    await expect(page.getByRole("button", { name: "重试载入" })).toBeVisible();
    await page.getByRole("button", { name: "重试载入" }).click();

    await expectTarget(page, {
        boss: "imperator-averzian",
        spec: "warlock-affliction",
        difficulty: "mythic",
        metric: "dps",
    });
    await expect(page.getByRole("alert", { name: "目标目录载入失败" })).toHaveCount(0);
    await expect(page.getByRole("status", { name: "正在载入目标目录" })).toHaveCount(0);
    expect(classAttempts).toBe(2);
});

test("快速切换时旧响应被丢弃且复制受控", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    (window as typeof window & { __raidglassCopied?: string }).__raidglassCopied = text;
                },
            },
        });
    });

    let releaseDelayedTarget!: () => void;
    const delayedTargetGate = new Promise<void>((resolve) => {
        releaseDelayedTarget = resolve;
    });
    await page.route("**/log/api/spec_ranking/warlock-demonology/imperator-averzian?*", async (route) => {
        await delayedTargetGate;
        await route.continue();
    });

    try {
        await page.goto("/log/");
        await expect(page.getByRole("heading", { name: "阿维兹安大帝 · 痛苦术士" })).toBeVisible();
        await expect(page.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();

        const delayedTargetRequest = page.waitForRequest((request) => (
            new URL(request.url()).pathname
                === "/log/api/spec_ranking/warlock-demonology/imperator-averzian"
        ));
        await selectTarget(page, { specName: "恶魔学识术士" });
        await delayedTargetRequest;
        await expectTarget(page, {
            boss: "imperator-averzian",
            spec: "warlock-demonology",
            difficulty: "mythic",
            metric: "dps",
        });
        await expect(page.getByText(/当前继续显示 阿维兹安大帝 · 痛苦术士/)).toBeVisible();
        await expect(page.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();

        await selectTarget(page, { boss: "vorasius" });
        await expectTarget(page, {
            boss: "vorasius",
            spec: "warlock-demonology",
            difficulty: "mythic",
            metric: "dps",
        });
        await expect(page.getByRole("heading", { name: "沃拉修斯 · 恶魔学识术士" })).toBeVisible();
        await expect(page.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();

        const delayedResponse = page.waitForResponse((response) => (
            new URL(response.url()).pathname
                === "/log/api/spec_ranking/warlock-demonology/imperator-averzian"
        ));
        releaseDelayedTarget();
        await delayedResponse;

        await expect(page.getByRole("heading", { name: "沃拉修斯 · 恶魔学识术士" })).toBeVisible();
        await page.getByRole("button", { name: "复制 Top10 作业" }).click();
        await expect.poll(() => page.evaluate(() => (
            (window as typeof window & { __raidglassCopied?: string }).__raidglassCopied || ""
        ))).toContain("首领：沃拉修斯");
        const copied = await page.evaluate(() => (
            (window as typeof window & { __raidglassCopied?: string }).__raidglassCopied || ""
        ));
        expect(copied).toContain("专精：恶魔学识术士");
        expect(copied).toContain("难度：史诗");
        expect(copied).not.toContain("首领：阿维兹安大帝");
    } finally {
        releaseDelayedTarget();
    }
});

for (const path of [
    "/user_report",
    "/user_report/load",
    "/user_report/REPORT-1",
]) {
    test(`报告不可用与未知路由：${path} 显示统一不可用页`, async ({ page }) => {
        await page.goto(`/log${path}`);

        await expect(page.getByRole("region", { name: "报告导入暂不可用" })).toBeVisible();
        await expect(page.getByText("报告导入功能当前未开放，请返回 Top10 时间轴继续查看公开作业。")).toBeVisible();
        await expect(page.getByRole("link", { name: "返回 Top10 时间轴" }))
            .toHaveAttribute("href", "/log");
    });
}

test("报告不可用与未知路由：未知地址显示地址与两个恢复入口", async ({ page }) => {
    await page.goto("/log/unknown/address");

    await expect(page.getByRole("region", { name: "没有找到这个页面" })).toBeVisible();
    await expect(page.getByText("/unknown/address")).toBeVisible();
    await expect(page.getByRole("link", { name: "返回 Top10 时间轴" })).toHaveAttribute("href", "/log");
    await expect(page.getByRole("link", { name: "前往阵容参考" }))
        .toHaveAttribute("href", "/log/comp_ranking/search");
});
