import { Link } from "react-router-dom";
import { ZH_CN } from "../../localization/zhCN";
import styles from "./Footer.module.scss";

function LegalText() {
    return (
        <small className={styles.legal}>
            {ZH_CN.footer.sourcePrefix} <a href="https://warcraftlogs.com" target="_blank" rel="noopener"><strong>Warcraft Logs</strong></a>。
            {ZH_CN.footer.rights}
        </small>
    );
}

function VersionInfo() {
    return (
        <small className={styles.versionInfo}>
            {ZH_CN.footer.versionBuild(
                RAIDGLASS_RELEASE_ID.slice(0, 8),
                RAIDGLASS_BUILD_ID.slice(0, 8),
            )}<br />
            {ZH_CN.footer.published} <time dateTime={RAIDGLASS_PUBLISHED_AT}>
                {new Date(RAIDGLASS_PUBLISHED_AT).toLocaleString("zh-CN", { hour12: false })}
            </time>
        </small>
    );
}

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <LegalText />
            <nav className={styles.footerNav} aria-label={ZH_CN.footer.supportNavigation}>
                <Link to="/help">{ZH_CN.footer.help}</Link>
            </nav>
            <VersionInfo />
        </footer>
    );
}
