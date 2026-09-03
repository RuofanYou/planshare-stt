import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    setDiagnosticSinkForTests,
    type DiagnosticDetails,
    type DiagnosticEvent,
} from "../../diagnostics";

vi.mock("konva", () => {
    class KonvaNode {}
    return {
        default: {
            autoDrawEnabled: true,
            Stage: KonvaNode,
            Group: KonvaNode,
            Layer: KonvaNode,
            Line: KonvaNode,
            Rect: KonvaNode,
            Text: KonvaNode,
            Image: KonvaNode,
        },
    };
});

import Stage from "./Stage";
import { IMAGES } from "./Cast";
import { EVENT_IMAGES_LOADED, TIMELINE_ZOOM_IDLE_MS } from "./constants";

interface StageInteractionContract {
    begin_direct_pan(at: number): number;
    update_direct_pan(rawX: number, at: number): number;
    end_direct_pan(at: number): void;
    cancel_direct_pan(reason?: string): void;
    handle_wheel(event: WheelEventShape, anchorX: number): boolean;
    set_reduced_motion(reduced: boolean): void;
    set_diagnostics_target(target?: HTMLElement): void;
}

interface WheelEventShape {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}

type TestStage = Stage & StageInteractionContract;

const rafCallbacks = new Map<number, FrameRequestCallback>();
let nextRafId = 1;

function createStageHarness(initialX = -100) {
    const container = document.createElement("div");
    let x = initialX;
    const stage = Object.create(Stage.prototype) as TestStage;

    Object.assign(stage as unknown as Record<string, unknown>, {
        scale_x: 4,
        rows: [{
            visible: () => true,
            height: () => 44,
            anchor_offset: 0,
            duration: 300,
            rows: [],
        }],
        reduced_motion: false,
        interaction_state: "idle",
        motion_frame: null,
        motion_state: null,
        motion_target: 0,
        motion_input: "pointer",
        motion_last_time: 0,
        velocity_samples: [],
        wheel_zoom_frame: null,
        wheel_zoom_delta: 0,
        wheel_zoom_anchor: 0,
        wheel_zoom_listener_timer: null,
        diagnostics_timer: null,
        x(next?: number) {
            if (next !== undefined) x = next;
            return next === undefined ? x : stage;
        },
        y: vi.fn(),
        width: () => 800,
        container: () => container,
        batchDraw: vi.fn(),
        handle_event: vi.fn(),
        zoom_listener: vi.fn(),
        schedule_full_diagnostics: vi.fn(),
    });

    return { stage, container, readX: () => x };
}

function runNextFrame(time: number) {
    const next = [...rafCallbacks.entries()].sort(([left], [right]) => left - right)[0];
    if (!next) return false;
    rafCallbacks.delete(next[0]);
    next[1](time);
    return true;
}

function runUntilIdle(startTime = 96) {
    let time = startTime;
    let frames = 0;
    while (runNextFrame(time)) {
        time += 16;
        frames += 1;
        if (frames > 240) throw new Error("timeline spring did not settle");
    }
    return frames;
}

beforeEach(() => {
    rafCallbacks.clear();
    nextRafId = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        const id = nextRafId;
        nextRafId += 1;
        rafCallbacks.set(id, callback);
        return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
        rafCallbacks.delete(id);
    });
});

afterEach(() => {
    setDiagnosticSinkForTests(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("Stage direct manipulation diagnostics", () => {
    it("边界只消费仍有可见子行的 fight", () => {
        const { stage } = createStageHarness();
        Object.assign(stage as unknown as Record<string, unknown>, {
            rows: [
                { visible: () => true, height: () => 0, anchor_offset: 0, duration: 300 },
                { visible: () => true, height: () => 44, anchor_offset: 0, duration: 200 },
            ],
        });

        expect(stage.get_pan_bounds()).toEqual({ minX: 0, maxX: 0 });
    });

    it("释放时继承最近 80ms 呈现速度并连续进入临界弹簧", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const { stage, container, readX } = createStageHarness();

        expect(stage.begin_direct_pan(0)).toBe(-100);
        expect(stage.update_direct_pan(-140, 40)).toBe(-140);
        expect(stage.update_direct_pan(-220, 80)).toBe(-220);
        stage.end_direct_pan(80);

        const releasedX = readX();
        expect(releasedX).toBe(-220);
        expect(container.dataset.timelineMotion).toBe("inertia");
        expect(rafCallbacks.size).toBe(1);

        expect(runNextFrame(96)).toBe(true);
        expect(readX()).toBeLessThan(releasedX);
        const frames = runUntilIdle(112);

        expect(frames).toBeGreaterThan(0);
        expect(readX()).toBeCloseTo(-400, 6);
        expect(container.dataset.timelineMotion).toBe("idle");
        expect(diagnostics.map(({ details }) => details.phase)).toEqual([
            "pressed",
            "released",
            "projected",
            "settled",
        ]);
        expect(diagnostics[1].details.velocity).toBe(-1_500);
        expect(diagnostics[2].details.targetX).toBe(-400);
        diagnostics.forEach(({ details }) => {
            expect(Object.values(details).every((value) => (
                value === null || ["string", "number", "boolean"].includes(typeof value)
            ))).toBe(true);
        });
    });

    it("新 pointer down 从当前呈现位置中断旧惯性", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const { stage, container, readX } = createStageHarness();

        stage.begin_direct_pan(0);
        stage.update_direct_pan(-220, 80);
        stage.end_direct_pan(80);
        runNextFrame(96);
        const presentedX = readX();

        expect(stage.begin_direct_pan(100)).toBe(presentedX);
        expect(readX()).toBe(presentedX);
        expect(rafCallbacks.size).toBe(0);
        expect(container.dataset.timelineLastMotionStopReason).toBe("pointerdown");
        expect(Number(container.dataset.timelineLastMotionVelocity)).toBeLessThan(0);
        expect(Number(container.dataset.timelineLastMotionTarget)).toBeLessThan(presentedX);
        expect(diagnostics.map(({ details }) => details.phase)).toContain("interrupted");
        expect(diagnostics.at(-2)?.details).toMatchObject({
            phase: "interrupted",
            reason: "pointerdown",
            x: presentedX,
        });
        expect(diagnostics.at(-1)?.details.phase).toBe("pressed");
    });

    it("pointercancel 清空采样并立即夹紧，完全禁止惯性投影", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const { stage, container, readX } = createStageHarness();

        stage.begin_direct_pan(0);
        const resisted = stage.update_direct_pan(100, 40);
        expect(resisted).toBeGreaterThan(0);
        expect(resisted).toBeLessThan(100);

        stage.cancel_direct_pan("pointercancel");

        expect(readX()).toBe(0);
        expect(container.dataset.timelineInput).toBe("idle");
        expect(container.dataset.timelineMotion).toBe("idle");
        expect(rafCallbacks.size).toBe(0);
        expect(diagnostics.map(({ details }) => details.phase)).toEqual(["pressed", "settled"]);
        expect(diagnostics.at(-1)?.details).toMatchObject({
            phase: "settled",
            reason: "pointercancel",
            velocity: 0,
        });
    });

    it("wheel 当帧终止仍在捕获中的 pointer 手势", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const { stage, container, readX } = createStageHarness();

        stage.begin_direct_pan(0);
        stage.update_direct_pan(-150, 30);
        expect(stage.handle_wheel({ deltaX: 20, deltaY: 0, deltaMode: 0 }, 200)).toBe(true);
        const afterWheel = readX();

        expect(container.dataset.timelineInput).toBe("idle");
        expect(stage.update_direct_pan(-300, 60)).toBe(afterWheel);
        expect(readX()).toBe(afterWheel);
        expect(diagnostics.map(({ details }) => details.phase)).toContain("interrupted");
    });

    it("wheel zoom 同样当帧终止仍在捕获中的 pointer 手势", () => {
        const { stage, container, readX } = createStageHarness();

        stage.begin_direct_pan(0);
        stage.update_direct_pan(-150, 30);
        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 200)).toBe(true);
        const afterWheel = readX();

        expect(container.dataset.timelineInput).toBe("idle");
        expect(stage.update_direct_pan(-300, 60)).toBe(afterWheel);
        expect(rafCallbacks.size).toBe(1);
    });

    it("reduced motion 下拖拽即时夹紧且释放后不创建 RAF", () => {
        const { stage, container, readX } = createStageHarness();

        stage.set_reduced_motion(true);
        stage.begin_direct_pan(0);
        expect(stage.update_direct_pan(100, 40)).toBe(0);
        stage.end_direct_pan(40);

        expect(readX()).toBe(0);
        expect(container.dataset.timelineReducedMotion).toBe("true");
        expect(container.dataset.timelineMotion).toBe("idle");
        expect(rafCallbacks.size).toBe(0);
    });

    it("同一帧合并 wheel zoom 并保持最后指针锚点稳定", () => {
        const { stage, readX } = createStageHarness(-200);
        const beforeWorld = (300 - readX()) / stage.scale_x;

        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 200)).toBe(true);
        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 300)).toBe(true);

        expect(stage.scale_x).toBe(4);
        expect(rafCallbacks.size).toBe(1);
        runNextFrame(16);

        expect(stage.scale_x).toBeGreaterThan(4);
        expect((300 - readX()) / stage.scale_x).toBeCloseTo(beforeWorld, 8);
        expect(rafCallbacks.size).toBe(0);
    });

    it("wheel zoom 的每个 RAF 只执行一次 batchDraw", () => {
        const { stage } = createStageHarness(-200);
        const batchDraw = vi.mocked(stage.batchDraw);
        vi.mocked(stage.handle_event).mockImplementation(() => {
            stage.batchDraw();
        });

        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 300)).toBe(true);
        runNextFrame(16);

        expect(batchDraw).toHaveBeenCalledTimes(1);
    });

    it("连续 wheel zoom 在 idle 后只同步一次 zoom listener", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { stage } = createStageHarness(-200);
        const zoomListener = vi.mocked((stage as unknown as {
            zoom_listener: (zoom: number) => void;
        }).zoom_listener);

        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 300)).toBe(true);
        runNextFrame(16);
        expect(stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 320)).toBe(true);
        runNextFrame(32);

        expect(zoomListener).not.toHaveBeenCalled();
        vi.advanceTimersByTime(TIMELINE_ZOOM_IDLE_MS - 1);
        expect(zoomListener).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(zoomListener).toHaveBeenCalledOnce();
        expect(zoomListener).toHaveBeenCalledWith(stage.scale_x);
    });

    it("工具栏缩放与重置立即同步并取消待执行的 wheel 同步", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { stage } = createStageHarness(-200);
        const zoomListener = vi.mocked((stage as unknown as {
            zoom_listener: (zoom: number) => void;
        }).zoom_listener);

        stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 300);
        runNextFrame(16);
        expect(zoomListener).not.toHaveBeenCalled();

        stage.zoom_by(1.1, 400, "toolbar");
        expect(zoomListener).toHaveBeenCalledOnce();
        expect(zoomListener).toHaveBeenLastCalledWith(stage.scale_x);

        stage.handle_wheel({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }, 300);
        runNextFrame(32);
        stage.reset_zoom("toolbar");
        expect(zoomListener).toHaveBeenCalledTimes(2);
        expect(zoomListener).toHaveBeenLastCalledWith(4);

        vi.advanceTimersByTime(TIMELINE_ZOOM_IDLE_MS);
        expect(zoomListener).toHaveBeenCalledTimes(2);
    });

    it("惯性中 cancel 只记录 interrupted 一个终态", () => {
        const diagnostics: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => diagnostics.push({ event, details }));
        const { stage } = createStageHarness();

        stage.begin_direct_pan(0);
        stage.update_direct_pan(-220, 80);
        stage.end_direct_pan(80);
        stage.cancel_direct_pan("pointercancel");

        expect(diagnostics.map(({ details }) => details.phase)).toEqual([
            "pressed",
            "released",
            "projected",
            "interrupted",
        ]);
        expect(diagnostics.filter(({ event }) => event === "timeline_pan_settled")).toHaveLength(1);
        expect(rafCallbacks.size).toBe(0);
    });

    it("将交互与碰撞 diagnostics 同步到外层断言节点", () => {
        const { stage, container } = createStageHarness(-200);
        const outer = document.createElement("div");

        stage.set_diagnostics_target(outer);
        stage.begin_direct_pan(0);

        expect(outer.dataset).toMatchObject({
            timelineLabelCollisions: "0",
            timelineLabelIconCollisions: "0",
            timelineVisibleLabels: "0",
            timelinePanX: "-200",
            timelinePanMin: "-400",
            timelinePanMax: "0",
            timelineInput: "pressed",
            timelineMotion: "idle",
            timelineReducedMotion: "false",
            timelineZoom: "4",
            timelineDuration: "0",
        });
        expect(outer.dataset.timelinePanX).toBe(container.dataset.timelinePanX);
    });

    it("只在时间轴图片全部可绘制后写入加载完成诊断", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { stage, container } = createStageHarness();
        const image = new Image();
        Object.defineProperties(image, {
            complete: { configurable: true, value: false },
            naturalWidth: { configurable: true, value: 0 },
        });
        IMAGES[999] = image;

        stage._handle_check_images_loaded();
        expect(container.dataset.timelineImagesLoaded).toBe("false");

        Object.defineProperties(image, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 24 },
        });
        stage._handle_check_images_loaded();

        expect(container.dataset.timelineImagesLoaded).toBe("true");
        expect(stage.handle_event).toHaveBeenCalledWith(EVENT_IMAGES_LOADED);
        delete IMAGES[999];
    });
});
