import { ReactNode, useId, useState } from 'react'
import Icon from '../../shared/Icon'
import style from "./CollapsableSpellGroup.module.scss"
import type Boss from "../../../types/boss"
import type Class from "../../../types/class"
import type Spec from "../../../types/spec"
import { combatantClassSlug, combatantDisplayName } from "../../../localization/zhCN"


type CollapsableSpellGroupProps = {

    /** Element used for the Icon, Label and Color */
    spec: Spec|Boss|Class

    /** The chilren inside the group */
    children: ReactNode

}


export default function CollapsableSpellGroup({spec, children} : CollapsableSpellGroupProps) {

    // Hooks
    const [collapsed, setCollapsed] = useState(false)
    const childrenId = useId()

    function onClick() {
        setCollapsed(!collapsed)
    }

    if (!spec) { return null }

    const wow_class = combatantClassSlug(spec)
    const displayName = combatantDisplayName(spec)

    /////////////////////////////////////
    // Render
    return <>
        <div className={`${style.group} wow-${wow_class}`}>

            <button
                type="button"
                className={style.toggle}
                onClick={onClick}
                aria-expanded={!collapsed}
                aria-controls={childrenId}
                aria-label={`${collapsed ? "展开" : "收起"}${displayName}`}
            >
                <Icon spec={spec} alt="" className={`${style.button} ${collapsed ? "closed" : "open"} button`}/>
            </button>

            {!collapsed && <div id={childrenId} className={`${style.children} `}>
                {children}
            </div>
            }
        </div>
    </>
}
