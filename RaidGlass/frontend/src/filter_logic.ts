import type { FilterValues } from "./store/ui"
import type Actor from "./types/actor"
import type Fight from "./types/fight"


function get_date_floor_ms(date_str: string): number {
    return Date.parse(`${date_str}T00:00:00.000Z`)
}


function get_date_ceil_ms(date_str: string): number {
    return Date.parse(`${date_str}T23:59:59.999Z`)
}


function matches_fight_filters(fight: Fight, filters: FilterValues): boolean {
    let fight_duration = fight.duration / 1000  // ms to s
    if (filters.killtime.min && filters.killtime.min > fight_duration) { return false }
    if (filters.killtime.max && filters.killtime.max < fight_duration) { return false }

    if (fight.region && filters.region && filters.region[fight.region] === false) {
        return false
    }

    const from = filters.log_date?.from
    const to = filters.log_date?.to
    if (from || to) {
        if (!fight.start_time) { return false }

        const fight_ms = Date.parse(fight.start_time)
        if (Number.isNaN(fight_ms)) { return false }

        if (from && fight_ms < get_date_floor_ms(from)) { return false }
        if (to && fight_ms > get_date_ceil_ms(to)) { return false }
    }

    return true
}


function is_fight_visible(
    fight: Fight,
    filters: FilterValues,
    spell_display: SpellDisplay,
) {

    if (fight.pinned) { return true }
    if (!matches_fight_filters(fight, filters)) { return false }

    const has_boss = fight.boss && is_player_visible(fight.boss, filters, spell_display)
    return has_boss || fight.players.some(player => (
        is_player_visible(player, filters, spell_display)
    ))
}


export type SpellDisplay = Readonly<Record<number, boolean | undefined>>

export interface TimelineVisibleActor {
    actor: Actor;
    kind: "boss" | "player";
}

export interface TimelineVisibleFight {
    fight: Fight;
    actors: ReadonlyArray<TimelineVisibleActor>;
}

export interface TimelineVisibility {
    fights: ReadonlyArray<TimelineVisibleFight>;
    hiddenPlayerCount: number;
}

function player_has_visible_casts(player: Actor, spell_display: SpellDisplay): boolean {

    return player.casts.some(cast =>
        // can be True or Undefined
        spell_display[cast.id] !== false
    )
}


function matches_player_filters(player: Actor, filters: FilterValues): boolean {
    // TODO: is this still used?
    if (player.role && filters.role[player.role] === false) { return false }
    if (filters.class[player.class_slug] === false) { return false }
    if (filters.spec[player.spec_slug] === false) { return false }
    return true
}


function is_player_content_visible(
    player: Actor,
    filters: FilterValues,
    spell_display: SpellDisplay,
) {
    if (!matches_player_filters(player, filters)) { return false }

    if (filters.hide_empty_rows) {

        // never hide the boss lane
        if (player.class_slug == "boss") {
            return true
        }

        if (!player_has_visible_casts(player, spell_display)) {
            return false
        }
    }

    const casts = player.casts
    return casts.length > 0
}


function is_player_visible(
    player: Actor,
    filters: FilterValues,
    spell_display: SpellDisplay,
) {
    if (player.pinned) { return true }
    return is_player_content_visible(player, filters, spell_display)
}


export function is_fight_content_visible(
    fight: Fight,
    filters: FilterValues,
    spell_display: SpellDisplay,
): boolean {
    if (!matches_fight_filters(fight, filters)) { return false }
    return fight.players.some(player => (
        is_player_content_visible(player, filters, spell_display)
    ))
}


export function buildTimelineVisibility(
    fights: readonly Fight[],
    filters: FilterValues,
    spell_display: SpellDisplay,
): TimelineVisibility {
    const visibleFights: TimelineVisibleFight[] = []
    let hiddenPlayerCount = 0

    fights.forEach(fight => {
        if (!matches_fight_filters(fight, filters)) {
            hiddenPlayerCount += fight.players.length
            return
        }

        const visiblePlayers = fight.players.filter(player => {
            if (is_player_content_visible(player, filters, spell_display)) {
                return true
            }
            hiddenPlayerCount += 1
            return false
        })

        if (visiblePlayers.length === 0) {
            return
        }

        const actors: TimelineVisibleActor[] = []
        if (fight.boss && is_player_content_visible(fight.boss, filters, spell_display)) {
            actors.push({ actor: fight.boss, kind: "boss" })
        }
        visiblePlayers.forEach(player => actors.push({ actor: player, kind: "player" }))
        visibleFights.push({ fight, actors })
    })

    return { fights: visibleFights, hiddenPlayerCount }
}


const FILTERS = {
    is_fight_visible,
    is_player_visible,
}

export default FILTERS
