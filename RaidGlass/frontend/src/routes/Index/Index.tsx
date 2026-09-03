import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTitle } from "react-use";

import { PRODUCT_CONFIG } from "../../config/product";
import TargetPicker from "../../features/timeline-workbench/TargetPicker";
import TimelineWorkbench from "../../features/timeline-workbench/TimelineWorkbench";
import {
    resolveTimelineTargetRoute,
    timelineTargetUrl,
    type TimelineCatalogs,
} from "../../features/timeline-workbench/targetRouting";
import { get_bosses, get_zones } from "../../store/bosses";
import { get_specs } from "../../store/specs";
import { useAppSelector } from "../../store/store_hooks";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import RouteStatePage from "../RouteStatePage";
import { ZH_CN } from "../../localization/zhCN";
import styles from "./Index.module.scss";

export default function Index() {
    useTitle("RaidGlass：顶榜时间轴参考库");

    const location = useLocation();
    const navigate = useNavigate();
    const zones = useAppSelector(get_zones);
    const bossesBySlug = useAppSelector(get_bosses);
    const specsBySlug = useAppSelector(get_specs);

    const bosses = useMemo(() => zones
        .flatMap((zone) => zone.bosses)
        .map((bossSlug) => bossesBySlug[bossSlug])
        .filter(Boolean) as Boss[], [bossesBySlug, zones]);

    const specs = useMemo(() => Object.values(specsBySlug)
        .filter((spec) => PRODUCT_CONFIG.combatRoles.includes(spec.role as typeof PRODUCT_CONFIG.combatRoles[number]))
        .sort((left, right) => left.full_name.localeCompare(right.full_name)), [specsBySlug]);

    const catalogs = useMemo<TimelineCatalogs | null>(() => {
        if (bosses.length === 0 || specs.length === 0) return null;
        return {
            bosses: Object.fromEntries(bosses.map((boss) => [boss.full_name_slug, boss])),
            specs: Object.fromEntries(specs.map((spec) => [spec.full_name_slug, spec])),
        };
    }, [bosses, specs]);

    const routeResolution = resolveTimelineTargetRoute({
        pathname: location.pathname,
        search: location.search,
        catalogs,
    });
    const redirectTo = routeResolution.kind === "redirect" ? routeResolution.to : null;

    useEffect(() => {
        if (redirectTo) navigate(redirectTo, { replace: true });
    }, [navigate, redirectTo]);

    if (routeResolution.kind === "not-found") {
        return <RouteStatePage kind="not-found" address={routeResolution.address} />;
    }

    if (routeResolution.kind === "pending" || routeResolution.kind === "redirect") {
        return (
            <section className={styles.page}>
                <header className={styles.pageIntro}>
                    <p className={styles.eyebrow}>{ZH_CN.workbench.eyebrow}</p>
                    <h1>{ZH_CN.workbench.title}</h1>
                    <p>{ZH_CN.workbench.pageDescription}</p>
                </header>
                <div className={styles.loading} role="status" aria-label="正在载入当前赛季目标">
                    <div className={styles.loadingContext}>
                        <span />
                        <strong />
                        <small />
                    </div>
                    <div className={styles.loadingTimeline} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                    <span className={styles.loadingText}>正在载入当前赛季目标…</span>
                </div>
            </section>
        );
    }

    const selectedTarget = routeResolution.target;
    const selectedBoss = bossesBySlug[selectedTarget.bossSlug];
    const selectedSpec = specsBySlug[selectedTarget.specSlug];

    return (
        <section className={styles.page}>
            <header className={styles.pageIntro}>
                <p className={styles.eyebrow}>{ZH_CN.workbench.eyebrow}</p>
                <h1>{ZH_CN.workbench.title}</h1>
                <p>{ZH_CN.workbench.pageDescription}</p>
            </header>

            {selectedBoss && selectedSpec && (
                <>
                    <TimelineWorkbench
                        target={selectedTarget}
                        boss={selectedBoss}
                        spec={selectedSpec}
                        headingLevel={2}
                        targetPicker={(
                            <TargetPicker
                                bosses={bosses}
                                specs={specs}
                                value={selectedTarget}
                                onChange={(nextTarget) => navigate(timelineTargetUrl(nextTarget))}
                            />
                        )}
                    />
                </>
            )}
        </section>
    );
}
