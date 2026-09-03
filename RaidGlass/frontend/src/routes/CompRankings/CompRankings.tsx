import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTitle } from "react-use";

import { buildTimelineVisibility } from "../../filter_logic";
import {
    buildCompCriteriaCatalog,
    compTargetKey,
    parseCompCriteria,
    parseCompTargetKey,
} from "../../features/comp-reference/criteria";
import { buildTimelineTextSnapshot } from "../../features/timeline-workbench/homework";
import { ZH_CN } from "../../localization/zhCN";
import { get_bosses, load_boss_spells } from "../../store/bosses";
import { get_fights, load_fights } from "../../store/fights";
import { get_spells } from "../../store/spells";
import { load_spec_spells } from "../../store/specs";
import { useAppDispatch, useAppSelector } from "../../store/store_hooks";
import { createDefaultFilters, MODES, set_mode } from "../../store/ui";
import CompRankingsView, {
    type CompRankingsDisplay,
    type CompRankingsViewState,
} from "./CompRankingsView";
import { formatCompCriteriaSummary } from "./CompRankingsHeader";

export default function CompRankings() {
    const { boss_slug: bossSlug } = useParams<{ boss_slug: string }>();
    const { search } = useLocation();
    const dispatch = useAppDispatch();
    const bosses = useAppSelector(get_bosses);
    const roles = useAppSelector((state) => state.roles);
    const specs = useAppSelector((state) => state.specs.specs_by_name);
    const fights = useAppSelector(get_fights);
    const spellDisplay = useAppSelector((state) => state.spells.spell_display);
    const spells = useAppSelector(get_spells);
    const status = useAppSelector((state) => state.fights.status);
    const error = useAppSelector((state) => state.fights.error);
    const acceptedTarget = useAppSelector((state) => state.fights.accepted_target);
    const meta = useAppSelector((state) => state.fights.ranking_meta);
    const [retryToken, setRetryToken] = useState(0);

    const catalog = useMemo(
        () => buildCompCriteriaCatalog(roles, specs),
        [roles, specs],
    );
    const bossKeys = useMemo(() => new Set(Object.keys(bosses)), [bosses]);
    const parsed = useMemo(() => parseCompCriteria(search, catalog), [catalog, search]);
    const bossKnown = Boolean(
        bossSlug
        && bossKeys.has(bossSlug)
        && ZH_CN.bossNames[bossSlug],
    );
    const routeState: "unknown-boss" | "invalid-query" | null = !bossKnown
        ? "unknown-boss"
        : parsed.errors.length > 0 ? "invalid-query" : null;
    const selectedTargetKey = routeState === null && bossSlug
        ? compTargetKey(bossSlug, parsed.criteria)
        : null;
    const compFilters = useMemo(() => ({
        ...createDefaultFilters(),
        hide_empty_rows: true,
    }), []);

    const acceptedComp = useMemo(() => (
        acceptedTarget
            ? parseCompTargetKey(acceptedTarget, catalog, bossKeys)
            : null
    ), [acceptedTarget, bossKeys, catalog]);
    const hasAcceptedData = acceptedComp !== null && fights.length > 0;
    const display = useMemo<CompRankingsDisplay | null>(() => {
        if (!acceptedTarget || !acceptedComp || !hasAcceptedData) return null;
        const bossName = ZH_CN.bossNames[acceptedComp.bossSlug];
        if (!bossName) return null;
        const criteriaSummary = formatCompCriteriaSummary(acceptedComp.criteria);
        const visibility = buildTimelineVisibility(fights, compFilters, spellDisplay);
        return {
            bossSlug: acceptedComp.bossSlug,
            bossName,
            targetKey: acceptedTarget,
            criteria: acceptedComp.criteria,
            criteriaSummary,
            fights,
            visibility,
            snapshot: buildTimelineTextSnapshot({
                title: bossName,
                context: criteriaSummary,
                visibility,
                spellDisplay,
                spells,
                updated: meta?.updated ?? null,
            }),
            meta,
        };
    }, [
        acceptedComp,
        acceptedTarget,
        compFilters,
        fights,
        hasAcceptedData,
        meta,
        spellDisplay,
        spells,
    ]);

    let viewState: CompRankingsViewState;
    if (routeState !== null) {
        viewState = routeState;
    } else if (status === "error" && error?.targetKey === selectedTargetKey) {
        viewState = hasAcceptedData ? "error-with-data" : "error";
    } else if (acceptedTarget !== selectedTargetKey) {
        viewState = "switching";
    } else if (fights.length === 0) {
        viewState = "empty";
    } else {
        viewState = "ready";
    }

    useTitle(
        bossKnown && bossSlug
            ? `RaidGlass: ${ZH_CN.bossNames[bossSlug]} · ${ZH_CN.comp.title}`
            : `RaidGlass: ${ZH_CN.comp.title}`,
    );

    useEffect(() => {
        if (routeState !== null || !bossSlug) return;
        dispatch(set_mode(MODES.COMP_RANKING));
        dispatch(load_fights(MODES.COMP_RANKING, { boss_slug: bossSlug, search }));
    }, [bossSlug, dispatch, retryToken, routeState, search]);

    useEffect(() => {
        if (!display) return;
        const acceptedBoss = bosses[display.bossSlug];
        if (acceptedBoss && !acceptedBoss.loaded) {
            dispatch(load_boss_spells(display.bossSlug));
        }
        const visibleSpecs = new Set(
            display.visibility.fights.flatMap(({ actors }) => (
                actors
                    .filter(({ kind }) => kind === "player")
                    .map(({ actor }) => actor.spec_slug)
            )),
        );
        visibleSpecs.forEach((specSlug) => {
            if (specs[specSlug] && !specs[specSlug].loaded) {
                dispatch(load_spec_spells(specSlug));
            }
        });
    }, [bosses, dispatch, display, specs]);

    return (
        <CompRankingsView
            state={viewState}
            display={display}
            filters={compFilters}
            errorMessage={error?.targetKey === selectedTargetKey ? error.message : null}
            onRetry={() => setRetryToken((value) => value + 1)}
        />
    );
}
