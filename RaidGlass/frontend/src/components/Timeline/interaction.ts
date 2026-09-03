import {
    normalizeWheelDelta,
    rubberband,
} from "../../motion/physicalMotion";
import {
    TIMELINE_MAX_RELEASE_VELOCITY,
    TIMELINE_WHEEL_PAN_RATE,
    TIMELINE_ZOOM_MAX,
    TIMELINE_ZOOM_MIN,
} from "./constants";

export interface PanBounds {
    minX: number;
    maxX: number;
}

export interface WheelLike {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}

export type TimelinePanInput = "pointer" | "trackpad" | "shift-wheel" | "keyboard" | "toolbar";
export type TimelineZoomSource = "wheel" | "keyboard" | "toolbar";
export type TimelineKeyAction = "zoom-in" | "zoom-out" | "reset" | "pan-left" | "pan-right";
export type WheelIntent =
    | { kind: "none" }
    | { kind: "pan"; deltaX: number; input: "trackpad" | "shift-wheel" }
    | { kind: "zoom"; deltaY: number };

export interface ZoomAtAnchorInput {
    currentX: number;
    oldScale: number;
    requestedScale: number;
    anchorX: number;
    viewportWidth: number;
    contentWidth: number;
}

export interface ZoomAtAnchorResult {
    x: number;
    scale: number;
}

export function clampToBounds(value: number, bounds: PanBounds) {
    return Math.min(Math.max(value, bounds.minX), bounds.maxX);
}

export function getPanBounds(viewportWidth: number, contentWidth: number, scale: number): PanBounds {
    return {
        minX: Math.min(0, viewportWidth - contentWidth * scale),
        maxX: 0,
    };
}

export function rubberBandX(rawX: number, bounds: PanBounds, dimension: number) {
    return rubberband(rawX, bounds.minX, bounds.maxX, Math.max(1, dimension));
}

export function getWheelIntent(event: WheelLike, pageSize: number): WheelIntent {
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, pageSize);
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, pageSize);

    if (event.ctrlKey || event.metaKey) return { kind: "zoom", deltaY };
    if (event.shiftKey && deltaY !== 0) {
        return {
            kind: "pan",
            deltaX: -deltaY * TIMELINE_WHEEL_PAN_RATE,
            input: "shift-wheel",
        };
    }

    if (Math.abs(deltaX) < Math.max(2, Math.abs(deltaY) * 0.75)) {
        return { kind: "none" };
    }
    return {
        kind: "pan",
        deltaX: -deltaX * TIMELINE_WHEEL_PAN_RATE,
        input: "trackpad",
    };
}

export function zoomAtAnchor(input: ZoomAtAnchorInput): ZoomAtAnchorResult {
    const scale = Math.min(Math.max(input.requestedScale, TIMELINE_ZOOM_MIN), TIMELINE_ZOOM_MAX);
    const worldX = (input.anchorX - input.currentX) / input.oldScale;
    const rawX = input.anchorX - worldX * scale;
    const bounds = getPanBounds(input.viewportWidth, input.contentWidth, scale);
    return { x: clampToBounds(rawX, bounds), scale };
}

export function limitTimelineVelocity(velocity: number) {
    return Math.min(Math.max(
        velocity,
        -TIMELINE_MAX_RELEASE_VELOCITY,
    ), TIMELINE_MAX_RELEASE_VELOCITY);
}

export function getTimelineKeyAction(key: string): TimelineKeyAction | null {
    if (key === "+" || key === "=") return "zoom-in";
    if (key === "-") return "zoom-out";
    if (key === "0") return "reset";
    if (key === "ArrowLeft") return "pan-left";
    if (key === "ArrowRight") return "pan-right";
    return null;
}
