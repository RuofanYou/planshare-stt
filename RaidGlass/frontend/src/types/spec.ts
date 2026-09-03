

export default interface Spec {

    /** Blizzard specialization id. Null for synthetic specs (e.g. Other). */
    id: number | null

    /** Index of the Spec (1-4) */
    index: number | null

    class: {
        /** Nice Full Name: eg.: Death Knight */
        name: string
        /** Slugified Name of the Parent WoW-Class. eg: "death-knight" */
        name_slug: string
    }

    role: string

    /** Just the Name of the Spec itself. eg: "Holy" */
    name: string

    /** Complete Name including the Class: eg.: "Holy Paladin" */
    full_name: string

    /** Complete name slugified. eg: "holy-paladin" */
    full_name_slug: string

    /** Original English short name when the API returns localized presentation names. */
    name_en?: string

    /** Original English full name when the API returns localized presentation names. */
    full_name_en?: string

    /** Presentation locale for localized API payloads. */
    locale?: string

    /** Name of the Icon File. */
    icon?: string

    /** URL to the icon */
    icon_path: string

    spells_by_type: { [key: string]: number[] }

    loaded: boolean

}
