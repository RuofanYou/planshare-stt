import * as constants from "./constants"
import Cast from "./Cast"
import Death from "./Death"
import Konva from "konva"
import Resurrection from "./Resurrection"
import type Actor from "../../types/actor"
import type PlayerRow from "./PlayerRow"
import { visibleTimelineLabels } from "./labelLayout"


export default class Player extends Konva.Group {

    row: PlayerRow
    casts: Cast[]
    deaths: Death[]
    resurrections: Resurrection[]
    player_data: Actor

    constructor(row: PlayerRow, player_data: Actor) {
        super()
        this.row = row
        this.transformsEnabled("position")

        this.clip({
            x: 0,
            y: 1,
            width: this.row.duration * constants.DEFAULT_ZOOM,
            height: constants.LINE_HEIGHT,
        })

        this.player_data = player_data

        // load casts
        this.casts = (player_data.casts || []).map(cast_data => new Cast(cast_data))
        this.casts = this.casts.filter(cast => cast.spell)

        // sub events
        this.deaths = (player_data.deaths || []).map(death_data => new Death(player_data, death_data))
        this.resurrections = (player_data.resurrects || []).map(resurrect_data => new Resurrection(player_data, resurrect_data))
        this.layout_children()
    }

    layout_children() {

        this.casts.forEach(cast => {

            if (cast.spell && cast.visible()) {

                // add cast if its not added yet
                if (cast.getParent() == undefined) {
                    this.add(cast)
                }

                // move one after the other to the top/
                // assuming they are sorted by time.. this should fix overlaps
                cast.moveToTop()

            } else { // dont show

                // remove cast if its currently added
                if (cast.getParent() != undefined) {
                    cast.remove()
                }
            }
        })

        this.deaths.forEach(event => { this.add(event) })
        this.resurrections.forEach(event => { this.add(event) })
        this.layout_cast_labels()
    }

    layout_cast_labels() {
        const candidates = this.casts.filter(cast => (
            cast.visible()
            && cast.label_requested_visible
            && cast.cast_text
        ))
        const boxes = candidates.map(cast => {
            const text = cast.cast_text!
            const left = cast.x() + text.x()
            return { left, right: left + text.width() }
        })
        const iconBoxes = this.casts
            .filter(cast => cast.visible() && cast.cast_icon?.isVisible())
            .map(cast => {
                const icon = cast.cast_icon!
                const left = cast.x() + icon.x()
                return { left, right: left + icon.width() }
            })
        const visible = visibleTimelineLabels(boxes, 4, iconBoxes)

        this.casts.forEach(cast => cast.set_timeline_label_visible(false))
        candidates.forEach((cast, index) => cast.set_timeline_label_visible(visible[index]))
    }

    schedule_cache() {

        this.clearCache() // clear to make sure we update (even if eg: all children are hidden)
        if (this.hasChildren()) {
            this.cache() // TODO: add throttle?
        }
        return
    }

    //////////////////////////////
    // Events
    //

    _handle_spell_display() {
        this.layout_children()
    }

    _handle_zoom_change(scale_x: number) {
        this.clipWidth((this.row.duration * scale_x) - 1)  // 1px to allow border to show
    }

    handle_event(event_name: string, payload: any) {
        if (event_name === constants.EVENT_ZOOM_CHANGE) { this._handle_zoom_change(payload) }
        this.casts.forEach(cast => cast.handle_event(event_name, payload))
        this.deaths.forEach(event => event.handle_event(event_name, payload))
        this.resurrections.forEach(event => event.handle_event(event_name, payload))

        if (
            event_name === constants.EVENT_ZOOM_CHANGE
            || event_name === constants.EVENT_DISPLAY_SETTINGS
            || event_name === constants.EVENT_SPELL_SELECTED
        ) {
            this.layout_cast_labels()
        }

        // after cast update, so we can handle the cast visibility in there
        if (event_name === constants.EVENT_SPELL_DISPLAY) { this._handle_spell_display() }

        this.schedule_cache()
    }
}
