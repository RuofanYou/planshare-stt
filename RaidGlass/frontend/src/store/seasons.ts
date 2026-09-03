/*
    Store to manage seasonal information
*/
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type Season from '../types/season'
import type { AppDispatch, RootState } from './store'
import { fetch_data } from '../api'
import { catalogsAccepted } from './catalogCommit'
import {
    assertUnique,
    expectArray,
    expectFiniteNumber,
    expectNonEmptyString,
    expectRecord,
    expectRouteSegment,
} from './catalogValidation'


export type SeasonCatalogPayload = Season



type SeasonsSlice = {
    current_season: string
    seasons: { [key: string]: Season }
}


////////////////////////////////////////////////////////////////////////////////
// Selectors
//


export function get_season(state: RootState, season_slug?: string): Season {
    season_slug = season_slug || state.seasons.current_season
    return state.seasons.seasons[season_slug]
}


export function get_current_season(state: RootState): Season {
    return state.seasons.seasons[state.seasons.current_season]
}



////////////////////////////////////////////////////////////////////////////////
// Slice
//


const INITIAL_STATE: SeasonsSlice = {
    current_season: "",
    seasons: {}
}

function replaceSeason(payload: SeasonCatalogPayload): SeasonsSlice {
    const season = {
        name: payload.name,
        slug: payload.slug,
        raids: [...payload.raids],
    }
    return {
        current_season: season.slug,
        seasons: { [season.slug]: season },
    }
}


const SLICE = createSlice({
    name: "seasons",

    initialState: INITIAL_STATE,

    reducers: {
        set_season: (_state, action: PayloadAction<SeasonCatalogPayload>) => (
            replaceSeason(action.payload)
        ),
    },
    extraReducers: (builder) => {
        builder.addCase(catalogsAccepted, (_state, action) => (
            replaceSeason(action.payload.seasons)
        ))
    },
})

export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

export function validateSeasonCatalog(payload: unknown): SeasonCatalogPayload {
    const entry = expectRecord(payload, "season")
    const raids = expectArray(entry.raids, "season.raids").map((raid, index) => (
        expectFiniteNumber(raid, `season.raids[${index}]`)
    ))
    assertUnique(raids, "season.raids")
    return {
        name: expectNonEmptyString(entry.name, "season.name"),
        slug: expectRouteSegment(entry.slug, "season.slug"),
        raids,
    }
}

export async function fetchSeasonCatalog(seasonSlug = "current"): Promise<SeasonCatalogPayload> {
    return validateSeasonCatalog(await fetch_data<unknown>(`/api/seasons/${seasonSlug}`))
}

export function load_season(season_slug?: string) {

    season_slug = season_slug || "current"

    return async (dispatch: AppDispatch) => {

        dispatch({ type: "ui/set_loading", payload: { key: "season", value: true } })

        try {
            dispatch(SLICE.actions.set_season(await fetchSeasonCatalog(season_slug)))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "season", value: false } })
        }
    }
}
