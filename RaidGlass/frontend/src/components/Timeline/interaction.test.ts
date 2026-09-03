import { describe, expect, it } from "vitest";

import {
    getPanBounds,
    getTimelineKeyAction,
    getWheelIntent,
    limitTimelineVelocity,
    rubberBandX,
    zoomAtAnchor,
} from "./interaction";

describe("timeline interaction geometry", () => {
    it("按视口和缩放后内容宽度计算唯一水平边界", () => {
        expect(getPanBounds(800, 100, 4)).toEqual({ minX: 0, maxX: 0 });
        expect(getPanBounds(800, 300, 4)).toEqual({ minX: -400, maxX: 0 });
    });

    it("仅在直接拖拽原始坐标越界时应用对称有限阻力", () => {
        const bounds = { minX: -400, maxX: 0 };
        const right = rubberBandX(100, bounds, 800);
        const left = rubberBandX(-500, bounds, 800);

        expect(right).toBeGreaterThan(0);
        expect(right).toBeLessThan(100);
        expect(left).toBeLessThan(-400);
        expect(-400 - left).toBeCloseTo(right, 6);
    });

    it("归一化 deltaMode 并支持双向水平及 Shift 垂直滚轮", () => {
        expect(getWheelIntent({ deltaX: 120, deltaY: 0, deltaMode: 0 }, 800))
            .toEqual({ kind: "pan", deltaX: -60, input: "trackpad" });
        expect(getWheelIntent({ deltaX: -1, deltaY: 0, deltaMode: 1 }, 800))
            .toEqual({ kind: "pan", deltaX: 8, input: "trackpad" });
        expect(getWheelIntent({ deltaX: 0, deltaY: 0.5, deltaMode: 2, shiftKey: true }, 800))
            .toEqual({ kind: "pan", deltaX: -200, input: "shift-wheel" });
    });

    it("只在横轴满足优势阈值时拦截，纵向滚动继续交给页面", () => {
        expect(getWheelIntent({ deltaX: 1, deltaY: 0, deltaMode: 0 }, 800))
            .toEqual({ kind: "none" });
        expect(getWheelIntent({ deltaX: 2, deltaY: 3, deltaMode: 0 }, 800))
            .toEqual({ kind: "none" });
        expect(getWheelIntent({ deltaX: 3, deltaY: 4, deltaMode: 0 }, 800))
            .toEqual({ kind: "pan", deltaX: -1.5, input: "trackpad" });
        expect(getWheelIntent({ deltaX: 0, deltaY: 120, deltaMode: 0 }, 800))
            .toEqual({ kind: "none" });
    });

    it("Ctrl 或 Meta wheel 归一化后进入缩放意图", () => {
        expect(getWheelIntent({ deltaX: 0, deltaY: -1, deltaMode: 1, ctrlKey: true }, 800))
            .toEqual({ kind: "zoom", deltaY: -16 });
        expect(getWheelIntent({ deltaX: 0, deltaY: 0.5, deltaMode: 2, metaKey: true }, 800))
            .toEqual({ kind: "zoom", deltaY: 400 });
    });

    it("缩放时保持锚点下的世界坐标并立即夹紧边界", () => {
        const result = zoomAtAnchor({
            currentX: -200,
            oldScale: 4,
            requestedScale: 8,
            anchorX: 300,
            viewportWidth: 800,
            contentWidth: 300,
        });

        expect(result).toEqual({ x: -700, scale: 8 });
        expect((300 - result.x) / result.scale).toBeCloseTo((300 - (-200)) / 4, 8);
        expect(zoomAtAnchor({
            currentX: 0,
            oldScale: 4,
            requestedScale: 0.01,
            anchorX: 400,
            viewportWidth: 800,
            contentWidth: 100,
        })).toEqual({ x: 0, scale: 0.5 });
    });

    it("释放速度在时间轴域限制为正负 2400px/s", () => {
        expect(limitTimelineVelocity(2_399)).toBe(2_399);
        expect(limitTimelineVelocity(50_000)).toBe(2_400);
        expect(limitTimelineVelocity(-50_000)).toBe(-2_400);
    });

    it("只映射时间轴局部支持的键盘动作", () => {
        expect(getTimelineKeyAction("+")).toBe("zoom-in");
        expect(getTimelineKeyAction("=")).toBe("zoom-in");
        expect(getTimelineKeyAction("-")).toBe("zoom-out");
        expect(getTimelineKeyAction("0")).toBe("reset");
        expect(getTimelineKeyAction("ArrowLeft")).toBe("pan-left");
        expect(getTimelineKeyAction("ArrowRight")).toBe("pan-right");
        expect(getTimelineKeyAction("Enter")).toBeNull();
    });
});
