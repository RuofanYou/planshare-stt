import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { createSelector } from 'reselect'
import type Role from '../types/role'
import type { AppDispatch, RootState } from './store'
import { fetch_data } from '../api'
import { ASSETS } from '../constants'
import { catalogsAccepted } from './catalogCommit'
import {
    assertUnique,
    expectArray,
    expectFiniteNumber,
    expectNonEmptyString,
    expectNullableNumberArray,
    expectRecord,
    expectRouteSegment,
    expectRouteSegmentArray,
} from './catalogValidation'


export interface RoleCatalogEntry {
    code: string
    id: number
    name: string
    specs: string[]
    spec_ids: Array<number | null>
    metrics: string[]
}

export type RolesCatalogPayload = RoleCatalogEntry[]


////////////////////////////////////////////////////////////////////////////////
// Selectors
//

export function get_roles(state: RootState) {
    return state.roles
}


export const get_player_roles = createSelector(
    get_roles,
    (roles_map) => {
        const roles = Object.values(roles_map)
        return roles.filter(role => role.id < 1000)
    }
)


export function get_role(state: RootState, role_name: string) {
    return state.roles[role_name]
}


export function get_specs_for_role(state: RootState, role_name: string) {

    const role = get_role(state, role_name)
    if (!role) { return [] }
    return role.specs.map((spec_slug: string) => state.specs.specs_by_name[spec_slug])
}



////////////////////////////////////////////////////////////////////////////////
// Slice
//

const INITIAL_STATE: { [key: string]: Role } = {}

function replaceRoles(payload: RolesCatalogPayload): { [key: string]: Role } {
    return Object.fromEntries([...payload]
        .sort((left, right) => left.id - right.id)
        .map((role) => [role.code, {
            id: role.id,
            code: role.code,
            name: role.name,
            specs: [...role.specs].sort(),
            spec_ids: [...role.spec_ids],
            metrics: [...role.metrics],
            icon_path: `${ASSETS}/images/roles/${role.code}.jpg`,
        }]))
}


const SLICE = createSlice({
    name: "roles",

    initialState: INITIAL_STATE,

    reducers: {
        set_roles: (_state, action: PayloadAction<RolesCatalogPayload>) => (
            replaceRoles(action.payload)
        ),
    },
    extraReducers: (builder) => {
        builder.addCase(catalogsAccepted, (_state, action) => (
            replaceRoles(action.payload.roles)
        ))
    },
})

export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

export function validateRolesCatalog(payload: unknown): RolesCatalogPayload {
    const envelope = expectRecord(payload, "roles")
    const roles = expectArray(envelope.roles, "roles.roles").map((rawRole, index) => {
        const path = `roles.roles[${index}]`
        const entry = expectRecord(rawRole, path)
        const result: RoleCatalogEntry = {
            id: expectFiniteNumber(entry.id, `${path}.id`),
            code: expectRouteSegment(entry.code, `${path}.code`),
            name: expectNonEmptyString(entry.name, `${path}.name`),
            specs: expectRouteSegmentArray(entry.specs, `${path}.specs`),
            spec_ids: expectNullableNumberArray(entry.spec_ids, `${path}.spec_ids`),
            metrics: expectRouteSegmentArray(entry.metrics, `${path}.metrics`),
        }
        return result
    })
    assertUnique(roles.map((role) => role.code), "roles.roles.code")
    return roles
}

export async function fetchRolesCatalog(): Promise<RolesCatalogPayload> {
    return validateRolesCatalog(await fetch_data<unknown>("/api/roles"))
}

export function load_roles() {

    return async (dispatch: AppDispatch) => {
        dispatch({ type: "ui/set_loading", payload: { key: "roles", value: true } })

        try {
            dispatch(SLICE.actions.set_roles(await fetchRolesCatalog()))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "roles", value: false } })
        }
    }
}
