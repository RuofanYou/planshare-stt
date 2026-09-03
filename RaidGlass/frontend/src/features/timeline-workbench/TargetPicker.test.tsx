import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../../diagnostics";
import type { DiagnosticDetails, DiagnosticEvent } from "../../diagnostics";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import TargetPicker from "./TargetPicker";
import type { TimelineTarget } from "./types";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const bosses = [
    {
        full_name_slug: "imperator-averzian",
        full_name: "Imperator Averzian",
        icon_path: "/log/assets/images/spells/imperator.jpg",
    },
    {
        full_name_slug: "lura",
        full_name: "L'ura",
        icon_path: "/log/assets/images/spells/lura.jpg",
    },
] as Boss[];

const specs = [
    {
        full_name_slug: "deathknight-blood",
        full_name: "Blood Death Knight",
        role: "tank",
        class: { name: "Death Knight", name_slug: "deathknight" },
        icon_path: "/log/assets/images/specs/deathknight-blood.jpg",
    },
    {
        full_name_slug: "deathknight-frost",
        full_name: "Frost Death Knight",
        role: "mdps",
        class: { name: "Death Knight", name_slug: "deathknight" },
        icon_path: "/log/assets/images/specs/deathknight-frost.jpg",
    },
    {
        full_name_slug: "priest-holy",
        full_name: "Holy Priest",
        role: "heal",
        class: { name: "Priest", name_slug: "priest" },
        icon_path: "/log/assets/images/specs/priest-holy.jpg",
    },
] as Spec[];

const value: TimelineTarget = {
    bossSlug: "imperator-averzian",
    bossName: "阿维兹安大帝",
    specSlug: "deathknight-blood",
    specName: "鲜血死亡骑士",
    difficulty: "mythic",
    metric: "dps",
};

function mediaQuery(query: string, reducedMotion = true): MediaQueryList {
    return {
        matches: reducedMotion && query === REDUCED_MOTION_QUERY,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
    } as MediaQueryList;
}

function targetTrigger(name = `${value.bossName} · ${value.specName}`) {
    return screen.getByRole("button", { name: new RegExp(name) });
}

function controlledDialog(trigger: HTMLElement) {
    const controls = trigger.getAttribute("aria-controls");
    if (!controls) throw new Error("目标按钮缺少 aria-controls");
    const dialog = document.getElementById(controls);
    if (!(dialog instanceof HTMLDialogElement)) throw new Error("aria-controls 未指向目标选择面板");
    return dialog;
}

beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => mediaQuery(query)));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperties(window, {
        innerWidth: { configurable: true, value: 1200 },
        innerHeight: { configurable: true, value: 800 },
    });
});

afterEach(() => {
    setDiagnosticSinkForTests(null);
    vi.unstubAllGlobals();
});

describe("TargetPicker", () => {
    it("只显示一个当前目标名，并由按钮完整关联自适应面板", () => {
        const { container } = render(
            <TargetPicker bosses={bosses} specs={specs} value={value} onChange={vi.fn()} />,
        );

        const targetName = `${value.bossName} · ${value.specName}`;
        const visibleNames = screen.getAllByText(targetName).filter(
            (element) => !element.closest("dialog:not([open])"),
        );
        expect(visibleNames).toHaveLength(1);

        const trigger = targetTrigger();
        const dialog = controlledDialog(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(trigger).toHaveAttribute("aria-controls", dialog.id);
        expect(container.querySelector('[data-target-picker-icon="boss"]')).toHaveAttribute(
            "src",
            "/log/assets/images/spells/imperator.jpg",
        );
        expect(container.querySelector('[data-target-picker-icon="spec"]')).toHaveAttribute(
            "src",
            "/log/assets/images/specs/deathknight-blood.jpg",
        );
    });

    it("每次打开同步草稿，确认前静默，确认后只提交一次并关闭", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);

        const trigger = targetTrigger();
        await user.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("combobox", { name: "首领" })).toHaveValue(value.bossSlug);
        expect(screen.getByRole("combobox", { name: "职业" })).toHaveValue("deathknight");

        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        await user.selectOptions(screen.getByRole("combobox", { name: "职业" }), "priest");
        expect(onChange).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "查看该时间轴" }));
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith({
            bossSlug: "lura",
            bossName: "鲁拉",
            specSlug: "priest-holy",
            specName: "神圣牧师",
            difficulty: "mythic",
            metric: "hps",
        });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(diagnostics.map(({ event }) => event)).toEqual([
            "target_picker_opened",
            "target_selection_submitted",
            "target_picker_closed",
        ]);
        expect(diagnostics[1]?.details).toMatchObject({
            surface: "popover",
        });
        expect(diagnostics[2]?.details).toMatchObject({
            reason: "action",
            surface: "popover",
        });
    });

    it("背景与 Escape 关闭都丢弃草稿，重新打开恢复外部值", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);

        const trigger = targetTrigger();
        const dialog = controlledDialog(trigger);
        await user.click(trigger);
        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        fireEvent.click(dialog);
        expect(trigger).toHaveAttribute("aria-expanded", "false");

        await user.click(trigger);
        expect(screen.getByRole("combobox", { name: "首领" })).toHaveValue(value.bossSlug);
        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
        expect(trigger).toHaveAttribute("aria-expanded", "false");

        await user.click(trigger);
        expect(screen.getByRole("combobox", { name: "首领" })).toHaveValue(value.bossSlug);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("面板打开期间接收新外部目标，草稿立即服从最新 URL 状态", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const rendered = render(
            <TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />,
        );
        const trigger = targetTrigger();

        await user.click(trigger);
        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");

        const nextValue: TimelineTarget = {
            bossSlug: "lura",
            bossName: "鲁拉",
            specSlug: "priest-holy",
            specName: "神圣牧师",
            difficulty: "heroic",
            metric: "hps",
        };
        rendered.rerender(
            <TargetPicker bosses={bosses} specs={specs} value={nextValue} onChange={onChange} />,
        );

        expect(screen.getByRole("combobox", { name: "首领" })).toHaveValue("lura");
        expect(screen.getByRole("combobox", { name: "职业" })).toHaveValue("priest");
        await user.click(screen.getByRole("button", { name: "查看该时间轴" }));
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith(nextValue);
    });

    it("正常动效关闭期间锁定事务，重复 submit 只提交一次", async () => {
        vi.stubGlobal("matchMedia", vi.fn((query: string) => mediaQuery(query, false)));
        vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);

        const trigger = targetTrigger();
        await user.click(trigger);
        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        const submit = screen.getByRole("button", { name: "查看该时间轴" });
        const form = submit.closest("form");
        if (!form) throw new Error("确认按钮缺少目标表单");

        fireEvent.submit(form);
        fireEvent.submit(form);

        expect(onChange).toHaveBeenCalledOnce();
        expect(submit).toBeDisabled();
        expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it("难度常驻面板外并立即提交，面板内不再生成第二组难度", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);

        await user.click(screen.getByRole("button", { name: "英雄难度" }));
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith({ ...value, difficulty: "heroic" });
        expect(diagnostics[0]).toMatchObject({
            event: "target_difficulty_changed",
            details: { from: "mythic", to: "heroic" },
        });

        const trigger = targetTrigger();
        await user.click(trigger);
        const dialog = controlledDialog(trigger);
        expect(within(dialog).queryByRole("button", { name: "史诗难度" })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole("button", { name: "英雄难度" })).not.toBeInTheDocument();
    });

    it("长专精名保留完整文本与可访问名称", () => {
        const longName = "恶魔学识术士极长专精名称用于验证窄屏布局";
        const longSpec = {
            ...specs[0],
            full_name_slug: "warlock-long-specialization",
            full_name: longName,
            class: { name: "Warlock", name_slug: "warlock" },
        } as Spec;
        const longValue: TimelineTarget = {
            ...value,
            specSlug: longSpec.full_name_slug,
            specName: longName,
        };

        render(
            <TargetPicker
                bosses={bosses}
                specs={[longSpec]}
                value={longValue}
                onChange={vi.fn()}
            />,
        );

        const fullLabel = `${longValue.bossName} · ${longName}`;
        expect(screen.getByText(fullLabel)).toHaveTextContent(longName);
        expect(targetTrigger(fullLabel)).toHaveAccessibleName(`更换目标：${fullLabel}`);
    });
});
