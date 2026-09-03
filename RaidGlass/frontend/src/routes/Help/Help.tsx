import HelpContent from "./HelpContent";
import HelpHeader from "./HelpHeader";
import HelpSidebar from "./HelpSidebar";
import { useTitle } from "react-use";
import styles from "./Help.module.scss";

export default function Help() {
    useTitle("RaidGlass: 使用帮助");

    return (
        <div className={styles.outerContainer}>
            <HelpHeader />
            <div className={styles.layout}>
                <HelpSidebar />
                <HelpContent />
            </div>
        </div>
    );
}
