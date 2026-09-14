import { recordDiagnostic } from "../../diagnostics";
import { ZH_CN } from "../../localization/zhCN";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import TargetSelector from "./TargetSelector";
import styles from "./TargetPicker.module.scss";
import { timelineTargetKey, type TimelineTarget } from "./types";

export default function TargetPicker({ bosses, specs, value, onChange }: {
    bosses: Boss[];
    specs: Spec[];
    value: TimelineTarget;
    onChange: (target: TimelineTarget) => void;
}) {
    function select(target: TimelineTarget) {
        if (timelineTargetKey(target) === timelineTargetKey(value)) return;
        recordDiagnostic("target_selection_submitted", {
            from: timelineTargetKey(value), to: timelineTargetKey(target), surface: "inline",
        });
        onChange(target);
    }
    return (
        <section className={styles.picker} aria-label={ZH_CN.selector.currentTargetAndDifficulty}>
            <TargetSelector bosses={bosses} specs={specs} value={value} onChange={select} />
            <fieldset className={styles.difficulty}>
                <legend>{ZH_CN.selector.difficulty}</legend>
                {(["mythic", "heroic"] as const).map(difficulty => (
                    <button key={difficulty} type="button" aria-pressed={value.difficulty === difficulty}
                        onClick={() => select({ ...value, difficulty })}>
                        {ZH_CN.selector[difficulty]}
                    </button>
                ))}
            </fieldset>
        </section>
    );
}
