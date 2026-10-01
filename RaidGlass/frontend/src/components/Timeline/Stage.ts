import Konva from "konva"
import type { StageConfig } from "konva/lib/Stage";

import { recordDiagnostic, type DiagnosticDetails } from "../../diagnostics";
import {
    advanceDampedSpring,
    estimateVelocity,
    isDampedSpringVisuallySettled,
    projectClampedTarget,
    type DampedSpringState,
    type MotionSample,
} from "../../motion/physicalMotion";
import Ruler from "./Ruler"
import * as constants from "./constants";
import FightRow from "./FightRow";
import type Fight from "../../types/fight";
import type Actor from "../../types/actor";
import type { TimelineVisibility } from "../../filter_logic";
import { IMAGES } from "./Cast";
import { MODES } from "../../store/ui";
import { timelineBoxesOverlap } from "./labelLayout";
import {
    clampToBounds,
    getPanBounds,
    getTimelineKeyAction,
    getWheelIntent,
    limitTimelineVelocity,
    rubberBandX,
    zoomAtAnchor,
    type PanBounds,
    type TimelinePanInput,
    type TimelineZoomSource,
    type WheelLike,
} from "./interaction";


// for performance
Konva.autoDrawEnabled = false;


export default class Stage extends Konva.Stage {

    static THROTTLE = 200 // max update rate in ms

    MODE = ""

    scale_x: number

    // bool: true if any spell is selected
    has_selection: boolean

    anchor_ts: number = 0
    anchor_name: string = "pull"

    private rows: FightRow[] = []
    private zoom_listener?: (zoom: number) => void
    private view_listener?: () => void
    private reduced_motion = false
    private interaction_state: "idle" | "pressed" | "dragging" | "inertia" = "idle"
    private motion_frame: number | null = null
    private motion_state: DampedSpringState | null = null
    private motion_target = 0
    private motion_input: TimelinePanInput = "pointer"
    private motion_last_time = 0
    private velocity_samples: MotionSample[] = []
    private wheel_zoom_frame: number | null = null
    private wheel_zoom_delta = 0
    private wheel_zoom_anchor = 0
    private wheel_zoom_listener_timer: ReturnType<typeof setTimeout> | null = null
    private diagnostics_timer: ReturnType<typeof setTimeout> | null = null
    private diagnostics_target?: HTMLElement
    back_layer: Konva.Layer
    main_layer: Konva.Layer
    overlay_layer: Konva.Layer  // general overlays (MouseCrossHair / Timeline Markers)
    overlay_layer2: Konva.Layer  // additional overlays
    ruler: Ruler

    /** Duration of the longest fight. Used to set things such as the the Length of the Ruler and overall width. */
    longest_fight = 0


    constructor(options: StageConfig) {
        super(options);
        this.draggable(false)

        /////////////////////////////////
        // custom attributes
        this.scale_x = constants.DEFAULT_ZOOM

        this.rows = []

        // bool: true if any spell is selected
        this.has_selection = false;

        ////////////////////////////////
        // create layers
        this.back_layer = new Konva.Layer({ listening: false })
        this.add(this.back_layer);

        this.main_layer = new Konva.Layer()
        this.add(this.main_layer);

        this.overlay_layer = new Konva.Layer()
        this.add(this.overlay_layer);

        this.overlay_layer2 = new Konva.Layer()
        this.add(this.overlay_layer2);

        this.ruler = new Ruler(this);
        this.back_layer.add(this.ruler)

        this.on("contextmenu", this.contextmenu)

        this.update_width() // initial update
    }

    get FIGHT_SPACE() {
        // distance between fights in pixels
        if (this.MODE == MODES.SPEC_RANKING) { return -1; }
        if (this.MODE == MODES.COMP_RANKING) { return 10; }
        if (this.MODE == MODES.USER_REPORT) { return 38; } // 1 row + 10px gap

        return -1;
    }

    ////////////////////////////////////////////////////////////////////////////
    // CREATION AND DRAW
    //
    update_width() {
        this.interrupt_all_motion("resize")
        const container = this.container()
        this.width(container.offsetWidth)
        this.clamp_to_bounds()
        this.update_diagnostics()
    }

    private update_collision_diagnostics() {
        let collisions = 0
        let iconCollisions = 0
        let visibleLabels = 0

        this.rows.forEach(fightRow => {
            fightRow.rows.forEach(playerRow => {
                const casts = playerRow.foreground.casts.filter(cast => cast.isVisible())
                const boxes = casts
                    .filter(cast => cast.isVisible() && cast.cast_text?.isVisible())
                    .map(cast => {
                        const text = cast.cast_text!
                        const left = cast.x() + text.x()
                        return { left, right: left + text.width() }
                    })
                    .sort((left, right) => left.left - right.left)
                const iconBoxes = casts
                    .filter(cast => cast.cast_icon?.isVisible())
                    .map(cast => {
                        const icon = cast.cast_icon!
                        const left = cast.x() + icon.x()
                        return { left, right: left + icon.width() }
                    })
                visibleLabels += boxes.length

                boxes.forEach(box => {
                    iconBoxes.forEach(icon => {
                        if (!timelineBoxesOverlap(box, icon)) return
                        iconCollisions += 1
                    })
                })

                boxes.forEach((box, index) => {
                    for (let nextIndex = index + 1; nextIndex < boxes.length; nextIndex += 1) {
                        const next = boxes[nextIndex]
                        if (next.left >= box.right) break
                        const overlap = Math.min(box.right, next.right) - Math.max(box.left, next.left)
                        const overlapRatio = overlap / Math.min(box.right - box.left, next.right - next.left)
                        if (overlapRatio > 0.1) collisions += 1
                    }
                })
            })
        })

        this.write_diagnostics({
            timelineLabelCollisions: String(collisions),
            timelineLabelIconCollisions: String(iconCollisions),
            timelineVisibleLabels: String(visibleLabels),
        })
    }

    private update_interaction_diagnostics() {
        const bounds = this.get_pan_bounds()
        this.write_diagnostics({
            timelinePanX: String(this.x()),
            timelinePanMin: String(bounds.minX),
            timelinePanMax: String(bounds.maxX),
            timelineInput: this.interaction_state,
            timelineMotion: this.motion_state ? "inertia" : "idle",
            timelineReducedMotion: String(this.reduced_motion),
            timelineZoom: String(this.scale_x),
            timelineDuration: String(this.longest_fight ?? 0),
        })
    }

    private write_diagnostics(values: Record<string, string>) {
        const container = this.container()
        Object.assign(container.dataset, values)
        if (this.diagnostics_target && this.diagnostics_target !== container) {
            Object.assign(this.diagnostics_target.dataset, values)
        }
    }

    private update_diagnostics() {
        this.update_collision_diagnostics()
        this.update_interaction_diagnostics()
    }

    private schedule_full_diagnostics() {
        if (this.diagnostics_timer !== null) clearTimeout(this.diagnostics_timer)
        this.diagnostics_timer = setTimeout(() => {
            this.diagnostics_timer = null
            this.update_collision_diagnostics()
        }, constants.TIMELINE_ZOOM_IDLE_MS)
    }

    set_diagnostics_target(target?: HTMLElement) {
        this.diagnostics_target = target
        this.update_diagnostics()
    }

    layout_children() {

        let y = this.ruler.height()

        this.rows.forEach(row => {
            row.y(y)

            const row_height = row.height()
            if (row_height > 0) {
                y += row.height() + this.FIGHT_SPACE + 1 // 1px for border
            }
        })
        this.height(y + 1) // 1 extra to show the border
    }

    ////////////////////////////////////////////////////////////////////////////
    // STANDARD EVENTS
    //

    contextmenu(event: Konva.KonvaEventObject<MouseEvent>) {
        event.evt.preventDefault();
    }

    private get_content_width() {
        const visibleWidths = this.rows
            .filter(row => row.visible() && row.height() > 0)
            .map(row => row.anchor_offset + row.duration)
        return visibleWidths.length > 0 ? Math.max(...visibleWidths) : 0
    }

    get_pan_bounds(): PanBounds {
        return getPanBounds(this.width(), this.get_content_width(), this.scale_x)
    }

    private set_pan_x(x: number, redraw = true) {
        this.x(x)
        this.y(0)
        this.view_listener?.()
        if (redraw) {
            this.update_interaction_diagnostics()
            this.batchDraw()
        }
        return x
    }

    private clamp_to_bounds() {
        return this.set_pan_x(clampToBounds(this.x(), this.get_pan_bounds()))
    }

    private diagnostic_details(
        phase: "pressed" | "released" | "projected" | "interrupted" | "settled",
        input: TimelinePanInput,
        details: DiagnosticDetails = {},
    ): DiagnosticDetails {
        const bounds = this.get_pan_bounds()
        return {
            phase,
            input,
            x: this.x(),
            minX: bounds.minX,
            maxX: bounds.maxX,
            reducedMotion: this.reduced_motion,
            ...details,
        }
    }

    private record_velocity_sample(at: number) {
        this.velocity_samples.push({ value: this.x(), at })
    }

    private cancel_queued_wheel_zoom() {
        if (this.wheel_zoom_frame !== null) cancelAnimationFrame(this.wheel_zoom_frame)
        this.wheel_zoom_frame = null
        this.wheel_zoom_delta = 0
    }

    private cancel_wheel_zoom_listener() {
        if (this.wheel_zoom_listener_timer !== null) {
            clearTimeout(this.wheel_zoom_listener_timer)
        }
        this.wheel_zoom_listener_timer = null
    }

    private sync_zoom_listener(source: TimelineZoomSource) {
        this.cancel_wheel_zoom_listener()
        if (source !== "wheel") {
            this.zoom_listener?.(this.scale_x)
            return
        }
        this.wheel_zoom_listener_timer = setTimeout(() => {
            this.wheel_zoom_listener_timer = null
            this.zoom_listener?.(this.scale_x)
        }, constants.TIMELINE_ZOOM_IDLE_MS)
    }

    private stop_motion(reason: string) {
        if (this.motion_frame === null && this.motion_state === null) return
        if (this.motion_frame !== null) cancelAnimationFrame(this.motion_frame)
        const input = this.motion_input
        this.motion_frame = null
        this.motion_state = null
        this.interaction_state = "idle"
        this.write_diagnostics({ timelineLastMotionStopReason: reason })
        recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
            "interrupted",
            input,
            { reason },
        ))
        this.update_interaction_diagnostics()
    }

    private interrupt_direct_pan(reason: string) {
        if (this.interaction_state !== "pressed" && this.interaction_state !== "dragging") return
        this.velocity_samples = []
        this.interaction_state = "idle"
        recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
            "interrupted",
            "pointer",
            { reason },
        ))
        this.update_interaction_diagnostics()
    }

    private interrupt_all_motion(reason: string) {
        this.stop_motion(reason)
        this.interrupt_direct_pan(reason)
        this.cancel_queued_wheel_zoom()
    }

    begin_direct_pan(at: number) {
        this.interrupt_all_motion("pointerdown")
        this.interaction_state = "pressed"
        this.velocity_samples = []
        this.record_velocity_sample(at)
        recordDiagnostic("timeline_pan_started", this.diagnostic_details("pressed", "pointer"))
        this.update_interaction_diagnostics()
        return this.x()
    }

    update_direct_pan(rawX: number, at: number) {
        if (this.interaction_state !== "pressed" && this.interaction_state !== "dragging") {
            return this.x()
        }
        this.interaction_state = "dragging"
        const bounds = this.get_pan_bounds()
        const presentedX = this.reduced_motion
            ? clampToBounds(rawX, bounds)
            : rubberBandX(rawX, bounds, this.width())
        this.set_pan_x(presentedX)
        this.record_velocity_sample(at)
        return presentedX
    }

    end_direct_pan(at: number) {
        if (this.interaction_state !== "pressed" && this.interaction_state !== "dragging") return
        const wasDragging = this.interaction_state === "dragging"
        this.record_velocity_sample(at)

        if (!wasDragging) {
            this.velocity_samples = []
            this.interaction_state = "idle"
            recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
                "settled",
                "pointer",
                { reason: "tap", velocity: 0 },
            ))
            this.update_interaction_diagnostics()
            return
        }

        const velocity = limitTimelineVelocity(estimateVelocity(this.velocity_samples))
        this.velocity_samples = []
        recordDiagnostic("timeline_pan_started", this.diagnostic_details(
            "released",
            "pointer",
            { velocity },
        ))

        if (this.reduced_motion) {
            this.interaction_state = "idle"
            this.clamp_to_bounds()
            recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
                "settled",
                "pointer",
                { reason: "reduced-motion", velocity: 0 },
            ))
            return
        }
        this.start_motion(velocity, "pointer", at)
    }

    cancel_direct_pan(reason = "pointercancel") {
        if (this.interaction_state === "idle") return
        this.velocity_samples = []
        if (this.interaction_state === "inertia") {
            this.stop_motion(reason)
            this.cancel_queued_wheel_zoom()
            this.clamp_to_bounds()
            return
        }
        this.stop_motion(reason)
        this.cancel_queued_wheel_zoom()
        this.interaction_state = "idle"
        this.clamp_to_bounds()
        recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
            "settled",
            "pointer",
            { reason, velocity: 0 },
        ))
    }

    private start_motion(velocity: number, input: TimelinePanInput, at: number) {
        const bounds = this.get_pan_bounds()
        this.motion_target = projectClampedTarget(
            this.x(),
            velocity,
            bounds.minX,
            bounds.maxX,
        )
        this.motion_state = { value: this.x(), velocity }
        this.motion_input = input
        this.motion_last_time = at
        this.interaction_state = "inertia"
        this.write_diagnostics({
            timelineLastMotionVelocity: String(velocity),
            timelineLastMotionTarget: String(this.motion_target),
            timelineLastMotionStopReason: "pending",
        })
        recordDiagnostic("timeline_pan_started", this.diagnostic_details(
            "projected",
            input,
            { velocity, targetX: this.motion_target },
        ))
        this.motion_frame = requestAnimationFrame(time => this.advance_motion(time))
        this.update_interaction_diagnostics()
    }

    private advance_motion(time: number) {
        if (!this.motion_state) return
        this.motion_state = advanceDampedSpring(
            this.motion_state,
            this.motion_target,
            time - this.motion_last_time,
        )
        this.motion_last_time = time
        this.set_pan_x(this.motion_state.value)

        if (isDampedSpringVisuallySettled(this.motion_state, this.motion_target)) {
            this.set_pan_x(this.motion_target)
            this.finish_motion("settled")
            return
        }
        this.motion_frame = requestAnimationFrame(nextTime => this.advance_motion(nextTime))
    }

    private finish_motion(reason: "settled") {
        const input = this.motion_input
        this.motion_frame = null
        this.motion_state = null
        this.interaction_state = "idle"
        this.write_diagnostics({ timelineLastMotionStopReason: reason })
        this.update_interaction_diagnostics()
        recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
            "settled",
            input,
            { reason },
        ))
    }

    handle_wheel(event: WheelLike, anchorX: number) {
        const intent = getWheelIntent(event, this.width())
        if (intent.kind === "none") return false
        this.stop_motion("wheel")
        this.interrupt_direct_pan("wheel")

        if (intent.kind === "pan") {
            this.cancel_queued_wheel_zoom()
            this.pan_by(intent.deltaX, intent.input)
            return true
        }

        this.wheel_zoom_delta += intent.deltaY
        this.wheel_zoom_anchor = anchorX
        if (this.wheel_zoom_frame === null) {
            this.wheel_zoom_frame = requestAnimationFrame(() => this.flush_wheel_zoom())
        }
        return true
    }

    private flush_wheel_zoom() {
        const deltaY = this.wheel_zoom_delta
        const anchorX = this.wheel_zoom_anchor
        this.wheel_zoom_frame = null
        this.wheel_zoom_delta = 0
        const factor = Math.exp(-deltaY * constants.TIMELINE_WHEEL_ZOOM_SENSITIVITY)
        this.apply_zoom(factor, anchorX, "wheel")
    }

    private apply_zoom(factor: number, anchorX: number, source: TimelineZoomSource) {
        const oldScale = this.scale_x
        const result = zoomAtAnchor({
            currentX: this.x(),
            oldScale,
            requestedScale: oldScale * factor,
            anchorX,
            viewportWidth: this.width(),
            contentWidth: this.get_content_width(),
        })
        this.scale_x = result.scale
        this.set_pan_x(result.x, false)
        this.handle_event(constants.EVENT_ZOOM_CHANGE, this.scale_x)
        this.sync_zoom_listener(source)
        recordDiagnostic("timeline_zoom_applied", {
            source,
            oldScale,
            newScale: this.scale_x,
            anchorX,
        })
        return this.scale_x
    }

    zoom_by(
        factor: number,
        anchor_x: number = this.width() / 2,
        source: TimelineZoomSource = "toolbar",
    ) {
        this.interrupt_all_motion("zoom")
        return this.apply_zoom(factor, anchor_x, source)
    }

    pan_by(delta_x: number, source: TimelinePanInput = "toolbar") {
        this.interrupt_all_motion("pan")
        recordDiagnostic("timeline_pan_started", this.diagnostic_details("pressed", source))
        const nextX = this.set_pan_x(clampToBounds(
            this.x() + delta_x,
            this.get_pan_bounds(),
        ))
        recordDiagnostic("timeline_pan_settled", this.diagnostic_details(
            "settled",
            source,
            { reason: "discrete" },
        ))
        return nextX
    }

    reset_zoom(source: TimelineZoomSource = "toolbar") {
        this.interrupt_all_motion("reset")
        const oldScale = this.scale_x
        this.scale_x = constants.DEFAULT_ZOOM
        this.set_pan_x(0, false)
        this.handle_event(constants.EVENT_ZOOM_CHANGE, this.scale_x)
        this.sync_zoom_listener(source)
        recordDiagnostic("timeline_zoom_applied", {
            source,
            oldScale,
            newScale: this.scale_x,
            anchorX: 0,
        })
        return this.scale_x
    }

    handle_key(key: string) {
        const action = getTimelineKeyAction(key)
        if (!action) return false
        if (action === "zoom-in") {
            this.zoom_by(constants.TIMELINE_ZOOM_STEP, this.width() / 2, "keyboard")
        } else if (action === "zoom-out") {
            this.zoom_by(1 / constants.TIMELINE_ZOOM_STEP, this.width() / 2, "keyboard")
        } else if (action === "reset") {
            this.reset_zoom("keyboard")
        } else if (action === "pan-left") {
            this.pan_by(constants.TIMELINE_KEYBOARD_PAN_STEP, "keyboard")
        } else {
            this.pan_by(-constants.TIMELINE_KEYBOARD_PAN_STEP, "keyboard")
        }
        return true
    }

    set_reduced_motion(reduced: boolean) {
        if (this.reduced_motion === reduced) return
        this.reduced_motion = reduced
        if (reduced) {
            this.interrupt_all_motion("reduced-motion")
            this.clamp_to_bounds()
        }
        this.update_interaction_diagnostics()
    }

    get_view() {
        return { zoom: this.scale_x, time: Math.max(0, -this.x() / this.scale_x) }
    }

    restore_view(view: { zoom: number; time: number }) {
        this.interrupt_all_motion("restore-view")
        this.scale_x = view.zoom
        this.set_pan_x(clampToBounds(-view.time * view.zoom, this.get_pan_bounds()), false)
        this.handle_event(constants.EVENT_ZOOM_CHANGE, this.scale_x)
        this.zoom_listener?.(this.scale_x)
    }

    set_view_listener(listener?: () => void) {
        this.view_listener = listener
    }

    get_zoom() {
        return this.scale_x
    }

    set_zoom_listener(listener?: (zoom: number) => void) {
        this.zoom_listener = listener
        listener?.(this.scale_x)
    }

    ////////////////////////////////////////////////////////////////////////////
    // CUSTOM EVENTS

    _handle_spell_selected(selected_spells: number[]) {
        this.has_selection = selected_spells.length > 0;
    }

    _handle_check_images_loaded() {
        // Emit a EVENT_IMAGES_LOADED event once all images have been loaded.
        // until then, periodically emit new "check"-events
        const images = Object.values(IMAGES)
        const is_loading = images.some(img => !img.complete)
        const images_loaded = !is_loading
        this.write_diagnostics({
            timelineImagesLoaded: String(images_loaded),
        })

        // try again later
        if (is_loading) {
            setTimeout(() => { this.handle_event(constants.EVENT_CHECK_IMAGES_LOADED) }, 200)
            return
        }
        // update now
        this.handle_event(constants.EVENT_IMAGES_LOADED)
    }

    handle_event(event_name: string, payload?: any) {

        const changesPanBounds = event_name === constants.EVENT_ANCHOR_CHANGED
        if (changesPanBounds) this.interrupt_all_motion(event_name)

        if (event_name === constants.EVENT_SPELL_SELECTED) { this._handle_spell_selected(payload) }
        if (event_name === constants.EVENT_CHECK_IMAGES_LOADED) { return this._handle_check_images_loaded() } // return here, as this event should not be passed on

        // pass to children
        this.ruler.handle_event(event_name, payload)
        this.rows.forEach(row => row.handle_event(event_name, payload))

        if (changesPanBounds) this.clamp_to_bounds()

        if (event_name === constants.EVENT_ZOOM_CHANGE) {
            this.update_interaction_diagnostics()
            this.schedule_full_diagnostics()
        } else {
            this.update_diagnostics()
        }
        this.batchDraw() // for now, just assume we need to redraw after every event
    }

    ////////////////////////////////////////////////////////////////////////////

    /**
     * Updates phase marker headers for each fight.
     * Ensures that each phase is only shown once per boss.
     * Subsequent occurrences of the same phase label are hidden.
     * 
     * Note:
     *   for now, this is really only relevant for spec_rankings,
     *   as these use a single boss row + many player rows.
     *   and even then only for cases where top logs skip phases
     *   while other logs still play them
     */
    private _update_phase_marker_headers() {

        // for user reports we can show the phases on each fight,
        // since each one will have its own boss-row
        if (this.MODE == MODES.USER_REPORT) { return; }

        // let seen: Record<string, Record<string, boolean>> = {}
        let seen: { [phase: string]: boolean } = {};

        this.rows.forEach(row => {
            row.phases.forEach(phase => {
                const phase_label = phase._get_text_label()

                if (seen[phase_label]) {
                    phase.show_label(false)
                } else {
                    phase.show_label(true)
                    seen[phase_label] = true
                }
            })
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // LOAD
    //

    apply_visibility(visibility: TimelineVisibility): ReadonlyArray<Actor> {
        this.interrupt_all_motion("apply-visibility")
        const visibleByFight = new Map(
            visibility.fights.map(visibleFight => [visibleFight.fight, visibleFight]),
        )
        const visibleActors: Actor[] = []

        this.rows.forEach(row => {
            const visibleFight = visibleByFight.get(row._fight_data)
            row.visible(Boolean(visibleFight))
            if (!visibleFight) { return }

            const actors = new Set(visibleFight.actors.map(({ actor }) => actor))
            visibleFight.actors.forEach(({ actor }) => visibleActors.push(actor))
            row.rows.forEach(playerRow => {
                playerRow.visible(actors.has(playerRow.foreground.player_data))
            })
            row.layout_children()
        })

        this.layout_children()
        this.clamp_to_bounds()
        this.write_diagnostics({
            timelineVisibleFightRows: String(visibility.fights.length),
            timelineVisibleActorRows: String(visibleActors.length),
            timelineHiddenPlayerRows: String(visibility.hiddenPlayerCount),
        })
        this.batchDraw()
        return visibleActors
    }

    set_fights(new_fights: readonly Fight[]) {

        this.interrupt_all_motion("set-fights")

        // clear any old rows
        this.rows.forEach(row => {
            row.destroy()
        })

        this.longest_fight = 0
        this.rows = []

        // create fresh instances
        new_fights.forEach((fight) => {
            const row = new FightRow(fight)
            this.back_layer.add(row.background)
            this.main_layer.add(row.foreground)
            this.overlay_layer2.add(row.overlay)
            this.longest_fight = Math.max(this.longest_fight, row.duration)

            this.rows.push(row)
        })

        this.layout_children()

        this.ruler.update_duration(this.longest_fight)
        this.handle_event(constants.EVENT_ZOOM_CHANGE, this.scale_x)
        this.handle_event(constants.EVENT_CHECK_IMAGES_LOADED)

        this._update_phase_marker_headers()
        this.clamp_to_bounds()
        this.update_diagnostics()
    }

    set_anchor(ts: number, name: string = "") {
        this.interrupt_all_motion("anchor")
        this.anchor_ts = ts
        this.anchor_name = name

        this.handle_event(constants.EVENT_ANCHOR_CHANGED, this.get_anchor())
    }

    get_anchor(): { ts: number, name: string } {
        return {
            ts: this.anchor_ts,
            name: this.anchor_name,
        }
    }

    destroy() {
        this.interrupt_all_motion("destroy")
        this.cancel_wheel_zoom_listener()
        if (this.diagnostics_timer !== null) clearTimeout(this.diagnostics_timer)
        this.diagnostics_timer = null
        return super.destroy()
    }

}
