import { describe, expect, it } from "vitest";
import {
    DEFAULT_DAMPED_SPRING,
    advanceDampedSpring,
    estimateVelocity,
    isDampedSpringSettled,
    isDampedSpringVisuallySettled,
    normalizeWheelDelta,
    projectClampedTarget,
    rubberband,
    type DampedSpringState,
} from "./physicalMotion";

describe("physicalMotion", () => {
    it("默认弹簧精确满足临界阻尼条件", () => {
        expect(DEFAULT_DAMPED_SPRING.damping ** 2).toBe(
            4 * DEFAULT_DAMPED_SPRING.stiffness * DEFAULT_DAMPED_SPRING.mass,
        );
    });

    it("从当前呈现值步进并在切换目标时保留速度", () => {
        const opening: DampedSpringState = { value: 0.35, velocity: 2.4 };
        const presented = advanceDampedSpring(opening, 1, 16);
        expect(presented.value).toBeGreaterThan(opening.value);
        expect(opening).toEqual({ value: 0.35, velocity: 2.4 });

        const handedOff = advanceDampedSpring(presented, 0, 4);
        const velocityReset = advanceDampedSpring({ ...presented, velocity: 0 }, 0, 4);
        expect(handedOff.value).toBeGreaterThan(velocityReset.value);
    });

    it("打开和关闭都无可见超调并达到物理收敛", () => {
        let state: DampedSpringState = { value: 0, velocity: 0 };
        let maximum = state.value;
        for (let frame = 0; frame < 360; frame += 1) {
            state = advanceDampedSpring(state, 1, 1000 / 60);
            maximum = Math.max(maximum, state.value);
        }

        expect(maximum).toBeLessThanOrEqual(1.0001);
        expect(isDampedSpringSettled(state, 1)).toBe(true);
        expect(state.value).toBeCloseTo(1, 3);

        let minimum = state.value;
        for (let frame = 0; frame < 360; frame += 1) {
            state = advanceDampedSpring(state, 0, 1000 / 60);
            minimum = Math.min(minimum, state.value);
        }
        expect(minimum).toBeGreaterThanOrEqual(-0.0001);
        expect(isDampedSpringSettled(state, 0)).toBe(true);
        expect(state.value).toBeCloseTo(0, 3);
    });

    it("默认弹簧在 14 帧内达到视觉收敛", () => {
        let state: DampedSpringState = { value: 1, velocity: 0 };
        let frameCount = 0;
        while (!isDampedSpringVisuallySettled(state, 0) && frameCount < 60) {
            state = advanceDampedSpring(state, 0, 1000 / 60);
            frameCount += 1;
        }

        expect(frameCount).toBeLessThanOrEqual(14);
        expect(state.value).toBeLessThanOrEqual(0.01);
        expect(isDampedSpringSettled(state, 0)).toBe(false);
    });

    it("非正步进时长不改变输入状态", () => {
        const state: DampedSpringState = { value: 0.4, velocity: -2 };
        const next = advanceDampedSpring(state, 1, 0);

        expect(next).toEqual(state);
        expect(next).not.toBe(state);
    });

    it("边界内保持 1:1 直接跟手", () => {
        expect(rubberband(0, 0, 500, 500)).toBe(0);
        expect(rubberband(180, 0, 500, 500)).toBe(180);
        expect(rubberband(500, 0, 500, 500)).toBe(500);
    });

    it("两侧越界使用对称的渐进阻力", () => {
        const below = rubberband(-100, 0, 500, 500);
        const above = rubberband(600, 0, 500, 500);

        expect(below).toBeCloseTo(-49.5495, 3);
        expect(above).toBeCloseTo(549.5495, 3);
        expect(-below).toBeCloseTo(above - 500, 10);
        expect(below).toBeGreaterThan(-100);
        expect(above).toBeLessThan(600);
    });

    it("橡皮筋距离有界且可配置阻力常数", () => {
        const lightResistance = rubberband(10_000, 0, 500, 500, 0.8);
        const strongResistance = rubberband(10_000, 0, 500, 500, 0.2);

        expect(lightResistance).toBeGreaterThan(strongResistance);
        expect(lightResistance).toBeLessThan(1_000);
        expect(strongResistance).toBeLessThan(1_000);
    });

    it("速度只使用末样本前最近 80ms 窗口", () => {
        const samples = [
            { value: 0, at: 0 },
            { value: 10, at: 35 },
            { value: 24, at: 80 },
            { value: 48, at: 120 },
        ] as const;

        expect(estimateVelocity(samples)).toBeCloseTo(600, 5);
        expect(samples).toEqual([
            { value: 0, at: 0 },
            { value: 10, at: 35 },
            { value: 24, at: 80 },
            { value: 48, at: 120 },
        ]);
    });

    it("速度窗口包含精确边界并忽略无效样本", () => {
        expect(estimateVelocity([
            { value: Number.NaN, at: 20 },
            { value: 0, at: 40 },
            { value: 40, at: 120 },
            { value: 80, at: Number.POSITIVE_INFINITY },
        ])).toBeCloseTo(500, 5);
    });

    it("速度窗口内没有有效样本对时返回零", () => {
        expect(estimateVelocity([{ value: 0, at: 0 }, { value: 50, at: 100 }])).toBe(0);
        expect(estimateVelocity([{ value: 0, at: 20 }, { value: 10, at: 20 }])).toBe(0);
        expect(estimateVelocity([])).toBe(0);
    });

    it("投影目标沿速度方向前推并夹在给定边界", () => {
        expect(projectClampedTarget(100, 200, 0, 400)).toBeCloseTo(199.8, 5);
        expect(projectClampedTarget(100, 1_000, 0, 400)).toBe(400);
        expect(projectClampedTarget(100, -1_000, 0, 400)).toBe(0);
    });

    it("零速度投影仍夹在合法边界", () => {
        expect(projectClampedTarget(250, 0, 0, 400)).toBe(250);
        expect(projectClampedTarget(500, 0, 0, 400)).toBe(400);
    });

    it("按 WheelEvent deltaMode 统一为像素距离", () => {
        expect(normalizeWheelDelta(5, 0, 900)).toBe(5);
        expect(normalizeWheelDelta(2, 1, 900)).toBe(32);
        expect(normalizeWheelDelta(-2, 1, 900, 20)).toBe(-40);
        expect(normalizeWheelDelta(0.5, 2, 800)).toBe(400);
    });
});
