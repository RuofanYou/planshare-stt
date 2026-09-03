import { StrictMode, useState, type ReactNode } from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    AdaptiveDialogPanel,
    type AdaptiveDialogPanelProps,
    type AdaptiveDialogTransition,
} from "./AdaptiveDialogPanel";

const MOBILE_QUERY = "(max-width: 959px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type MediaListener = (event: MediaQueryListEvent) => void;

class MediaEnvironment {
    private readonly entries = new Map<string, {
        query: MediaQueryList;
        listeners: Set<MediaListener>;
    }>();

    constructor(mobile: boolean, reducedMotion: boolean) {
        this.create(MOBILE_QUERY, mobile);
        this.create(REDUCED_MOTION_QUERY, reducedMotion);
    }

    readonly matchMedia = (query: string): MediaQueryList => {
        return this.entries.get(query)?.query ?? this.create(query, false);
    };

    set(query: string, matches: boolean): void {
        const entry = this.entries.get(query);
        if (!entry || entry.query.matches === matches) return;
        Object.defineProperty(entry.query, "matches", { configurable: true, value: matches });
        const event = new Event("change") as MediaQueryListEvent;
        Object.defineProperties(event, {
            matches: { value: matches },
            media: { value: query },
        });
        entry.listeners.forEach((listener) => listener(event));
    }

    private create(queryText: string, matches: boolean): MediaQueryList {
        const listeners = new Set<MediaListener>();
        const query = {
            matches,
            media: queryText,
            onchange: null,
            addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                if (typeof listener === "function") listeners.add(listener as MediaListener);
            },
            removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                if (typeof listener === "function") listeners.delete(listener as MediaListener);
            },
            addListener: (listener: MediaListener) => listeners.add(listener),
            removeListener: (listener: MediaListener) => listeners.delete(listener),
            dispatchEvent: () => true,
        } as MediaQueryList;
        this.entries.set(queryText, { query, listeners });
        return query;
    }
}

class FrameDriver {
    private callbacks = new Map<number, FrameRequestCallback>();
    private nextId = 1;
    private now = 0;

    readonly request = (callback: FrameRequestCallback): number => {
        const id = this.nextId;
        this.nextId += 1;
        this.callbacks.set(id, callback);
        return id;
    };

    readonly cancel = (id: number): void => {
        this.callbacks.delete(id);
    };

    step(frames = 1): void {
        act(() => {
            for (let frame = 0; frame < frames; frame += 1) {
                this.runFrame();
            }
        });
    }

    flush(limit = 600): void {
        act(() => {
            let frames = 0;
            while (this.callbacks.size > 0 && frames < limit) {
                this.runFrame();
                frames += 1;
            }
            if (this.callbacks.size > 0) throw new Error("动画未在帧预算内收敛");
        });
    }

    private runFrame(): void {
        this.now += 1000 / 60;
        const callbacks = [...this.callbacks.values()];
        this.callbacks.clear();
        callbacks.forEach((callback) => callback(this.now));
    }
}

interface TestEnvironment {
    media: MediaEnvironment;
    frames: FrameDriver;
}

function installEnvironment({
    mobile = false,
    reducedMotion = true,
    width = 1000,
    height = 700,
}: {
    mobile?: boolean;
    reducedMotion?: boolean;
    width?: number;
    height?: number;
} = {}): TestEnvironment {
    const media = new MediaEnvironment(mobile, reducedMotion);
    const frames = new FrameDriver();
    vi.stubGlobal("matchMedia", media.matchMedia);
    vi.stubGlobal("requestAnimationFrame", frames.request);
    vi.stubGlobal("cancelAnimationFrame", frames.cancel);
    setViewport(width, height);
    return { media, frames };
}

function setViewport(width: number, height: number): void {
    Object.defineProperties(window, {
        innerWidth: { configurable: true, value: width },
        innerHeight: { configurable: true, value: height },
    });
}

function domRect({
    left,
    top,
    width,
    height,
}: {
    left: number;
    top: number;
    width: number;
    height: number;
}): DOMRect {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

function pointerEvent(
    target: Element,
    type: string,
    {
        pointerId = 1,
        clientY = 0,
        button = 0,
        isPrimary = true,
        timeStamp = 0,
    }: {
        pointerId?: number;
        clientY?: number;
        button?: number;
        isPrimary?: boolean;
        timeStamp?: number;
    } = {},
): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
        pointerId: { value: pointerId },
        clientY: { value: clientY },
        button: { value: button },
        isPrimary: { value: isPrimary },
        timeStamp: { value: timeStamp },
    });
    fireEvent(target, event);
    return event;
}

function StatefulChild(): ReactNode {
    const [count, setCount] = useState(0);
    return (
        <button type="button" data-testid="stateful-child" onClick={() => setCount((value) => value + 1)}>
            子内容 {count}
        </button>
    );
}

function renderPanel({
    children = <StatefulChild />,
    onStateChange,
}: {
    children?: AdaptiveDialogPanelProps["children"];
    onStateChange?: (open: boolean, transition: AdaptiveDialogTransition) => void;
} = {}) {
    return render(
        <AdaptiveDialogPanel
            title="筛选与显示"
            description="调整时间轴显示内容"
            trigger={({ ref, ...triggerProps }) => (
                <button ref={ref} type="button" {...triggerProps}>打开筛选</button>
            )}
            onStateChange={onStateChange}
        >
            {children}
        </AdaptiveDialogPanel>,
    );
}

function panelElement(container: HTMLElement): HTMLElement {
    const panel = container.querySelector<HTMLElement>("[data-adaptive-dialog-panel]");
    if (!panel) throw new Error("缺少 AdaptiveDialogPanel 内容表面");
    return panel;
}

function dialogElement(container: HTMLElement): HTMLDialogElement {
    const dialog = container.querySelector<HTMLDialogElement>("dialog");
    if (!dialog) throw new Error("缺少 dialog");
    return dialog;
}

function sheetHandle(container: HTMLElement): HTMLDivElement {
    const handle = container.querySelector<HTMLDivElement>("[data-sheet-drag-handle]");
    if (!handle) throw new Error("缺少 sheet 拖拽手势区");
    return handle;
}

function installPointerCapture(handle: HTMLElement) {
    let captured = false;
    const setPointerCapture = vi.fn((_pointerId: number) => { captured = true; });
    const releasePointerCapture = vi.fn((_pointerId: number) => { captured = false; });
    const hasPointerCapture = vi.fn((_pointerId: number) => captured);
    Object.defineProperties(handle, {
        setPointerCapture: { configurable: true, value: setPointerCapture },
        releasePointerCapture: { configurable: true, value: releasePointerCapture },
        hasPointerCapture: { configurable: true, value: hasPointerCapture },
    });
    return { setPointerCapture, releasePointerCapture, hasPointerCapture };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AdaptiveDialogPanel", () => {
    it("桌面从触发器锚定，重算后保持视口内，并在断点切换时保留唯一内容", () => {
        const { media } = installEnvironment();
        const { container } = renderPanel();
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);
        const panel = panelElement(container);
        vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(domRect({
            left: 10, top: 10, width: 80, height: 30,
        }));
        vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(domRect({
            left: 0, top: 0, width: 403, height: 288,
        }));
        Object.defineProperties(panel, {
            offsetWidth: { configurable: true, value: 420 },
            offsetHeight: { configurable: true, value: 300 },
        });

        fireEvent.click(trigger);

        expect(dialog).toHaveAttribute("open");
        expect(dialog).toHaveAttribute("data-surface", "popover");
        expect(dialog.style.getPropertyValue("--rg-dialog-top")).toBe("40px");
        expect(dialog.style.getPropertyValue("--rg-dialog-right")).toBe("564px");
        expect(dialog.style.getPropertyValue("--rg-dialog-origin-x")).toBe("34px");
        expect(dialog.style.getPropertyValue("--rg-popover-offset")).toBe("0px");
        expect(dialog.style.getPropertyValue("--rg-popover-scale")).toBe("1");
        expect(screen.getAllByTestId("stateful-child")).toHaveLength(1);

        vi.mocked(trigger.getBoundingClientRect).mockReturnValue(domRect({
            left: 620, top: 460, width: 60, height: 30,
        }));
        setViewport(700, 500);
        fireEvent(window, new Event("resize"));
        expect(dialog.style.getPropertyValue("--rg-dialog-top")).toBe("184px");
        expect(dialog.style.getPropertyValue("--rg-dialog-right")).toBe("20px");

        vi.mocked(trigger.getBoundingClientRect).mockReturnValue(domRect({
            left: 300, top: 100, width: 80, height: 40,
        }));
        fireEvent(document.body, new Event("scroll"));
        expect(dialog.style.getPropertyValue("--rg-dialog-top")).toBe("140px");

        act(() => media.set(MOBILE_QUERY, true));
        expect(dialog).toHaveAttribute("data-surface", "sheet");
        expect(screen.getAllByTestId("stateful-child")).toHaveLength(1);
        expect(trigger).toHaveAttribute("aria-expanded", "true");

        act(() => media.set(MOBILE_QUERY, false));
        expect(dialog).toHaveAttribute("data-surface", "popover");
        expect(screen.getAllByTestId("stateful-child")).toHaveLength(1);

        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        act(() => media.set(MOBILE_QUERY, true));
        expect(dialog).toHaveAttribute("data-surface", "popover");
        fireEvent.click(trigger);
        expect(dialog).toHaveAttribute("data-surface", "sheet");
        expect(screen.getAllByTestId("stateful-child")).toHaveLength(1);
    });

    it("桌面内容尺寸变化时用未变换布局尺寸重新夹紧", () => {
        installEnvironment({ width: 700, height: 500 });
        let notifyResize: () => void = () => {};
        const observedTargets: Element[] = [];
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: ResizeObserverCallback) {
                notifyResize = () => callback([], this as unknown as ResizeObserver);
            }

            observe(target: Element) {
                observedTargets.push(target);
            }
            disconnect() {}
        });
        const { container } = renderPanel();
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);
        const panel = panelElement(container);
        let panelHeight = 100;
        vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(domRect({
            left: 540, top: 400, width: 80, height: 30,
        }));
        vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(domRect({
            left: 0, top: 0, width: 288, height: 96,
        }));
        Object.defineProperties(panel, {
            offsetWidth: { configurable: true, value: 300 },
            offsetHeight: { configurable: true, get: () => panelHeight },
        });

        fireEvent.click(trigger);
        expect(observedTargets).toContain(panel);
        expect(dialog.style.getPropertyValue("--rg-dialog-top")).toBe("384px");
        expect(dialog.style.getPropertyValue("--rg-dialog-right")).toBe("80px");

        panelHeight = 260;
        act(() => notifyResize());
        expect(dialog.style.getPropertyValue("--rg-dialog-top")).toBe("224px");
    });

    it("桌面关闭弹簧可由对话框内的同一控件反向", () => {
        const { frames } = installEnvironment({ reducedMotion: false });
        const onStateChange = vi.fn();
        const { container } = renderPanel({ onStateChange });
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);

        fireEvent.click(trigger);
        frames.flush();
        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        frames.step(2);

        const cancelClose = screen.getByRole("button", { name: "取消关闭筛选与显示" });
        expect(cancelClose).toBeVisible();
        fireEvent.click(cancelClose);
        frames.flush();

        expect(dialog).toHaveAttribute("open");
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(dialog.style.getPropertyValue("--rg-popover-scale")).toBe("1");
        expect(onStateChange.mock.calls.filter(([nextOpen]) => nextOpen === false)).toHaveLength(0);
    });

    it("关闭弹簧跨响应式断点后继续关闭并保留原原因", () => {
        const { media, frames } = installEnvironment({ reducedMotion: false });
        const onStateChange = vi.fn();
        const { container } = renderPanel({ onStateChange });
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);

        fireEvent.click(trigger);
        frames.flush();
        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        frames.step(2);
        act(() => media.set(MOBILE_QUERY, true));
        expect(dialog).toHaveAttribute("data-surface", "sheet");

        frames.flush();
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "sheet",
            reason: "close_button",
        });
    });

    it("关联标题说明、圈定焦点，并精确上报 backdrop、escape、close_button 与 unmount", async () => {
        installEnvironment();
        const onStateChange = vi.fn();
        const { container, unmount } = renderPanel({ onStateChange });
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);
        const panel = panelElement(container);

        expect(trigger).toHaveAttribute("aria-controls", dialog.id);
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(trigger);

        const close = screen.getByRole("button", { name: "关闭筛选与显示" });
        const child = screen.getByTestId("stateful-child");
        expect(dialog).toHaveAccessibleName("筛选与显示");
        expect(dialog).toHaveAccessibleDescription("调整时间轴显示内容");
        expect(close).toHaveFocus();
        expect(onStateChange).toHaveBeenLastCalledWith(true, {
            surface: "popover", reason: "trigger",
        });

        child.focus();
        fireEvent.keyDown(dialog, { key: "Tab" });
        expect(close).toHaveFocus();
        fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
        expect(child).toHaveFocus();

        fireEvent.click(panel);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(dialog);
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "popover", reason: "backdrop",
        });
        await waitFor(() => expect(trigger).toHaveFocus());

        fireEvent.click(trigger);
        const cancel = new Event("cancel", { cancelable: true });
        fireEvent(dialog, cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "popover", reason: "escape",
        });

        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "popover", reason: "close_button",
        });
        const callsAfterNormalClose = onStateChange.mock.calls.length;
        unmount();
        expect(onStateChange).toHaveBeenCalledTimes(callsAfterNormalClose);

        const onUnmount = vi.fn();
        const mounted = renderPanel({ onStateChange: onUnmount });
        fireEvent.click(screen.getByRole("button", { name: "打开筛选" }));
        mounted.unmount();
        expect(onUnmount).toHaveBeenLastCalledWith(false, {
            surface: "popover", reason: "unmount",
        });
        expect(onUnmount.mock.calls.filter(([open]) => open === false)).toHaveLength(1);
    });

    it("移动 sheet 按 1:1 跟手，并在距离边界、取消与失去捕获时正确收口", () => {
        const { frames } = installEnvironment({ mobile: true });
        const onStateChange = vi.fn();
        const { container } = renderPanel({ onStateChange });
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);
        const panel = panelElement(container);
        vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(domRect({
            left: 0, top: 100, width: 400, height: 600,
        }));

        fireEvent.click(trigger);
        const handle = sheetHandle(container);
        expect(handle.tagName).toBe("DIV");
        expect(handle).toHaveAttribute("aria-hidden", "true");
        expect(screen.queryByRole("button", { name: "拖动筛选与显示" })).toBeNull();
        const capture = installPointerCapture(handle);

        pointerEvent(handle, "pointerdown", { button: 1, clientY: 0 });
        pointerEvent(handle, "pointerdown", { isPrimary: false, clientY: 0 });
        expect(capture.setPointerCapture).not.toHaveBeenCalled();

        pointerEvent(handle, "pointerdown", { clientY: 0, timeStamp: 0 });
        pointerEvent(handle, "pointermove", { clientY: 197, timeStamp: 100 });
        frames.step();
        expect(dialog).toHaveAttribute("data-dragging", "true");
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("197px");
        pointerEvent(handle, "pointerup", { clientY: 197, timeStamp: 120 });
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("0px");
        expect(trigger).toHaveAttribute("aria-expanded", "true");

        pointerEvent(handle, "pointerdown", { clientY: 0, timeStamp: 200 });
        pointerEvent(handle, "pointermove", { clientY: 100, timeStamp: 220 });
        frames.step();
        pointerEvent(handle, "pointercancel", { clientY: 100, timeStamp: 230 });
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("0px");
        expect(trigger).toHaveAttribute("aria-expanded", "true");

        pointerEvent(handle, "pointerdown", { clientY: 0, timeStamp: 300 });
        pointerEvent(handle, "pointermove", { clientY: 90, timeStamp: 320 });
        frames.step();
        fireEvent(handle, new Event("lostpointercapture", { bubbles: true }));
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("0px");
        expect(trigger).toHaveAttribute("aria-expanded", "true");

        pointerEvent(handle, "pointerdown", { clientY: 0, timeStamp: 400 });
        pointerEvent(handle, "pointermove", { clientY: 198, timeStamp: 500 });
        frames.step();
        pointerEvent(handle, "pointerup", { clientY: 198, timeStamp: 520 });
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "sheet", reason: "drag",
        });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(capture.releasePointerCapture).toHaveBeenCalled();
    });

    it("关闭动画可从对话框内取消，回弹中重抓从当前呈现位置继续", () => {
        const { frames } = installEnvironment({ mobile: true, reducedMotion: false });
        const onStateChange = vi.fn();
        const { container } = renderPanel({ onStateChange });
        const trigger = screen.getByRole("button", { name: "打开筛选" });
        const dialog = dialogElement(container);
        const panel = panelElement(container);
        vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(domRect({
            left: 0, top: 100, width: 400, height: 600,
        }));

        fireEvent.click(trigger);
        frames.flush();
        fireEvent.click(screen.getByTestId("stateful-child"));
        expect(screen.getByTestId("stateful-child")).toHaveTextContent("子内容 1");

        fireEvent.click(screen.getByRole("button", { name: "关闭筛选与显示" }));
        frames.step(3);
        const interruptedOffset = Number.parseFloat(dialog.style.getPropertyValue("--rg-sheet-offset"));
        expect(interruptedOffset).toBeGreaterThan(0);
        expect(interruptedOffset).toBeLessThan(600);

        fireEvent.click(screen.getByRole("button", { name: "取消关闭筛选与显示" }));
        frames.flush();
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(dialog).toHaveAttribute("open");
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("0px");
        expect(screen.getAllByTestId("stateful-child")).toHaveLength(1);
        expect(screen.getByTestId("stateful-child")).toHaveTextContent("子内容 1");
        expect(onStateChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

        const handle = sheetHandle(container);
        installPointerCapture(handle);
        pointerEvent(handle, "pointerdown", { clientY: 0, timeStamp: 0 });
        pointerEvent(handle, "pointermove", { clientY: 180, timeStamp: 100 });
        frames.step();
        pointerEvent(handle, "pointerup", { clientY: 180, timeStamp: 120 });
        frames.step(2);
        const reboundingOffset = Number.parseFloat(dialog.style.getPropertyValue("--rg-sheet-offset"));
        expect(reboundingOffset).toBeGreaterThan(0);

        pointerEvent(handle, "pointerdown", { clientY: 200, timeStamp: 140 });
        pointerEvent(handle, "pointermove", { clientY: 210, timeStamp: 150 });
        frames.step();
        expect(Number.parseFloat(dialog.style.getPropertyValue("--rg-sheet-offset")))
            .toBeGreaterThan(10);
        pointerEvent(handle, "pointercancel", { clientY: 210, timeStamp: 160 });
        frames.flush();
        expect(dialog.style.getPropertyValue("--rg-sheet-offset")).toBe("0px");
        expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it("reduced motion 立即到端点，render prop 可用 action 原因关闭", () => {
        installEnvironment({ mobile: true, reducedMotion: true });
        const onStateChange = vi.fn();
        const { container } = renderPanel({
            onStateChange,
            children: ({ close, surface }) => (
                <button type="button" onClick={close}>提交 {surface}</button>
            ),
        });
        const dialog = dialogElement(container);

        fireEvent.click(screen.getByRole("button", { name: "打开筛选" }));
        expect(dialog.style.getPropertyValue("--rg-motion-progress")).toBe("1");
        fireEvent.click(screen.getByRole("button", { name: "提交 sheet" }));
        expect(dialog.style.getPropertyValue("--rg-motion-progress")).toBe("0");
        expect(onStateChange).toHaveBeenLastCalledWith(false, {
            surface: "sheet", reason: "action",
        });
    });

    it("StrictMode 不制造虚假卸载，并在真正卸载时调用最新回调", () => {
        installEnvironment();
        const firstCallback = vi.fn();
        const latestCallback = vi.fn();
        const renderTree = (callback: typeof firstCallback) => (
            <StrictMode>
                <AdaptiveDialogPanel
                    title="筛选与显示"
                    description="调整时间轴显示内容"
                    trigger={({ ref, ...triggerProps }) => (
                        <button ref={ref} type="button" {...triggerProps}>严格模式触发器</button>
                    )}
                    onStateChange={callback}
                >
                    <button type="button">内容操作</button>
                </AdaptiveDialogPanel>
            </StrictMode>
        );
        const mounted = render(renderTree(firstCallback));
        expect(firstCallback).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "严格模式触发器" }));
        expect(firstCallback).toHaveBeenCalledTimes(1);
        mounted.rerender(renderTree(latestCallback));
        expect(latestCallback).not.toHaveBeenCalled();
        mounted.unmount();

        expect(firstCallback).toHaveBeenCalledTimes(1);
        expect(latestCallback).toHaveBeenCalledTimes(1);
        expect(latestCallback).toHaveBeenCalledWith(false, {
            surface: "popover", reason: "unmount",
        });
    });
});
