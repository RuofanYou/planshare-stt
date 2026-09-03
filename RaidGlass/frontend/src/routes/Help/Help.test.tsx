import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import Help from "./Help";

const helpStyles = readFileSync(resolve(
    process.cwd(),
    "src/routes/Help/Help.module.scss",
), "utf8");

const generalStyles = readFileSync(resolve(
    process.cwd(),
    "scss/_general.scss",
), "utf8");

afterEach(() => {
    window.history.replaceState({}, "", "/");
    document.title = "";
});

function renderHelp() {
    return render(
        <MemoryRouter initialEntries={["/help"]}>
            <Help />
        </MemoryRouter>,
    );
}

describe("Help", () => {
    it("提供单一中文标题与连续标题层级", () => {
        const { container } = renderHelp();
        const headings = screen.getAllByRole("heading");
        const levels = headings.map((heading) => Number(heading.tagName.slice(1)));

        expect(document.title).toBe("RaidGlass: 使用帮助");
        expect(levels.filter((level) => level === 1)).toHaveLength(1);
        expect(levels[0]).toBe(1);
        expect(levels.every((level) => level >= 1 && level <= 3)).toBe(true);
        levels.slice(1).forEach((level, index) => {
            expect(level - levels[index]).toBeLessThanOrEqual(1);
        });

        expect(container).toHaveTextContent("RaidGlass 使用帮助");
        expect(container).toHaveTextContent("画布会按指针位移 1:1 跟随");
        expect(container).toHaveTextContent("横向滚轮");
        expect(container).toHaveTextContent("Ctrl");
        expect(container).toHaveTextContent("Meta");
        expect(container).toHaveTextContent("0.5×–16×");
        expect(container).toHaveTextContent("选择首领");
        expect(container).not.toHaveTextContent(/Spell selection|Timeline Markers|Hover/i);
    });

    it("不再加载图片、GIF 或远程帮助资源", () => {
        const { container } = renderHelp();

        expect(container.querySelector("img, picture, video, iframe, link")).toBeNull();
        expect(container.innerHTML).not.toMatch(/https?:\/\/|\.gif(?:[\"'?]|$)/i);
    });

    it("目录使用原生渐进披露，所有锚点留在帮助页并指向真实章节", async () => {
        window.history.replaceState({}, "", "/help");
        const user = userEvent.setup();
        const { container } = renderHelp();

        const summary = screen.getByText("本页目录", { selector: "summary" });
        const details = summary.closest("details");
        expect(details).not.toHaveAttribute("open");

        await user.click(summary);
        expect(details).toHaveAttribute("open");

        const navigation = screen.getByRole("navigation", { name: "本页目录（移动）" });
        const links = within(navigation).getAllByRole("link");
        expect(links.length).toBeGreaterThanOrEqual(5);

        container.querySelectorAll("aside a").forEach((link) => {
            const href = link.getAttribute("href");
            expect(href).toMatch(/^#[a-z0-9-]+$/);
            expect(document.querySelector(href!)).not.toBeNull();
        });

        await user.click(links[0]);
        expect(window.location.pathname).toBe("/help");
        expect(window.location.hash).toBe(links[0].getAttribute("href"));
    });

    it("目录命中区域、双栏和窄屏收口有明确样式合同", () => {
        expect(helpStyles).toMatch(
            /\.outerContainer,\s*\.layout,\s*\.sidebar,\s*\.content\s*{[\s\S]*min-width:\s*0/,
        );
        expect(helpStyles).toMatch(
            /\.directorySummary,\s*\.directoryLink\s*{[\s\S]*min-height:\s*var\(--rg-control-min-touch\)/,
        );
        expect(helpStyles).toMatch(/@media\s*\(min-width:\s*960px\)/);
        expect(helpStyles).toMatch(
            /@media\s*\(min-width:\s*960px\)[\s\S]*\.sidebar\s*{[\s\S]*position:\s*sticky/,
        );
        expect(helpStyles).toMatch(/@media\s*\(max-width:\s*480px\)/);
    });

    it("全局减少动态效果直接关闭动画与过渡", () => {
        const reduceStart = generalStyles.indexOf("@media (prefers-reduced-motion: reduce)");
        expect(reduceStart).toBeGreaterThanOrEqual(0);

        const reduceStyles = generalStyles.slice(reduceStart);
        expect(reduceStyles).toMatch(/animation:\s*none\s*!important/);
        expect(reduceStyles).toMatch(/transition:\s*none\s*!important/);
        expect(reduceStyles).toMatch(/scroll-behavior:\s*auto\s*!important/);
        expect(reduceStyles).not.toMatch(/1ms/);
    });
});
