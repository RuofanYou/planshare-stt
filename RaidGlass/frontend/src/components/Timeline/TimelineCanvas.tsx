import * as constants from "./constants";
import Stage from "./Stage";
import TimelineTooltip from "./TimelineTooltip";
import { useAppSelector } from "../../store/store_hooks";
import { useRef, useEffect } from "react";
import { ZH_CN } from "../../localization/zhCN";
import type { TimelineVisibility } from "../../filter_logic";
import type Fight from "../../types/fight";
import styles from "./TimelineCanvas.module.scss";

interface ActivePointerGesture {
    pointerId: number;
    captureElement: Element;
    startClientX: number;
    startClientY: number;
    startStageX: number;
    intent: "pending" | "horizontal";
}

export default function TimelineCanvas({
    fights,
    visibility,
    onStageReady,
}: {
    fights: readonly Fight[];
    visibility: TimelineVisibility;
    onStageReady?: (stage: Stage | null) => void;
}) {
    //////////////////////////////////////
    // HOOKS
    //
    const ref = useRef<HTMLDivElement>(null); // container div for the canvas
    const viewport_ref = useRef<HTMLDivElement>(null);
    const stage_ref = useRef<Stage | null>(null); // canvas itself
    const active_pointer_ref = useRef<ActivePointerGesture | null>(null);

    // state vars
    const mode = useAppSelector((state) => state.ui.mode);
    const ui_settings = useAppSelector((state) => state.ui.settings);
    const spell_display = useAppSelector((state) => state.spells.spell_display);
    const selected_spells = useAppSelector((state) => state.spells.selected_spells);

    //////////////////////////////////////
    // Listeners
    //

    // initial creation
    useEffect(() => {
        // dispatch({type: "ui/set_loading", key: "stage", value: true})
        if (!ref.current || !viewport_ref.current) {
            return;
        }
        stage_ref.current = new Stage({ container: ref.current });
        stage_ref.current.set_diagnostics_target(viewport_ref.current);
        onStageReady?.(stage_ref.current);
        const resizeObserver = new ResizeObserver(() => stage_ref.current?.update_width());
        resizeObserver.observe(ref.current);
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncMotionPreference = () => {
            stage_ref.current?.set_reduced_motion(motionPreference.matches);
        };
        syncMotionPreference();
        motionPreference.addEventListener("change", syncMotionPreference);

        const viewport = viewport_ref.current;
        const visual = ref.current;
        const onWheel = (event: WheelEvent) => {
            const anchorX = event.clientX - visual.getBoundingClientRect().left;
            if (!stage_ref.current?.handle_wheel(event, anchorX)) return;
            event.preventDefault();
        };
        viewport.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            viewport.removeEventListener("wheel", onWheel);
            motionPreference.removeEventListener("change", syncMotionPreference);
            resizeObserver.disconnect();
            stage_ref.current?.destroy();
            stage_ref.current = null;
            onStageReady?.(null);
        };
    }, [onStageReady]);

    // Update: ui.mode
    useEffect(() => {
        stage_ref.current!.MODE = mode;
    }, [mode]);

    useEffect(() => {
        stage_ref.current!.set_fights([...fights]);
        stage_ref.current!.handle_event(constants.EVENT_DISPLAY_SETTINGS, ui_settings);
    }, [fights]);

    useEffect(() => {
        stage_ref.current!.apply_visibility(visibility);
    }, [visibility]);

    // Pass trough UI Settings like "show_cooldown", "show_duration"
    useEffect(() => {
        stage_ref.current!.handle_event(constants.EVENT_DISPLAY_SETTINGS, ui_settings);
    }, [ui_settings]);

    // update spell visibility
    useEffect(() => {
        stage_ref.current!.handle_event(constants.EVENT_SPELL_DISPLAY, spell_display);
    }, [spell_display]);

    useEffect(() => {
        stage_ref.current!.handle_event(constants.EVENT_SPELL_SELECTED, selected_spells);
    }, [selected_spells]);

    //////////////////////////////////////
    // Render
    //
    function releasePointerCapture(element: Element, pointerId: number) {
        if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    }

    return (
        <div
            ref={viewport_ref}
            className={`flex-grow-1 ${styles.viewport}`}
            data-testid="timeline-canvas"
            role="region"
            aria-label={ZH_CN.settings.timeline}
            aria-keyshortcuts="ArrowLeft ArrowRight + - 0"
            tabIndex={0}
            onPointerDown={(event) => {
                if (event.button !== 0 || event.isPrimary === false) return;
                event.currentTarget.focus({ preventScroll: true });
                const captureElement = event.target instanceof Element
                    ? event.target
                    : event.currentTarget;
                const startStageX = stage_ref.current?.begin_direct_pan(event.timeStamp);
                if (startStageX === undefined) return;
                active_pointer_ref.current = {
                    pointerId: event.pointerId,
                    captureElement,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    startStageX,
                    intent: "pending",
                };
            }}
            onPointerMove={(event) => {
                const active = active_pointer_ref.current;
                if (!active || active.pointerId !== event.pointerId) return;
                const deltaX = event.clientX - active.startClientX;
                const deltaY = event.clientY - active.startClientY;

                if (active.intent === "pending") {
                    if (Math.max(Math.abs(deltaX), Math.abs(deltaY))
                        < constants.TIMELINE_POINTER_INTENT_THRESHOLD) return;
                    if (Math.abs(deltaY) > Math.abs(deltaX)) {
                        active_pointer_ref.current = null;
                        stage_ref.current?.cancel_direct_pan("vertical-intent");
                        releasePointerCapture(active.captureElement, event.pointerId);
                        return;
                    }
                    active.intent = "horizontal";
                    active.captureElement.setPointerCapture(event.pointerId);
                }

                event.preventDefault();
                stage_ref.current?.update_direct_pan(
                    active.startStageX + deltaX,
                    event.timeStamp,
                );
            }}
            onPointerUp={(event) => {
                const active = active_pointer_ref.current;
                if (!active || active.pointerId !== event.pointerId) return;
                active_pointer_ref.current = null;
                stage_ref.current?.end_direct_pan(event.timeStamp);
                releasePointerCapture(active.captureElement, event.pointerId);
            }}
            onPointerCancel={(event) => {
                const active = active_pointer_ref.current;
                if (!active || active.pointerId !== event.pointerId) return;
                active_pointer_ref.current = null;
                stage_ref.current?.cancel_direct_pan("pointercancel");
                releasePointerCapture(active.captureElement, event.pointerId);
            }}
            onLostPointerCapture={(event) => {
                const active = active_pointer_ref.current;
                if (!active || active.pointerId !== event.pointerId) return;
                active_pointer_ref.current = null;
                stage_ref.current?.cancel_direct_pan("lostpointercapture");
            }}
            onKeyDown={(event) => {
                if (!stage_ref.current?.handle_key(event.key)) return;
                event.preventDefault();
            }}
        >
            <div
                ref={ref}
                className={styles.canvas}
                data-testid="timeline-canvas-visual"
                aria-hidden="true"
            />
            <TimelineTooltip />
        </div>
    );
}
