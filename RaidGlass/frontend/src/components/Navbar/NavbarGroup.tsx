import type { ReactNode } from "react";

import styles from "./Navbar.module.scss"


export default function NavbarGroup({children, className=""} : { children: ReactNode, className?: string } ) {

    if (!children) return null

    return (
        <div className={`${styles.navbar_group} p-1 bg-dark border rounded ${className || ""}`}>
            {children}
        </div>
    )
}
