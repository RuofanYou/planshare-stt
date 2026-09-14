import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../../diagnostics";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import TargetPicker from "./TargetPicker";
import type { TimelineTarget } from "./types";


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

afterEach(() => { setDiagnosticSinkForTests(null); });

describe("TargetPicker", () => {
    it("首领常驻、点击立即切换并保留专精难度", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "鲁拉" }));
        const next = { ...value, bossSlug: "lura", bossName: "鲁拉" };
        expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
        rerender(<TargetPicker bosses={bosses} specs={specs} value={next} onChange={onChange} />);
        await user.click(screen.getByRole("button", { name: "鲁拉" }));
        expect(onChange).toHaveBeenCalledOnce();
        await user.click(screen.getByRole("button", { name: "英雄难度" }));
        expect(onChange).toHaveBeenLastCalledWith({ ...next, difficulty: "heroic" });
    });
    it("治疗一级入口支持键盘，全部专精菜单可选其他职责", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TargetPicker bosses={bosses} specs={specs} value={value} onChange={onChange} />);
        screen.getByRole("button", { name: "神圣牧师" }).focus();
        await user.keyboard("{Enter}");
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ specSlug: "priest-holy", metric: "hps" }));
        await user.selectOptions(screen.getByRole("combobox", { name: "全部专精" }), "deathknight-frost");
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ specSlug: "deathknight-frost", metric: "dps" }));
    });
});
