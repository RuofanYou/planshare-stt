import { useMemo } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTitle } from "react-use";

import {
    buildCompCriteriaCatalog,
    buildCompReferencePath,
    parseCompCriteria,
    type CompCriteriaCatalog,
    type CompOperator,
} from "../features/comp-reference/criteria";
import { ZH_CN } from "../localization/zhCN";
import { useAppSelector } from "../store/store_hooks";
import BossSelect from "./CompSearch/BossSelect";
import BossSelection from "./CompSearch/BossSelection";
import KilltimeGroup from "./CompSearch/KilltimeGroup";
import PlayerRoleSearch from "./CompSearch/PlayerRoleSearch";
import PlayerSelection from "./CompSearch/PlayerSelection";
import PlayerSpecSearch from "./CompSearch/PlayerSpecSearch";
import SearchSubmitButton from "./CompSearch/SearchSubmitButton";
import style from "./CompSearch/CompSearch.module.scss";

interface CompSearchCountValue {
    op?: CompOperator | string;
    count?: string | number;
}

export interface CompSearchFormValues {
    boss_name_slug: string;
    killtime_min?: number;
    killtime_max?: number;
    comp: {
        role: Record<string, CompSearchCountValue>;
        spec: Record<string, CompSearchCountValue>;
    };
}

export function criteriaFromForm(
    values: CompSearchFormValues,
    catalog: CompCriteriaCatalog,
) {
    const params = new URLSearchParams();

    (["role", "spec"] as const).forEach((group) => {
        Object.entries(values.comp[group] ?? {}).forEach(([key, criterion]) => {
            const count = criterion.count;
            if (count === undefined || String(count).trim() === "") return;
            params.append(group, `${key}.${criterion.op ?? "eq"}.${count}`);
        });
    });

    if (values.killtime_min !== undefined) {
        params.set("killtime_min", String(values.killtime_min));
    }
    if (values.killtime_max !== undefined) {
        params.set("killtime_max", String(values.killtime_max));
    }

    return parseCompCriteria(params.toString(), catalog);
}

const DEFAULT_VALUES: CompSearchFormValues = {
    boss_name_slug: "",
    comp: {
        role: {},
        spec: {},
    },
};

export default function CompSearch() {
    const rolesByCode = useAppSelector((state) => state.roles);
    const specsByName = useAppSelector((state) => state.specs.specs_by_name);
    const catalog = useMemo(
        () => buildCompCriteriaCatalog(rolesByCode, specsByName),
        [rolesByCode, specsByName],
    );
    const formMethods = useForm<CompSearchFormValues>({ defaultValues: DEFAULT_VALUES });
    const selectedBossSlug = useWatch({
        control: formMethods.control,
        name: "boss_name_slug",
    });
    const navigate = useNavigate();

    useTitle("RaidGlass: 阵容参考");

    function onSubmit(values: CompSearchFormValues) {
        formMethods.clearErrors("root.criteria");
        const parsed = criteriaFromForm(values, catalog);
        if (parsed.errors.length > 0) {
            formMethods.setError("root.criteria", {
                type: "validate",
                message: parsed.errors.join("；"),
            });
            return;
        }
        navigate(buildCompReferencePath(values.boss_name_slug, parsed.criteria));
    }

    const criteriaError = formMethods.formState.errors.root?.criteria?.message;

    return (
        <div className={style.page}>
            <header className={style.intro}>
                <p className={style.eyebrow}>{ZH_CN.comp.title}</p>
                <h1>{ZH_CN.comp.introTitle}</h1>
                <p>{ZH_CN.comp.introDescription}</p>
            </header>

            <FormProvider {...formMethods}>
                <form
                    aria-label="阵容搜索"
                    className={style.form}
                    onSubmit={formMethods.handleSubmit(onSubmit)}
                >
                    <ol className={style.steps}>
                        <li className={style.step} data-testid="comp-search-step">
                            <span className={style.stepNumber} aria-hidden="true">01</span>
                            <section className={style.stepCard} aria-labelledby="comp-search-boss-title">
                                <div className={style.stepHeading}>
                                    <h2 id="comp-search-boss-title">{ZH_CN.comp.chooseBoss}</h2>
                                    <p>{ZH_CN.comp.chooseBossDescription}</p>
                                </div>
                                <BossSelect />
                            </section>
                        </li>

                        {selectedBossSlug && (
                            <>
                                <li className={style.step} data-testid="comp-search-step">
                                    <span className={style.stepNumber} aria-hidden="true">02</span>
                                    <section
                                        className={style.stepCard}
                                        aria-labelledby="comp-search-criteria-title"
                                    >
                                        <div className={style.stepHeading}>
                                            <h2 id="comp-search-criteria-title">{ZH_CN.comp.criteriaTitle}</h2>
                                            <p>{ZH_CN.comp.criteriaDescription}</p>
                                        </div>

                                        <PlayerRoleSearch />

                                        <details className={style.advancedFilters}>
                                            <summary>{ZH_CN.comp.moreFilters}</summary>
                                            <div className={style.advancedGrid}>
                                                <KilltimeGroup />
                                                <PlayerSpecSearch />
                                            </div>
                                        </details>
                                    </section>
                                </li>

                                <li className={style.step} data-testid="comp-search-step">
                                    <span className={style.stepNumber} aria-hidden="true">03</span>
                                    <section
                                        className={style.stepCard}
                                        aria-labelledby="comp-search-result-title"
                                    >
                                        <div className={style.stepHeading}>
                                            <h2 id="comp-search-result-title">{ZH_CN.comp.resultTitle}</h2>
                                            <p>{ZH_CN.comp.resultDescription}</p>
                                        </div>

                                        <div
                                            className={style.resultSummary}
                                            aria-live="polite"
                                            aria-atomic="true"
                                        >
                                            <div className={style.resultItem}>
                                                <span className={style.resultLabel}>{ZH_CN.comp.boss}</span>
                                                <BossSelection />
                                            </div>
                                            <span className={style.resultDivider} aria-hidden="true">×</span>
                                            <div className={style.resultItem}>
                                                <span className={style.resultLabel}>{ZH_CN.comp.criteria}</span>
                                                <PlayerSelection />
                                            </div>
                                        </div>

                                        <div className={style.actionRow}>
                                            <p id="comp-search-result-note">
                                                {ZH_CN.comp.submitDescription}
                                            </p>
                                            <SearchSubmitButton describedBy="comp-search-result-note" />
                                        </div>

                                        {criteriaError && (
                                            <p className={style.formError} role="alert">
                                                {String(criteriaError)}
                                            </p>
                                        )}
                                    </section>
                                </li>
                            </>
                        )}
                    </ol>
                </form>
            </FormProvider>
        </div>
    );
}
