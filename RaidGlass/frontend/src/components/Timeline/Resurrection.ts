import * as constants from "./constants"
import PlayerEventLine from "./PlayerEventLine"
import type Actor from "../../types/actor"
import type Event from "../../types/event"
import type { EventLineConfig } from "./EventLine"


export default class Resurrection extends PlayerEventLine {

    constructor(player_data: Actor, event_data: Event, config: EventLineConfig = {}) {
        super(player_data, event_data, { ...config, color: "#8cff2e" })
    }

    _get_text_label() {
        return "🠝 " + super._get_text_label()
    }

    _get_text_tooltip() {
        const t = this._get_tooltip_elements()
        return `${t.icon} ${t.time} ${t.source}使用${t.spell}复活${t.player}`
    }

    _handle_display_settings(settings: { [key: string]: boolean }) {
        this.visible(settings.show_deaths)
    }

    handle_event(event_name: string, payload: any) {
        if (event_name === constants.EVENT_DISPLAY_SETTINGS) { this._handle_display_settings(payload) }
        super.handle_event(event_name, payload)
    }
}
