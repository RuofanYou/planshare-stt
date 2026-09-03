import { createContext, ReactNode, useId, useState } from 'react'
import styles from "./ButtonGroup.module.scss"


type ButtonGroupContextType = {
    /** If the group itself is active or not. */
    active: boolean

    /** Type of element that triggered a change. */
    source: string //"group" | "child" | ""

    /** Callable to change the Group Context. Expects active and source keys*/
    setter?: (state: { active: boolean; source: string }) => void
}


const DEFAULT_CONTEXT: ButtonGroupContextType = {
    active: true,
    source: "",
}


export const ButtonGroupContext = createContext<ButtonGroupContextType>(DEFAULT_CONTEXT)


type ButtonGroupProps = {

    name?: string,
    extra_class?: string,
    className?: string,
    toggleable?: boolean,
    children?: ReactNode
}

export default function ButtonGroup({name, extra_class, className, toggleable = true, children} : ButtonGroupProps) {
    ///////////////////////
    // Hooks

    // The Groups Active state:
    // in addition to the "group_active"-value, we pass a "group_source",
    // which can be used to determine who changed the groups state.
    const [{active, source}, setActive] = useState({active: true, source: ""})
    const group_context : ButtonGroupContextType = {active, source, setter: setActive}
    const groupId = useId()

    // Vars
    extra_class = extra_class || className || ""

    function onClick() {
        // toggle the group state and pass "group" as the source,
        // so child elements can react accordingly
        setActive({active: !active, source: "group"})
    }

    ////////////////////////
    // Render
    return (
        <div className="d-flex">
            <div className={`${styles.group} bg-dark p-1 rounded border`}>
                {name && toggleable && (
                    <button
                        type="button"
                        className={`${styles.header} ${extra_class} ${active ? "" : "disabled"}`}
                        onClick={onClick}
                        aria-pressed={active}
                        aria-controls={groupId}
                    >
                        {name}
                    </button>
                )}
                {name && !toggleable && <span className={`${styles.header} ${extra_class}`}>{name}</span>}
                <div id={groupId} className={styles.children}>
                    <ButtonGroupContext.Provider value={group_context}>
                    {children}
                    </ButtonGroupContext.Provider>
                </div>
            </div>
        </div>
    )
}
