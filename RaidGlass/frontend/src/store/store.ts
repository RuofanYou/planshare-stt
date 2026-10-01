/*
Redux Data Store
*/

import { combineReducers, configureStore, type UnknownAction } from '@reduxjs/toolkit'

import { DEBUG } from '../constants'
import admin_reducer from "./admin"
import bosses_reducer from "./bosses"
import classes_reducer from "./classes"
import fights_reducer, {
    castsUpdated,
    fightsRequestFailed,
    fightsRequestSucceeded,
    isCurrentFightsRequest,
} from "./fights"
import roles_reducer from "./roles"
import seasons_reducer from "./seasons"
import specs_reducer from "./specs"
import spells_reducer from "./spells"
import ui_reducer from "./ui"
import user_reducer from "./user"
import user_report_reducer from "./user_reports"
import bootstrap_reducer from "./bootstrap"

////////////////////////////////////////////////////////////////////////////////
// REDCUER
//
const combinedReducer = combineReducers({
    admin: admin_reducer,
    bootstrap: bootstrap_reducer,
    classes: classes_reducer,
    fights: fights_reducer,
    roles: roles_reducer,
    seasons: seasons_reducer,
    specs: specs_reducer,
    spells: spells_reducer,
    ui: ui_reducer,
    user_report: user_report_reducer,
    user: user_reducer,
    zones: bosses_reducer,
})

type AppState = ReturnType<typeof combinedReducer>
const initialAppState = combinedReducer(undefined, { type: "@@raidglass/INIT" })

export function appReducer(state: AppState | undefined, action: UnknownAction): AppState {
    const currentState = state ?? initialAppState
    if (castsUpdated.match(action) && (currentState.fights.accepted_target !== action.payload.targetKey
        || currentState.fights.active_request_id)) return currentState;
    if (fightsRequestSucceeded.match(action)) {
        if (!isCurrentFightsRequest(currentState.fights, action.payload)) {
            return currentState
        }
    }
    if (fightsRequestFailed.match(action)) {
        if (!isCurrentFightsRequest(currentState.fights, action.payload)) {
            return currentState
        }
    }
    return combinedReducer(currentState, action)
}

const store = configureStore({
    reducer: appReducer,
    devTools: DEBUG,
})

export default store


// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof appReducer>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch
