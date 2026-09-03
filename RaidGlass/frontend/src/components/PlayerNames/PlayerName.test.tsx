import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type Actor from "../../types/actor";
import type Fight from "../../types/fight";
import { LINE_HEIGHT } from "../Timeline/constants";
import { PlayerName } from "./PlayerName";

const settingsStyles = readFileSync(resolve(process.cwd(), "scss/_settings.scss"), "utf8");
const playerNameStyles = readFileSync(resolve(
    process.cwd(),
    "src/components/PlayerNames/PlayerName.module.scss",
), "utf8");

const dispatch = vi.fn();

vi.mock("../../store/store_hooks", () => ({
    useAppDispatch: () => dispatch,
    useAppSelector: (selector: (state: unknown) => unknown) => selector({
        ui: { mode: "spec_ranking", filters: {} },
        spells: { spell_display: {} },
    }),
}));

vi.mock("../../store/specs", () => ({
    get_spec: () => ({ role: "tank", icon_path: "/spec.webp" }),
}));

vi.mock("../../store/roles", () => ({
    get_role: () => ({ icon_path: "/role.webp" }),
}));

vi.mock("../WebpImg", () => ({
    default: ({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img src={src} {...props} />,
}));

const player: Actor = {
    name: "测试玩家完整名称",
    spec_slug: "deathknight-blood",
    class_slug: "deathknight",
    total: 123456,
    rank: 1,
    casts: [],
    deaths: [],
    resurrects: [],
};

const fight: Fight = {
    fight_id: 7,
    report_id: "REPORT",
    report_url: "https://example.test/report",
    duration: 90000,
    players: [player],
    phases: [],
    difficulty: 5,
};

describe("PlayerName", () => {
    beforeEach(() => dispatch.mockClear());

    it("排名、名字、数值和复制使用独立语义节点", () => {
        render(<PlayerName fight={fight} player={player} />);

        expect(screen.getByText("#1")).toHaveAttribute("data-player-rank");
        expect(screen.getByText("测试玩家完整名称")).toHaveAttribute("title", "测试玩家完整名称");
        expect(screen.getByText("123.5k")).toHaveAttribute("data-player-total");

        const copyButton = screen.getByRole("button", { name: "复制测试玩家完整名称的作业" });
        expect(copyButton).toBeEnabled();
        fireEvent.click(copyButton);
        expect(dispatch).toHaveBeenCalledTimes(3);
    });

    it("姓名列在桌面收窄、移动端保留可读宽度并显式提供复制", () => {
        expect(settingsStyles).toMatch(
            /--rg-player-column-width:\s*clamp\(286px,\s*18vw,\s*320px\)/,
        );
        expect(settingsStyles).toMatch(
            /@media \(max-width: 959px\)[\s\S]*--rg-player-column-width:\s*clamp\(164px,\s*44vw,\s*184px\)/,
        );
        expect(playerNameStyles).toMatch(
            /@media \(max-width: 959px\)[\s\S]*\.total\s*\{\s*display:\s*none;/,
        );
        expect(playerNameStyles).toMatch(
            /\.compLink[\s\S]*\.rank\s*\{\s*display:\s*none;/,
        );
        expect(playerNameStyles).toMatch(
            /@media \(max-width: 959px\)[\s\S]*\.copyButton\s*\{[\s\S]*opacity:\s*0\.72;/,
        );
    });

    it("姓名列与 Canvas 的 Top10 和阵容多场累计高度恒等", () => {
        expect(settingsStyles).toMatch(/--timeline-height:\s*52px/);
        const mobileSettings = settingsStyles.slice(settingsStyles.indexOf("@media (max-width: 959px)"));
        expect(mobileSettings).not.toMatch(/--timeline-height:/);
        expect(settingsStyles).toMatch(/--timeline-fight-gap:\s*10px/);
        expect(settingsStyles).toMatch(/\.spec_ranking\s*\{\s*--timeline-fight-gap:\s*-1px/);
        expect(playerNameStyles).toMatch(
            /height:\s*calc\(var\(--timeline-height\) \+ 1px\)/,
        );
        expect(playerNameStyles).toMatch(
            /\.boss_name \+ \.player_name,[\s\S]*margin-top:\s*-1px/,
        );
        expect(playerNameStyles).toMatch(
            /\.fight\s*\{[\s\S]*margin-bottom:\s*var\(--timeline-fight-gap, 0\)/,
        );

        const rowCounts = [2, 1, 5, 3];
        const namesFightHeight = (rows: number, fightGap: number) => (
            rows * (LINE_HEIGHT + 1) + (rows - 1) * -1 + fightGap
        );
        let top10NamesY = LINE_HEIGHT;
        let top10CanvasY = LINE_HEIGHT;
        let compNamesY = LINE_HEIGHT;
        let compCanvasY = LINE_HEIGHT;

        rowCounts.forEach((rows) => {
            top10NamesY += namesFightHeight(rows, -1);
            top10CanvasY += rows * LINE_HEIGHT;
            compNamesY += namesFightHeight(rows, 10);
            compCanvasY += rows * LINE_HEIGHT + 10 + 1;
            expect(top10NamesY).toBe(top10CanvasY);
            expect(compNamesY).toBe(compCanvasY);
        });
    });
});
