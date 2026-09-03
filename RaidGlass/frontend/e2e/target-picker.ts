import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export async function openTargetPicker(page: Page): Promise<Locator> {
    const trigger = page.getByRole("button", { name: /^更换目标：/ });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "选择首领与专精" });
    await expect(dialog).toBeVisible();
    return dialog;
}

export async function commitTargetDraft(
    page: Page,
    draft: { boss?: string; className?: string; specName?: string },
): Promise<void> {
    const dialog = await openTargetPicker(page);
    if (draft.boss) {
        await dialog.getByRole("combobox", { name: "首领", exact: true }).selectOption(draft.boss);
    }
    if (draft.className) {
        await dialog.getByRole("combobox", { name: "职业", exact: true }).selectOption(draft.className);
    }
    if (draft.specName) {
        await dialog.getByRole("button", { name: draft.specName, exact: true }).click();
    }
    await dialog.getByRole("button", { name: "查看该时间轴" }).click();
    await expect(dialog).toBeHidden();
}
