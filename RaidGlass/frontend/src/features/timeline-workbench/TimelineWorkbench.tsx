import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";
import { FaArrowLeft, FaArrowRight, FaMagnifyingGlassMinus, FaMagnifyingGlassPlus, FaRotateLeft } from "react-icons/fa6";

import CopyNoteWindow from "../../components/CopyNoteWindow";
import PlayerNamesList from "../../components/PlayerNames/PlayerNamesList";
import type Stage from "../../components/Timeline/Stage";
import TimelineCanvas from "../../components/Timeline/TimelineCanvas";
import * as timelineConstants from "../../components/Timeline/constants";
import { recordDiagnostic } from "../../diagnostics";
import { buildTimelineVisibility } from "../../filter_logic";
import { ZH_CN } from "../../localization/zhCN";
import { get_bosses, load_boss_spells } from "../../store/bosses";
import { get_fights, load_fights } from "../../store/fights";
import { get_spell_display, get_spells } from "../../store/spells";
import { get_specs, load_spec_spells } from "../../store/specs";
import { useAppDispatch, useAppSelector } from "../../store/store_hooks";
import * as uiStore from "../../store/ui";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import {
    buildHomeworkExport,
    buildHomeworkSnapshot,
} from "./homework";
import TimelineTextAlternative from "./TimelineTextAlternative";
import TimelineSettings from "./TimelineSettings";
import TimelineWorkbenchView from "./TimelineWorkbenchView";
import { timelineTargetFromKey } from "./targetRouting";
import { timelineTargetKey, type TimelineTarget } from "./types";
import { deriveWorkbenchPresentation } from "./workbenchState";
import styles from "./TimelineWorkbench.module.scss";

export function blockUnavailableCopy(
    selectedTargetKey: string,
    presentation: ReturnType<typeof deriveWorkbenchPresentation>,
    hasAcceptedSnapshot: boolean,
) {
    if (presentation.copyAllowed && hasAcceptedSnapshot) {
        return false;
    }
    recordDiagnostic("target_copy_blocked", {
        target: selectedTargetKey,
        reason: presentation.copyBlockReason ?? "target-mismatch",
    });
    return true;
}

async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
        throw new Error("clipboard command failed");
    }
}

export default function TimelineWorkbench({
    target,
    boss,
    spec,
    headingLevel,
    targetPicker,
}: {
    target: TimelineTarget;
    boss: Boss;
    spec: Spec;
    headingLevel: 1 | 2;
    targetPicker: ReactNode;
}) {
    const dispatch = useAppDispatch();
    const fights = useAppSelector(get_fights);
    const bosses = useAppSelector(get_bosses);
    const specs = useAppSelector(get_specs);
    const filters = useAppSelector((state) => state.ui.filters);
    const spellDisplay = useAppSelector(get_spell_display) as Record<number, boolean | undefined>;
    const spells = useAppSelector(get_spells);
    const status = useAppSelector((state) => state.fights.status);
    const error = useAppSelector((state) => state.fights.error);
    const meta = useAppSelector((state) => state.fights.ranking_meta);
    const requestTargetKey = useAppSelector((state) => state.fights.request_target);
    const acceptedTargetKeyFromState = useAppSelector((state) => state.fights.accepted_target);
    const stageRef = useRef<Stage | null>(null);
    const copyAttemptRef = useRef(0);
    const copyFeedbackTimerRef = useRef<number | null>(null);
    const selectedTargetKeyRef = useRef("");
    const acceptedTargetKeyRef = useRef<string | null>(null);
    const [zoom, setZoom] = useState(timelineConstants.DEFAULT_ZOOM);
    const [copyStatus, setCopyStatus] = useState("");
    const [retryToken, setRetryToken] = useState(0);

    const clearCopyFeedbackTimer = useCallback(() => {
        if (copyFeedbackTimerRef.current === null) return;
        window.clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
    }, []);

    const selectedTargetKey = timelineTargetKey(target);
    const catalogs = useMemo(() => ({ bosses, specs }), [bosses, specs]);
    const acceptedTarget = useMemo(() => (
        acceptedTargetKeyFromState
            ? timelineTargetFromKey(acceptedTargetKeyFromState, catalogs)
            : null
    ), [acceptedTargetKeyFromState, catalogs]);
    const requestTarget = useMemo(() => (
        requestTargetKey ? timelineTargetFromKey(requestTargetKey, catalogs) : null
    ), [catalogs, requestTargetKey]);
    const failedTarget = useMemo(() => (
        error ? timelineTargetFromKey(error.targetKey, catalogs) : null
    ), [catalogs, error]);
    const acceptedTargetKey = acceptedTarget ? acceptedTargetKeyFromState : null;

    const visibility = useMemo(
        () => buildTimelineVisibility(fights, filters, spellDisplay),
        [fights, filters, spellDisplay],
    );
    const visibleFights = useMemo(
        () => visibility.fights.map(({ fight }) => fight),
        [visibility],
    );
    const homeworkSnapshot = useMemo(() => (
        acceptedTarget
            ? buildHomeworkSnapshot({
                target: acceptedTarget,
                visibility,
                spellDisplay,
                spells,
                updated: meta?.updated ?? null,
            })
            : null
    ), [acceptedTarget, meta?.updated, spellDisplay, spells, visibility]);
    const presentation = deriveWorkbenchPresentation({
        selectedTargetKey,
        requestTarget: requestTargetKey,
        acceptedTarget: acceptedTargetKey,
        status,
        error,
        acceptedFightCount: fights.length,
        visibleFightCount: visibleFights.length,
    });

    selectedTargetKeyRef.current = selectedTargetKey;
    acceptedTargetKeyRef.current = acceptedTargetKey;

    useEffect(() => {
        dispatch(uiStore.set_mode(uiStore.MODES.SPEC_RANKING));
    }, [dispatch]);

    useLayoutEffect(() => {
        dispatch(uiStore.clear_copynote());
        return () => {
            dispatch(uiStore.clear_copynote());
        };
    }, [dispatch, selectedTargetKey]);

    useEffect(() => {
        copyAttemptRef.current += 1;
        clearCopyFeedbackTimer();
        setCopyStatus("");
    }, [clearCopyFeedbackTimer, selectedTargetKey]);

    useEffect(() => () => clearCopyFeedbackTimer(), [clearCopyFeedbackTimer]);

    useEffect(() => {
        if (!spec.loaded) {
            dispatch(load_spec_spells(spec.full_name_slug));
        }
    }, [dispatch, spec.full_name_slug, spec.loaded]);

    useEffect(() => {
        if (!boss.loaded) {
            dispatch(load_boss_spells(boss.full_name_slug));
        }
    }, [boss.full_name_slug, boss.loaded, dispatch]);

    useEffect(() => {
        if (!spec.spells_by_type || !boss.spells_by_type) {
            return;
        }
        dispatch(load_fights(uiStore.MODES.SPEC_RANKING, {
            boss_slug: target.bossSlug,
            spec_slug: target.specSlug,
            difficulty: target.difficulty,
            metric: target.metric,
        }));
    }, [
        boss.spells_by_type,
        dispatch,
        retryToken,
        spec.spells_by_type,
        target.bossSlug,
        target.difficulty,
        target.metric,
        target.specSlug,
    ]);

    const onStageReady = useCallback((stage: Stage | null) => {
        stageRef.current = stage;
        if (stage) {
            stage.set_zoom_listener(setZoom);
        }
    }, []);

    const applyZoom = useCallback((action: "in" | "out" | "reset") => {
        const stage = stageRef.current;
        if (!stage) return;
        if (action === "reset") {
            stage.reset_zoom("toolbar");
            return;
        }
        stage.zoom_by(
            action === "in"
                ? timelineConstants.TIMELINE_ZOOM_STEP
                : 1 / timelineConstants.TIMELINE_ZOOM_STEP,
            undefined,
            "toolbar",
        );
    }, []);

    const panTimeline = useCallback((direction: "left" | "right") => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.pan_by(
            direction === "left"
                ? timelineConstants.TIMELINE_KEYBOARD_PAN_STEP
                : -timelineConstants.TIMELINE_KEYBOARD_PAN_STEP,
            "toolbar",
        );
    }, []);

    const onTimelineKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!stageRef.current?.handle_key(event.key)) return;
        event.preventDefault();
    }, []);

    async function copyHomework() {
        if (blockUnavailableCopy(
            selectedTargetKey,
            presentation,
            Boolean(acceptedTarget && acceptedTargetKey),
        ) || !acceptedTarget || !acceptedTargetKey || !homeworkSnapshot) {
            return;
        }

        const attemptId = ++copyAttemptRef.current;
        const snapshotTargetKey = acceptedTargetKey;
        const homework = buildHomeworkExport(homeworkSnapshot);
        recordDiagnostic("target_copy_started", { target: snapshotTargetKey });
        try {
            await copyText(homework);
            recordDiagnostic("target_copy_succeeded", { target: snapshotTargetKey });
            if (
                copyAttemptRef.current === attemptId
                && selectedTargetKeyRef.current === snapshotTargetKey
                && acceptedTargetKeyRef.current === snapshotTargetKey
            ) {
                clearCopyFeedbackTimer();
                setCopyStatus(ZH_CN.workbench.copied);
                copyFeedbackTimerRef.current = window.setTimeout(() => {
                    if (
                        copyAttemptRef.current === attemptId
                        && selectedTargetKeyRef.current === snapshotTargetKey
                        && acceptedTargetKeyRef.current === snapshotTargetKey
                    ) {
                        setCopyStatus("");
                    }
                    copyFeedbackTimerRef.current = null;
                }, 1500);
            }
        } catch {
            recordDiagnostic("target_copy_failed", {
                target: snapshotTargetKey,
                reason: "clipboard-write-failed",
            });
            if (
                copyAttemptRef.current === attemptId
                && selectedTargetKeyRef.current === snapshotTargetKey
                && acceptedTargetKeyRef.current === snapshotTargetKey
            ) {
                clearCopyFeedbackTimer();
                setCopyStatus(ZH_CN.workbench.copyFailed);
            }
        }
    }

    const timelineControls = (
        <div
            className={styles.timelineTools}
            role="toolbar"
            aria-label={ZH_CN.settings.timelineTools}
            onKeyDown={onTimelineKeyDown}
        >
            <div
                className={`${styles.timelineToolGroup} ${styles.timelinePanGroup}`}
                role="group"
                aria-label={ZH_CN.settings.panControls}
            >
                <button
                    type="button"
                    data-timeline-control="pan"
                    disabled={!presentation.showAcceptedTimeline}
                    onClick={() => panTimeline("left")}
                    aria-label={ZH_CN.settings.panLeft}
                >
                    <FaArrowLeft />
                </button>
                <button
                    type="button"
                    data-timeline-control="pan"
                    disabled={!presentation.showAcceptedTimeline}
                    onClick={() => panTimeline("right")}
                    aria-label={ZH_CN.settings.panRight}
                >
                    <FaArrowRight />
                </button>
            </div>
            <div
                className={`${styles.timelineToolGroup} ${styles.timelineZoomGroup}`}
                role="group"
                aria-label={ZH_CN.settings.zoomControls}
            >
                <button
                    type="button"
                    disabled={!presentation.showAcceptedTimeline}
                    onClick={() => applyZoom("out")}
                    aria-label={ZH_CN.settings.zoomOut}
                >
                    <FaMagnifyingGlassMinus />
                </button>
                <output>{zoom.toFixed(1)}x</output>
                <button
                    type="button"
                    disabled={!presentation.showAcceptedTimeline}
                    onClick={() => applyZoom("in")}
                    aria-label={ZH_CN.settings.zoomIn}
                >
                    <FaMagnifyingGlassPlus />
                </button>
                <button
                    type="button"
                    data-timeline-control="reset"
                    disabled={!presentation.showAcceptedTimeline}
                    onClick={() => applyZoom("reset")}
                    aria-label={ZH_CN.settings.zoomReset}
                >
                    <FaRotateLeft />
                </button>
            </div>
        </div>
    );

    const timeline = (
        <div className={`${styles.timelineBody} spec_ranking`}>
            <PlayerNamesList visibility={visibility} />
            <TimelineCanvas
                fights={fights}
                visibility={visibility}
                onStageReady={onStageReady}
            />
            {homeworkSnapshot && acceptedTargetKey && (
                <TimelineTextAlternative
                    snapshot={homeworkSnapshot}
                    targetKey={acceptedTargetKey}
                    ariaLabel={ZH_CN.workbench.timelineTextLabel}
                />
            )}
        </div>
    );

    return (
        <>
            <CopyNoteWindow />
            <TimelineWorkbenchView
                selectedTarget={target}
                acceptedTarget={acceptedTarget}
                requestTarget={requestTarget}
                failedTarget={failedTarget}
                presentation={presentation}
                error={error}
                meta={meta}
                visibleCount={visibleFights.length}
                copyStatus={copyStatus}
                headingLevel={headingLevel}
                onCopy={copyHomework}
                onRetry={() => setRetryToken((value) => value + 1)}
                onClearFilters={() => dispatch(uiStore.reset_filters())}
                targetPicker={targetPicker}
                settings={<TimelineSettings filters={filters} />}
                timelineControls={timelineControls}
                timeline={timeline}
            />
        </>
    );
}
