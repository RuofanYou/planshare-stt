import { useMemo } from "react";

import { bossDisplayName } from "../../localization/bossNames";
import { classDisplayName, specDisplayName, ZH_CN } from "../../localization/zhCN";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import type { TimelineTarget } from "./types";
import styles from "./TimelineWorkbench.module.scss";

function specMetric(spec: Spec) {
    return spec.role === "heal" ? "hps" : "dps";
}

export default function TargetSelector({
    bosses,
    specs,
    value,
    onChange,
}: {
    bosses: Boss[];
    specs: Spec[];
    value: TimelineTarget;
    onChange: (target: TimelineTarget) => void;
}) {
    const classes = useMemo(() => {
        const groups = new Map<string, Spec[]>();
        specs.forEach((spec) => {
            const group = groups.get(spec.class.name_slug) || [];
            group.push(spec);
            groups.set(spec.class.name_slug, group);
        });
        return Array.from(groups.entries())
            .map(([slug, classSpecs]) => ({
                slug,
                name: classDisplayName(slug, classSpecs[0]?.class.name),
                specs: classSpecs,
            }))
            .sort((left, right) => left.slug.localeCompare(right.slug));
    }, [specs]);

    function selectBoss(bossSlug: string) {
        const boss = bosses.find((item) => item.full_name_slug === bossSlug);
        if (!boss) return;
        onChange({
            ...value,
            bossSlug,
            bossName: bossDisplayName(boss),
        });
    }

    function selectSpec(specSlug: string) {
        const spec = specs.find((item) => item.full_name_slug === specSlug);
        if (!spec) return;
        onChange({
            ...value,
            specSlug,
            specName: specDisplayName(spec),
            metric: specMetric(spec),
        });
    }

    return (
        <section
            className={styles.selector}
            aria-label="目标选择"
            data-target-selector-mode="inline"
        >
            <fieldset className={styles.bossControl}>
                <legend>{ZH_CN.selector.boss}</legend>
                <div className={styles.bossChoices}>
                    {bosses.map(boss => (
                        <button key={boss.full_name_slug} data-boss-slug={boss.full_name_slug} type="button"
                            aria-pressed={value.bossSlug === boss.full_name_slug}
                            onClick={() => selectBoss(boss.full_name_slug)}>
                            <img src={boss.icon_path} alt="" data-target-icon="boss" />
                            <span>{bossDisplayName(boss)}</span>
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset className={styles.healerControl}>
                <legend>治疗专精</legend>
                <div className={styles.specChoices}>
                    {specs.filter(spec => spec.role === "heal").map(spec => (
                        <button key={spec.full_name_slug} type="button"
                            aria-pressed={value.specSlug === spec.full_name_slug}
                            onClick={() => selectSpec(spec.full_name_slug)}>
                            <img data-target-icon="spec" src={spec.icon_path} alt="" />
                            <span>{specDisplayName(spec)}</span>
                        </button>
                    ))}
                    <label className={styles.otherSpecs}>
                        <span className={styles.visuallyHidden}>全部专精</span>
                        <select aria-label="全部专精" value={specs.find(spec => spec.full_name_slug === value.specSlug)?.role === "heal" ? "" : value.specSlug}
                            onChange={event => selectSpec(event.target.value)}>
                            <option value="" disabled>全部专精…</option>
                            {classes.map(group => (
                                <optgroup key={group.slug} label={group.name}>
                                    {group.specs.map(spec => <option key={spec.full_name_slug} value={spec.full_name_slug}>{specDisplayName(spec)}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                </div>
            </fieldset>
        </section>
    );
}
