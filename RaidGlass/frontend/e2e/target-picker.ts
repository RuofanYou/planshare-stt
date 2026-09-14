import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function selectTarget(
    page: Page,
    target: { boss?: string; specName?: string },
): Promise<void> {
    const selector = page.locator('[data-target-selector-mode="inline"]');
    await expect(selector).toBeVisible();
    if (target.boss) {
        await selector.locator(`button[data-boss-slug="${target.boss}"]`).click();
    }
    if (target.specName) await selector.getByRole("combobox", { name: "全部专精", exact: true }).selectOption({ label: target.specName });
}
