import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../../diagnostics";
import type { DiagnosticDetails, DiagnosticEvent } from "../../diagnostics";
import { set_boss_spells } from "../../store/bosses";
import { catalogsAccepted } from "../../store/catalogCommit";
import {
    fightsRequestStarted,
    fightsRequestSucceeded,
} from "../../store/fights";
import { set_spec_spells } from "../../store/specs";
import { appReducer } from "../../store/store";
import { createDefaultFilters, set_filters } from "../../store/ui";
import type Boss from "../../types/boss";
import type Fight from "../../types/fight";
import type Spec from "../../types/spec";
import TimelineWorkbench, { blockUnavailableCopy } from "./TimelineWorkbench";
import TimelineWorkbenchView from "./TimelineWorkbenchView";
import type { RankingMeta, TimelineTarget } from "./types";
import type { WorkbenchPresentation } from "./workbenchState";

const timelineStageMock = vi.hoisted(() => ({
    set_zoom_listener: vi.fn(),
    reset_zoom: vi.fn(() => 4),
    zoom_by: vi.fn(() => 4.4),
    pan_by: vi.fn(),
    handle_key: vi.fn(() => false),
}));

vi.mock("../../components/CopyNoteWindow", () => ({ default: () => null }));
vi.mock("../../components/PlayerNames/PlayerNamesList", () => ({
    default: () => <div data-testid="player-names" />,
}));
vi.mock("../../components/Timeline/Stage", () => ({
    default: class MockStage {},
}));
vi.mock("../../components/Timeline/TimelineCanvas", () => ({
    default: ({ onStageReady }: { onStageReady?: (stage: typeof timelineStageMock) => void }) => {
        onStageReady?.(timelineStageMock);
        return <div data-testid="mock-timeline-canvas" />;
    },
}));
vi.mock("./TimelineSettings", () => ({ default: () => <div data-testid="mock-settings" /> }));

const acceptedTarget: TimelineTarget = {
    bossSlug: "imperator-averzian",
    bossName: "阿维兹安大帝",
    specSlug: "deathknight-blood",
    specName: "鲜血死亡骑士",
    difficulty: "mythic",
    metric: "dps",
};

const selectedTarget: TimelineTarget = {
    bossSlug: "vorasius",
    bossName: "沃拉修斯",
    specSlug: "warlock-demonology",
    specName: "恶魔学识术士",
    difficulty: "heroic",
    metric: "dps",
};

const meta: RankingMeta = {
    updated: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    edgeTopN: 10,
    sourceReportCount: 50,
    refresh: {
        status: "fresh",
        checked_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        published_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        upstream_updated: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        last_error_code: null,
    },
};

const readyPresentation: WorkbenchPresentation = {
    contentState: "ready",
    displayTargetKey: "imperator-averzian/deathknight-blood/mythic/dps",
    showAcceptedTimeline: true,
    copyAllowed: true,
    copyBlockReason: null,
};

function fightFixture(): Fight {
    return {
        fight_id: 1,
        report_id: "REPORT-A",
        report_url: "https://www.warcraftlogs.com/reports/REPORT-A",
        duration: 90_000,
        difficulty: 5,
        phases: [],
        boss: {
            name: acceptedTarget.bossSlug,
            boss_slug: acceptedTarget.bossSlug,
            spec_slug: acceptedTarget.bossSlug,
            class_slug: "boss",
            total: 0,
            casts: [{ id: 54_321, ts: 5_000 }],
            deaths: [],
            resurrects: [],
        },
        players: [{
            name: "已接收玩家",
            spec_slug: acceptedTarget.specSlug,
            class_slug: "deathknight",
            total: 100_000,
            casts: [{ id: 12_345, ts: 10_000 }],
            deaths: [],
            resurrects: [],
        }],
    };
}

function connectedFixture() {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(catalogsAccepted({
        classes: {},
        roles: [],
        seasons: { name: "测试赛季", slug: "test-season", raids: [1] },
        specs: [
            {
                id: 250,
                index: 1,
                class: { name: "Death Knight", name_slug: "deathknight" },
                role: "tank",
                name: "Blood",
                full_name: "Blood Death Knight",
                full_name_slug: acceptedTarget.specSlug,
            },
            {
                id: 266,
                index: 2,
                class: { name: "Warlock", name_slug: "warlock" },
                role: "rdps",
                name: "Demonology",
                full_name: "Demonology Warlock",
                full_name_slug: selectedTarget.specSlug,
            },
        ],
        bosses: [{
            id: 1,
            name: "测试副本",
            name_slug: "test-raid",
            bosses: [
                {
                    id: 1,
                    name: "Imperator Averzian",
                    full_name: "Imperator Averzian",
                    full_name_slug: acceptedTarget.bossSlug,
                    icon: "accepted.jpg",
                    phase_type: "static",
                },
                {
                    id: 2,
                    name: "Vorasius",
                    full_name: "Vorasius",
                    full_name_slug: selectedTarget.bossSlug,
                    icon: "selected.jpg",
                    phase_type: "static",
                },
            ],
        }],
    }));
    store.dispatch(set_spec_spells({ spec_slug: acceptedTarget.specSlug, spells: {} }));
    store.dispatch(set_spec_spells({ spec_slug: selectedTarget.specSlug, spells: {} }));
    store.dispatch(set_boss_spells({ boss_slug: acceptedTarget.bossSlug, spells: {} }));
    store.dispatch(set_boss_spells({ boss_slug: selectedTarget.bossSlug, spells: {} }));
    store.dispatch(fightsRequestStarted({
        requestId: "accepted",
        targetKey: readyPresentation.displayTargetKey!,
    }));
    store.dispatch(fightsRequestSucceeded({
        requestId: "accepted",
        targetKey: readyPresentation.displayTargetKey!,
        fights: [fightFixture()],
        meta,
    }));

    const state = store.getState();
    const acceptedBoss = {
        ...state.zones.bosses[acceptedTarget.bossSlug],
        spells_by_type: undefined,
    } as unknown as Boss;
    const selectedBoss = {
        ...state.zones.bosses[selectedTarget.bossSlug],
        spells_by_type: undefined,
    } as unknown as Boss;
    const acceptedSpec = {
        ...state.specs.specs_by_name[acceptedTarget.specSlug],
        spells_by_type: undefined,
    } as unknown as Spec;
    const selectedSpec = {
        ...state.specs.specs_by_name[selectedTarget.specSlug],
        spells_by_type: undefined,
    } as unknown as Spec;

    function element(target: TimelineTarget, boss: Boss, spec: Spec) {
        return (
            <Provider store={store}>
                <TimelineWorkbench
                    target={target}
                    boss={boss}
                    spec={spec}
                    headingLevel={1}
                    targetPicker={<button type="button">选择目标</button>}
                />
            </Provider>
        );
    }

    return {
        store,
        acceptedBoss,
        acceptedSpec,
        selectedBoss,
        selectedSpec,
        element,
    };
}

function deferredVoid() {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((next, fail) => {
        resolve = next;
        reject = fail;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    vi.clearAllMocks();
    timelineStageMock.reset_zoom.mockReturnValue(4);
    timelineStageMock.zoom_by.mockReturnValue(4.4);
    timelineStageMock.handle_key.mockReturnValue(false);
});

afterEach(() => {
    vi.useRealTimers();
    setDiagnosticSinkForTests(null);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    vi.restoreAllMocks();
});

describe("TimelineWorkbench 时间轴键盘边界", () => {
    it("Top10 姓名列与 Canvas 共享 spec_ranking 行距语义祖先", () => {
        const fixture = connectedFixture();
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        const playerNames = screen.getByTestId("player-names");
        const timelineCanvas = screen.getByTestId("mock-timeline-canvas");
        const rankingAncestor = playerNames.closest(".spec_ranking");

        expect(rankingAncestor).not.toBeNull();
        expect(rankingAncestor).toContainElement(timelineCanvas);
    });

    it("时间轴外的 window keydown 不再劫持平移", () => {
        const fixture = connectedFixture();
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        fireEvent.keyDown(window, { key: "ArrowLeft" });

        expect(timelineStageMock.pan_by).not.toHaveBeenCalled();
        expect(timelineStageMock.handle_key).not.toHaveBeenCalled();
    });

    it("时间轴工具栏焦点范围把按键委派给同一 Stage 入口", () => {
        timelineStageMock.handle_key.mockReturnValue(true);
        const fixture = connectedFixture();
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        const zoomIn = screen.getByRole("button", { name: "放大" });
        zoomIn.focus();
        const handled = fireEvent.keyDown(zoomIn, { key: "ArrowLeft" });

        expect(handled).toBe(false);
        expect(timelineStageMock.handle_key).toHaveBeenCalledWith("ArrowLeft");
    });
});

function renderView(overrides: Partial<React.ComponentProps<typeof TimelineWorkbenchView>> = {}) {
    const props: React.ComponentProps<typeof TimelineWorkbenchView> = {
        selectedTarget: acceptedTarget,
        acceptedTarget,
        requestTarget: null,
        failedTarget: null,
        presentation: readyPresentation,
        error: null,
        meta,
        visibleCount: 10,
        copyStatus: "",
        headingLevel: 1,
        onCopy: vi.fn(),
        onRetry: vi.fn(),
        onClearFilters: vi.fn(),
        targetPicker: <button type="button">阿维兹安大帝 · 鲜血死亡骑士</button>,
        settings: <div data-testid="timeline-settings">设置</div>,
        timelineControls: <button type="button">放大时间轴</button>,
        timeline: <div data-testid="timeline-content">Top10 时间轴</div>,
        ...overrides,
    };
    return { ...render(<TimelineWorkbenchView {...props} />), props };
}

describe("TimelineWorkbenchView", () => {
    it("就绪时目标、元数据、工具和时间轴收进同一工作台", () => {
        renderView();

        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { name: "阿维兹安大帝 · 鲜血死亡骑士" })).toBeInTheDocument();
        expect(screen.getByText("史诗难度 · 伤害 · Top10")).toBeVisible();
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
        expect(screen.getByTestId("workbench-context")).toBeVisible();
        expect(screen.getByRole("button", { name: "放大时间轴" }).closest("[data-timeline-scroll]"))
            .toBeNull();
    });

    it("服务端 refresh 标记 stale 时明确显示数据已过期", () => {
        renderView({
            meta: {
                ...meta,
                updated: new Date().toISOString(),
                refresh: {
                    ...meta.refresh,
                    status: "stale",
                    checked_at: new Date().toISOString(),
                    last_error_code: "upstream_info_http_503",
                },
            },
        });

        expect(screen.getByText("数据已过期")).toHaveAttribute("data-freshness", "stale");
    });

    it("跨目标加载时描述请求目标、保留旧时间轴并原生禁用复制", () => {
        renderView({
            selectedTarget,
            requestTarget: selectedTarget,
            targetPicker: <button type="button">沃拉修斯 · 恶魔学识术士</button>,
            presentation: {
                ...readyPresentation,
                contentState: "cross-target-loading",
                copyAllowed: false,
                copyBlockReason: "target-mismatch",
            },
        });

        expect(screen.getByText(/正在载入 沃拉修斯 · 恶魔学识术士/)).toBeVisible();
        expect(screen.getByText(/当前继续显示 阿维兹安大帝 · 鲜血死亡骑士/)).toBeVisible();
        expect(screen.getByRole("heading", { name: "沃拉修斯 · 恶魔学识术士" })).toBeInTheDocument();
        expect(screen.getByText("英雄难度 · 伤害 · Top10")).toBeVisible();
        expect(screen.getByText("等待数据")).toBeVisible();
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
    });

    it("同目标刷新时保留时间轴与复制能力", () => {
        renderView({
            requestTarget: acceptedTarget,
            presentation: { ...readyPresentation, contentState: "same-target-refreshing" },
        });

        expect(screen.getByText("正在更新")).toBeVisible();
        expect(screen.queryByRole("status")).toBeNull();
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
    });

    it("跨目标失败指出失败目标、保留旧时间轴并允许重试", () => {
        const onRetry = vi.fn();
        renderView({
            selectedTarget,
            failedTarget: selectedTarget,
            error: { targetKey: "vorasius/warlock-demonology/heroic/dps", message: "网络请求失败" },
            presentation: {
                ...readyPresentation,
                contentState: "target-error",
                copyAllowed: false,
                copyBlockReason: "target-mismatch",
            },
            onRetry,
        });

        expect(screen.getByRole("alert")).toHaveTextContent("载入 沃拉修斯 · 恶魔学识术士失败：网络请求失败");
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
    });

    it("同目标刷新失败保留旧时间轴与复制能力", () => {
        renderView({
            failedTarget: acceptedTarget,
            error: {
                targetKey: "imperator-averzian/deathknight-blood/mythic/dps",
                message: "刷新失败",
            },
            presentation: { ...readyPresentation, contentState: "same-target-error" },
        });

        expect(screen.getByRole("alert")).toHaveTextContent("更新 阿维兹安大帝 · 鲜血死亡骑士失败：刷新失败");
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
    });

    it("首次加载没有已接收目标时保留稳定上下文并省略时间轴内容", () => {
        renderView({
            selectedTarget,
            acceptedTarget: null,
            requestTarget: selectedTarget,
            presentation: {
                contentState: "initial-loading",
                displayTargetKey: null,
                showAcceptedTimeline: false,
                copyAllowed: false,
                copyBlockReason: "target-mismatch",
            },
            timelineControls: <button type="button" disabled>放大时间轴</button>,
        });

        expect(screen.getByRole("status")).toHaveTextContent("正在载入 沃拉修斯 · 恶魔学识术士");
        expect(screen.getByLabelText("当前目标")).toBeVisible();
        expect(screen.getByTestId("workbench-context")).toBeVisible();
        expect(screen.getByRole("button", { name: "放大时间轴" })).toBeDisabled();
        expect(screen.queryByTestId("timeline-content")).not.toBeInTheDocument();
    });

    it("已接收空结果展示目标空态和重试", () => {
        const onRetry = vi.fn();
        renderView({
            presentation: {
                contentState: "target-empty",
                displayTargetKey: readyPresentation.displayTargetKey,
                showAcceptedTimeline: false,
                copyAllowed: false,
                copyBlockReason: "target-empty",
            },
            visibleCount: 0,
            onRetry,
        });

        expect(screen.getByRole("status")).toHaveTextContent("当前目标暂无 Top10 样本");
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();
        expect(screen.queryByTestId("timeline-content")).not.toBeInTheDocument();
    });

    it("筛选隐藏全部玩家时提供清除筛选动作", () => {
        const onClearFilters = vi.fn();
        renderView({
            presentation: {
                contentState: "filter-empty",
                displayTargetKey: readyPresentation.displayTargetKey,
                showAcceptedTimeline: false,
                copyAllowed: false,
                copyBlockReason: "filters-hidden",
            },
            visibleCount: 0,
            onClearFilters,
        });

        expect(screen.getByRole("status")).toHaveTextContent("当前筛选隐藏了全部玩家");
        fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
        expect(onClearFilters).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();
    });

    it("筛选与显示使用自适应对话表面，开关可断言且时间轴始终保留", async () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        renderView({ settings: <button type="button">技能图标</button> });

        const toggle = screen.getByRole("button", { name: "筛选与显示" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("button", { name: "技能图标" })).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("button", { name: "技能图标" })).toBeVisible();
        expect(screen.getByRole("dialog", { name: "筛选与显示" })).toBeVisible();
        expect(screen.getByTestId("timeline-content")).toBeVisible();
        expect(diagnostics).toEqual([{
            event: "settings_opened",
            details: { reason: "trigger", surface: "popover" },
        }]);

        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        await waitFor(() => {
            expect(diagnostics.at(-1)).toEqual({
                event: "settings_closed",
                details: { reason: "close_button", surface: "popover" },
            });
        });
    });
});

describe("TimelineWorkbench 复制闸门", () => {
    it("筛选空态的清除动作恢复唯一默认过滤器", () => {
        const fixture = connectedFixture();
        fixture.store.dispatch(set_filters({ class: { deathknight: false } }));
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        expect(screen.getByText("当前筛选隐藏了全部玩家")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));

        expect(fixture.store.getState().ui.filters).toEqual(createDefaultFilters());
        expect(screen.getByTestId("mock-timeline-canvas")).toBeVisible();
    });

    it("跨目标时防御性阻止复制并只记录标量原因", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));

        const blocked = blockUnavailableCopy(
            "vorasius/warlock-demonology/heroic/dps",
            {
                ...readyPresentation,
                contentState: "cross-target-loading",
                copyAllowed: false,
                copyBlockReason: "target-mismatch",
            },
            true,
        );

        expect(blocked).toBe(true);
        expect(diagnostics).toEqual([{
            event: "target_copy_blocked",
            details: {
                target: "vorasius/warlock-demonology/heroic/dps",
                reason: "target-mismatch",
            },
        }]);
    });

    it("复制成功依次记录终态，在原按钮确认 1.5 秒后恢复", async () => {
        vi.useFakeTimers();
        const fixture = connectedFixture();
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });
        const diagnostics: DiagnosticEvent[] = [];
        setDiagnosticSinkForTests((event) => diagnostics.push(event));
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        fireEvent.click(screen.getByRole("button", { name: "复制 Top10 作业" }));
        await act(async () => Promise.resolve());

        expect(screen.getByRole("button", { name: "Top10 作业已复制" })).toHaveTextContent("已复制");
        expect(screen.getByText("Top10 作业已复制")).toBeInTheDocument();
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain("首领：阿维兹安大帝");
        expect(writeText.mock.calls[0][0]).toContain("专精：鲜血死亡骑士");
        expect(diagnostics).toEqual(["target_copy_started", "target_copy_succeeded"]);

        act(() => vi.advanceTimersByTime(1499));
        expect(screen.getByRole("button", { name: "Top10 作业已复制" })).toBeEnabled();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeEnabled();
    });

    it("复制失败依次记录 started 和 failed 并显示稳定反馈", async () => {
        const fixture = connectedFixture();
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: vi.fn(async () => Promise.reject(new Error("secret clipboard error"))) },
        });
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        fireEvent.click(screen.getByRole("button", { name: "复制 Top10 作业" }));

        await waitFor(() => expect(screen.getByText("复制失败，请稍后重试")).toBeVisible());
        expect(diagnostics).toEqual([
            {
                event: "target_copy_started",
                details: { target: readyPresentation.displayTargetKey },
            },
            {
                event: "target_copy_failed",
                details: {
                    target: readyPresentation.displayTargetKey,
                    reason: "clipboard-write-failed",
                },
            },
        ]);
    });

    it("目标切换后旧剪贴板完成仍记录终态但不写入新目标反馈", async () => {
        const fixture = connectedFixture();
        const pending = deferredVoid();
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: vi.fn(() => pending.promise) },
        });
        const diagnostics: DiagnosticEvent[] = [];
        setDiagnosticSinkForTests((event) => diagnostics.push(event));
        const view = render(fixture.element(acceptedTarget, fixture.acceptedBoss, fixture.acceptedSpec));

        fireEvent.click(screen.getByRole("button", { name: "复制 Top10 作业" }));
        expect(diagnostics).toEqual(["target_copy_started"]);

        view.rerender(fixture.element(selectedTarget, fixture.selectedBoss, fixture.selectedSpec));
        await act(async () => pending.resolve());

        await waitFor(() => expect(diagnostics).toEqual([
            "target_copy_started",
            "target_copy_succeeded",
        ]));
        expect(screen.queryByText("Top10 作业已复制")).not.toBeInTheDocument();
        expect(screen.queryByText("复制失败，请稍后重试")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "复制 Top10 作业" })).toBeDisabled();
    });
});
