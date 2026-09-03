import { Link } from "react-router-dom"
import styles from "./HeaderLogo.module.scss"


export default function HeaderLogo({wow_class="wow-boss", size="icon-l"}) {

    return (
        <div className={styles.container}>
            <Link to="/">
                <span className={`${styles.logo} ${wow_class} ${size} bg-dark rounded grow-when-touched`}>
                    RG
                </span>
            </Link>
        </div>
    )
}
