import type { TimelineVisibleFight } from "../../filter_logic";
import styles from "./PlayerName.module.scss";
import { FightInfo } from "./FightInfo";
import { BossName, PlayerName } from "./PlayerName";

export default function PlayerNamesFight({
    visibleFight,
}: {
    visibleFight: TimelineVisibleFight;
}) {
    const { fight, actors } = visibleFight;
    return (
        <div className={styles.fight}>
            <div>
                <FightInfo fight={fight} />
                {actors.map(({ actor, kind }) => (
                    kind === "boss"
                        ? <BossName key="boss" fight={fight} boss={actor} />
                        : (
                            <PlayerName
                                key={`${fight.report_id}_${actor.name}`}
                                fight={fight}
                                player={actor}
                            />
                        )
                ))}
            </div>
        </div>
    );
}
