import type { TimelineVisibility } from "../../filter_logic";
import PlayerNamesFight from "./PlayerNamesFight";
import styles from "./PlayerNamesList.module.scss";

export default function PlayerNamesList({
    visibility,
}: {
    visibility: TimelineVisibility;
}) {
    return (
        <div className={styles.player_names_list}>
            {visibility.fights.map((visibleFight) => (
                <PlayerNamesFight
                    key={`${visibleFight.fight.report_id}-${visibleFight.fight.fight_id}`}
                    visibleFight={visibleFight}
                />
            ))}
        </div>
    );
}
