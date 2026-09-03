import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultFilters } from "../../../store/ui";
import SpellSettings from "./SpellSettings";

const top10Filters = {
    ...createDefaultFilters(),
    class: { mage: false },
};

vi.mock("../../../store/store_hooks", () => ({
    useAppSelector: (selector: (state: unknown) => unknown) => selector({
        ui: { filters: top10Filters },
    }),
}));

vi.mock("../../../store/classes", () => ({
    get_class_names: () => ["mage"],
    get_class: (_state: unknown, slug: string) => (
        slug === "mage"
            ? { name_slug: "mage", specs: [] }
            : null
    ),
}));

vi.mock("../../../store/specs", () => ({ get_spec: () => null }));
vi.mock("../../../store/bosses", () => ({ get_boss: () => null }));
vi.mock("../../../store/fights", () => ({ get_occuring_bosses: () => [] }));
vi.mock("../../../store/spells", () => ({ get_types_have_used_spells: () => true }));
vi.mock("../SpellPresets/SpellPresetSettings", () => ({ SpellPresetSettings: () => null }));
vi.mock("./CollapsableSpellGroup", () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./SpellTypeGroup", () => ({
    SpellTypeGroup: ({ spell_type }: { spell_type: string }) => (
        <div data-testid="spell-type">{spell_type}</div>
    ),
}));

describe("SpellSettings filters", () => {
    it("阵容局部 filters 不受 Top10 职业筛选污染", () => {
        const compFilters = createDefaultFilters();

        render(<SpellSettings filters={compFilters} />);

        expect(screen.getByTestId("spell-type")).toHaveTextContent("mage");
        expect(top10Filters.class).toEqual({ mage: false });
    });
});
