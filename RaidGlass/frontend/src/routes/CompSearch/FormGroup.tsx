
import type { ReactNode } from "react";


export default function FormGroup({name, className="", children} : {name: string, className?: string, children?: ReactNode}) {
    return (
        <fieldset className="search-group">
            <legend>{name}</legend>
            <div className={`search-group__content ${className}`}>
                {children}
            </div>
        </fieldset>
    )
}
