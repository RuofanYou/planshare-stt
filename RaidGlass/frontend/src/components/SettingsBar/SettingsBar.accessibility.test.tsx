import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DisplaySettings from "./DisplaySettings";
import FilterDateRangeGroup from "./FilterSettings/FilterDateRange";
import RegionFilterGroup from "./FilterSettings/RegionFilter";
import { SpellPresetSettings } from "./SpellPresets/SpellPresetSettings";
import ButtonGroup from "./shared/ButtonGroup";

const dispatch = vi.fn();
const settings = {
    show_casticon: true,
    show_casttime: true,
    show_duration: false,
    show_cooldown: true,
    show_deaths: true,
    show_phases: true,
};
const selectorState = {
    ui: {
        settings,
        filters: {
            region: { US: false },
        },
    },
    spells: {
        all_spells: {
            1: { spell_id: 1, tags: ["defensive"] },
        },
        spell_display: { 1: false },
    },
};

vi.mock("react-redux", () => ({ useDispatch: () => dispatch }));
vi.mock("../../store/store_hooks", () => ({
    useAppDispatch: () => dispatch,
    useAppSelector: (selector: (state: unknown) => unknown) => selector(selectorState),
}));
vi.mock("../../store/ui", () => ({
    update_settings: (payload: unknown) => ({ type: "ui/update_settings", payload }),
    set_region_filter: (payload: unknown) => ({ type: "ui/set_region_filter", payload }),
    set_filters: (payload: unknown) => ({ type: "ui/set_filters", payload }),
}));
vi.mock("../../store/spells", () => ({
    set_spell_tag_visible: (payload: unknown) => ({ type: "spells/set_tag", payload }),
    set_spell_visible: (payload: unknown) => ({ type: "spells/set_visible", payload }),
}));
vi.mock("./MetricSelect", () => ({ default: () => null }));

describe("SettingsBar 可访问交互", () => {
    beforeEach(() => dispatch.mockClear());

    it("设置分组标题是有状态的原生按钮", () => {
        render(<ButtonGroup name="时间轴"><span>内容</span></ButtonGroup>);
        const button = screen.getByRole("button", { name: "时间轴" });
        expect(button).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("显示设置提供中文名称和按下状态", () => {
        render(<DisplaySettings showMetric={false} />);
        expect(screen.getByRole("button", { name: "技能图标" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "持续时间" })).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(screen.getByRole("button", { name: "释放时间" }));
        expect(dispatch).toHaveBeenCalled();
    });

    it("地区和技能预设都能通过中文按钮切换", () => {
        const { unmount } = render(<RegionFilterGroup />);
        const usButton = screen.getByRole("button", { name: "美服（US）" });
        expect(usButton).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(usButton);
        expect(dispatch).toHaveBeenCalledWith({
            type: "ui/set_region_filter",
            payload: { region: "US", value: true },
        });
        unmount();
        dispatch.mockClear();

        render(<SpellPresetSettings />);
        expect(screen.getByRole("button", { name: "全部技能" })).toHaveAttribute("aria-pressed", "false");
        const defensiveButton = screen.getByRole("button", { name: "防御技能" });
        expect(defensiveButton).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(defensiveButton);
        expect(dispatch).toHaveBeenCalledWith({
            type: "spells/set_tag",
            payload: { tag: "defensive", visible: true },
        });
    });

    it("仅打开设置不改写地区或技能筛选", () => {
        const { unmount } = render(<RegionFilterGroup />);
        expect(dispatch).not.toHaveBeenCalled();
        unmount();

        render(<SpellPresetSettings />);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it("空日期控件显示中文格式并保留原生日期输入", () => {
        render(<FilterDateRangeGroup />);

        expect(screen.getAllByText("年/月/日")).toHaveLength(2);
        expect(screen.getByLabelText("开始日期")).toHaveAttribute("type", "date");
        expect(screen.getByLabelText("结束日期")).toHaveAttribute("type", "date");
    });
});
