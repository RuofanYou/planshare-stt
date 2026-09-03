import { useContext, useEffect } from 'react'
import { useDispatch } from 'react-redux'

import styles from "./SpellButton.module.scss"
import type Boss from '../../../types/boss'
import type Class from '../../../types/class'
import type Spec from '../../../types/spec'
import { ButtonGroupContext } from '../shared/ButtonGroup'
import { get_spell, set_spell_visible, get_spell_visible } from '../../../store/spells'
import { useAppSelector } from '../../../store/store_hooks'
import { combatantClassSlug, ZH_CN } from '../../../localization/zhCN'


function CustomTooltip({tooltip = ""}) {

    if (!tooltip) { return null }

    return (
        <div
            className={styles.info_icon}
            data-tooltip={tooltip}
            data-tooltip-size="small"
        >
            ⚠️
        </div>
    )
}


export default function SpellButton({spec, spell_id, onClick} : { spec: Spec|Boss|Class, spell_id: number, onClick?: (visible: boolean) => void } ) {

    ////////////////////////////////////////////////////////////////////////////
    // Hooks
    //
    const dispatch = useDispatch()
    const spell = useAppSelector(state => get_spell(state, spell_id))
    const visible = useAppSelector(state => get_spell_visible(state, spell_id))
    const group_context = useContext(ButtonGroupContext)

    useEffect(() => {
        if (!spell || group_context.source !== "group") { return }
        dispatch(set_spell_visible({
            spell_id: spell.spell_id,
            visible: group_context.active
        }))
        onClick?.(group_context.active)
    }, [dispatch, group_context.active, group_context.source, onClick, spell])

    if (!spell) { return null }
    if (!spec) { return null }

    ////////////////////////////////////////////////////////////////////////////
    // Vars
    //
    const wow_class = combatantClassSlug(spec)
    const disabled = visible ? "" : "disabled"
    const dynamic_cd = spell.tags?.includes("dynamic_cd")

    ////////////////////////////////////////////////////////////////////////////

    // onClick Callback
    function toggle_spell() {
        const new_value = !visible

        // Toggle the spell itself
        dispatch(set_spell_visible({
            spell_id: spell.spell_id,
            visible: new_value
        }))

        // if the spell became active make sure to also enable the parent group.
        // passing "child" as group_source to differenciate between clicks on the
        // group itself and triggers like these, which should only affect the
        // group itself, but not its children
        if (new_value && group_context.setter) {
            group_context.setter({active: new_value, source: "child"})
        }

        // Invoke any additional onClick Callbacks
        onClick && onClick(new_value)
    }

    ////////////////////////////////
    // Render
    return (
        <div className={styles.spell_button}>
            <button
                type="button"
                className={styles.toggle}
                data-wowhead={spell.wowhead_data || spell.tooltip_info}
                onClick={toggle_spell}
                aria-label={spell.name}
                aria-pressed={visible}
            >
                <img
                    className={`button icon-s rounded wow-border-${wow_class} ${disabled}`}
                    src={spell.icon_path}
                    data-spell_id={spell.spell_id}
                    alt=""
                />
            </button>

            {visible && <CustomTooltip tooltip={spell.tooltip} /> }
            {visible && dynamic_cd && <CustomTooltip tooltip={ZH_CN.settings.dynamicCooldown} /> }

        </div>
    )
}
