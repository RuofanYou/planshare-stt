import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../../diagnostics";
import type { DiagnosticDetails, DiagnosticEvent } from "../../diagnostics";
import ProductShell from "./ProductShell";

const shellStyles = readFileSync(resolve(
    process.cwd(),
    "src/components/ProductShell/ProductShell.module.scss",
), "utf8");

function selectorBody(source: string, selector: string) {
    const selectorStart = source.indexOf(selector);
    expect(selectorStart, `缺少选择器 ${selector}`).toBeGreaterThanOrEqual(0);

    const bodyStart = source.indexOf("{", selectorStart);
    expect(bodyStart, `缺少选择器正文 ${selector}`).toBeGreaterThanOrEqual(0);

    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") depth -= 1;
        if (depth === 0) return source.slice(bodyStart + 1, index);
    }

    throw new Error(`选择器 ${selector} 没有闭合`);
}

function renderShell(pathname: string) {
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <ProductShell>页面内容</ProductShell>
        </MemoryRouter>,
    );
}

describe("ProductShell", () => {
    beforeEach(() => {
        vi.stubGlobal("RAIDGLASS_BUILD_ID", "test-build");
        vi.stubGlobal("RAIDGLASS_RELEASE_ID", "test-release");
        vi.stubGlobal("RAIDGLASS_SOURCE_TREE_HASH", "test-source-tree");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        setDiagnosticSinkForTests(null);
    });

    it.each([1440, 390])("%ipx 视口只渲染一份响应式主导航", (viewportWidth) => {
        Object.defineProperty(window, "innerWidth", {
            configurable: true,
            value: viewportWidth,
        });

        renderShell("/");

        const navigations = screen.getAllByRole("navigation", { name: "主导航" });
        expect(navigations).toHaveLength(1);

        const navigation = navigations[0];
        const links = within(navigation).getAllByRole("link");

        expect(links.map((link) => link.textContent)).toEqual(["Top10 时间轴", "阵容参考"]);
        expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/comp_ranking/search"]);
        expect(navigation.querySelector('a[href^="/user_report"]')).toBeNull();
        expect(navigation.querySelector('a[href^="https://www.warcraftlogs.com"]')).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("search")).not.toBeInTheDocument();
    });

    it.each([
        ["/", "Top10 时间轴"],
        ["/spec_ranking/warlock-affliction/imperator-averzian", "Top10 时间轴"],
        ["/comp_ranking/search", "阵容参考"],
    ])("路径 %s 只标记当前入口 %s", (pathname, currentName) => {
        renderShell(pathname);

        const navigation = screen.getByRole("navigation", { name: "主导航" });
        const currentLinks = within(navigation).getAllByRole("link")
            .filter((link) => link.getAttribute("aria-current") === "page");

        expect(currentLinks).toHaveLength(1);
        expect(currentLinks[0]).toHaveAccessibleName(currentName);
    });

    it("桌面产品栏使用悬浮材质并保持紧凑触控尺寸", () => {
        const topbar = selectorBody(shellStyles, ".topbar");
        const brandMark = selectorBody(shellStyles, ".brandMark");
        const navLink = selectorBody(shellStyles, ".navLink");

        expect(topbar).toMatch(/height:\s*64px/);
        expect(topbar).toMatch(/align-items:\s*center/);
        expect(topbar).toMatch(/position:\s*sticky/);
        expect(topbar).toMatch(/backdrop-filter:\s*blur\(24px\)/);
        expect(brandMark).toMatch(/width:\s*40px/);
        expect(brandMark).toMatch(/height:\s*40px/);
        expect(navLink).toMatch(/height:\s*var\(--rg-control-min-touch\)/);
    });

    it("当前入口使用连续分段表面和滑入指示", () => {
        const currentLink = selectorBody(shellStyles, '.navLink[aria-current="page"]');
        const indicator = selectorBody(shellStyles, ".navLink::after");
        const currentIndicator = selectorBody(shellStyles, '.navLink[aria-current="page"]::after');

        expect(currentLink).toMatch(/color:\s*var\(--rg-ink\)/);
        expect(currentLink).toMatch(/background:\s*rgba\(255,\s*253,\s*248,\s*0\.90\)/);
        expect(currentLink).toMatch(/box-shadow:/);
        expect(indicator).toMatch(/opacity:\s*0/);
        expect(indicator).toMatch(/transform:\s*scaleX\(/);
        expect(indicator).toMatch(/transition:[^;]*opacity[^;]*transform/);
        expect(currentIndicator).toMatch(/opacity:\s*1/);
        expect(currentIndicator).toMatch(/transform:\s*scaleX\(1\)/);
    });

    it("导航焦点与按压显式消费全局交互令牌", () => {
        const focus = selectorBody(shellStyles, ".navLink:focus-visible");
        const active = selectorBody(shellStyles, ".navLink:active");

        expect(focus).toMatch(/outline:\s*var\(--rg-focus-ring-width\) solid var\(--rg-focus-ring-color\)/);
        expect(focus).toMatch(/outline-offset:\s*var\(--rg-focus-ring-offset\)/);
        expect(active).toMatch(/transform:\s*scale\(var\(--rg-press-scale\)\)/);
        expect(active).toMatch(/transition-duration:\s*0ms/);
    });

    it("减少动态效果时关闭当前入口指示过渡", () => {
        const reduceStart = shellStyles.indexOf("@media (prefers-reduced-motion: reduce)");
        expect(reduceStart).toBeGreaterThanOrEqual(0);

        const indicator = selectorBody(shellStyles.slice(reduceStart), ".navLink::after");
        expect(indicator).toMatch(/transition:\s*none/);
    });

    it("移动产品栏解除固定定位容器并把同一导航放到底部安全区", () => {
        const mobileStart = shellStyles.indexOf("@media (max-width: 959px)");
        expect(mobileStart).toBeGreaterThanOrEqual(0);

        const mobileStyles = shellStyles.slice(mobileStart);
        const topbar = selectorBody(mobileStyles, ".topbar");
        const navigation = selectorBody(mobileStyles, ".nav");
        const content = selectorBody(mobileStyles, ".content");

        expect(topbar).toMatch(/height:\s*58px/);
        expect(topbar).toMatch(/backdrop-filter:\s*none/);
        expect(navigation).toMatch(/position:\s*fixed/);
        expect(navigation).toMatch(/bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
        expect(navigation).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
        expect(navigation).toMatch(/env\(safe-area-inset-bottom,\s*0px\)/);
        expect(navigation).toMatch(/overflow:\s*visible/);
        expect(content).toMatch(/padding-bottom:[^;]*var\(--rg-control-min-touch\)[^;]*env\(safe-area-inset-bottom,\s*0px\)/);
    });

    it("开放画布移除整页相框并由内容容器约束宽度", () => {
        const appFrame = selectorBody(shellStyles, ".appFrame");
        const content = selectorBody(shellStyles, ".content");

        expect(appFrame).toMatch(/width:\s*100%/);
        expect(appFrame).toMatch(/min-height:\s*calc\(100dvh - 72px\)/);
        expect(appFrame).toMatch(/max-width:\s*100%/);
        expect(appFrame).not.toMatch(/(?:border|border-radius|box-shadow):/);
        expect(content).toMatch(/width:\s*min\(1760px,\s*100%\)/);
        expect(content).toMatch(/min-width:\s*0/);
    });

    it("提供可见跳转链接并把焦点送到唯一主内容", async () => {
        const user = userEvent.setup();
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        renderShell("/");

        const main = screen.getByRole("main", { name: "主要内容" });
        const skipLink = screen.getByRole("link", { name: "跳到主要内容" });

        expect(skipLink).toHaveAttribute("href", "#raidglass-main");
        await user.click(skipLink);

        expect(main).toHaveFocus();
        expect(diagnostics).toContainEqual({
            event: "skip_link_activated",
            details: { pathname: "/" },
        });
    });

    it("SPA 主路径切换后恢复主内容焦点并记录来源", async () => {
        const user = userEvent.setup();
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        renderShell("/");

        const main = screen.getByRole("main", { name: "主要内容" });
        await user.click(screen.getByRole("link", { name: "阵容参考" }));

        await waitFor(() => expect(main).toHaveFocus());
        expect(diagnostics).toContainEqual({
            event: "route_focus_restored",
            details: { fromPath: "/", toPath: "/comp_ranking/search" },
        });
    });
});
