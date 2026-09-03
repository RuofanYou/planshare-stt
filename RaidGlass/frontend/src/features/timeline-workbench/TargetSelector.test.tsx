import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import TargetSelector from "./TargetSelector";
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

describe("TargetSelector", () => {
    it("首领和专精分别提交完整目标", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TargetSelector bosses={bosses} specs={specs} value={value} onChange={onChange} />);

        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
            bossSlug: "lura",
            bossName: "鲁拉",
        }));

        await user.click(screen.getByRole("button", { name: "冰霜死亡骑士" }));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
            specSlug: "deathknight-frost",
            specName: "冰霜死亡骑士",
            metric: "dps",
        }));

    });

    it("切换职业时只提交一次，并只显示该职业的专精", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(
            <TargetSelector bosses={bosses} specs={specs} value={value} onChange={onChange} />,
        );

        await user.selectOptions(screen.getByRole("combobox", { name: "职业" }), "priest");
        expect(onChange).toHaveBeenCalledTimes(1);

        const nextTarget = onChange.mock.calls[0][0] as TimelineTarget;
        expect(nextTarget).toEqual(expect.objectContaining({
            specSlug: "priest-holy",
            specName: "神圣牧师",
            metric: "hps",
        }));

        rerender(<TargetSelector bosses={bosses} specs={specs} value={nextTarget} onChange={onChange} />);
        expect(screen.getByRole("button", { name: "神圣牧师" })).toBeVisible();
        expect(screen.queryByRole("button", { name: "鲜血死亡骑士" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "冰霜死亡骑士" })).not.toBeInTheDocument();
    });

    it("使用当前数据里的真实首领、职业与专精图标", () => {
        const { container } = render(
            <TargetSelector bosses={bosses} specs={specs} value={value} onChange={vi.fn()} />,
        );

        expect(container.querySelector('[data-target-icon="boss"]')).toHaveAttribute(
            "src",
            "/log/assets/images/spells/imperator.jpg",
        );
        expect(container.querySelector('[data-target-icon="class"]')).toHaveAttribute(
            "src",
            "/log/assets/images/classes/deathknight.webp",
        );
        expect(container.querySelector('[data-target-icon="spec"]')).toHaveAttribute(
            "src",
            "/log/assets/images/specs/deathknight-blood.jpg",
        );
    });

    it("草稿选择器不承载难度，仍保留首领与专精选择能力", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TargetSelector
                bosses={bosses}
                specs={specs}
                value={value}
                onChange={onChange}
            />,
        );

        expect(screen.queryByRole("button", { name: "史诗难度" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "英雄难度" })).not.toBeInTheDocument();

        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            bossSlug: "lura",
            bossName: "鲁拉",
        }));
    });
});
