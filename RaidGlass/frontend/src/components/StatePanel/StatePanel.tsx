import { useId, type AriaRole, type ReactNode } from "react";

import styles from "./StatePanel.module.scss";

export default function StatePanel({
    title,
    description,
    role,
    actions,
}: {
    title: ReactNode;
    description: ReactNode;
    role?: AriaRole;
    actions?: ReactNode;
}) {
    const titleId = useId();

    return (
        <section className={styles.panel} role={role} aria-labelledby={titleId}>
            <h1 id={titleId} className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
            {actions && <div className={styles.actions}>{actions}</div>}
        </section>
    );
}
