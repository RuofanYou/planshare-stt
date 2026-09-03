import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineVisibility } from "../../filter_logic";
import type Fight from "../../types/fight";

const stageMock = vi.hoisted(() => ({
    MODE: "",
    update_width: vi.fn(),
    destroy: vi.fn(),
    set_fights: vi.fn(),
    apply_visibility: vi.fn(),
    handle_event: vi.fn(),
    begin_direct_pan: vi.fn(() => -100),
    update_direct_pan: vi.fn((rawX: number) => rawX),
    end_direct_pan: vi.fn(),
    cancel_direct_pan: vi.fn(),
    handle_wheel: vi.fn(() => false),
    handle_key: vi.fn(() => false),
    set_reduced_motion: vi.fn(),
    set_diagnostics_target: vi.fn(),
}));

const selectorState = vi.hoisted(() => ({
    ui: {
        mode: "spec_ranking",
        settings: {},
        filters: {},
    },
    fights: { status: "idle" },
    spells: {
        spell_display: {},
        selected_spells: [],
    },
}));

vi.mock("./Stage", () => ({
    default: class MockStage {
        constructor() {
            return stageMock;
        }
    },
}));

vi.mock("../../store/fights", () => ({ get_fights: () => [] }));
vi.mock("../../store/store_hooks", () => ({
    useAppSelector: (selector: (state: typeof selectorState) => unknown) => selector(selectorState),
}));
vi.mock("./TimelineTooltip", () => ({ default: () => null }));

import TimelineCanvas from "./TimelineCanvas";

const fights: Fight[] = [];
const visibility: TimelineVisibility = { fights: [], hiddenPlayerCount: 0 };

function CanvasFixture() {
    return <TimelineCanvas fights={fights} visibility={visibility} />;
}

let motionPreferenceListener: ((event: MediaQueryListEvent) => void) | null = null;
const motionPreference = {
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        motionPreferenceListener = listener;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
};

function createPointerEvent(type: string, values: Record<string, number | boolean>) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.entries(values).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
    });
    return event;
}

function preparePointerCapture(element: HTMLElement) {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const captured = new Set<number>();
    setPointerCapture.mockImplementation((pointerId: number) => captured.add(pointerId));
    releasePointerCapture.mockImplementation((pointerId: number) => captured.delete(pointerId));
    Object.defineProperties(element, {
        setPointerCapture: { configurable: true, value: setPointerCapture },
        releasePointerCapture: { configurable: true, value: releasePointerCapture },
        hasPointerCapture: {
            configurable: true,
            value: (pointerId: number) => captured.has(pointerId),
        },
    });
    return { setPointerCapture, releasePointerCapture };
}

beforeEach(() => {
    Object.values(stageMock).forEach((value) => {
        if (typeof value === "function" && "mockClear" in value) value.mockClear();
    });
    stageMock.begin_direct_pan.mockReturnValue(-100);
    stageMock.update_direct_pan.mockImplementation((rawX: number) => rawX);
    stageMock.handle_wheel.mockReturnValue(false);
    stageMock.handle_key.mockReturnValue(false);
    motionPreference.matches = false;
    motionPreferenceListener = null;
    motionPreference.addEventListener.mockClear();
    motionPreference.removeEventListener.mockClear();

    vi.stubGlobal("ResizeObserver", class ResizeObserverMock {
        observe = vi.fn();
        disconnect = vi.fn();
    });
    vi.stubGlobal("matchMedia", vi.fn(() => motionPreference));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("TimelineCanvas pointer ownership", () => {
    it("把 capture 绑定到原始 Canvas 目标以保留 Konva 事件链", () => {
        render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });
        const visual = screen.getByTestId("timeline-canvas-visual");
        const regionCapture = preparePointerCapture(region);
        const visualCapture = preparePointerCapture(visual);

        fireEvent(visual, createPointerEvent("pointerdown", {
            pointerId: 6,
            button: 0,
            isPrimary: true,
            clientX: 100,
            clientY: 100,
            timeStamp: 0,
        }));
        expect(visualCapture.setPointerCapture).not.toHaveBeenCalled();
        fireEvent(visual, createPointerEvent("pointermove", {
            pointerId: 6,
            clientX: 108,
            clientY: 102,
            timeStamp: 40,
        }));

        expect(visualCapture.setPointerCapture).toHaveBeenCalledWith(6);
        expect(regionCapture.setPointerCapture).not.toHaveBeenCalled();
    });

    it("真实捕获 pointer，并在达到 8px 水平意图后保持 1:1 跟手", () => {
        render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });
        const capture = preparePointerCapture(region);

        fireEvent(region, createPointerEvent("pointerdown", {
            pointerId: 7,
            button: 0,
            isPrimary: true,
            clientX: 100,
            clientY: 100,
            timeStamp: 0,
        }));

        expect(capture.setPointerCapture).not.toHaveBeenCalled();
        expect(stageMock.begin_direct_pan).toHaveBeenCalledWith(expect.any(Number));
        expect(region).toHaveFocus();

        fireEvent(region, createPointerEvent("pointermove", {
            pointerId: 7,
            clientX: 107,
            clientY: 101,
            timeStamp: 20,
        }));
        expect(stageMock.update_direct_pan).not.toHaveBeenCalled();

        const committedMove = createPointerEvent("pointermove", {
            pointerId: 7,
            clientX: 108,
            clientY: 102,
            timeStamp: 40,
        });
        fireEvent(region, committedMove);
        expect(committedMove.defaultPrevented).toBe(true);
        expect(capture.setPointerCapture).toHaveBeenCalledWith(7);
        expect(stageMock.update_direct_pan).toHaveBeenCalledWith(-92, expect.any(Number));

        fireEvent(region, createPointerEvent("pointerup", {
            pointerId: 7,
            clientX: 108,
            clientY: 102,
            timeStamp: 50,
        }));
        expect(stageMock.end_direct_pan).toHaveBeenCalledWith(expect.any(Number));
        expect(capture.releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it("超过 8px 的纵向意图释放捕获并完整交还页面", () => {
        render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });
        const capture = preparePointerCapture(region);

        fireEvent(region, createPointerEvent("pointerdown", {
            pointerId: 8,
            button: 0,
            isPrimary: true,
            clientX: 100,
            clientY: 100,
            timeStamp: 0,
        }));
        const verticalMove = createPointerEvent("pointermove", {
            pointerId: 8,
            clientX: 102,
            clientY: 109,
            timeStamp: 30,
        });
        fireEvent(region, verticalMove);

        expect(verticalMove.defaultPrevented).toBe(false);
        expect(capture.setPointerCapture).not.toHaveBeenCalled();
        expect(stageMock.update_direct_pan).not.toHaveBeenCalled();
        expect(stageMock.cancel_direct_pan).toHaveBeenCalledWith("vertical-intent");
        expect(capture.releasePointerCapture).not.toHaveBeenCalled();
    });

    it("pointercancel 与 lostpointercapture 都夹紧清理且不走释放惯性", () => {
        const view = render(<CanvasFixture />);
        let region = screen.getByRole("region", { name: "时间轴" });
        preparePointerCapture(region);
        fireEvent(region, createPointerEvent("pointerdown", {
            pointerId: 9,
            button: 0,
            isPrimary: true,
            clientX: 100,
            clientY: 100,
            timeStamp: 0,
        }));
        fireEvent(region, createPointerEvent("pointercancel", {
            pointerId: 9,
            timeStamp: 20,
        }));
        expect(stageMock.cancel_direct_pan).toHaveBeenLastCalledWith("pointercancel");
        expect(stageMock.end_direct_pan).not.toHaveBeenCalled();

        view.unmount();
        stageMock.cancel_direct_pan.mockClear();
        render(<CanvasFixture />);
        region = screen.getByRole("region", { name: "时间轴" });
        preparePointerCapture(region);
        fireEvent(region, createPointerEvent("pointerdown", {
            pointerId: 10,
            button: 0,
            isPrimary: true,
            clientX: 100,
            clientY: 100,
            timeStamp: 0,
        }));
        fireEvent(region, createPointerEvent("lostpointercapture", {
            pointerId: 10,
            timeStamp: 20,
        }));
        expect(stageMock.cancel_direct_pan).toHaveBeenCalledWith("lostpointercapture");
        expect(stageMock.end_direct_pan).not.toHaveBeenCalled();
    });
});

describe("TimelineCanvas local input boundary", () => {
    it("将外层 Canvas 区域注册为 Stage diagnostics 断言节点", () => {
        render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });

        expect(stageMock.set_diagnostics_target).toHaveBeenCalledOnce();
        expect(stageMock.set_diagnostics_target).toHaveBeenCalledWith(region);
    });

    it("只拦截 Stage 接受的 wheel，并传入相对 Canvas 的缩放锚点", () => {
        render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });
        const visual = screen.getByTestId("timeline-canvas-visual");
        vi.spyOn(visual, "getBoundingClientRect").mockReturnValue({
            x: 50,
            y: 0,
            left: 50,
            top: 0,
            right: 850,
            bottom: 400,
            width: 800,
            height: 400,
            toJSON: () => ({}),
        });

        stageMock.handle_wheel.mockReturnValueOnce(true).mockReturnValueOnce(false);
        const zoomWheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: 250,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        });
        visual.dispatchEvent(zoomWheel);
        expect(zoomWheel.defaultPrevented).toBe(true);
        expect(stageMock.handle_wheel).toHaveBeenCalledWith(expect.objectContaining({
            deltaX: 0,
            deltaY: -1,
            deltaMode: 1,
            ctrlKey: true,
        }), 200);

        const verticalWheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 120,
        });
        region.dispatchEvent(verticalWheel);
        expect(verticalWheel.defaultPrevented).toBe(false);
    });

    it("键盘仅在具名 Canvas 区域委派，并同步 reduced motion 生命周期", () => {
        stageMock.handle_key.mockReturnValue(true);
        const view = render(<CanvasFixture />);
        const region = screen.getByRole("region", { name: "时间轴" });

        const handled = fireEvent.keyDown(region, { key: "ArrowLeft" });
        expect(handled).toBe(false);
        expect(stageMock.handle_key).toHaveBeenCalledWith("ArrowLeft");
        expect(stageMock.set_reduced_motion).toHaveBeenCalledWith(false);

        motionPreference.matches = true;
        motionPreferenceListener?.({ matches: true } as MediaQueryListEvent);
        expect(stageMock.set_reduced_motion).toHaveBeenLastCalledWith(true);

        view.unmount();
        expect(motionPreference.removeEventListener).toHaveBeenCalledWith(
            "change",
            expect.any(Function),
        );
        expect(stageMock.destroy).toHaveBeenCalledTimes(1);
    });
});
