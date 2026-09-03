import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Footer from "./Footer";
import styles from "./Footer.module.scss";

const footerStyles = readFileSync(resolve(
    process.cwd(),
    "src/components/Footer/Footer.module.scss",
), "utf8");

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Footer 移动端避让", () => {
    it("用本地类覆盖全局 footer 间距并为固定底栏保留空间", () => {
        vi.stubGlobal("RAIDGLASS_RELEASE_ID", "release-test");
        vi.stubGlobal("RAIDGLASS_BUILD_ID", "build-test");
        vi.stubGlobal("RAIDGLASS_PUBLISHED_AT", "2026-07-18T00:00:00.000Z");
        const { container } = render(<MemoryRouter><Footer /></MemoryRouter>);
        expect(container.querySelector("footer")).toHaveClass(styles.footer);
        expect(screen.getByRole("navigation", { name: "辅助导航" })).toBeVisible();
        expect(screen.getByRole("link", { name: "使用帮助" })).toHaveAttribute("href", "/help");
        expect(container).toHaveTextContent("版本 release-");
        expect(container).toHaveTextContent("构建 build-te");

        const mobileStart = footerStyles.indexOf("@media (max-width: 959px)");
        expect(mobileStart).toBeGreaterThanOrEqual(0);

        const mobileStyles = footerStyles.slice(mobileStart);
        expect(footerStyles).toMatch(/\.footer\s*{/);
        expect(mobileStyles).toMatch(/\.footer\s*{/);
        expect(mobileStyles).toMatch(
            /margin-bottom:[^;]*var\(--rg-control-min-touch\)[^;]*env\(safe-area-inset-bottom,\s*0px\)/,
        );
    });
});
