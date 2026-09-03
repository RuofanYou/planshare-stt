import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import StatePanel from "./StatePanel";

const statePanelStyles = readFileSync(resolve(
    process.cwd(),
    "src/components/StatePanel/StatePanel.module.scss",
), "utf8");

describe("StatePanel", () => {
    it.each<[string, ReactNode]>([
        ["按钮", <button type="button">重试</button>],
        ["链接", <a href="/help">查看帮助</a>],
    ])("%s动作保留至少 44px 的触控目标", (_kind, action) => {
        render(
            <StatePanel
                title="载入失败"
                description="请重试"
                actions={action}
            />,
        );

        expect(screen.getByRole(_kind === "按钮" ? "button" : "link")).toBeVisible();
        expect(statePanelStyles).toMatch(/\.actions\s*>\s*:global\(a\)/);
        expect(statePanelStyles).toMatch(
            /\.actions\s*>\s*:global\(button\)[\s\S]*min-inline-size:\s*var\(--rg-control-min-touch\)/,
        );
        expect(statePanelStyles).toMatch(
            /\.actions\s*>\s*:global\(button\)[\s\S]*min-block-size:\s*var\(--rg-control-min-touch\)/,
        );
        expect(statePanelStyles).toMatch(
            /\.actions\s*>\s*:global\(button\)[\s\S]*display:\s*inline-flex/,
        );
    });

    it("长地址和 code 内容允许在面板内断行", () => {
        render(
            <StatePanel
                title="页面不存在"
                description={<code>https://example.test/a-very-long-address-without-breaks</code>}
            />,
        );

        expect(screen.getByText(/example\.test/)).toBeVisible();
        expect(statePanelStyles).toMatch(/\.description\s*{[\s\S]*overflow-wrap:\s*anywhere/);
        expect(statePanelStyles).toMatch(/\.description\s+code\s*{[\s\S]*white-space:\s*normal/);
    });
});
