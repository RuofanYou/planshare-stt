import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { catalogsAccepted } from "../store/catalogCommit";
import { appReducer } from "../store/store";
import CompSearch from "./CompSearch";

function makeStore() {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(catalogsAccepted({
        classes: {},
        roles: [{
            id: 1,
            code: "tank",
            name: "Tank",
            specs: ["paladin-protection"],
            spec_ids: [66],
            metrics: ["dps"],
        }],
        specs: [{
            id: 66,
            index: 1,
            class: { name: "Paladin", name_slug: "paladin" },
            role: "tank",
            name: "Protection",
            full_name: "Protection Paladin",
            full_name_slug: "paladin-protection",
        }],
        seasons: { name: "Season", slug: "season", raids: [1] },
        bosses: [{
            id: 1,
            name: "测试副本",
            name_slug: "test-raid",
            bosses: [{
                id: 10,
                name: "Imperator Averzian",
                full_name: "Imperator Averzian",
                full_name_slug: "imperator-averzian",
                icon: "boss.jpg",
                phase_type: "static",
            }],
        }],
    }));
    return store;
}

function LocationProbe() {
    const location = useLocation();
    return <output aria-label="当前地址">{location.pathname}{location.search}</output>;
}

function renderSearch() {
    render(
        <Provider store={makeStore()}>
            <MemoryRouter initialEntries={["/comp_ranking/search"]}>
                <Routes>
                    <Route path="/comp_ranking/search" element={<CompSearch />} />
                    <Route path="/comp_ranking/:bossSlug" element={<p>阵容结果</p>} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>
        </Provider>,
    );
}

describe("CompSearch", () => {
    it("首屏只要求选择首领，选择后再披露职责与确认步骤", async () => {
        const user = userEvent.setup();
        renderSearch();

        const form = screen.getByRole("form", { name: "阵容搜索" });
        expect(within(form).getAllByTestId("comp-search-step")).toHaveLength(1);
        expect(screen.getByRole("group", { name: "选择首领" })).toBeVisible();
        expect(screen.queryByRole("group", { name: "职责人数" })).not.toBeInTheDocument();
        expect(screen.queryByText("更多筛选")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "查看阵容参考" })).not.toBeInTheDocument();

        const bossButton = screen.getByRole("button", { name: "阿维兹安大帝" });
        expect(bossButton).toHaveAttribute("aria-pressed", "false");
        await user.click(bossButton);

        expect(bossButton).toHaveAttribute("aria-pressed", "true");
        expect(within(form).getAllByTestId("comp-search-step")).toHaveLength(3);
        expect(screen.getByRole("group", { name: "职责人数" })).toBeVisible();
        expect(screen.getByText("更多筛选")).toBeVisible();
        expect(screen.getByRole("button", { name: "查看阵容参考" })).toBeEnabled();
    });

    it("保留零人数排除条件并使用目录中的 jpg 图标", async () => {
        const user = userEvent.setup();
        renderSearch();

        await user.click(screen.getByRole("button", { name: "阿维兹安大帝" }));
        await user.type(screen.getByRole("spinbutton", { name: "坦克人数" }), "0");

        const preview = screen.getByRole("img", { name: "坦克 0人" });
        expect(preview.querySelector("img")?.getAttribute("src")).toMatch(/\/roles\/tank\.jpg$/);

        await user.click(screen.getByRole("button", { name: "查看阵容参考" }));
        await waitFor(() => {
            expect(screen.getByRole("status", { name: "当前地址" })).toHaveTextContent(
                "/comp_ranking/imperator-averzian?role=tank.eq.0",
            );
        });
    });

    it("高级条件按需展开，反向击杀时长原位报错且不跳转", async () => {
        const user = userEvent.setup();
        renderSearch();

        await user.click(screen.getByRole("button", { name: "阿维兹安大帝" }));
        await user.click(screen.getByText("更多筛选"));
        expect(screen.getByRole("group", { name: "击杀时间" })).toBeVisible();
        expect(screen.getByRole("group", { name: "专精人数" })).toBeVisible();

        await user.type(screen.getByRole("textbox", { name: "最短时长" }), "10:00");
        await user.type(screen.getByRole("textbox", { name: "最长时长" }), "5:00");
        await user.click(screen.getByRole("button", { name: "查看阵容参考" }));

        expect(screen.getByRole("alert")).toHaveTextContent("最短击杀时间不能大于最长击杀时间");
        expect(screen.getByRole("status", { name: "当前地址" })).toHaveTextContent(
            "/comp_ranking/search",
        );
    });
});
