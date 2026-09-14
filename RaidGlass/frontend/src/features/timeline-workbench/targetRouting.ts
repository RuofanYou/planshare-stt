import { bossDisplayName } from "../../localization/bossNames";
import { specDisplayName } from "../../localization/zhCN";
import type Boss from "../../types/boss";
import type Spec from "../../types/spec";
import type { TimelineDifficulty, TimelineMetric, TimelineTarget } from "./types";

export interface TimelineCatalogs {
    bosses: Readonly<Record<string, Boss>>;
    specs: Readonly<Record<string, Spec>>;
}

export interface TargetRouteInput {
    pathname: string;
    search: string;
    catalogs: TimelineCatalogs | null;
}

export type TargetRouteResolution =
    | { kind: "pending" }
    | { kind: "redirect"; target: TimelineTarget; to: string }
    | { kind: "valid"; target: TimelineTarget }
    | { kind: "not-found"; address: string };

const DIFFICULTIES = new Set<TimelineDifficulty>(["mythic", "heroic"]);
const METRICS = new Set<TimelineMetric>(["dps", "bossdps", "hps"]);

function isDifficulty(value: string): value is TimelineDifficulty {
    return DIFFICULTIES.has(value as TimelineDifficulty);
}

function isMetric(value: string): value is TimelineMetric {
    return METRICS.has(value as TimelineMetric);
}

function defaultMetric(spec: Spec): TimelineMetric {
    return spec.role === "heal" ? "hps" : "dps";
}

function targetFromCatalogs(
    bossSlug: string,
    specSlug: string,
    difficulty: TimelineDifficulty,
    metric: TimelineMetric,
    catalogs: TimelineCatalogs,
): TimelineTarget | null {
    const boss = catalogs.bosses[bossSlug];
    const spec = catalogs.specs[specSlug];
    if (!boss || !spec) return null;

    return {
        bossSlug,
        bossName: bossDisplayName(boss),
        specSlug,
        specName: specDisplayName(spec),
        difficulty,
        metric,
    };
}

export function timelineTargetUrl(target: TimelineTarget) {
    const query = new URLSearchParams({
        difficulty: target.difficulty,
        metric: target.metric,
    });
    return `/spec_ranking/${target.specSlug}/${target.bossSlug}?${query.toString()}`;
}

export function timelineTargetFromKey(targetKey: string, catalogs: TimelineCatalogs): TimelineTarget | null {
    const [bossSlug, specSlug, difficulty, metric, ...extra] = targetKey.split("/");
    if (extra.length > 0 || !bossSlug || !specSlug || !isDifficulty(difficulty) || !isMetric(metric)) {
        return null;
    }
    return targetFromCatalogs(bossSlug, specSlug, difficulty, metric, catalogs);
}

export function resolveTimelineTargetRoute({
    pathname,
    search,
    catalogs,
}: TargetRouteInput): TargetRouteResolution {
    const address = `${pathname}${search}`;

    if (pathname === "/") {
        if (!catalogs) return { kind: "pending" };
        const boss = Object.values(catalogs.bosses)[0];
        const spec = Object.values(catalogs.specs).find(spec => spec.role === "heal")
            ?? Object.values(catalogs.specs)[0];
        if (!boss || !spec) return { kind: "not-found", address };

        const target = targetFromCatalogs(
            boss.full_name_slug,
            spec.full_name_slug,
            "mythic",
            defaultMetric(spec),
            catalogs,
        );
        if (!target) return { kind: "not-found", address };
        return { kind: "redirect", target, to: timelineTargetUrl(target) };
    }

    const match = pathname.match(/^\/spec_ranking\/([^/]+)\/([^/]+)$/);
    if (!match) return { kind: "not-found", address };
    if (!catalogs) return { kind: "pending" };

    const [, specSlug, bossSlug] = match;
    const boss = catalogs.bosses[bossSlug];
    const spec = catalogs.specs[specSlug];
    if (!boss || !spec) return { kind: "not-found", address };

    const query = new URLSearchParams(search);
    const difficultyValue = query.get("difficulty");
    const metricValue = query.get("metric");
    if ((difficultyValue !== null && !isDifficulty(difficultyValue))
        || (metricValue !== null && !isMetric(metricValue))) {
        return { kind: "not-found", address };
    }

    const target = targetFromCatalogs(
        bossSlug,
        specSlug,
        difficultyValue ?? "mythic",
        metricValue ?? defaultMetric(spec),
        catalogs,
    );
    if (!target) return { kind: "not-found", address };

    const canonicalUrl = timelineTargetUrl(target);
    if (address !== canonicalUrl) {
        return { kind: "redirect", target, to: canonicalUrl };
    }
    return { kind: "valid", target };
}
