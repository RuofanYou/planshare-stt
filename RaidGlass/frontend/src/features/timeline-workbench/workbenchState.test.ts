import { describe, expect, it } from "vitest";

import {
    deriveWorkbenchPresentation,
    type WorkbenchPresentation,
    type WorkbenchStateInput,
} from "./workbenchState";

const ACCEPTED_TARGET = "imperator-averzian/warlock-affliction/mythic/dps";
const SELECTED_TARGET = "vorasius/warlock-demonology/heroic/dps";

interface PresentationCase {
    name: string;
    input: WorkbenchStateInput;
    expected: WorkbenchPresentation;
}

const cases: PresentationCase[] = [
    {
        name: "首次请求显示初始加载且不暴露时间轴",
        input: {
            selectedTargetKey: SELECTED_TARGET,
            requestTarget: SELECTED_TARGET,
            acceptedTarget: null,
            status: "updating",
            error: null,
            acceptedFightCount: 0,
            visibleFightCount: 0,
        },
        expected: {
            contentState: "initial-loading",
            displayTargetKey: null,
            showAcceptedTimeline: false,
            copyAllowed: false,
            copyBlockReason: "target-mismatch",
        },
    },
    {
        name: "跨目标加载保留已接收时间轴并阻止复制",
        input: {
            selectedTargetKey: SELECTED_TARGET,
            requestTarget: SELECTED_TARGET,
            acceptedTarget: ACCEPTED_TARGET,
            status: "updating",
            error: null,
            acceptedFightCount: 10,
            visibleFightCount: 10,
        },
        expected: {
            contentState: "cross-target-loading",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: false,
            copyBlockReason: "target-mismatch",
        },
    },
    {
        name: "就绪目标显示已接收时间轴并允许复制",
        input: {
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "ready",
            error: null,
            acceptedFightCount: 10,
            visibleFightCount: 10,
        },
        expected: {
            contentState: "ready",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: true,
            copyBlockReason: null,
        },
    },
    {
        name: "同目标刷新保留时间轴与复制能力",
        input: {
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: ACCEPTED_TARGET,
            acceptedTarget: ACCEPTED_TARGET,
            status: "updating",
            error: null,
            acceptedFightCount: 10,
            visibleFightCount: 10,
        },
        expected: {
            contentState: "same-target-refreshing",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: true,
            copyBlockReason: null,
        },
    },
    {
        name: "同目标刷新失败保留时间轴与复制能力",
        input: {
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "error",
            error: { targetKey: ACCEPTED_TARGET, message: "刷新失败" },
            acceptedFightCount: 10,
            visibleFightCount: 10,
        },
        expected: {
            contentState: "same-target-error",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: true,
            copyBlockReason: null,
        },
    },
    {
        name: "跨目标失败保留旧时间轴并阻止复制",
        input: {
            selectedTargetKey: SELECTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "error",
            error: { targetKey: SELECTED_TARGET, message: "目标加载失败" },
            acceptedFightCount: 10,
            visibleFightCount: 10,
        },
        expected: {
            contentState: "target-error",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: false,
            copyBlockReason: "target-mismatch",
        },
    },
    {
        name: "已接收目标没有原始战斗时显示目标空态",
        input: {
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "ready",
            error: null,
            acceptedFightCount: 0,
            visibleFightCount: 0,
        },
        expected: {
            contentState: "target-empty",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: false,
            copyAllowed: false,
            copyBlockReason: "target-empty",
        },
    },
    {
        name: "原始战斗存在但全部被过滤时显示筛选空态",
        input: {
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "ready",
            error: null,
            acceptedFightCount: 10,
            visibleFightCount: 0,
        },
        expected: {
            contentState: "filter-empty",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: false,
            copyAllowed: false,
            copyBlockReason: "filters-hidden",
        },
    },
];

describe("deriveWorkbenchPresentation", () => {
    it.each(cases)("$name", ({ input, expected }) => {
        expect(deriveWorkbenchPresentation(input)).toEqual(expected);
    });

    it("首次目标失败时没有已接收时间轴", () => {
        expect(deriveWorkbenchPresentation({
            selectedTargetKey: SELECTED_TARGET,
            requestTarget: null,
            acceptedTarget: null,
            status: "error",
            error: { targetKey: SELECTED_TARGET, message: "首次加载失败" },
            acceptedFightCount: 10,
            visibleFightCount: 10,
        })).toEqual({
            contentState: "target-error",
            displayTargetKey: null,
            showAcceptedTimeline: false,
            copyAllowed: false,
            copyBlockReason: "target-mismatch",
        });
    });

    it("其他目标的过期错误不污染当前已接收目标", () => {
        expect(deriveWorkbenchPresentation({
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "error",
            error: { targetKey: SELECTED_TARGET, message: "过期错误" },
            acceptedFightCount: 10,
            visibleFightCount: 10,
        })).toEqual({
            contentState: "ready",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: true,
            copyBlockReason: null,
        });
    });

    it("第三目标请求不误报为当前目标刷新", () => {
        expect(deriveWorkbenchPresentation({
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: SELECTED_TARGET,
            acceptedTarget: ACCEPTED_TARGET,
            status: "updating",
            error: null,
            acceptedFightCount: 10,
            visibleFightCount: 10,
        })).toEqual({
            contentState: "ready",
            displayTargetKey: ACCEPTED_TARGET,
            showAcceptedTimeline: true,
            copyAllowed: true,
            copyBlockReason: null,
        });
    });

    it("原始战斗为零时目标空态优先于筛选空态", () => {
        const presentation = deriveWorkbenchPresentation({
            selectedTargetKey: ACCEPTED_TARGET,
            requestTarget: null,
            acceptedTarget: ACCEPTED_TARGET,
            status: "ready",
            error: null,
            acceptedFightCount: 0,
            visibleFightCount: 0,
        });

        expect(presentation.contentState).toBe("target-empty");
        expect(presentation.copyBlockReason).toBe("target-empty");
    });
});
