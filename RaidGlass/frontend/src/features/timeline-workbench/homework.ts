import { PRODUCT_CONFIG } from "../../config/product";
import type { TimelineVisibility } from "../../filter_logic";
import type Actor from "../../types/actor";
import type { SpellDict } from "../../types/spell";
import { toMMSS } from "../../utils";
import type { TimelineTarget } from "./types";

export interface HomeworkEvent {
    spellId: number;
    spellName: string;
    timeMs: number;
    timeLabel: string;
}

export interface TimelineActorSnapshot {
    kind: "boss" | "player";
    rank: number | null;
    name: string;
    value: number;
    events: HomeworkEvent[];
}

export interface TimelineFightSnapshot {
    rank: number;
    region: string;
    durationMs: number;
    durationLabel: string;
    reportUrl: string;
    actors: TimelineActorSnapshot[];
}

export interface TimelineTextSnapshot {
    title: string;
    context: string;
    updated: string | null;
    hiddenPlayerCount: number;
    fights: TimelineFightSnapshot[];
}

export interface HomeworkSnapshot extends TimelineTextSnapshot {
    target: TimelineTarget;
}

export interface TimelineTextSnapshotInput {
    title: string;
    context: string;
    visibility: TimelineVisibility;
    spellDisplay: Record<number, boolean | undefined>;
    spells: SpellDict;
    updated: string | null;
}

export interface HomeworkSnapshotInput {
    target: TimelineTarget;
    visibility: TimelineVisibility;
    spellDisplay: Record<number, boolean | undefined>;
    spells: SpellDict;
    updated: string | null;
}

function actorEvents(
    actor: Actor,
    spellDisplay: Record<number, boolean | undefined>,
    spells: SpellDict,
): HomeworkEvent[] {
    return actor.casts
        .filter((cast) => spellDisplay[cast.id] !== false)
        .map((cast) => ({
            spellId: cast.id,
            spellName: spells[cast.id]?.name || `法术 ${cast.id}`,
            timeMs: cast.ts,
            timeLabel: toMMSS(cast.ts / 1000, 1),
        }));
}

export function buildTimelineTextSnapshot({
    title,
    context,
    visibility,
    spellDisplay,
    spells,
    updated,
}: TimelineTextSnapshotInput): TimelineTextSnapshot {
    return {
        title,
        context,
        updated,
        hiddenPlayerCount: visibility.hiddenPlayerCount,
        fights: visibility.fights
            .slice(0, PRODUCT_CONFIG.rankingTopN)
            .map(({ fight, actors }, fightIndex) => ({
                rank: fightIndex + 1,
                region: fight.region || "未标注",
                durationMs: fight.duration,
                durationLabel: toMMSS(fight.duration / 1000, 1),
                reportUrl: fight.report_url,
                actors: actors.map(({ actor, kind }) => ({
                    kind,
                    rank: kind === "player" ? actor.rank ?? null : null,
                    name: kind === "boss" ? title : actor.name,
                    value: kind === "boss" ? 0 : actor.total,
                    events: actorEvents(actor, spellDisplay, spells),
                })),
            })),
    };
}

function difficultyName(difficulty: TimelineTarget["difficulty"]) {
    return difficulty === "heroic" ? "英雄" : "史诗";
}

export function buildHomeworkSnapshot({
    target,
    visibility,
    spellDisplay,
    spells,
    updated,
}: HomeworkSnapshotInput): HomeworkSnapshot {
    return {
        ...buildTimelineTextSnapshot({
            title: target.bossName,
            context: `${target.specName} · ${difficultyName(target.difficulty)}`,
            visibility,
            spellDisplay,
            spells,
            updated,
        }),
        target,
    };
}

export function buildHomeworkExport(snapshot: HomeworkSnapshot): string {
    const rows = [
        "# RaidGlass Top10 时间轴作业",
        `首领：${snapshot.target.bossName}`,
        `专精：${snapshot.target.specName}`,
        `难度：${difficultyName(snapshot.target.difficulty)}`,
        `来源：WCL Top${PRODUCT_CONFIG.rankingTopN}`,
        "",
    ];

    snapshot.fights.forEach((fight) => {
        fight.actors
            .filter((actor) => actor.kind === "player")
            .forEach((actor) => {
                rows.push(`## #${actor.rank ?? fight.rank} ${actor.name}`);
                rows.push(`报告：${fight.reportUrl}`);
                rows.push(`击杀时长：${fight.durationLabel}`);
                actor.events.forEach((event) => {
                    rows.push(`{time:${event.timeLabel}} - ${actor.name} {spell:${event.spellId}}`);
                });
                rows.push("");
            });
    });

    return rows.join("\n");
}
