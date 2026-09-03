
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type Boss from "../types/boss"
import type { AppDispatch, RootState } from './store'
import { fetch_data } from '../api'
import { group_spells_by_type } from './store_utils'
import { ASSETS } from '../constants'
import type RaidZone from '../types/raid_zone'
import { catalogsAccepted } from './catalogCommit'
import {
    assertUnique,
    expectArray,
    expectFiniteNumber,
    expectNonEmptyString,
    expectRecord,
    expectRouteSegment,
} from './catalogValidation'


// TODO:
// Split Zones and Bosses Slices?


////////////////////////////////////////////////////////////////////////////////
// Selectors
//

export function get_zones(state: RootState) {
    // Always return zones sorted by numeric `id` so UI ordering is stable.
    return Object.values(state.zones.zones).sort((a, b) => a.id - b.id)
}

export function get_zone(state: RootState, zone_id: number) {
    return state.zones.zones[zone_id]
}


/** all bosses in the zone, keyed by their full_name_slug */
export function get_bosses(state: RootState) {
    return state.zones.bosses
}


/** a single boss from the zone (defaults to the currently selected boss) */
export function get_boss(state: RootState, boss_slug?: string) {
    boss_slug = boss_slug ?? state.ui.boss_slug
    return state.zones.bosses[boss_slug] || null
}

export function get_default_boss(state: RootState): Boss | null {

    // todo: if state.default_boss:
    return Object.values(state.zones.bosses)[0]
}



////////////////////////////////////////////////////////////////////////////////
// Slice
//

export interface BossCatalogEntry {
    id: number
    name: string
    full_name: string
    full_name_slug: string
    icon: string
    phase_type: "static" | "dynamic"
}

export interface RaidZoneCatalogEntry {
    id: number
    name: string
    name_slug: string
    bosses: BossCatalogEntry[]
}

export type BossCatalogPayload = RaidZoneCatalogEntry[]

const INITIAL_STATE = {
    zones: {} as { [key: number]: RaidZone },
    bosses: {} as { [key: string]: Boss },
}

type ZonesSliceState = typeof INITIAL_STATE

function replaceZones(payload: BossCatalogPayload): ZonesSliceState {
    const state: ZonesSliceState = { zones: {}, bosses: {} }

    payload.forEach((zoneEntry) => {
        const zone: RaidZone = {
            id: zoneEntry.id,
            name: zoneEntry.name,
            name_slug: zoneEntry.name_slug,
            bosses: zoneEntry.bosses.map((boss) => boss.full_name_slug),
        }
        state.zones[zone.id] = zone

        zoneEntry.bosses.forEach((bossEntry) => {
            const icon_path = `${ASSETS}/images/spells/${bossEntry.icon}`
            const boss: Boss = {
                id: bossEntry.id,
                index: null,
                class: { name: "boss", name_slug: "boss" },
                role: "boss",
                name: bossEntry.name,
                full_name: bossEntry.full_name,
                full_name_slug: bossEntry.full_name_slug,
                icon: bossEntry.icon,
                icon_path,
                spells_by_type: {},
                loaded: false,
                zone_id: zone.id,
                phase_type: bossEntry.phase_type,
            }
            state.bosses[boss.full_name_slug] = boss
        })
    })

    return state
}

function replaceSingleZone(state: ZonesSliceState, payload: RaidZoneCatalogEntry) {
    const previousBosses = state.zones[payload.id]?.bosses ?? []
    previousBosses.forEach((bossSlug) => {
        delete state.bosses[bossSlug]
    })
    const replacement = replaceZones([payload])
    state.zones[payload.id] = replacement.zones[payload.id]
    Object.assign(state.bosses, replacement.bosses)
}

function validateBossCatalogArray(payload: unknown, path: string): BossCatalogPayload {
    const bossSlugs: string[] = []
    const zones = expectArray(payload, path).map((rawZone, zoneIndex) => {
        const zonePath = `${path}[${zoneIndex}]`
        const zone = expectRecord(rawZone, zonePath)
        const bosses = expectArray(zone.bosses, `${zonePath}.bosses`).map((rawBoss, bossIndex) => {
            const bossPath = `${zonePath}.bosses[${bossIndex}]`
            const boss = expectRecord(rawBoss, bossPath)
            const phaseType = expectNonEmptyString(boss.phase_type, `${bossPath}.phase_type`)
            if (phaseType !== "static" && phaseType !== "dynamic") {
                throw new Error(`元数据格式错误：${bossPath}.phase_type 无效`)
            }
            const fullNameSlug = expectRouteSegment(
                boss.full_name_slug,
                `${bossPath}.full_name_slug`,
            )
            bossSlugs.push(fullNameSlug)
            return {
                id: expectFiniteNumber(boss.id, `${bossPath}.id`),
                name: expectNonEmptyString(boss.name, `${bossPath}.name`),
                full_name: expectNonEmptyString(boss.full_name, `${bossPath}.full_name`),
                full_name_slug: fullNameSlug,
                icon: expectRouteSegment(boss.icon, `${bossPath}.icon`),
                phase_type: phaseType,
            } satisfies BossCatalogEntry
        })
        assertUnique(bosses.map((boss) => boss.full_name_slug), `${zonePath}.bosses.full_name_slug`)
        return {
            id: expectFiniteNumber(zone.id, `${zonePath}.id`),
            name: expectNonEmptyString(zone.name, `${zonePath}.name`),
            name_slug: expectRouteSegment(zone.name_slug, `${zonePath}.name_slug`),
            bosses,
        }
    })
    assertUnique(zones.map((zone) => zone.id), `${path}.id`)
    assertUnique(zones.map((zone) => zone.name_slug), `${path}.name_slug`)
    assertUnique(bossSlugs, `${path}.bosses.full_name_slug`)
    return zones
}

export function validateBossCatalog(payload: unknown): BossCatalogPayload {
    return validateBossCatalogArray(payload, "currentSeasonZones")
}

export async function fetchBossCatalog(): Promise<BossCatalogPayload> {
    return validateBossCatalog(await fetch_data<unknown>("/api/current_season/zones"))
}

async function fetchBossZone(zoneId: number): Promise<RaidZoneCatalogEntry> {
    const payload = await fetch_data<unknown>(`/api/zones/${zoneId}`)
    return validateBossCatalogArray([payload], `zone.${zoneId}`)[0]
}

const SLICE = createSlice({
    name: "zones",

    initialState: INITIAL_STATE,

    reducers: {

        set_zone: (state, action: PayloadAction<RaidZoneCatalogEntry>) => {
            replaceSingleZone(state, action.payload)
            return state
        },

        set_zones: (_state, action: PayloadAction<BossCatalogPayload>) => (
            replaceZones(action.payload)
        ),

        set_boss_spells: (state, action) => {
            const { boss_slug, spells } = action.payload
            const boss = state.bosses[boss_slug]
            if (!boss) { return }

            boss.spells_by_type = group_spells_by_type(spells, boss)
            boss.loaded = true
            return state
        }
    },
    extraReducers: (builder) => {
        builder.addCase(catalogsAccepted, (_state, action) => (
            replaceZones(action.payload.bosses)
        ))
    },
})

export const {
    set_boss_spells
} = SLICE.actions

export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

/* load all bosses */
export function load_bosses(zone_id: number) {

    return async (dispatch: AppDispatch) => {

        dispatch({ type: "ui/set_loading", payload: { key: "zone", value: true } })

        try {
            dispatch(SLICE.actions.set_zone(await fetchBossZone(zone_id)))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "zone", value: false } })
        }
    }
}


/* load current season bosses in one request for fast first paint */
export function load_current_season_bosses() {

    return async (dispatch: AppDispatch) => {

        const load_key = "current-season-zones"
        dispatch({ type: "ui/set_loading", payload: { key: load_key, value: true } })

        try {
            dispatch(SLICE.actions.set_zones(await fetchBossCatalog()))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: load_key, value: false } })
        }
    }
}


/**
 * Load Spells for a given boss
 * @param {string} boss_slug name of the boss whom's spells to load
 */
export function load_boss_spells(boss_slug: string) {

    return async (dispatch: AppDispatch) => {

        const load_key = `boss/${boss_slug}`
        dispatch({ type: "ui/set_loading", payload: { key: load_key, value: true } })

        try {
            const spells = await fetch_data(`/api/bosses/${boss_slug}/spells`);
            console.info("[Bosses] spells loaded", { boss_slug, count: Object.keys(spells || {}).length })
            dispatch(SLICE.actions.set_boss_spells({ boss_slug, spells }))
        } catch (error) {
            console.warn("[Bosses] spells load failed", {
                boss_slug,
                error: error instanceof Error ? error.message : String(error),
            })
            dispatch(SLICE.actions.set_boss_spells({ boss_slug, spells: {} }))
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: load_key, value: false } })
        }
    }
}
