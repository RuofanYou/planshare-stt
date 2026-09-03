import CollapsableSpellGroup from './CollapsableSpellGroup'
import type Boss from "../../../types/boss"
import type Class from "../../../types/class"
import type Spec from "../../../types/spec"
import { SpellTypeGroup } from "./SpellTypeGroup"
import { get_boss } from "../../../store/bosses"
import { get_class, get_class_names } from "../../../store/classes"
import { get_occuring_bosses } from "../../../store/fights"
import { get_spec } from "../../../store/specs"
import { get_types_have_used_spells } from "../../../store/spells"
import { useAppSelector } from "../../../store/store_hooks"
import type { FilterValues } from "../../../store/ui"

import { SpellPresetSettings } from "../SpellPresets/SpellPresetSettings"


function get_spell_type(spell_type: string): Spec|Boss|Class {
    const spec = useAppSelector(state => get_spec(state, spell_type));
    const boss = useAppSelector(state => get_boss(state, spell_type));
    const wow_class = useAppSelector(state => get_class(state, spell_type));

    return spec || boss || wow_class;
}


function SpellGroupSpecs({
    icon_name,
    filters,
}: {
    icon_name: string;
    filters: FilterValues;
}) {

    const type = get_spell_type(icon_name)
    // @ts-ignore
    const groups = [icon_name, ...(type?.specs || [])]

    const has_spells = useAppSelector(state => get_types_have_used_spells(state, groups))
    if (!has_spells) { return null }

    return (
        <CollapsableSpellGroup spec={type}>
            {groups.map(group => (
                <SpellTypeGroup key={group} spell_type={group} filters={filters} />
            ))}
        </CollapsableSpellGroup>
    )
}


function BossSpells({ filters }: { filters: FilterValues }) {
    const boss_names = useAppSelector(get_occuring_bosses)
    return <>{boss_names.map(name => (
        <SpellGroupSpecs key={name} icon_name={name} filters={filters} />
    ))}</>
}


function ClassSpells({ filters }: { filters: FilterValues }) {

    let class_names = useAppSelector(get_class_names)
    class_names = class_names.filter(name => name != "other")

    // apply filters
    class_names = class_names.filter(name => filters.class[name] !== false )

    return <>{class_names.map(name => (
        <SpellGroupSpecs key={name} icon_name={name} filters={filters} />
    ))}</>
}


function OtherSpells({ filters }: { filters: FilterValues }) {
    const other = useAppSelector(state => get_class(state, "other"))
    if (!other) { return null }
    return <>{other.specs.map(name => (
        <SpellGroupSpecs key={name} icon_name={name} filters={filters} />
    ))}</>
}


export default function SpellSettings({ filters }: { filters: FilterValues }) {

    return (
        <>
            <SpellPresetSettings />
            <BossSpells filters={filters} />
            <ClassSpells filters={filters} />
            <OtherSpells filters={filters} />
        </>
    )
}
