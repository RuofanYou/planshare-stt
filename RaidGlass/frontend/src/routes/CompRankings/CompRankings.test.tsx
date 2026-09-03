import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import {
    MemoryRouter,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTimelineVisibility, type TimelineVisibility } from "../../filter_logic";
import { parseCompCriteria } from "../../features/comp-reference/criteria";
import { buildTimelineTextSnapshot } from "../../features/timeline-workbench/homework";
import { catalogsAccepted } from "../../store/catalogCommit";
import {
    fightsRequestStarted,
    fightsRequestSucceeded,
} from "../../store/fights";
import { set_spec_spells } from "../../store/specs";
import { set_spell_visible } from "../../store/spells";
import { appReducer } from "../../store/store";
import {
    createDefaultFilters,
    set_copynote_fight,
    set_copynote_player,
    set_filters,
    set_show_copynote,
} from "../../store/ui";
import type Actor from "../../types/actor";
import type Fight from "../../types/fight";
import CompRankings from "./CompRankings";
import CompRankingsView, {
    type CompRankingsDisplay,
} from "./CompRankingsView";

const captures = vi.hoisted(() => ({
    loadFights: vi.fn(),
    playerVisibility: null as TimelineVisibility | null,
    canvasVisibility: null as TimelineVisibility | null,
}));

vi.mock("../../store/fights", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../store/fights")>();
    return {
        ...actual,
        load_fights: (...args: unknown[]) => {
            captures.loadFights(...args);
            return async () => undefined;
        },
    };
});

vi.mock("../../store/bosses", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../store/bosses")>();
    return { ...actual, load_boss_spells: () => async () => undefined };
});

vi.mock("../../store/specs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../store/specs")>();
    return { ...actual, load_spec_spells: () => async () => undefined };
});

vi.mock("../../components/CopyNoteWindow", () => ({ default: () => null }));
vi.mock("../../components/PlayerNames/PlayerNamesList", () => ({
    default: ({ visibility }: { visibility: TimelineVisibility }) => {
        captures.playerVisibility = visibility;
        return (
            <div data-testid="player-names">
                {visibility.fights.flatMap(({ actors }) => actors
                    .filter(({ kind }) => kind === "player")
                    .map(({ actor }) => actor.name)).join("|")}
            </div>
        );
    },
}));
vi.mock("../../components/Timeline/TimelineCanvas", () => ({
    default: ({ visibility }: { visibility: TimelineVisibility }) => {
        captures.canvasVisibility = visibility;
        return (
            <div data-testid="timeline-canvas-mock">
                {visibility.fights.flatMap(({ actors }) => actors
                    .filter(({ kind }) => kind === "player")
                    .map(({ actor }) => actor.name)).join("|")}
            </div>
        );
    },
}));

const targetKey = "comp/vorasius?role=tank.eq.2";
const routePath = "/comp_ranking/vorasius?role=tank.eq.2";

function actor(name: string, spec: string, classSlug: string, spellId: number): Actor {
    return {
        name,
        spec_slug: spec,
        class_slug: classSlug,
        total: 100_000,
        casts: [{ id: spellId, ts: 10_000 }],
        deaths: [],
        resurrects: [],
    };
}

function fightFixture(): Fight {
    return {
        fight_id: 1,
        report_id: "REPORT",
        report_url: "https://www.warcraftlogs.com/reports/REPORT#fight=1",
        start_time: "2026-07-18T00:00:00.000Z",
        region: "CN",
        duration: 90_000,
        difficulty: 0,
        phases: [],
        composition: {
            roles: { tank: 2, heal: 4, mdps: 6, rdps: 8 },
            specs: { "mage-fire": 1, "warrior-fury": 1, "priest-holy": 1 },
            classes: { mage: 1, warrior: 1, priest: 1 },
        },
        boss: {
            name: "vorasius",
            boss_slug: "vorasius",
            spec_slug: "vorasius",
            class_slug: "boss",
            total: 0,
            casts: [{ id: 900, ts: 5_000 }],
            deaths: [],
            resurrects: [],
        },
        players: [
            actor("可见法师", "mage-fire", "mage", 100),
            actor("可见战士", "warrior-fury", "warrior", 300),
            actor("隐藏牧师", "priest-holy", "priest", 200),
        ],
    };
}

function makeStore() {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(catalogsAccepted({
        classes: {
            mage: {
                name: "Mage",
                name_slug: "mage",
                specs: ["mage-fire"],
                spec_ids: [63],
                color: "#3fc7eb",
            },
            warrior: {
                name: "Warrior",
                name_slug: "warrior",
                specs: ["warrior-fury"],
                spec_ids: [72],
                color: "#c69b6d",
            },
            priest: {
                name: "Priest",
                name_slug: "priest",
                specs: ["priest-holy"],
                spec_ids: [257],
                color: "#ffffff",
            },
        },
        roles: [{
            id: 1,
            code: "tank",
            name: "Tank",
            specs: [],
            spec_ids: [],
            metrics: ["dps"],
        }, {
            id: 2,
            code: "heal",
            name: "Healer",
            specs: [],
            spec_ids: [],
            metrics: ["hps"],
        }, {
            id: 3,
            code: "mdps",
            name: "Melee",
            specs: [],
            spec_ids: [],
            metrics: ["dps"],
        }, {
            id: 4,
            code: "rdps",
            name: "Ranged",
            specs: [],
            spec_ids: [],
            metrics: ["dps"],
        }],
        specs: [
            [63, "Mage", "mage", "rdps", "Fire", "Fire Mage", "mage-fire"],
            [72, "Warrior", "warrior", "mdps", "Fury", "Fury Warrior", "warrior-fury"],
            [257, "Priest", "priest", "heal", "Holy", "Holy Priest", "priest-holy"],
        ].map(([id, className, classSlug, role, name, fullName, slug]) => ({
            id: id as number,
            index: 1,
            class: { name: className as string, name_slug: classSlug as string },
            role: role as string,
            name: name as string,
            full_name: fullName as string,
            full_name_slug: slug as string,
        })),
        seasons: { name: "测试赛季", slug: "test-season", raids: [1] },
        bosses: [{
            id: 1,
            name: "测试副本",
            name_slug: "test-raid",
            bosses: [{
                id: 1,
                name: "Vorasius",
                full_name: "Vorasius",
                full_name_slug: "vorasius",
                icon: "vorasius.jpg",
                phase_type: "static",
            }],
        }],
    }));
    store.dispatch(set_spec_spells({
        spec_slug: "mage-fire",
        spells: {
            100: {
                spell_id: 100,
                spell_type: "mage",
                name: "测试法术",
                color: "#ffffff",
                cooldown: 60,
                duration: 5,
                icon: "spell.jpg",
                icon_path: "/spell.jpg",
                show: true,
            },
        },
    }));
    store.dispatch(fightsRequestStarted({ requestId: "accepted", targetKey }));
    store.dispatch(fightsRequestSucceeded({
        requestId: "accepted",
        targetKey,
        fights: [fightFixture()],
        meta: {
            updated: "2026-07-18T00:00:00.000Z",
            edgeTopN: 10,
            sourceReportCount: 24,
            refresh: {
                status: "fresh",
                checked_at: "2026-07-18T01:00:00.000Z",
                published_at: "2026-07-18T00:00:00.000Z",
                upstream_updated: "2026-07-18T00:00:00.000Z",
                last_error_code: null,
            },
        },
    }));
    store.dispatch(set_spell_visible({ spell_id: 200, visible: false }));
    store.dispatch(set_filters({
        region: { CN: false },
        class: { mage: false },
        killtime: { min: 999, max: null },
    }));
    return store;
}

function localFilters() {
    return { ...createDefaultFilters(), hide_empty_rows: true };
}

function displayFixture(store = makeStore()): CompRankingsDisplay {
    const fight = fightFixture();
    const filters = localFilters();
    const spellDisplay = { 200: false };
    const visibility = buildTimelineVisibility([fight], filters, spellDisplay);
    const catalog = {
        roleKeys: new Set(["tank", "heal", "mdps", "rdps"]),
        specKeys: new Set(["mage-fire", "warrior-fury", "priest-holy"]),
    };
    const criteria = parseCompCriteria("role=tank.eq.2", catalog).criteria;
    return {
        bossSlug: "vorasius",
        bossName: "沃拉修斯",
        targetKey,
        criteria,
        criteriaSummary: "坦克 2人",
        fights: [fight],
        visibility,
        snapshot: buildTimelineTextSnapshot({
            title: "沃拉修斯",
            context: "坦克 2人",
            visibility,
            spellDisplay,
            spells: store.getState().spells.all_spells,
            updated: "2026-07-18T00:00:00.000Z",
        }),
        meta: {
            updated: "2026-07-18T00:00:00.000Z",
            edgeTopN: 10,
            sourceReportCount: 24,
            refresh: {
                status: "fresh",
                checked_at: "2026-07-18T01:00:00.000Z",
                published_at: "2026-07-18T00:00:00.000Z",
                upstream_updated: "2026-07-18T00:00:00.000Z",
                last_error_code: null,
            },
        },
    };
}

function LocationProbe() {
    const location = useLocation();
    return <output aria-label="当前地址">{location.pathname}{location.search}</output>;
}

function InvalidNavigation() {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate(`${routePath}&token=x`)}>
            前往非法条件
        </button>
    );
}

function renderView(
    state: React.ComponentProps<typeof CompRankingsView>["state"],
    overrides: Partial<React.ComponentProps<typeof CompRankingsView>> = {},
    store = makeStore(),
) {
    const props: React.ComponentProps<typeof CompRankingsView> = {
        state,
        display: state === "empty" || state === "error"
            || state === "unknown-boss" || state === "invalid-query"
            ? null
            : displayFixture(store),
        filters: localFilters(),
        errorMessage: null,
        onRetry: vi.fn(),
        ...overrides,
    };
    return {
        store,
        props,
        ...render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[routePath]}>
                    <CompRankingsView {...props} />
                    <LocationProbe />
                </MemoryRouter>
            </Provider>,
        ),
    };
}

beforeEach(() => {
    captures.loadFights.mockClear();
    captures.playerVisibility = null;
    captures.canvasVisibility = null;
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })));
});

describe("CompRankingsView", () => {
    function openCopyNote(store: ReturnType<typeof makeStore>) {
        const fight = fightFixture();
        store.dispatch(set_copynote_fight(fight));
        store.dispatch(set_copynote_player(fight.players[0]));
        store.dispatch(set_show_copynote(true));
    }

    function expectCopyNoteCleared(store: ReturnType<typeof makeStore>) {
        expect(store.getState().ui.show_copynote).toBe(false);
        expect(store.getState().ui.copynote_player).toBeNull();
        expect(store.getState().ui.copynote_fight).toBeNull();
    }

    it("进入 Comp 时完整清理 Top10 遗留的作业弹窗状态", () => {
        const store = makeStore();
        openCopyNote(store);

        renderView("ready", {}, store);

        expectCopyNoteCleared(store);
    });

    it("Comp 换目标时完整清理当前目标的作业弹窗状态", () => {
        const view = renderView("ready");
        openCopyNote(view.store);

        view.rerender(
            <Provider store={view.store}>
                <MemoryRouter initialEntries={[routePath]}>
                    <CompRankingsView {...view.props} state="switching" />
                    <LocationProbe />
                </MemoryRouter>
            </Provider>,
        );

        expectCopyNoteCleared(view.store);
    });

    it("离开 Comp 时完整清理作业弹窗状态", () => {
        const view = renderView("ready");
        openCopyNote(view.store);

        view.unmount();

        expectCopyNoteCleared(view.store);
    });

    it("ready 使用同一 visibility 呈现玩家列、Canvas 与完整文字摘要", () => {
        renderView("ready");

        const heading = screen.getByRole("heading", { name: "沃拉修斯 · 阵容参考" });
        expect(heading).toBeVisible();
        expect(within(heading.closest("header")!).getByText("坦克 2人")).toBeVisible();
        expect(screen.getByRole("img", { name: "坦克 2人" })).toBeVisible();
        expect(captures.playerVisibility).toBe(captures.canvasVisibility);
        expect(screen.getByTestId("player-names")).toHaveTextContent("可见法师|可见战士");
        expect(screen.getByTestId("timeline-canvas-mock")).toHaveTextContent("可见法师|可见战士");
        const summary = screen.getByRole("region", { name: "阵容时间轴文字摘要" });
        expect(summary).toHaveTextContent("沃拉修斯");
        expect(summary).toHaveTextContent("可见法师");
        expect(summary).toHaveTextContent("可见战士");
        expect(summary).toHaveTextContent("00:10.0 测试法术");
        expect(summary).not.toHaveTextContent("隐藏牧师");
    });

    it("阵容页沿用 refresh stale 状态展示数据已过期", () => {
        const display = displayFixture();
        display.meta = {
            ...display.meta!,
            refresh: {
                ...display.meta!.refresh,
                status: "stale",
                last_error_code: "upstream_comp_http_503",
            },
        };
        renderView("ready", { display });

        expect(screen.getByText("数据已过期")).toHaveAttribute("data-freshness", "stale");
    });

    it("switching 有同模式旧数据时保留内容并公告新条件载入", () => {
        renderView("switching");

        expect(screen.getByRole("status", { name: "正在载入阵容参考" })).toHaveTextContent(
            "正在载入新条件",
        );
        expect(screen.getByTestId("timeline-canvas-mock")).toBeVisible();
    });

    it("switching 无可用旧数据时只显示独立载入状态", () => {
        renderView("switching", { display: null });

        expect(screen.getByRole("status", { name: "正在载入阵容参考" })).toBeVisible();
        expect(screen.queryByTestId("timeline-canvas-mock")).not.toBeInTheDocument();
    });

    it("empty 与 error 提供修改条件或重试", async () => {
        const user = userEvent.setup();
        renderView("empty");
        expect(screen.getByText("当前公开 Top10 样本中没有符合条件的阵容")).toBeVisible();
        expect(screen.getByRole("link", { name: "修改条件" })).toHaveAttribute(
            "href",
            "/comp_ranking/search",
        );

        const errorView = renderView("error", {
            errorMessage: "阵容数据请求失败",
            onRetry: vi.fn(),
        });
        await user.click(screen.getByRole("button", { name: "重试" }));
        expect(errorView.props.onRetry).toHaveBeenCalledTimes(1);
    });

    it("error-with-data 同时显示非阻断错误与已接收时间轴", () => {
        renderView("error-with-data", { errorMessage: "刷新失败" });

        expect(screen.getByRole("alert")).toHaveTextContent("刷新失败");
        expect(screen.getByTestId("timeline-canvas-mock")).toBeVisible();
    });

    it.each(["unknown-boss", "invalid-query"] as const)(
        "%s 复用不可用路由且不读取旧数据",
        (state) => {
            renderView(state);
            expect(screen.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
            expect(screen.queryByTestId("timeline-canvas-mock")).not.toBeInTheDocument();
        },
    );

    it("AdaptiveDialogPanel 中不出现指标且设置操作不改变条件 URL", async () => {
        const user = userEvent.setup();
        renderView("ready");

        await user.click(screen.getByRole("button", { name: "时间轴设置" }));
        const dialog = screen.getByRole("dialog", { name: "时间轴设置" });
        expect(within(dialog).queryByText("选择指标")).not.toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", { name: "技能图标" }));
        await user.click(within(dialog).getByRole("button", { name: "测试法术" }));
        expect(screen.getByRole("status", { name: "当前地址" })).toHaveTextContent(routePath);
    });
});

describe("CompRankings controller", () => {
    function renderRoute(path: string) {
        const store = makeStore();
        const top10Filters = structuredClone(store.getState().ui.filters);
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/comp_ranking/:boss_slug" element={(
                            <>
                                <CompRankings />
                                <InvalidNavigation />
                            </>
                        )} />
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );
        return { store, top10Filters };
    }

    it("合法结果使用阵容局部 filters 且严格保留 Top10 Redux", async () => {
        const fixture = renderRoute(routePath);

        await waitFor(() => expect(captures.loadFights).toHaveBeenCalledTimes(1));
        expect(captures.loadFights).toHaveBeenCalledWith("comp_ranking", {
            boss_slug: "vorasius",
            search: "?role=tank.eq.2",
        });
        expect(captures.playerVisibility).toBe(captures.canvasVisibility);
        expect(screen.getByTestId("player-names")).toHaveTextContent("可见法师");
        expect(screen.getByTestId("player-names")).not.toHaveTextContent("隐藏牧师");
        expect(fixture.store.getState().ui.filters).toEqual(fixture.top10Filters);
    });

    it("unknown boss 与 invalid query 都不发请求", () => {
        renderRoute("/comp_ranking/unknown-boss?role=tank.eq.2");
        expect(captures.loadFights).not.toHaveBeenCalled();

        captures.loadFights.mockClear();
        renderRoute("/comp_ranking/vorasius?token=x");
        expect(captures.loadFights).not.toHaveBeenCalled();
    });

    it("合法结果后导航非法条件时清除旧内容且不追加请求", async () => {
        const user = userEvent.setup();
        renderRoute(routePath);
        await waitFor(() => expect(captures.loadFights).toHaveBeenCalledTimes(1));
        captures.loadFights.mockClear();

        await user.click(screen.getByRole("button", { name: "前往非法条件" }));

        expect(screen.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
        expect(screen.queryByText("可见法师")).not.toBeInTheDocument();
        expect(captures.loadFights).not.toHaveBeenCalled();
    });
});
