import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type Actor from "../types/actor";
import type Fight from "../types/fight";
import { clear_copynote } from "../store/ui";
import CopyNoteWindow, { get_note_mrt } from "./CopyNoteWindow";

const dispatch = vi.fn();
const player: Actor = {
    name: "测试玩家",
    spec_slug: "mage-fire",
    class_slug: "mage",
    source_id: 1,
    total: 100,
    casts: [{ id: 123, ts: 30_000 }, { id: 456, ts: 40_000 }, { id: 123, ts: 65_000 }],
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
    phases: [{ id: 2, name: "P2", ts: 60_000 }],
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
vi.mock("../store/spells", () => ({
    get_spell_display: () => ({ 123: true, 456: false }),
}));

beforeEach(() => {
    dispatch.mockClear();
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
});

describe("CopyNoteWindow", () => {
    it.each([
        ["nekzali-the-soulcoiler", [1.5, 1.75, 2], ["i1", "i2", "p2"]],
        ["entombed-sentinels", [2, 3, 4], ["p2", "p3", "p4"]],
        ["the-coiled-altar", [2, 2.5, 3], ["p2", "i2", "p3"]],
        ["ulatek", [2, 2.5, 3], ["p2", "i2", "p3"]],
    ])("%s 使用 STT 阶段名", (bossSlug, phaseIds, phaseKeys) => {
        const phases = phaseIds.map((phase_id, index) => ({
            id: index + 2,
            phase_id,
            name: `P${index + 2}`,
            ts: (index + 1) * 60_000,
        }));
        const casts = phaseKeys.map((_, index) => ({ id: 123, ts: (index + 1) * 60_000 + 5_000 }));
        const phaseFight = {
            ...fight,
            boss: { ...boss, boss_slug: bossSlug },
            phases,
            players: [{ ...player, casts }],
        };

        expect(get_note_mrt(phaseFight.players[0], phaseFight, { 123: true })).toBe(
            phaseKeys.map(phaseKey => `{time:00:05.0,${phaseKey}} - {spell:123}`).join("\n"),
        );
    });

    it.each([
        ["nekzali-the-soulcoiler", [2, 3]],
        ["the-lost-explorers", [2, 3, 4]],
    ])("%s 的不可靠阶段保留绝对时间", (bossSlug, phaseIds) => {
        const phaseFight = {
            ...fight,
            boss: { ...boss, boss_slug: bossSlug },
            phases: phaseIds.map((phase_id, index) => ({
                id: index + 2,
                phase_id,
                name: `P${index + 2}`,
                ts: (index + 1) * 60_000,
            })),
            players: [{ ...player, casts: [{ id: 123, ts: 65_000 }] }],
        };

        expect(get_note_mrt(phaseFight.players[0], phaseFight, { 123: true })).toBe("{time:01:05.0} - {spell:123}");
    });

    it("使用受控原生 dialog、初始关闭焦点与明确表单名称", () => {
        render(<CopyNoteWindow />);

        const dialog = screen.getByRole("dialog", { name: "复制单人作业" });
        expect(dialog).toHaveAttribute("open");
        expect(screen.getByRole("button", { name: "关闭复制作业" })).toHaveFocus();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.getAllByRole("textbox")).toHaveLength(1);
        expect(screen.queryByRole("button", { name: "结构化" })).not.toBeInTheDocument();
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

        await user.click(screen.getByRole("button", { name: "复制 STT 格式" }));
        expect(clipboard).toHaveBeenCalledOnce();
        expect(clipboard.mock.calls[0][0]).toBe("{time:00:30.0} - {spell:123}\n{time:00:05.0,p2} - {spell:123}");
        expect(screen.getByRole("button", { name: "已复制" })).toBeVisible();
    });
});
