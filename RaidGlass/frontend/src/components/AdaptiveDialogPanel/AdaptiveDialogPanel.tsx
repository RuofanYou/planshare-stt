import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    type RefObject,
} from "react";
import {
    trapDialogTab,
    useModalDialogLifecycle,
} from "../../hooks/useModalDialogLifecycle";
import {
    advanceDampedSpring,
    isDampedSpringSettled,
    isDampedSpringVisuallySettled,
} from "../../motion/physicalMotion";
import {
    rubberbandSheetOffset,
    sheetReleaseVelocity,
    shouldDismissSheet,
    type SheetSample,
} from "./sheetMotion";
import styles from "./AdaptiveDialogPanel.module.scss";

export type AdaptiveDialogSurface = "popover" | "sheet";
export type AdaptiveDialogReason =
    | "trigger"
    | "close_button"
    | "escape"
    | "backdrop"
    | "drag"
    | "action"
    | "unmount";

export interface AdaptiveDialogTransition {
    surface: AdaptiveDialogSurface;
    reason: AdaptiveDialogReason;
}

export interface AdaptiveDialogTriggerProps {
    ref: RefObject<HTMLButtonElement | null>;
    "aria-controls": string;
    "aria-expanded": boolean;
    onClick: () => void;
}

export interface AdaptiveDialogRenderContext {
    close: () => void;
    surface: AdaptiveDialogSurface;
}

export interface AdaptiveDialogPanelProps {
    title: string;
    description: string;
    trigger: (props: AdaptiveDialogTriggerProps) => ReactNode;
    children: ReactNode | ((context: AdaptiveDialogRenderContext) => ReactNode);
    onStateChange?: (
        open: boolean,
        transition: AdaptiveDialogTransition,
    ) => void;
}

interface MotionRuntime {
    value: number;
    velocity: number;
    target: number;
    frameId: number | null;
    lastFrameAt: number | null;
    generation: number;
}

interface SheetGesture {
    pointerId: number;
    handle: HTMLDivElement;
    startY: number;
    startOffset: number;
    height: number;
    samples: SheetSample[];
    pendingY: number;
    moveFrameId: number | null;
}

const MOBILE_MEDIA_QUERY = "(max-width: 959px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const VIEWPORT_MARGIN_PX = 16;
const MAX_FRAME_ELAPSED_MS = 64;

function readSurface(): AdaptiveDialogSurface {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "popover";
    }
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? "sheet" : "popover";
}

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

function cssNumber(value: number): string {
    if (Math.abs(value) < 0.000001) return "0";
    if (Math.abs(value - 1) < 0.000001) return "1";
    return `${value}`;
}

export function AdaptiveDialogPanel({
    title,
    description,
    trigger,
    children,
    onStateChange,
}: AdaptiveDialogPanelProps) {
    const reactId = useId();
    const dialogId = `adaptive-dialog-${reactId}`;
    const titleId = `${dialogId}-title`;
    const descriptionId = `${dialogId}-description`;
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [surface, setSurface] = useState<AdaptiveDialogSurface>("popover");
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const interruptButtonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const openRef = useRef(false);
    const surfaceRef = useRef<AdaptiveDialogSurface>(surface);
    const latestOnStateChangeRef = useRef(onStateChange);
    const closingReasonRef = useRef<AdaptiveDialogReason | null>(null);
    const gestureRef = useRef<SheetGesture | null>(null);
    const motionRef = useRef<MotionRuntime>({
        value: 0,
        velocity: 0,
        target: 0,
        frameId: null,
        lastFrameAt: null,
        generation: 0,
    });

    surfaceRef.current = surface;
    latestOnStateChangeRef.current = onStateChange;

    const dialogRef = useModalDialogLifecycle({
        open,
        initialFocusRef: closeButtonRef,
        returnFocusRef: triggerRef,
    });

    const sheetHeight = useCallback((): number => {
        const measured = panelRef.current?.getBoundingClientRect().height ?? 0;
        if (measured > 0) return measured;
        if (typeof window === "undefined") return 1;
        return Math.max(1, Math.min(window.innerHeight * 0.8, 44 * 16));
    }, []);

    const writePresentation = useCallback((value: number): void => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        dialog.style.setProperty("--rg-motion-progress", cssNumber(value));
        const popoverProgress = clamp(value, 0, 1);
        const popoverOffset = Math.round((1 - popoverProgress) * -8000) / 1000;
        const popoverScale = 0.96 + popoverProgress * 0.04;
        dialog.style.setProperty("--rg-popover-offset", `${popoverOffset}px`);
        dialog.style.setProperty("--rg-popover-scale", cssNumber(popoverScale));
        const offset = surfaceRef.current === "sheet"
            ? (1 - value) * sheetHeight()
            : 0;
        const renderedOffset = Math.abs(offset) < 0.000001
            ? 0
            : Math.round(offset * 1000) / 1000;
        dialog.style.setProperty(
            "--rg-sheet-offset",
            `${renderedOffset}px`,
        );
    }, [dialogRef, sheetHeight]);

    const cancelMotionFrame = useCallback((): void => {
        const motion = motionRef.current;
        motion.generation += 1;
        if (motion.frameId !== null) cancelAnimationFrame(motion.frameId);
        motion.frameId = null;
        motion.lastFrameAt = null;
    }, []);

    const clearGesture = useCallback((): SheetGesture | null => {
        const gesture = gestureRef.current;
        if (!gesture) return null;
        gestureRef.current = null;
        if (gesture.moveFrameId !== null) cancelAnimationFrame(gesture.moveFrameId);
        gesture.moveFrameId = null;
        dialogRef.current?.removeAttribute("data-dragging");
        if (
            typeof gesture.handle.hasPointerCapture === "function"
            && gesture.handle.hasPointerCapture(gesture.pointerId)
            && typeof gesture.handle.releasePointerCapture === "function"
        ) {
            gesture.handle.releasePointerCapture(gesture.pointerId);
        }
        return gesture;
    }, [dialogRef]);

    const finishClose = useCallback((reason: AdaptiveDialogReason): void => {
        if (!openRef.current) return;
        openRef.current = false;
        closingReasonRef.current = null;
        setClosing(false);
        setOpen(false);
        latestOnStateChangeRef.current?.(false, {
            surface: surfaceRef.current,
            reason,
        });
    }, []);

    const startSpring = useCallback((
        target: 0 | 1,
        closeReason: AdaptiveDialogReason | null = null,
    ): void => {
        cancelMotionFrame();
        const motion = motionRef.current;
        motion.target = target;
        writePresentation(motion.value);

        if (prefersReducedMotion()) {
            motion.value = target;
            motion.velocity = 0;
            writePresentation(target);
            if (target === 0 && closeReason) finishClose(closeReason);
            return;
        }

        const generation = motion.generation;
        const tick = (frameAt: number): void => {
            if (motion.generation !== generation) return;
            const elapsed = motion.lastFrameAt === null
                ? 1000 / 60
                : clamp(frameAt - motion.lastFrameAt, 1, MAX_FRAME_ELAPSED_MS);
            motion.lastFrameAt = frameAt;
            const next = advanceDampedSpring(motion, target, elapsed);
            motion.value = next.value;
            motion.velocity = next.velocity;
            writePresentation(motion.value);

            if (
                isDampedSpringSettled(motion, target)
                || (target === 0 && closeReason && isDampedSpringVisuallySettled(motion, target))
            ) {
                motion.value = target;
                motion.velocity = 0;
                motion.frameId = null;
                motion.lastFrameAt = null;
                writePresentation(target);
                if (target === 0 && closeReason) finishClose(closeReason);
                return;
            }
            motion.frameId = requestAnimationFrame(tick);
        };
        motion.frameId = requestAnimationFrame(tick);
    }, [cancelMotionFrame, finishClose, writePresentation]);

    const positionPopover = useCallback((): void => {
        if (!openRef.current || surfaceRef.current !== "popover") return;
        const dialog = dialogRef.current;
        const triggerElement = triggerRef.current;
        const panel = panelRef.current;
        if (!dialog || !triggerElement || !panel) return;

        const triggerRect = triggerElement.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = panel.offsetWidth || panelRect.width;
        const panelHeight = panel.offsetHeight || panelRect.height;
        const maximumLeft = Math.max(
            VIEWPORT_MARGIN_PX,
            window.innerWidth - panelWidth - VIEWPORT_MARGIN_PX,
        );
        const maximumTop = Math.max(
            VIEWPORT_MARGIN_PX,
            window.innerHeight - panelHeight - VIEWPORT_MARGIN_PX,
        );
        const left = clamp(
            triggerRect.right - panelWidth,
            VIEWPORT_MARGIN_PX,
            maximumLeft,
        );
        const top = clamp(triggerRect.bottom, VIEWPORT_MARGIN_PX, maximumTop);
        const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - left - panelWidth);
        const originX = clamp(
            triggerRect.left + triggerRect.width / 2 - left,
            0,
            panelWidth,
        );
        const originY = clamp(triggerRect.bottom - top, 0, panelHeight);

        dialog.style.setProperty("--rg-dialog-top", `${top}px`);
        dialog.style.setProperty("--rg-dialog-right", `${right}px`);
        dialog.style.setProperty("--rg-dialog-origin-x", `${originX}px`);
        dialog.style.setProperty("--rg-dialog-origin-y", `${originY}px`);
    }, [dialogRef]);

    const requestClose = useCallback((reason: AdaptiveDialogReason): void => {
        if (!openRef.current) return;
        clearGesture();
        closingReasonRef.current = reason;
        setClosing(true);
        startSpring(0, reason);
    }, [clearGesture, startSpring]);

    const interruptClose = useCallback((): boolean => {
        if (!openRef.current || !closingReasonRef.current) return false;
        closingReasonRef.current = null;
        setClosing(false);
        startSpring(1);
        return true;
    }, [startSpring]);

    const openPanel = useCallback((): void => {
        if (openRef.current) {
            interruptClose();
            return;
        }
        const nextSurface = readSurface();
        surfaceRef.current = nextSurface;
        setSurface(nextSurface);
        openRef.current = true;
        setOpen(true);
        latestOnStateChangeRef.current?.(true, {
            surface: nextSurface,
            reason: "trigger",
        });
    }, [interruptClose]);

    const handleTriggerClick = useCallback((): void => {
        if (!openRef.current || closingReasonRef.current) {
            openPanel();
            return;
        }
        requestClose("trigger");
    }, [openPanel, requestClose]);

    const applyGesturePosition = useCallback((gesture: SheetGesture, clientY: number): number => {
        const rawOffset = gesture.startOffset + clientY - gesture.startY;
        const offset = rubberbandSheetOffset(rawOffset, gesture.height);
        const motion = motionRef.current;
        motion.value = 1 - offset / gesture.height;
        motion.velocity = 0;
        writePresentation(motion.value);
        return offset;
    }, [writePresentation]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        if (
            surfaceRef.current !== "sheet"
            || !openRef.current
            || !event.isPrimary
            || event.button !== 0
        ) return;

        clearGesture();
        cancelMotionFrame();
        closingReasonRef.current = null;
        setClosing(false);
        const height = sheetHeight();
        const motion = motionRef.current;
        const gesture: SheetGesture = {
            pointerId: event.pointerId,
            handle: event.currentTarget,
            startY: event.clientY,
            startOffset: (1 - motion.value) * height,
            height,
            samples: [{ y: event.clientY, at: event.timeStamp }],
            pendingY: event.clientY,
            moveFrameId: null,
        };
        gestureRef.current = gesture;
        dialogRef.current?.setAttribute("data-dragging", "true");
        if (typeof event.currentTarget.setPointerCapture === "function") {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }, [cancelMotionFrame, clearGesture, dialogRef, sheetHeight]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        gesture.pendingY = event.clientY;
        gesture.samples.push({ y: event.clientY, at: event.timeStamp });
        const cutoff = event.timeStamp - 160;
        while (gesture.samples.length > 2 && gesture.samples[1].at < cutoff) {
            gesture.samples.shift();
        }
        if (gesture.moveFrameId !== null) return;
        gesture.moveFrameId = requestAnimationFrame(() => {
            if (gestureRef.current !== gesture) return;
            gesture.moveFrameId = null;
            applyGesturePosition(gesture, gesture.pendingY);
        });
    }, [applyGesturePosition]);

    const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        gesture.samples.push({ y: event.clientY, at: event.timeStamp });
        if (gesture.moveFrameId !== null) cancelAnimationFrame(gesture.moveFrameId);
        gesture.moveFrameId = null;
        const offsetY = applyGesturePosition(gesture, event.clientY);
        const velocityY = sheetReleaseVelocity(gesture.samples);
        clearGesture();

        const motion = motionRef.current;
        motion.velocity = -velocityY / gesture.height;
        if (shouldDismissSheet({ offsetY, velocityY, height: gesture.height })) {
            closingReasonRef.current = "drag";
            startSpring(0, "drag");
            return;
        }
        startSpring(1);
    }, [applyGesturePosition, clearGesture, startSpring]);

    const cancelPointerGesture = useCallback((): void => {
        if (!gestureRef.current) return;
        clearGesture();
        startSpring(1);
    }, [clearGesture, startSpring]);

    const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        if (gestureRef.current?.pointerId !== event.pointerId) return;
        cancelPointerGesture();
    }, [cancelPointerGesture]);

    const handleLostPointerCapture = useCallback((): void => {
        cancelPointerGesture();
    }, [cancelPointerGesture]);

    const handleCancel = useCallback((event: ReactKeyboardEvent<HTMLDialogElement>): void => {
        event.preventDefault();
        requestClose("escape");
    }, [requestClose]);

    useLayoutEffect(() => {
        if (!open) return;
        positionPopover();
        const closingReason = closingReasonRef.current;
        startSpring(closingReason ? 0 : 1, closingReason);
    }, [open, positionPopover, startSpring, surface]);

    useLayoutEffect(() => {
        if (!closing || surface !== "popover") return;
        interruptButtonRef.current?.focus({ preventScroll: true });
    }, [closing, surface]);

    useEffect(() => {
        if (!open || typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleSurfaceChange = (): void => {
            const nextSurface: AdaptiveDialogSurface = mediaQuery.matches ? "sheet" : "popover";
            if (nextSurface === surfaceRef.current) return;
            clearGesture();
            cancelMotionFrame();
            surfaceRef.current = nextSurface;
            writePresentation(motionRef.current.value);
            setSurface(nextSurface);
        };
        const handleViewportChange = (): void => {
            if (surfaceRef.current === "popover") positionPopover();
            else writePresentation(motionRef.current.value);
        };

        mediaQuery.addEventListener("change", handleSurfaceChange);
        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("scroll", handleViewportChange, true);
        const resizeObserver = typeof ResizeObserver === "function"
            ? new ResizeObserver(handleViewportChange)
            : null;
        if (panelRef.current) resizeObserver?.observe(panelRef.current);
        return () => {
            mediaQuery.removeEventListener("change", handleSurfaceChange);
            window.removeEventListener("resize", handleViewportChange);
            window.removeEventListener("scroll", handleViewportChange, true);
            resizeObserver?.disconnect();
        };
    }, [cancelMotionFrame, clearGesture, open, positionPopover, writePresentation]);

    useEffect(() => () => {
        clearGesture();
        cancelMotionFrame();
        if (!openRef.current) return;
        openRef.current = false;
        latestOnStateChangeRef.current?.(false, {
            surface: surfaceRef.current,
            reason: "unmount",
        });
    }, [cancelMotionFrame, clearGesture]);

    const handleDialogClick = useCallback((event: React.MouseEvent<HTMLDialogElement>): void => {
        if (event.target === event.currentTarget) requestClose("backdrop");
    }, [requestClose]);

    const closeFromAction = useCallback((): void => {
        requestClose("action");
    }, [requestClose]);

    const renderedChildren = typeof children === "function"
        ? children({ close: closeFromAction, surface })
        : children;

    return (
        <>
            {trigger({
                ref: triggerRef,
                "aria-controls": dialogId,
                "aria-expanded": open,
                onClick: handleTriggerClick,
            })}
            <dialog
                ref={dialogRef}
                id={dialogId}
                className={styles.dialog}
                data-surface={surface}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-modal="true"
                onCancel={handleCancel}
                onClick={handleDialogClick}
                onKeyDown={trapDialogTab}
                style={{
                    "--rg-motion-progress": "0",
                    "--rg-sheet-offset": "0px",
                    "--rg-popover-offset": "-8px",
                    "--rg-popover-scale": "0.96",
                } as React.CSSProperties}
            >
                <div ref={panelRef} className={styles.panel} data-adaptive-dialog-panel>
                    <div
                        className={styles.dragHandle}
                        aria-hidden="true"
                        data-sheet-drag-handle
                        hidden={surface !== "sheet"}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onLostPointerCapture={handleLostPointerCapture}
                    >
                        <span />
                    </div>
                    <header className={styles.header}>
                        <div className={styles.heading}>
                            <h2 id={titleId}>{title}</h2>
                            <p id={descriptionId}>{description}</p>
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className={styles.closeButton}
                            aria-label={closing ? `取消关闭${title}` : `关闭${title}`}
                            aria-hidden={closing && surface === "popover" ? "true" : undefined}
                            tabIndex={closing && surface === "popover" ? -1 : undefined}
                            data-dialog-close-control
                            onClick={() => {
                                if (!interruptClose()) requestClose("close_button");
                            }}
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </header>
                    <div className={styles.content}>{renderedChildren}</div>
                </div>
                {closing && surface === "popover" && (
                    <button
                        ref={interruptButtonRef}
                        type="button"
                        className={`${styles.closeButton} ${styles.interruptCloseButton}`}
                        aria-label={`取消关闭${title}`}
                        data-dialog-interrupt-control
                        onClick={interruptClose}
                    >
                        <span aria-hidden="true">↶</span>
                    </button>
                )}
            </dialog>
        </>
    );
}
