import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    MemoryRouter,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useNavigationType,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Index from "./Index";

const mockState = vi.hoisted(() => ({
    zones: {
        zones: {
            1: {
                id: 1,
                bosses: ["imperator-averzian", "lura"],
            },
        },
        bosses: {
            "imperator-averzian": {
                full_name_slug: "imperator-averzian",
                full_name: "Imperator Averzian",
                icon_path: "/imperator.jpg",
            },
            lura: {
                full_name_slug: "lura",
                full_name: "L'ura",
                icon_path: "/lura.jpg",
            },
        },
    },
    specs: {
        specs_by_name: {
            "deathknight-blood": {
                full_name_slug: "deathknight-blood",
                full_name: "Blood Death Knight",
                role: "tank",
                class: { name: "Death Knight", name_slug: "deathknight" },
                icon_path: "/deathknight-blood.jpg",
            },
        },
    },
}));

vi.mock("../../store/store_hooks", () => ({
    useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock("../../features/timeline-workbench/TimelineWorkbench", () => ({
    default: ({
        target,
        targetPicker,
    }: {
        target: { bossSlug: string; specSlug: string };
        targetPicker: ReactNode;
    }) => (
        <div data-testid="timeline-workbench">
            {targetPicker}
            {target.bossSlug}/{target.specSlug}
        </div>
    ),
}));

beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
    })));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function RouterProbe() {
    const location = useLocation();
    const navigate = useNavigate();
    const navigationType = useNavigationType();

    return (
        <aside>
            <output aria-label="当前测试地址">{location.pathname}{location.search}</output>
            <output aria-label="当前导航类型">{navigationType}</output>
            <button type="button" onClick={() => navigate(-1)}>后退</button>
        </aside>
    );
}

function renderIndex(initialEntry: string) {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <RouterProbe />
            <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/spec_ranking/:spec_slug/:boss_slug" element={<Index />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("Index 的规范 URL 状态", () => {
    it("目标草稿确认后只 push 一条记录，后退从 URL 恢复触发器", async () => {
        const user = userEvent.setup();
        const initialAddress = "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps";
        renderIndex(initialAddress);

        await user.click(screen.getByRole("button", {
            name: "更换目标：阿维兹安大帝 · 鲜血死亡骑士",
        }));
        await user.selectOptions(screen.getByRole("combobox", { name: "首领" }), "lura");
        expect(screen.getByLabelText("当前测试地址")).toHaveTextContent(initialAddress);
        await user.click(screen.getByRole("button", { name: "查看该时间轴" }));

        expect(screen.getByLabelText("当前测试地址")).toHaveTextContent(
            "/spec_ranking/deathknight-blood/lura?difficulty=mythic&metric=dps",
        );
        expect(screen.getByLabelText("当前导航类型")).toHaveTextContent("PUSH");
        expect(screen.getByRole("button", { name: "更换目标：鲁拉 · 鲜血死亡骑士" }))
            .toHaveAttribute("aria-expanded", "false");

        await user.click(screen.getByRole("button", { name: "后退" }));

        await waitFor(() => {
            expect(screen.getByLabelText("当前测试地址")).toHaveTextContent(initialAddress);
        });
        expect(screen.getByRole("button", {
            name: "更换目标：阿维兹安大帝 · 鲜血死亡骑士",
        })).toHaveAttribute("aria-expanded", "false");
    }, 10_000);

    it("目录就绪后用 replace 把根路由规范化", async () => {
        renderIndex("/");

        await waitFor(() => {
            expect(screen.getByLabelText("当前测试地址")).toHaveTextContent(
                "/spec_ranking/deathknight-blood/imperator-averzian?difficulty=mythic&metric=dps",
            );
        });
        expect(screen.getByLabelText("当前导航类型")).toHaveTextContent("REPLACE");
    });
});
