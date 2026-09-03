import { createRef, StrictMode, type ReactNode, type RefObject } from "react";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    trapDialogTab,
    useModalDialogLifecycle,
} from "./useModalDialogLifecycle";

interface DialogHarnessProps {
    open: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
    returnFocusRef?: RefObject<HTMLElement | null>;
    children?: ReactNode;
}

function DialogHarness({
    open,
    initialFocusRef,
    returnFocusRef,
    children,
}: DialogHarnessProps) {
    const dialogRef = useModalDialogLifecycle({
        open,
        initialFocusRef,
        returnFocusRef,
    });

    return (
        <dialog ref={dialogRef} aria-label="测试窗口" onKeyDown={trapDialogTab}>
            {children}
        </dialog>
    );
}

afterEach(() => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
});

describe("useModalDialogLifecycle", () => {
    it("打开原生 dialog 并聚焦显式初始控件", () => {
        const initialFocusRef = createRef<HTMLButtonElement>();
        const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

        render(
            <DialogHarness open initialFocusRef={initialFocusRef}>
                <button ref={initialFocusRef} type="button">初始操作</button>
            </DialogHarness>,
        );

        const dialog = screen.getByRole("dialog", { name: "测试窗口" });
        expect(showModal).toHaveBeenCalledOnce();
        expect(dialog).toHaveAttribute("open");
        expect(initialFocusRef.current).toHaveFocus();
        expect(document.documentElement.style.overflow).toBe("hidden");
        expect(document.body.style.overflow).toBe("hidden");
    });

    it("初始引用缺失或断开时聚焦首个合格控件", () => {
        const detachedButton = document.createElement("button");
        const detachedRef: RefObject<HTMLElement | null> = { current: detachedButton };

        render(
            <DialogHarness open initialFocusRef={detachedRef}>
                <div hidden><button type="button">隐藏祖先</button></div>
                <div inert><button type="button">惰性祖先</button></div>
                <div style={{ display: "none" }}><button type="button">CSS 隐藏祖先</button></div>
                <button type="button" style={{ visibility: "hidden" }}>CSS 不可见控件</button>
                <input type="hidden" />
                <button type="button" disabled>禁用控件</button>
                <button type="button" tabIndex={-1}>Tab 序列外</button>
                <button type="button">第一个合格操作</button>
                <button type="button">第二个合格操作</button>
            </DialogHarness>,
        );

        expect(screen.getByRole("button", { name: "第一个合格操作" })).toHaveFocus();
    });

    it("只在首尾圈定 Tab，中间控件不拦截", () => {
        render(
            <DialogHarness open>
                <button type="button">第一个操作</button>
                <button type="button">中间操作</button>
                <button type="button">最后一个操作</button>
            </DialogHarness>,
        );

        const dialog = screen.getByRole("dialog", { name: "测试窗口" });
        const first = screen.getByRole("button", { name: "第一个操作" });
        const middle = screen.getByRole("button", { name: "中间操作" });
        const last = screen.getByRole("button", { name: "最后一个操作" });

        const backwards = createEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
        fireEvent(dialog, backwards);
        expect(backwards.defaultPrevented).toBe(true);
        expect(last).toHaveFocus();

        middle.focus();
        const middleTab = createEvent.keyDown(dialog, { key: "Tab" });
        fireEvent(dialog, middleTab);
        expect(middleTab.defaultPrevented).toBe(false);
        expect(middle).toHaveFocus();

        last.focus();
        const forwards = createEvent.keyDown(dialog, { key: "Tab" });
        fireEvent(dialog, forwards);
        expect(forwards.defaultPrevented).toBe(true);
        expect(first).toHaveFocus();
    });

    it("CSS 隐藏控件不参与 Tab 首尾判断", () => {
        render(
            <DialogHarness open>
                <button type="button">可见首项</button>
                <button type="button">可见末项</button>
                <button type="button" style={{ display: "none" }}>隐藏末项</button>
            </DialogHarness>,
        );

        const dialog = screen.getByRole("dialog", { name: "测试窗口" });
        const first = screen.getByRole("button", { name: "可见首项" });
        const last = screen.getByRole("button", { name: "可见末项" });
        last.focus();
        const forwards = createEvent.keyDown(dialog, { key: "Tab" });
        fireEvent(dialog, forwards);

        expect(forwards.defaultPrevented).toBe(true);
        expect(first).toHaveFocus();
    });

    it("open 从 true 变为 false 时只 close 一次并派发一次 DOM close", () => {
        const close = vi.spyOn(HTMLDialogElement.prototype, "close");
        const { container, rerender } = render(
            <DialogHarness open><button type="button">操作</button></DialogHarness>,
        );
        const dialog = container.querySelector("dialog");
        if (!dialog) throw new Error("dialog missing");
        const closeEvent = vi.fn();
        dialog.addEventListener("close", closeEvent);

        rerender(<DialogHarness open={false}><button type="button">操作</button></DialogHarness>);

        expect(close).toHaveBeenCalledOnce();
        expect(closeEvent).toHaveBeenCalledOnce();
        expect(dialog).not.toHaveAttribute("open");
    });

    it("优先恢复显式 returnFocusRef", async () => {
        const returnFocusRef = createRef<HTMLButtonElement>();
        const initialFocusRef = createRef<HTMLButtonElement>();
        const { rerender } = render(
            <>
                <button ref={returnFocusRef} type="button">显式触发元素</button>
                <DialogHarness open initialFocusRef={initialFocusRef} returnFocusRef={returnFocusRef}>
                    <button ref={initialFocusRef} type="button">窗口操作</button>
                </DialogHarness>
            </>,
        );
        const restoreFocus = vi.spyOn(returnFocusRef.current!, "focus");

        rerender(
            <>
                <button ref={returnFocusRef} type="button">显式触发元素</button>
                <DialogHarness open={false} initialFocusRef={initialFocusRef} returnFocusRef={returnFocusRef}>
                    <button ref={initialFocusRef} type="button">窗口操作</button>
                </DialogHarness>
            </>,
        );

        await waitFor(() => {
            expect(restoreFocus).toHaveBeenCalledOnce();
            expect(returnFocusRef.current).toHaveFocus();
        });
    });

    it("未传 returnFocusRef 时恢复打开前 activeElement", async () => {
        const { rerender } = render(
            <>
                <button type="button">打开窗口</button>
                <DialogHarness open={false}><button type="button">窗口操作</button></DialogHarness>
            </>,
        );
        const trigger = screen.getByRole("button", { name: "打开窗口" });
        trigger.focus();

        rerender(
            <>
                <button type="button">打开窗口</button>
                <DialogHarness open><button type="button">窗口操作</button></DialogHarness>
            </>,
        );
        rerender(
            <>
                <button type="button">打开窗口</button>
                <DialogHarness open={false}><button type="button">窗口操作</button></DialogHarness>
            </>,
        );

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "打开窗口" })).toHaveFocus();
        });
    });

    it("StrictMode 重放后仍把焦点留在打开的 dialog", async () => {
        const returnFocusRef = createRef<HTMLButtonElement>();
        const initialFocusRef = createRef<HTMLButtonElement>();

        render(
            <StrictMode>
                <button ref={returnFocusRef} type="button">外部触发元素</button>
                <DialogHarness open initialFocusRef={initialFocusRef} returnFocusRef={returnFocusRef}>
                    <button ref={initialFocusRef} type="button">窗口初始操作</button>
                </DialogHarness>
            </StrictMode>,
        );
        await Promise.resolve();

        expect(initialFocusRef.current).toHaveFocus();
    });

    it("未传 returnFocusRef 时 StrictMode 重放仍恢复首次外部目标", async () => {
        const trigger = document.createElement("button");
        trigger.textContent = "首次外部目标";
        document.body.append(trigger);
        trigger.focus();
        const initialFocusRef = createRef<HTMLButtonElement>();
        const renderDialog = (open: boolean) => (
            <StrictMode>
                <DialogHarness open={open} initialFocusRef={initialFocusRef}>
                    <button ref={initialFocusRef} type="button">StrictMode 窗口操作</button>
                </DialogHarness>
            </StrictMode>
        );

        try {
            const { rerender } = render(renderDialog(true));
            expect(initialFocusRef.current).toHaveFocus();
            rerender(renderDialog(false));
            await waitFor(() => expect(trigger).toHaveFocus());
        } finally {
            trigger.remove();
        }
    });

    it("同一微任务窗口关闭并重开会取消陈旧焦点恢复", async () => {
        const returnFocusRef = createRef<HTMLButtonElement>();
        const initialFocusRef = createRef<HTMLButtonElement>();
        const renderDialog = (open: boolean) => (
            <>
                <button ref={returnFocusRef} type="button">快速重开触发元素</button>
                <DialogHarness open={open} initialFocusRef={initialFocusRef} returnFocusRef={returnFocusRef}>
                    <button ref={initialFocusRef} type="button">快速重开初始操作</button>
                </DialogHarness>
            </>
        );
        const { rerender } = render(renderDialog(true));
        const restoreFocus = vi.spyOn(returnFocusRef.current!, "focus");

        rerender(renderDialog(false));
        rerender(renderDialog(true));
        await Promise.resolve();

        expect(restoreFocus).not.toHaveBeenCalled();
        expect(initialFocusRef.current).toHaveFocus();
    });

    it("恢复目标已断开时不聚焦且不抛错", async () => {
        const returnTarget = document.createElement("button");
        document.body.append(returnTarget);
        const focus = vi.spyOn(returnTarget, "focus");
        const returnFocusRef: RefObject<HTMLElement | null> = { current: returnTarget };
        const { rerender } = render(
            <DialogHarness open returnFocusRef={returnFocusRef}>
                <button type="button">窗口操作</button>
            </DialogHarness>,
        );
        returnTarget.remove();

        expect(() => rerender(
            <DialogHarness open={false} returnFocusRef={returnFocusRef}>
                <button type="button">窗口操作</button>
            </DialogHarness>,
        )).not.toThrow();
        await Promise.resolve();
        expect(focus).not.toHaveBeenCalled();
    });

    it("关闭和打开中卸载都精确恢复 overflow 原字符串", () => {
        document.documentElement.style.overflow = "clip";
        document.body.style.overflow = "scroll";
        const first = render(
            <DialogHarness open><button type="button">操作</button></DialogHarness>,
        );
        expect(document.documentElement.style.overflow).toBe("hidden");
        expect(document.body.style.overflow).toBe("hidden");

        first.rerender(<DialogHarness open={false}><button type="button">操作</button></DialogHarness>);
        expect(document.documentElement.style.overflow).toBe("clip");
        expect(document.body.style.overflow).toBe("scroll");
        first.unmount();

        document.documentElement.style.overflow = "auto";
        document.body.style.overflow = "visible";
        const second = render(
            <DialogHarness open><button type="button">操作</button></DialogHarness>,
        );
        second.unmount();
        expect(document.documentElement.style.overflow).toBe("auto");
        expect(document.body.style.overflow).toBe("visible");
    });

    it("打开中卸载会 close 并恢复仍连接的焦点目标", async () => {
        const returnTarget = document.createElement("button");
        returnTarget.textContent = "卸载后焦点目标";
        document.body.append(returnTarget);
        const returnFocusRef: RefObject<HTMLElement | null> = { current: returnTarget };
        const close = vi.spyOn(HTMLDialogElement.prototype, "close");
        const { unmount } = render(
            <DialogHarness open returnFocusRef={returnFocusRef}>
                <button type="button">窗口操作</button>
            </DialogHarness>,
        );

        try {
            unmount();
            expect(close).toHaveBeenCalledOnce();
            await waitFor(() => expect(returnTarget).toHaveFocus());
        } finally {
            returnTarget.remove();
        }
    });

    it("初始 open=false 无 dialog、滚动或焦点副作用", () => {
        document.documentElement.style.overflow = "clip";
        document.body.style.overflow = "scroll";
        const trigger = document.createElement("button");
        document.body.append(trigger);
        trigger.focus();
        const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
        const close = vi.spyOn(HTMLDialogElement.prototype, "close");

        render(
            <DialogHarness open={false}><button type="button">窗口操作</button></DialogHarness>,
        );

        expect(showModal).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
        expect(document.documentElement.style.overflow).toBe("clip");
        expect(document.body.style.overflow).toBe("scroll");
        expect(trigger).toHaveFocus();
        trigger.remove();
    });
});
