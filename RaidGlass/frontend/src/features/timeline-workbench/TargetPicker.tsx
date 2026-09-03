import { useEffect, useRef, useState, type FormEvent } from "react";

import { AdaptiveDialogPanel } from "../../components/AdaptiveDialogPanel/AdaptiveDialogPanel";
import { recordDiagnostic } from "../../diagnostics";
import { ZH_CN } from "../../localization/zhCN";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import TargetSelector from "./TargetSelector";
import styles from "./TargetPicker.module.scss";
import { timelineTargetKey, type TimelineDifficulty, type TimelineTarget } from "./types";

interface TargetPickerProps {
    bosses: Boss[];
    specs: Spec[];
    value: TimelineTarget;
    onChange: (target: TimelineTarget) => void;
}

export default function TargetPicker({
    bosses,
    specs,
    value,
    onChange,
}: TargetPickerProps) {
    const [draft, setDraft] = useState(value);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const valueKey = timelineTargetKey(value);
    const selectedBoss = bosses.find((boss) => boss.full_name_slug === value.bossSlug);
    const selectedSpec = specs.find((spec) => spec.full_name_slug === value.specSlug);
    const targetName = `${value.bossName} · ${value.specName}`;

    useEffect(() => {
        setDraft(value);
    }, [valueKey]);

    function selectDifficulty(difficulty: TimelineDifficulty) {
        if (difficulty === value.difficulty) return;
        recordDiagnostic("target_difficulty_changed", {
            from: value.difficulty,
            target: valueKey,
            to: difficulty,
        });
        onChange({ ...value, difficulty });
    }

    return (
        <section className={styles.picker} aria-label={ZH_CN.selector.currentTargetAndDifficulty}>
            <AdaptiveDialogPanel
                title={ZH_CN.selector.chooseTarget}
                description={ZH_CN.selector.chooseTargetDescription}
                trigger={({ ref, ...triggerProps }) => (
                    <button
                        ref={ref}
                        {...triggerProps}
                        type="button"
                        className={styles.targetTrigger}
                        aria-label={ZH_CN.selector.changeTarget(targetName)}
                        title={targetName}
                    >
                        <span className={styles.targetIcons} aria-hidden="true">
                            {selectedBoss && (
                                <img
                                    data-target-picker-icon="boss"
                                    src={selectedBoss.icon_path}
                                    alt=""
                                />
                            )}
                            {selectedSpec && (
                                <img
                                    data-target-picker-icon="spec"
                                    src={selectedSpec.icon_path}
                                    alt=""
                                />
                            )}
                        </span>
                        <span className={styles.targetName}>{targetName}</span>
                        <span className={styles.disclosure} aria-hidden="true">⌄</span>
                    </button>
                )}
                onStateChange={(open, transition) => {
                    recordDiagnostic(open ? "target_picker_opened" : "target_picker_closed", {
                        reason: transition.reason,
                        surface: transition.surface,
                        target: valueKey,
                    });
                    if (open) {
                        submittingRef.current = false;
                        setSubmitting(false);
                        setDraft(value);
                    }
                }}
            >
                {({ close, surface }) => {
                    function submit(event: FormEvent<HTMLFormElement>) {
                        event.preventDefault();
                        if (submittingRef.current) return;
                        submittingRef.current = true;
                        setSubmitting(true);
                        recordDiagnostic("target_selection_submitted", {
                            from: valueKey,
                            surface,
                            to: timelineTargetKey(draft),
                        });
                        onChange(draft);
                        close();
                    }

                    return (
                        <form
                            className={styles.form}
                            data-surface={surface}
                            onSubmit={submit}
                        >
                            <TargetSelector
                                bosses={bosses}
                                specs={specs}
                                value={draft}
                                onChange={setDraft}
                            />
                            <div className={styles.formActions}>
                                <button
                                    type="submit"
                                    className={styles.confirmButton}
                                    disabled={submitting}
                                >
                                    {ZH_CN.selector.confirmTarget}
                                </button>
                            </div>
                        </form>
                    );
                }}
            </AdaptiveDialogPanel>

            <fieldset className={styles.difficulty}>
                <legend className={styles.visuallyHidden}>{ZH_CN.selector.difficulty}</legend>
                <button
                    type="button"
                    aria-pressed={value.difficulty === "mythic"}
                    onClick={() => selectDifficulty("mythic")}
                >
                    {ZH_CN.selector.mythic}
                </button>
                <button
                    type="button"
                    aria-pressed={value.difficulty === "heroic"}
                    onClick={() => selectDifficulty("heroic")}
                >
                    {ZH_CN.selector.heroic}
                </button>
            </fieldset>
        </section>
    );
}
