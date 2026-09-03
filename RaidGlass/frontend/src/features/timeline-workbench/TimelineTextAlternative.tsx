import { kFormatter } from "../../utils";
import type {
    TimelineActorSnapshot,
    TimelineFightSnapshot,
    TimelineTextSnapshot,
} from "./homework";
import { ZH_CN } from "../../localization/zhCN";
import styles from "./TimelineTextAlternative.module.scss";

export interface TimelineTextAlternativeProps {
    snapshot: TimelineTextSnapshot;
    targetKey: string;
    ariaLabel: string;
}

function ActorSummary({ actor }: { actor: TimelineActorSnapshot }) {
    const identity = ZH_CN.timelineText.actorIdentity(
        actor.kind,
        actor.name,
        actor.rank,
        kFormatter(actor.value),
    );

    return (
        <li>
            <span>{identity}</span>
            {actor.events.length > 0 && (
                <ul>
                    {actor.events.map((event, index) => (
                        <li key={`${event.spellId}-${event.timeMs}-${index}`}>
                            {event.timeLabel} {event.spellName}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function FightSummary({ fight }: { fight: TimelineFightSnapshot }) {
    return (
        <li>
            <p>
                {ZH_CN.timelineText.fightSummary(
                    fight.rank,
                    fight.region,
                    fight.durationLabel,
                    fight.reportUrl,
                )}
            </p>
            <ul>
                {fight.actors.map((actor, index) => (
                    <ActorSummary
                        key={`${actor.kind}-${actor.name}-${index}`}
                        actor={actor}
                    />
                ))}
            </ul>
        </li>
    );
}

export default function TimelineTextAlternative({
    snapshot,
    targetKey,
    ariaLabel,
}: TimelineTextAlternativeProps) {
    return (
        <>
            <p
                className={styles.visuallyHidden}
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {ZH_CN.timelineText.updateSummary(
                    snapshot.fights.length,
                    snapshot.hiddenPlayerCount,
                )}
            </p>
            <section
                className={styles.visuallyHidden}
                role="region"
                aria-label={ariaLabel}
                data-target-key={targetKey}
            >
                <h3>{snapshot.title}</h3>
                <p>{snapshot.context}</p>
                {snapshot.updated && <p>{ZH_CN.timelineText.dataTime(snapshot.updated)}</p>}
                <p>{ZH_CN.timelineText.hiddenPlayers(snapshot.hiddenPlayerCount)}</p>
                <ol>
                    {snapshot.fights.map((fight) => (
                        <FightSummary key={`${targetKey}-${fight.rank}`} fight={fight} />
                    ))}
                </ol>
            </section>
        </>
    );
}
