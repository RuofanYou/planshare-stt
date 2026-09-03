import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { assetUrl } from "../../constants";
import { recordDiagnostic } from "../../diagnostics";
import { ZH_CN } from "../../localization/zhCN";
import styles from "./ProductShell.module.scss";

export default function ProductShell({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const mainRef = useRef<HTMLElement>(null);
    const previousPathnameRef = useRef(pathname);
    const timelineIsCurrent = pathname === "/" || pathname.startsWith("/spec_ranking/");
    const compReferenceIsCurrent = pathname.startsWith("/comp_ranking/");

    useEffect(() => {
        const previousPathname = previousPathnameRef.current;
        previousPathnameRef.current = pathname;

        if (previousPathname === pathname || !mainRef.current) return;

        mainRef.current.focus({ preventScroll: true });
        recordDiagnostic("route_focus_restored", {
            fromPath: previousPathname,
            toPath: pathname,
        });
    }, [pathname]);

    function focusMainContent() {
        mainRef.current?.focus();
        recordDiagnostic("skip_link_activated", { pathname });
    }

    return (
        <div
            className={styles.shell}
            data-build-id={RAIDGLASS_BUILD_ID}
            data-release-id={RAIDGLASS_RELEASE_ID}
            data-source-tree-hash={RAIDGLASS_SOURCE_TREE_HASH}
        >
            <a className={styles.skipLink} href="#raidglass-main" onClick={focusMainContent}>
                {ZH_CN.shell.skipToMain}
            </a>
            <div className={styles.background} aria-hidden="true" />

            <div className={styles.appFrame}>
                <header className={styles.topbar}>
                    <Link to="/" className={styles.brand} aria-label={ZH_CN.shell.brandHome}>
                        <span className={styles.brandMark}>
                            <img src={assetUrl("img/raidglass-d4/brand-crystal.png")} alt="" />
                        </span>
                        <span>
                            <strong>{ZH_CN.shell.brand}</strong>
                            <small>{ZH_CN.shell.tagline}</small>
                        </span>
                    </Link>

                    <nav className={styles.nav} aria-label={ZH_CN.shell.primaryNavigation}>
                        <Link
                            to="/"
                            className={styles.navLink}
                            aria-current={timelineIsCurrent ? "page" : undefined}
                        >
                            {ZH_CN.shell.timeline}
                        </Link>
                        <Link
                            to="/comp_ranking/search"
                            className={styles.navLink}
                            aria-current={compReferenceIsCurrent ? "page" : undefined}
                        >
                            {ZH_CN.shell.comp}
                        </Link>
                    </nav>
                </header>

                <main
                    ref={mainRef}
                    id="raidglass-main"
                    className={styles.content}
                    tabIndex={-1}
                    aria-label={ZH_CN.shell.mainContent}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
