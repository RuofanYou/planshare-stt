import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TimelineTextAlternative from "./TimelineTextAlternative";
import type { TimelineTextSnapshot } from "./homework";

const snapshot: TimelineTextSnapshot = {
    title: "沃拉修斯",
    context: "坦克 2人；治疗至少4人",
    updated: "2026-07-18T00:00:00.000Z",
    hiddenPlayerCount: 1,
    fights: [{
        rank: 1,
        region: "CN",
        durationMs: 90_000,
        durationLabel: "1:30.0",
        reportUrl: "https://www.warcraftlogs.com/reports/REPORT",
        actors: [{
            kind: "boss",
            rank: null,
            name: "沃拉修斯",
            value: 0,
            events: [{
                spellId: 12345,
                spellName: "反魔法护罩",
                timeMs: 5_000,
                timeLabel: "0:05.0",
            }],
        }, {
            kind: "player",
            rank: null,
            name: "玩家甲",
            value: 100_000,
            events: [{
                spellId: 67890,
                spellName: "法术 67890",
                timeMs: 10_000,
                timeLabel: "0:10.0",
            }],
        }],
    }],
};

describe("TimelineTextAlternative", () => {
    it("用短状态播报更新并保留静态完整文字摘要", () => {
        render(
            <TimelineTextAlternative
                snapshot={snapshot}
                targetKey="comp/vorasius?role=tank.eq.2"
                ariaLabel="阵容时间轴文字摘要"
            />,
        );

        const region = screen.getByRole("region", { name: "阵容时间轴文字摘要" });
        expect(region).not.toHaveAttribute("aria-live");
        expect(region).not.toHaveAttribute("aria-atomic");
        expect(region).toHaveAttribute("data-target-key", "comp/vorasius?role=tank.eq.2");
        expect(screen.getByRole("status")).toHaveTextContent(
            "时间轴摘要已更新：显示 1 场，隐藏 1 名玩家",
        );
        expect(region).toHaveTextContent("沃拉修斯");
        expect(region).toHaveTextContent("坦克 2人；治疗至少4人");
        expect(region).toHaveTextContent("CN");
        expect(region).toHaveTextContent("1:30.0");
        expect(region).toHaveTextContent("首领 沃拉修斯");
        expect(region).not.toHaveTextContent("首领 沃拉修斯，数值 0");
        expect(region).toHaveTextContent("玩家 玩家甲");
        expect(region).toHaveTextContent("0:10.0 法术 67890");
        expect(region).toHaveTextContent("已隐藏 1 名玩家");
        expect(region).toHaveTextContent("https://www.warcraftlogs.com/reports/REPORT");
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
