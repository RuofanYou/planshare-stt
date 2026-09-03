import type Class from "../types/class"
import type { AppDispatch, RootState } from "./store"
import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { fetch_data } from "../api"
import { sort_spell_types } from "./spells"
import { ASSETS } from "../constants"
import { catalogsAccepted } from "./catalogCommit"
import {
    expectNonEmptyString,
    expectNullableNumberArray,
    expectRecord,
    expectRouteSegment,
    expectRouteSegmentArray,
    expectString,
} from "./catalogValidation"


type ClassesSlice = {
    class_names: string[]
    classes: { [key: string]: Class }
}

export interface ClassCatalogEntry {
    name: string
    name_slug: string
    specs: string[]
    spec_ids: Array<number | null>
    color: string
}

export type ClassesCatalogPayload = Record<string, ClassCatalogEntry>


////////////////////////////////////////////////////////////////////////////////
// Selectors

export function get_class_names(state: RootState) {
    return state.classes.class_names
}


export function get_class(state: RootState, class_name_slug: string) {

    // allow passing in a spec name
    class_name_slug = class_name_slug.split("-")[0]

    return state.classes.classes[class_name_slug]
}

export function get_class_color(state: RootState, class_name_slug: string) {
    const class_ = get_class(state, class_name_slug)
    return class_?.color || ""
}


////////////////////////////////////////////////////////////////////////////////
// Slice

const INITIAL_STATE: ClassesSlice = {
    class_names: [],
    classes: {}
}

function replaceClasses(payload: ClassesCatalogPayload): ClassesSlice {
    const classes: Record<string, Class> = {}
    const class_names = sort_spell_types(Object.keys(payload))

    class_names.forEach((classSlug) => {
        const wowClass = payload[classSlug]
        classes[classSlug] = {
            name: wowClass.name,
            name_slug: wowClass.name_slug,
            specs: [...wowClass.specs],
            spec_ids: [...wowClass.spec_ids],
            color: wowClass.color,
            icon_path: `${ASSETS}/images/classes/${wowClass.name_slug}.webp`,
        }
    })

    return { class_names, classes }
}


const SLICE = createSlice({

    name: "classes",
    initialState: INITIAL_STATE,

    reducers: {
        set_classes: (_state, action: PayloadAction<ClassesCatalogPayload>) => (
            replaceClasses(action.payload)
        ),
    }, // reducers
    extraReducers: (builder) => {
        builder.addCase(catalogsAccepted, (_state, action) => (
            replaceClasses(action.payload.classes)
        ))
    },
})

export default SLICE.reducer


////////////////////////////////////////////////////////////////////////////////
// Extra Actions

export function validateClassesCatalog(payload: unknown): ClassesCatalogPayload {
    const catalog = expectRecord(payload, "classes")
    return Object.fromEntries(Object.entries(catalog).map(([classSlug, rawClass]) => {
        const entry = expectRecord(rawClass, `classes.${classSlug}`)
        const safeClassSlug = expectRouteSegment(classSlug, `classes.${classSlug}.key`)
        const nameSlug = expectRouteSegment(entry.name_slug, `classes.${classSlug}.name_slug`)
        if (nameSlug !== safeClassSlug) {
            throw new Error(`元数据格式错误：classes.${classSlug}.name_slug 与 key 不一致`)
        }
        const result: ClassCatalogEntry = {
            name: expectNonEmptyString(entry.name, `classes.${classSlug}.name`),
            name_slug: nameSlug,
            specs: expectRouteSegmentArray(entry.specs, `classes.${classSlug}.specs`),
            spec_ids: expectNullableNumberArray(
                entry.spec_ids,
                `classes.${classSlug}.spec_ids`,
            ),
            color: expectString(entry.color, `classes.${classSlug}.color`),
        }
        return [safeClassSlug, result]
    }))
}

export async function fetchClassesCatalog(): Promise<ClassesCatalogPayload> {
    return validateClassesCatalog(await fetch_data<unknown>("/api/classes"))
}

export function load_classes() {

    return async (dispatch: AppDispatch) => {
        dispatch({ type: "ui/set_loading", payload: { key: "classes", value: true } })

        try {
            dispatch(SLICE.actions.set_classes(await fetchClassesCatalog()))
        } catch (error) {
            throw error
        } finally {
            dispatch({ type: "ui/set_loading", payload: { key: "classes", value: false } })
        }
    }
}
