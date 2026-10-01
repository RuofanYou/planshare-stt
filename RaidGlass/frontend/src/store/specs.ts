import type Spec from "../types/spec"
import type { RootState, AppDispatch } from './store'
import { ASSETS } from '../constants'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { fetch_data } from '../api'
import { group_spells_by_type } from './store_utils'
import { catalogsAccepted } from './catalogCommit'
import type { SpellDict } from '../types/spell'
import {
    assertUnique,
    expectArray,
    expectNonEmptyString,
    expectNullableFiniteNumber,
    expectRecord,
    expectRouteSegment,
} from './catalogValidation'


export interface SpecCatalogEntry {
    id: number | null
    index: number | null
    class: {
        name: string
        name_slug: string
    }
    role: string
    name: string
    full_name: string
    full_name_slug: string
    name_en?: string
    full_name_en?: string
    locale?: string
    icon?: string
}

export type SpecsCatalogPayload = SpecCatalogEntry[]

interface SpellbookPayload {
    schema_version: number
    specs: Record<string, Record<string, { name: string; name_en?: string; aliases?: string[] }>>
}


export interface SpecSliceState {
    specs_by_name: { [key: string]: Spec }
}


////////////////////////////////////////////////////////////////////////////////
// Actions
//

export function get_specs(state: RootState) {
    return state.specs.specs_by_name
}

export function get_spec(state: RootState, spec_slug?: string) {
    spec_slug = spec_slug?.split(":")[0] // allow a suffix (eg.: for placeholder purposes)
    spec_slug = spec_slug || state.ui.spec_slug // input or current spec
    return state.specs.specs_by_name[spec_slug] || null
}

/** Find the first spec that can use a given spell
 * @param {object} state current state
 * @param {number} spell_id id of the spell to find
 * @returns {object} the matched spell
*/
export function get_spec_for_spell_id(state: RootState, spell_id: number) {
    return Object.values(state.specs.specs_by_name).find(spec => {
        return Object.values(spec.spells_by_type || {}).some(spell_group => {
            return spell_group.includes(spell_id)
        }) // spell group
    }) // specs
}


////////////////////////////////////////////////////////////////////////////////
// Slice
//

const INITIAL_STATE: SpecSliceState = {
    specs_by_name: {},
}

function replaceSpecs(payload: SpecsCatalogPayload): SpecSliceState {
    return {
        specs_by_name: Object.fromEntries(payload.map((spec) => {
            const processed: Spec = {
                id: spec.id,
                index: spec.index,
                class: { ...spec.class },
                role: spec.role,
                name: spec.name,
                full_name: spec.full_name,
                full_name_slug: spec.full_name_slug,
                name_en: spec.name_en,
                full_name_en: spec.full_name_en,
                locale: spec.locale,
                icon: spec.icon,
                icon_path: `${ASSETS}/images/specs/${spec.full_name_slug}.jpg`,
                spells_by_type: {},
                loaded: false,
            }
            return [processed.full_name_slug, processed]
        })),
    }
}


const SLICE = createSlice({
    name: "specs",

    initialState: INITIAL_STATE,

    reducers: {

        set_specs: (_state, action: PayloadAction<SpecsCatalogPayload>) => (
            replaceSpecs(action.payload)
        ),

        set_spec_spells: (state, action) => {
            const { spec_slug, spells } = action.payload
            const spec = state.specs_by_name[spec_slug]
            if (!spec) { return state }

            spec.spells_by_type = group_spells_by_type(spells, spec)
            spec.loaded = true
            return state
        },
    }, // reducers
    extraReducers: (builder) => {
        builder.addCase(catalogsAccepted, (_state, action) => (
            replaceSpecs(action.payload.specs)
        ))
    },
}) // slice


export const {
    set_spec_spells
} = SLICE.actions

export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

function optionalString(
    entry: Record<string, unknown>,
    key: "name_en" | "full_name_en" | "locale" | "icon",
    path: string,
): string | undefined {
    if (entry[key] === undefined || entry[key] === null) return undefined
    return expectNonEmptyString(entry[key], `${path}.${key}`)
}

export function validateSpecsCatalog(payload: unknown): SpecsCatalogPayload {
    const envelope = expectRecord(payload, "specs")
    const specs = expectArray(envelope.specs, "specs.specs").map((rawSpec, index) => {
        const path = `specs.specs[${index}]`
        const entry = expectRecord(rawSpec, path)
        const classInfo = expectRecord(entry.class, `${path}.class`)
        return {
            id: expectNullableFiniteNumber(entry.id, `${path}.id`),
            index: expectNullableFiniteNumber(entry.index, `${path}.index`),
            class: {
                name: expectNonEmptyString(classInfo.name, `${path}.class.name`),
                name_slug: expectRouteSegment(classInfo.name_slug, `${path}.class.name_slug`),
            },
            role: expectRouteSegment(entry.role, `${path}.role`),
            name: expectNonEmptyString(entry.name, `${path}.name`),
            full_name: expectNonEmptyString(entry.full_name, `${path}.full_name`),
            full_name_slug: expectRouteSegment(entry.full_name_slug, `${path}.full_name_slug`),
            name_en: optionalString(entry, "name_en", path),
            full_name_en: optionalString(entry, "full_name_en", path),
            locale: optionalString(entry, "locale", path),
            icon: optionalString(entry, "icon", path),
        }
    })
    assertUnique(specs.map((spec) => spec.full_name_slug), "specs.specs.full_name_slug")
    return specs
}

export async function fetchSpecsCatalog(): Promise<SpecsCatalogPayload> {
    return validateSpecsCatalog(await fetch_data<unknown>("/api/specs"))
}

export function load_specs() {

    return async (dispatch: AppDispatch) => {
        dispatch({ type: "ui/set_loading", payload: { key: "specs", value: true } })

        try {
            dispatch(SLICE.actions.set_specs(await fetchSpecsCatalog()))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "specs", value: false } })
        }
    }
}


export function load_spec_spells(spec_slug: string) {

    return async (dispatch: AppDispatch) => {
        const load_key = `specs/${spec_slug}`
        dispatch({ type: "ui/set_loading", payload: { key: load_key, value: true } })

        try {
            const [curated, book] = await Promise.allSettled([
                fetch_data<SpellDict>(`/api/specs/${spec_slug}/spells`),
                fetch_data<SpellbookPayload>('/api/spellbook'),
            ]);
            if (curated.status === 'rejected') throw curated.reason;
            const spells: SpellDict = { ...curated.value };
            if (book.status === 'fulfilled' && book.value?.schema_version === 1) {
                for (const [rawId, entry] of Object.entries(book.value.specs?.[spec_slug] || {})) {
                    const id = Number(rawId);
                    if (!Number.isSafeInteger(id) || id <= 0 || typeof entry?.name !== 'string' || !entry.name) continue;
                    const search_names = [entry.name_en, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]
                        .filter((name): name is string => typeof name === 'string' && name.length > 0);
                    const base = curated.value[id] || {
                        spell_id: id, spell_type: spec_slug, name: entry.name,
                        icon: '', icon_path: '', color: '', cooldown: 0, duration: 0, show: false,
                    };
                    spells[id] = { ...base, name: entry.name, search_names, catalog_source: 'spellbook' };
                }
            } else {
                console.warn('[Specs] spellbook unavailable', { spec_slug,
                    reason: book.status === 'rejected' ? String(book.reason) : 'invalid_schema' });
            }
            console.info('[Specs] spells loaded', { spec_slug, count: Object.keys(spells).length });
            dispatch(SLICE.actions.set_spec_spells({ spec_slug, spells }));
        } catch (error) {
            console.warn("[Specs] spells load failed", {
                spec_slug,
                error: error instanceof Error ? error.message : String(error),
            })
            dispatch(SLICE.actions.set_spec_spells({ spec_slug, spells: {} }))
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: load_key, value: false } })
        }
    }
}
