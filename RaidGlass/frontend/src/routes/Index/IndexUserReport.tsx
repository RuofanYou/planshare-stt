import { FaFileImport } from "react-icons/fa6";
import IndexModuleLink from "./IndexModuleLink";
import styles from "./Index.module.scss"

function UserReportIcon() {
    return <FaFileImport className="icon-l wow-artifact" aria-label="user report icon" />
}


export default function IndexUserReport() {

    return (
        <IndexModuleLink title="Custom Report:" url="/user_report" className={styles.user_report_link}>
            <UserReportIcon />
            <span className="h2">Load Log</span>
        </IndexModuleLink>
    )
}
