import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TimelineVisibility } from "../../filter_logic";
import type Fight from "../../types/fight";
import PlayerNamesList from "./PlayerNamesList";

vi.mock("./PlayerNamesFight", () => ({
    default: ({ visibleFight }: { visibleFight: TimelineVisibility["fights"][number] }) => (
        <div>{visibleFight.fight.players[0].name}</div>
    ),
}));

function visibility(report: string, names: string[]): TimelineVisibility {
    return {
        hiddenPlayerCount: 0,
        fights: names.map((name, index) => ({
            fight: {
                report_id: report,
                fight_id: 61,
                players: [{ name, source_id: index + 1 }],
            } as Fight,
            actors: [],
        })),
    };
}

it("同报告同场战斗的不同玩家，在切换首领后全部清除", () => {
    const { rerender } = render(<PlayerNamesList visibility={visibility("旧报告", ["Hokoreuw", "Kakazi"])} />);
    expect(screen.getByText("Hokoreuw")).toBeVisible();
    expect(screen.getByText("Kakazi")).toBeVisible();

    rerender(<PlayerNamesList visibility={visibility("新报告", ["Thoughtvoke"])} />);
    expect(screen.queryByText("Hokoreuw")).not.toBeInTheDocument();
    expect(screen.queryByText("Kakazi")).not.toBeInTheDocument();
    expect(screen.getByText("Thoughtvoke")).toBeVisible();
});
