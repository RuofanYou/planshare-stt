import { ControlledMenu, useMenuState } from '@szhsin/react-menu';
import { ReactNode, useRef } from 'react'
import styles from "./DropdownMenu.module.scss"


export default function DropdownMenu({button, children, label = "打开选项菜单"} : {button: ReactNode, children: ReactNode, label?: string}) {

    const ref = useRef<HTMLButtonElement>(null!);
    const [menuState, toggleMenu] = useMenuState();
    const isOpen = menuState.state === "open" || menuState.state === "opening";

    const callbacks = {
        onMouseEnter: () => toggleMenu(true),
        onMouseLeave: () => toggleMenu(false),
    }

    return (
        <div> {/* wrapper to avoid issues if the parent uses grid-gap */}

            {/* Button */}
            <button
                {...callbacks}
                ref={ref}
                type="button"
                className={`${styles.trigger} active`}
                onClick={() => toggleMenu(!isOpen)}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                {button}
            </button>

            {/* Menu Content */}
            <ControlledMenu {...callbacks} onClose={() => toggleMenu(false)} {...menuState} anchorRef={ref}>
                {children}
            </ControlledMenu>
        </div>
    )
}
