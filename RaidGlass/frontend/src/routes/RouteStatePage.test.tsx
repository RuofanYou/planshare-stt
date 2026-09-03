import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import RouteStatePage from "./RouteStatePage";

describe("RouteStatePage", () => {
    it("报告不可用页说明状态并返回 Top10 时间轴", () => {
        render(
            <MemoryRouter initialEntries={["/user_report/REPORT-1"]}>
                <RouteStatePage kind="report-unavailable" />
            </MemoryRouter>,
        );

        expect(screen.getByRole("region", { name: "报告导入暂不可用" })).toBeVisible();
        expect(screen.getByText("报告导入功能当前未开放，请返回 Top10 时间轴继续查看公开作业。")).toBeVisible();
        expect(screen.getByRole("link", { name: "返回 Top10 时间轴" })).toHaveAttribute("href", "/");
    });

    it("中文 404 显示当前地址与两个恢复入口", () => {
        render(
            <MemoryRouter initialEntries={["/missing/path?from=shared-link"]}>
                <RouteStatePage kind="not-found" />
            </MemoryRouter>,
        );

        expect(screen.getByRole("region", { name: "没有找到这个页面" })).toBeVisible();
        expect(screen.getByText("/missing/path?from=shared-link")).toBeVisible();
        expect(screen.getByRole("link", { name: "返回 Top10 时间轴" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "前往阵容参考" }))
            .toHaveAttribute("href", "/comp_ranking/search");
    });
});
