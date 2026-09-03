import { get_boss } from "../../../store/bosses";
import { get_class } from "../../../store/classes";
import { get_spec } from "../../../store/specs";
import { get_used_spells_for_type } from "../../../store/spells";
import { useAppSelector } from "../../../store/store_hooks";
import ButtonGroup from "../shared/ButtonGroup";
import SpellButton from "./SpellButton";
import type Boss from "../../../types/boss";
import type Class from "../../../types/class";
import type Spec from "../../../types/spec";
import type { FilterValues } from "../../../store/ui";
import { combatantClassSlug, combatantDisplayName } from "../../../localization/zhCN";


export type SpellTypeGroupProps = {
    spell_type: string;
    filters: FilterValues;
};


function get_spell_type(spell_type: string): Spec | Boss | Class {
    const spec = useAppSelector(state => get_spec(state, spell_type));
    const boss = useAppSelector(state => get_boss(state, spell_type));
    const wow_class = useAppSelector(state => get_class(state, spell_type));

    return spec || boss || wow_class;
}

function create_spell_button(name_slug: string, spec: Spec | Boss | Class, spell_id: number) {
    const key = `${name_slug}/${spell_id}`;
    return <SpellButton key={key} spell_id={spell_id} spec={spec} />;
}

export function SpellTypeGroup({ spell_type, filters }: SpellTypeGroupProps) {
    
    const type = get_spell_type(spell_type);
    const used_spells = useAppSelector(state => get_used_spells_for_type(state, spell_type));
    // check of type hidden by filter
    if (filters.class[spell_type] === false || filters.spec[spell_type] === false) {
        return null;
    }

    if (!type) {
        console.warn("unknown type:", type);
        return null;
    }
    if (used_spells.length === 0) {
        return null;
    }

    const name_slug = combatantClassSlug(type);
    const className = `wow-${name_slug}`;

    return (
        <ButtonGroup name={combatantDisplayName(type)} className={className}>
            {used_spells.map((spell_id) => create_spell_button(name_slug, type, spell_id))}
        </ButtonGroup>
    );
}
