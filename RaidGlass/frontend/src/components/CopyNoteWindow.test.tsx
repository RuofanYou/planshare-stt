import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type Actor from "../types/actor";
import type Fight from "../types/fight";
import { clear_copynote } from "../store/ui";
import CopyNoteWindow from "./CopyNoteWindow";

const dispatch = vi.fn();
const player: Actor = {
    name: "测试玩家",
    spec_slug: "mage-fire",
    class_slug: "mage",
    source_id: 1,
    total: 100,
    casts: [{ id: 123, ts: 30_000 }],
    deaths: [],
    resurrects: [],
};
const boss: Actor = {
    name: "测试首领",
    boss_slug: "test-boss",
    spec_slug: "test-boss",
    class_slug: "boss",
    total: 0,
    casts: [],
    deaths: [],
    resurrects: [],
};
const fight: Fight = {
    fight_id: 1,
    report_id: "REPORT-1",
    report_url: "https://example.test/REPORT-1",
    duration: 90_000,
    difficulty: 5,
    phases: [],
    boss,
    players: [player],
};
const fakeState = {
    ui: {
        show_copynote: true,
        copynote_player: player,
        copynote_fight: fight,
    },
};

vi.mock("../store/store_hooks", () => ({
    useAppDispatch: () => dispatch,
    useAppSelector: (selector: (state: unknown) => unknown) => selector(fakeState),
}));
vi.mock("../store/bosses", () => ({
    get_boss: () => ({ id: 1, full_name: "测试首领" }),
}));
vi.mock("../store/specs", () => ({
    get_spec: () => ({ id: 63, index: 1, class: { name: "Mage" } }),
}));
vi.mock("../store/spells", () => ({
    get_spell_display: () => ({ 123: true }),
}));
vi.mock("../store/fights", () => ({
    get_difficulty_name: () => "史诗",
}));

beforeEach(() => {
    dispatch.mockClear();
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
});

describe("CopyNoteWindow", () => {
    it("使用受控原生 dialog、初始关闭焦点与明确表单名称", () => {
        render(<CopyNoteWindow />);

        const dialog = screen.getByRole("dialog", { name: "复制单人作业" });
        expect(dialog).toHaveAttribute("open");
        expect(screen.getByRole("button", { name: "关闭复制作业" })).toHaveFocus();
        expect(screen.getByRole("combobox", { name: "标签方式" })).toBeVisible();
        expect(screen.getByRole("textbox", { name: "标签内容" })).toBeVisible();
        expect(screen.getByRole("textbox", { name: "作业文本" })).toBeVisible();
        expect(document.documentElement.style.overflow).toBe("hidden");
    });

    it("关闭按钮、Escape cancel 与 backdrop 共用完整清理动作", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<CopyNoteWindow />);
        const expectedAction = clear_copynote();

        await user.click(screen.getByRole("button", { name: "关闭复制作业" }));
        expect(dispatch).toHaveBeenLastCalledWith(expectedAction);

        dispatch.mockClear();
        rerender(<CopyNoteWindow />);
        const dialog = screen.getByRole("dialog", { name: "复制单人作业" });
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
        expect(dispatch).toHaveBeenLastCalledWith(expectedAction);

        dispatch.mockClear();
        fireEvent.click(dialog);
        expect(dispatch).toHaveBeenLastCalledWith(expectedAction);
    });

    it("文本框只负责预览选择，显式复制按钮提供完成反馈", async () => {
        const user = userEvent.setup();
        render(<CopyNoteWindow />);
        const clipboard = vi.spyOn(navigator.clipboard, "writeText");

        await user.click(screen.getByRole("textbox", { name: "作业文本" }));
        expect(clipboard).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "复制文本" }));
        expect(clipboard).toHaveBeenCalledOnce();
        expect(clipboard.mock.calls[0][0]).toContain("EncounterID:1");
        expect(screen.getByRole("button", { name: "已复制" })).toBeVisible();
    });
});
