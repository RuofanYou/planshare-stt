import type { ReactNode } from "react";
import { FaSliders } from "react-icons/fa6";
import { AdaptiveDialogPanel } from "../../components/AdaptiveDialogPanel/AdaptiveDialogPanel";
import { recordDiagnostic } from "../../diagnostics";
import { ZH_CN } from "../../localization/zhCN";
import type { FightsRequestError } from "../../store/fights";
import TargetSummary from "./TargetSummary";
import { timelineTargetKey, type RankingMeta, type TimelineTarget } from "./types";
import type { WorkbenchPresentation } from "./workbenchState";
import styles from "./TimelineWorkbench.module.scss";

export interface TimelineWorkbenchViewProps {
    selectedTarget: TimelineTarget;
    acceptedTarget: TimelineTarget | null;
    requestTarget: TimelineTarget | null;
    failedTarget: TimelineTarget | null;
    presentation: WorkbenchPresentation;
    error: FightsRequestError | null;
    meta: RankingMeta | null;
    visibleCount: number;
    copyStatus: string;
    headingLevel: 1 | 2;
    onCopy: () => void;
    onRetry: () => void;
    onClearFilters: () => void;
    targetPicker: ReactNode;
    settings: ReactNode;
    spellFilter?: ReactNode;
    timelineControls: ReactNode;
    timeline: ReactNode;
}

function targetLabel(target: TimelineTarget) {
    return `${target.bossName} · ${target.specName}`;
}

function StateFeedback({
    selectedTarget,
    acceptedTarget,
    requestTarget,
    failedTarget,
    presentation,
    error,
    onRetry,
    onClearFilters,
}: Pick<TimelineWorkbenchViewProps,
    | "selectedTarget"
    | "acceptedTarget"
    | "requestTarget"
    | "failedTarget"
    | "presentation"
    | "error"
    | "onRetry"
    | "onClearFilters"
>) {
    const selectedLabel = targetLabel(requestTarget ?? selectedTarget);
    const acceptedLabel = acceptedTarget ? targetLabel(acceptedTarget) : "";
    const failedLabel = targetLabel(failedTarget ?? selectedTarget);

    switch (presentation.contentState) {
        case "initial-loading":
            return (
                <div className={styles.stateMessage} role="status">
                    {ZH_CN.workbench.initialLoading(selectedLabel)}
                </div>
            );
        case "cross-target-loading":
            return (
                <div className={styles.stateMessage} role="status">
                    {ZH_CN.workbench.crossTargetLoading(selectedLabel, acceptedLabel)}
                </div>
            );
        case "same-target-refreshing":
            return null;
        case "same-target-error":
            return (
                <div className={styles.stateError} role="alert">
                    <span>{ZH_CN.workbench.refreshTargetFailed(
                        failedLabel,
                        error?.message || ZH_CN.workbench.timelineLoadFailed,
                    )}</span>
                    <button type="button" onClick={onRetry}>{ZH_CN.workbench.retry}</button>
                </div>
            );
        case "target-error":
            return (
                <div className={styles.stateError} role="alert">
                    <span>{ZH_CN.workbench.loadTargetFailed(
                        failedLabel,
                        error?.message || ZH_CN.workbench.timelineLoadFailed,
                    )}</span>
                    <button type="button" onClick={onRetry}>{ZH_CN.workbench.retry}</button>
                </div>
            );
        case "target-empty":
            return (
                <div className={styles.stateMessage} role="status">
                    <span>{ZH_CN.workbench.targetEmpty}</span>
                    <button type="button" onClick={onRetry}>{ZH_CN.workbench.retry}</button>
                </div>
            );
        case "filter-empty":
            return (
                <div className={styles.stateMessage} role="status">
                    <span>{ZH_CN.workbench.filterEmpty}</span>
                    <button type="button" onClick={onClearFilters}>{ZH_CN.workbench.clearFilters}</button>
                </div>
            );
        case "ready":
            return null;
    }
}

export default function TimelineWorkbenchView({
    selectedTarget,
    acceptedTarget,
    requestTarget,
    failedTarget,
    presentation,
    error,
    meta,
    visibleCount,
    copyStatus,
    headingLevel,
    onCopy,
    onRetry,
    onClearFilters,
    targetPicker,
    settings,
    spellFilter,
    timelineControls,
    timeline,
}: TimelineWorkbenchViewProps) {
    const acceptedMatchesSelection = acceptedTarget !== null
        && timelineTargetKey(acceptedTarget) === timelineTargetKey(selectedTarget);

    return (
        <section
            className={styles.workbench}
            data-testid="timeline-workbench"
            data-content-state={presentation.contentState}
        >
            <TargetSummary
                target={selectedTarget}
                meta={acceptedMatchesSelection ? meta : null}
                refreshing={acceptedMatchesSelection
                    && presentation.contentState === "same-target-refreshing"}
                copyDisabled={!presentation.copyAllowed}
                copyStatus={copyStatus}
                headingLevel={headingLevel}
                targetPicker={targetPicker}
                onCopy={onCopy}
            />

            <div className={styles.timelineWorkspace}>
            <section
                className={styles.timelinePanel}
                aria-label={ZH_CN.workbench.title}
                data-content-state={presentation.contentState}
            >
                <header className={styles.timelineHeader}>
                    <div className={styles.timelineIdentity}>
                        <h3>{ZH_CN.workbench.title}</h3>
                        <span>{ZH_CN.workbench.timelineHint}</span>
                    </div>
                    <div className={styles.visibleCount} aria-label={`${visibleCount} ${ZH_CN.workbench.visiblePlayers}`}>
                        <strong>{visibleCount}</strong>
                        <span>位</span>
                    </div>
                    <div className={styles.timelineHeaderActions}>
                        {timelineControls}
                        <AdaptiveDialogPanel
                            title={ZH_CN.settings.advanced}
                            description={ZH_CN.settings.advancedDescription}
                            trigger={({ ref, ...triggerProps }) => (
                                <button
                                    ref={ref}
                                    {...triggerProps}
                                    type="button"
                                    className={styles.settingsToggle}
                                >
                                    <FaSliders aria-hidden="true" />
                                    {ZH_CN.settings.advanced}
                                </button>
                            )}
                            onStateChange={(open, transition) => {
                                recordDiagnostic(open ? "settings_opened" : "settings_closed", {
                                    reason: transition.reason,
                                    surface: transition.surface,
                                });
                            }}
                        >
                            <div className={styles.settings}>{settings}</div>
                        </AdaptiveDialogPanel>
                    </div>
                </header>
                {spellFilter}

                <StateFeedback
                    selectedTarget={selectedTarget}
                    acceptedTarget={acceptedTarget}
                    requestTarget={requestTarget}
                    failedTarget={failedTarget}
                    presentation={presentation}
                    error={error}
                    onRetry={onRetry}
                    onClearFilters={onClearFilters}
                />

                {presentation.showAcceptedTimeline && (
                    <div className={styles.timelineScroll} data-timeline-scroll>
                        {timeline}
                    </div>
                )}
            </section>
            </div>
        </section>
    );
}
