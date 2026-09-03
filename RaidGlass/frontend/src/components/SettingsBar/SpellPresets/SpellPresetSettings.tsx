import { FaShield } from "react-icons/fa6";
import { FaRunning, FaStarOfLife } from 'react-icons/fa';
import { GiHealthNormal, GiTank  } from 'react-icons/gi';
import { ReactNode, useContext, useEffect } from 'react'
import { RiSwordFill } from 'react-icons/ri';
import { set_spell_tag_visible, set_spell_visible } from '../../../store/spells';
import { useAppDispatch, useAppSelector } from '../../../store/store_hooks'
import ButtonGroup, { ButtonGroupContext } from './../shared/ButtonGroup'

import style from "./SpellPresetSettings.module.scss"
import { ZH_CN } from "../../../localization/zhCN"


interface SpellSelection {
    name: string;
    icon: ReactNode;
    tags?: string[];
    spell_ids?: number[];
}


const DEFAULT_SELECTIONS : SpellSelection[] = [

    {
        name: ZH_CN.settings.allSpells,
        icon: <FaStarOfLife />,
        tags: [
            "*"
        ],
    },
    {
        name: ZH_CN.settings.damageSpells,
        icon: <RiSwordFill />,
        tags: [
            "dps"
        ],
    },
    {
        name: ZH_CN.settings.defensiveSpells,
        icon: <FaShield  />,
        tags: [
            "defensive",
        ],
    },
    {
        name: ZH_CN.settings.tankSpells,
        icon: <GiTank />,
        tags: [
            "tank"
        ],
    },
    {
        name: ZH_CN.settings.healingSpells,
        icon: <GiHealthNormal />,
        tags: [
            "raid_cd"
        ],
    },
    {
        name: ZH_CN.settings.movementSpells,
        icon: <FaRunning />,
        tags: [
            "move"
        ],
    },
]




function Button({selection} : {selection: SpellSelection}) {

    ////////////////////////
    // Hooks
    //
    const dispatch = useAppDispatch()
    const selected = useAppSelector(state => {
        const affected = new Set(selection.spell_ids || [])
        Object.values(state.spells.all_spells).forEach(spell => {
            if (selection.tags?.some(tag => tag === "*" || spell.tags?.includes(tag))) {
                affected.add(spell.spell_id)
            }
        })
        return Array.from(affected).every(spellId => state.spells.spell_display[spellId] !== false)
    })
    const group_context = useContext(ButtonGroupContext)

    function applySelected(visible: boolean) {
        // tags
        selection.tags?.forEach(tag => {
            dispatch(set_spell_tag_visible({
                tag: tag,
                visible
            }))
        });

        // spell ids
        selection.spell_ids?.forEach(spell_id => {
            dispatch(set_spell_visible({
                spell_id: spell_id,
                visible
            }))
        });

        console.info("[TimelineSettings] spell preset applied", {
            preset: selection.name,
            visible,
        })
    }

    function onClick() {
        applySelected(!selected)
    }

    useEffect(() => {
        if (group_context.source !== "group") { return}
        applySelected(group_context.active)
    }, [group_context.active, group_context.source, selection])

    ////////////////////////
    // Render
    //
    return (
        <button
            type="button"
            className={`${style.button} button icon-s rounded border-white ${selected ? "" : "disabled"}`}
            onClick={onClick}
            data-tooltip={selection.name}
            aria-label={selection.name}
            aria-pressed={selected}
        >
            <span aria-hidden="true">{selection.icon}</span>
        </button>
    )
}


export function SpellPresetSettings() {

    return (
        <ButtonGroup name={ZH_CN.settings.spells}>
            {DEFAULT_SELECTIONS.map(selection => 
                <Button key={selection.name} selection={selection} />
            )}
        </ButtonGroup>
    )
}
