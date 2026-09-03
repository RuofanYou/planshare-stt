import { describe, expect, it } from "vitest";

import { visibleTimelineLabels } from "./labelLayout";

describe("visibleTimelineLabels", () => {
    it("隐藏与前一可见标签相交的时间文字", () => {
        expect(visibleTimelineLabels([
            { left: 0, right: 48 },
            { left: 40, right: 88 },
            { left: 96, right: 144 },
        ], 4)).toEqual([true, false, true]);
    });

    it("按坐标排序，并为无效矩形保留隐藏结果", () => {
        expect(visibleTimelineLabels([
            { left: 80, right: 112 },
            { left: Number.NaN, right: 40 },
            { left: 0, right: 32 },
        ], 4)).toEqual([true, false, true]);
    });

    it("被跳过的标签不阻塞后续标签", () => {
        expect(visibleTimelineLabels([
            { left: 0, right: 50 },
            { left: 10, right: 200 },
            { left: 60, right: 90 },
        ], 4)).toEqual([true, false, true]);
    });

    it("恰好满足最小间距时保留标签", () => {
        expect(visibleTimelineLabels([
            { left: 0, right: 40 },
            { left: 44, right: 80 },
        ], 4)).toEqual([true, true]);
    });

    it("隐藏会压住后续技能图标的时间文字", () => {
        expect(visibleTimelineLabels([
            { left: 32, right: 72 },
            { left: 92, right: 132 },
            { left: 152, right: 192 },
        ], 4, [
            { left: 3.5, right: 27.5 },
            { left: 63.5, right: 87.5 },
            { left: 123.5, right: 147.5 },
        ])).toEqual([false, false, true]);
    });
});
