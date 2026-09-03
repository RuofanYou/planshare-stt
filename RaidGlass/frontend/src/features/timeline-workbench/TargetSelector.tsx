import { useMemo } from "react";

import { bossDisplayName } from "../../localization/bossNames";
import { classDisplayName, specDisplayName, ZH_CN } from "../../localization/zhCN";
import { ASSETS } from "../../constants";
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

    const selectedBoss = bosses.find((boss) => boss.full_name_slug === value.bossSlug);
    const selectedSpec = specs.find((spec) => spec.full_name_slug === value.specSlug);
    const selectedClassSlug = selectedSpec?.class.name_slug || classes[0]?.slug || "";
    const selectedClass = classes.find((item) => item.slug === selectedClassSlug);

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

    function selectClass(classSlug: string) {
        const nextSpec = classes.find((item) => item.slug === classSlug)?.specs[0];
        if (!nextSpec) return;
        onChange({
            ...value,
            specSlug: nextSpec.full_name_slug,
            specName: specDisplayName(nextSpec),
            metric: specMetric(nextSpec),
        });
    }

    return (
        <section
            className={styles.selector}
            aria-label="目标选择"
            data-target-selector-mode="draft"
        >
            <label className={styles.bossControl}>
                <span>{ZH_CN.selector.boss}</span>
                <span className={styles.selectWithIcon}>
                    {selectedBoss && (
                        <img
                            className={styles.targetIcon}
                            data-target-icon="boss"
                            src={selectedBoss.icon_path}
                            alt=""
                        />
                    )}
                    <select
                        aria-label={ZH_CN.selector.boss}
                        value={value.bossSlug}
                        onChange={(event) => selectBoss(event.currentTarget.value)}
                    >
                        {bosses.map((boss) => (
                            <option key={boss.full_name_slug} value={boss.full_name_slug}>
                                {bossDisplayName(boss)}
                            </option>
                        ))}
                    </select>
                </span>
            </label>

            <label className={styles.classControl}>
                <span>{ZH_CN.selector.class}</span>
                <span className={styles.selectWithIcon}>
                    {selectedClass && (
                        <img
                            className={styles.targetIcon}
                            data-target-icon="class"
                            src={`${ASSETS}/images/classes/${selectedClass.slug}.webp`}
                            alt=""
                        />
                    )}
                    <select
                        aria-label={ZH_CN.selector.class}
                        value={selectedClassSlug}
                        onChange={(event) => selectClass(event.currentTarget.value)}
                    >
                        {classes.map((item) => (
                            <option key={item.slug} value={item.slug}>{item.name}</option>
                        ))}
                    </select>
                </span>
            </label>

            <fieldset className={styles.specPicker}>
                <legend>{ZH_CN.selector.spec}</legend>
                <div className={styles.specChoices}>
                    {selectedClass?.specs.map((spec) => (
                        <button
                            key={spec.full_name_slug}
                            type="button"
                            aria-pressed={value.specSlug === spec.full_name_slug}
                            onClick={() => selectSpec(spec.full_name_slug)}
                        >
                            <img
                                data-target-icon={value.specSlug === spec.full_name_slug ? "spec" : undefined}
                                src={spec.icon_path}
                                alt=""
                            />
                            <span>{specDisplayName(spec)}</span>
                        </button>
                    ))}
                </div>
            </fieldset>

        </section>
    );
}
