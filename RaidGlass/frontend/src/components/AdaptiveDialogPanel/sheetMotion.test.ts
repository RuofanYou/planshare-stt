import { describe, expect, it } from "vitest";
import {
    rubberbandSheetOffset,
    sheetReleaseVelocity,
    shouldDismissSheet,
} from "./sheetMotion";

describe("sheetMotion", () => {
    it("按距离与速度的精确边界决定关闭", () => {
        expect(shouldDismissSheet({ offsetY: 197, velocityY: 0, height: 600 })).toBe(false);
        expect(shouldDismissSheet({ offsetY: 198, velocityY: 0, height: 600 })).toBe(true);
        expect(shouldDismissSheet({ offsetY: 10, velocityY: 899, height: 600 })).toBe(false);
        expect(shouldDismissSheet({ offsetY: 10, velocityY: 900, height: 600 })).toBe(true);
    });

    it("向下保持 1:1 且不超过面板高度，向上使用有限阻尼", () => {
        expect(rubberbandSheetOffset(240, 600)).toBe(240);
        expect(rubberbandSheetOffset(900, 600)).toBe(600);
        expect(rubberbandSheetOffset(20, 0)).toBe(0);

        const upward = rubberbandSheetOffset(-100, 600);
        expect(upward).toBeCloseTo(-19.3548, 3);
        expect(upward).toBeGreaterThan(-100);
        expect(upward).toBeLessThan(0);
    });

    it("速度只读取末样本前 80ms 的有效窗口", () => {
        const samples = [
            { y: 0, at: 0 },
            { y: 10, at: 35 },
            { y: 24, at: 80 },
            { y: 48, at: 120 },
        ] as const;

        expect(sheetReleaseVelocity(samples)).toBeCloseTo(600, 5);
        expect(sheetReleaseVelocity([{ y: 0, at: 0 }, { y: 50, at: 100 }])).toBe(0);
        expect(sheetReleaseVelocity([{ y: 0, at: 20 }, { y: 10, at: 20 }])).toBe(0);
        expect(samples).toEqual([
            { y: 0, at: 0 },
            { y: 10, at: 35 },
            { y: 24, at: 80 },
            { y: 48, at: 120 },
        ]);
    });

});
