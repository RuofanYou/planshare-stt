import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";

import CopyNoteWindow from "../../components/CopyNoteWindow";
import PlayerNamesList from "../../components/PlayerNames/PlayerNamesList";
import StatePanel from "../../components/StatePanel/StatePanel";
import TimelineCanvas from "../../components/Timeline/TimelineCanvas";
import type { TimelineVisibility } from "../../filter_logic";
import type { CompCriteria } from "../../features/comp-reference/criteria";
import { rankingRefreshPresentation } from "../../features/ranking-refresh/presentation";
import type { TimelineTextSnapshot } from "../../features/timeline-workbench/homework";
import TimelineTextAlternative from "../../features/timeline-workbench/TimelineTextAlternative";
import { ZH_CN } from "../../localization/zhCN";
import type { FilterValues } from "../../store/ui";
import { clear_copynote } from "../../store/ui";
import { useAppDispatch } from "../../store/store_hooks";
import type Fight from "../../types/fight";
import type { RankingMeta } from "../../features/timeline-workbench/types";
import RouteStatePage from "../RouteStatePage";
import CompRankingsHeader from "./CompRankingsHeader";
import CompSettingsBar from "./CompSettingsBar";
import styles from "./CompRankings.module.scss";

export type CompRankingsViewState =
    | "switching"
    | "ready"
    | "empty"
    | "error"
    | "error-with-data"
    | "unknown-boss"
    | "invalid-query";

export interface CompRankingsDisplay {
    bossSlug: string;
    bossName: string;
    targetKey: string;
    criteria: CompCriteria;
    criteriaSummary: string;
    fights: readonly Fight[];
    visibility: TimelineVisibility;
    snapshot: TimelineTextSnapshot;
    meta: RankingMeta | null;
}

export interface CompRankingsViewProps {
    state: CompRankingsViewState;
    display: CompRankingsDisplay | null;
    filters: FilterValues;
    errorMessage: string | null;
    onRetry: () => void;
}

function ChangeCriteriaLink() {
    return (
        <Link className="rg-button rg-button-primary" to="/comp_ranking/search">
            {ZH_CN.comp.changeCriteria}
        </Link>
    );
}

function CompContent({
    display,
    filters,
}: {
    display: CompRankingsDisplay;
    filters: FilterValues;
}) {
    const freshness = display.meta
        ? rankingRefreshPresentation(display.meta.refresh)
        : null;
    return (
        <>
            <CompRankingsHeader
                bossName={display.bossName}
                criteria={display.criteria}
                criteriaSummary={display.criteriaSummary}
            />
            <div className={styles.toolbar}>
                <p className={styles.meta}>
                    <span>{ZH_CN.comp.dataSummary(
                            display.meta?.updated ?? null,
                            display.meta?.sourceReportCount ?? null,
                        )}</span>
                    {freshness && (
                        <span data-freshness={freshness.key}>{freshness.label}</span>
                    )}
                </p>
                <CompSettingsBar filters={filters} />
            </div>
            <section className={styles.timelinePanel} aria-label={ZH_CN.comp.timelinePanelLabel}>
                <div className={styles.timelineBody}>
                    <PlayerNamesList visibility={display.visibility} />
                    <TimelineCanvas fights={display.fights} visibility={display.visibility} />
                </div>
                <TimelineTextAlternative
                    snapshot={display.snapshot}
                    targetKey={display.targetKey}
                    ariaLabel={ZH_CN.comp.timelineTextLabel}
                />
            </section>
            <CopyNoteWindow />
        </>
    );
}

export default function CompRankingsView({
    state,
    display,
    filters,
    errorMessage,
    onRetry,
}: CompRankingsViewProps) {
    const dispatch = useAppDispatch();
    const copyNoteScope = state === "switching"
        ? "switching"
        : display?.targetKey ?? "no-display";

    useLayoutEffect(() => {
        dispatch(clear_copynote());
        return () => {
            dispatch(clear_copynote());
        };
    }, [copyNoteScope, dispatch]);

    if (state === "unknown-boss" || state === "invalid-query") {
        return <RouteStatePage kind="not-found" />;
    }

    if (state === "empty") {
        return (
            <StatePanel
                title={ZH_CN.comp.emptyTitle}
                description={ZH_CN.comp.emptyDescription}
                actions={<ChangeCriteriaLink />}
            />
        );
    }

    if (state === "error") {
        return (
            <StatePanel
                title={ZH_CN.comp.errorTitle}
                description={errorMessage || ZH_CN.comp.errorDescription}
                role="alert"
                actions={(
                    <>
                        <button className="rg-button rg-button-primary" type="button" onClick={onRetry}>
                            {ZH_CN.comp.retry}
                        </button>
                        <ChangeCriteriaLink />
                    </>
                )}
            />
        );
    }

    if (!display) {
        return (
            <StatePanel
                title={ZH_CN.comp.loadingTitle}
                description={ZH_CN.comp.loadingDescription}
                role="status"
                actions={<ChangeCriteriaLink />}
            />
        );
    }

    return (
        <section className={styles.page} data-testid="comp-rankings-view">
            {state === "switching" && (
                <div
                    className={styles.status}
                    role="status"
                    aria-label={ZH_CN.comp.loadingTitle}
                >
                    {ZH_CN.comp.switchingDescription}
                </div>
            )}
            {state === "error-with-data" && (
                <div className={styles.error} role="alert">
                    <span>{errorMessage || ZH_CN.comp.errorDescription}</span>
                    <button type="button" onClick={onRetry}>{ZH_CN.comp.retry}</button>
                </div>
            )}
            <CompContent display={display} filters={filters} />
        </section>
    );
}
