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
    it("Boss 直接切换并保留专精难度", async () => {
        const onChange = vi.fn();
        render(<TargetSelector bosses={bosses} specs={specs} value={value} onChange={onChange} />);
        await userEvent.click(screen.getByRole("button", { name: "鲁拉" }));
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...value, bossSlug: "lura", bossName: "鲁拉" });
    });
    it("治疗在一级入口，其他专精通过分组菜单选择", async () => {
        const onChange = vi.fn();
        render(<TargetSelector bosses={bosses} specs={specs} value={value} onChange={onChange} />);
        expect(screen.getByRole("button", { name: "神圣牧师" })).toBeVisible();
        expect(screen.queryByRole("button", { name: "冰霜死亡骑士" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "神圣牧师" }));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ specSlug: "priest-holy", metric: "hps" }));
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "全部专精" }), "deathknight-frost");
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ specSlug: "deathknight-frost", metric: "dps" }));
    });
});
