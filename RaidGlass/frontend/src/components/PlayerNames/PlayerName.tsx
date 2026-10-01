import { FaCopy } from "react-icons/fa";
import { get_boss } from "../../store/bosses";
import { get_role } from "../../store/roles";
import { get_spec } from "../../store/specs";
import { kFormatter } from "../../utils";
import { useAppDispatch, useAppSelector } from "../../store/store_hooks";
import { WCL_URL } from "../../constants";
import * as ui_store from "../../store/ui"
import { bossShortName } from "../../localization/bossNames";
import styles from "./PlayerName.module.scss";
import type Actor from "../../types/actor";
import type Fight from "../../types/fight";
import WebpImg from "../WebpImg";

function spec_ranking_color(i = 0) {
    if (i <= 0) {
        return "";
    } else if (i == 1) {
        return "wow-artifact";
    } else if (i <= 25) {
        return "wow-astounding";
    } else if (i <= 100) {
        return "wow-legendary";
    } else {
        return "wow-epic";
    }
}

function CopyAsNoteButton({ fight, player }: { fight: Fight, player: Actor }) {

    const dispatch = useAppDispatch()

    function onClick() {
        dispatch(ui_store.set_copynote_fight(fight));
        dispatch(ui_store.set_copynote_player(player));
        dispatch(ui_store.set_show_copynote(true));
    }

    return (
        <button
            type="button"
            className={styles.copyButton}
            onClick={onClick}
            data-tooltip="复制单人作业"
            data-tooltip-dir="down"
            aria-label={`复制${player.name}的作业`}
        >
            <FaCopy aria-hidden="true" />
        </button>
    )
}


export function BossName({ fight, boss }: { fight: Fight; boss: Actor }) {
    ///////////////////
    // hooks
    const boss_type = useAppSelector((state) => get_boss(state, boss.boss_slug));

    ///////////////////
    // apply filters
    if (!boss) {
        return null;
    }
    if (!boss_type) {
        return null;
    }
    ///////////////////
    // Render
    return (
        <a
            className={styles.boss_name}
            target="_blank"
            rel="noreferrer"
            href={fight.report_url}
        >
            <WebpImg className={styles.icon} src={boss_type.icon_path} alt="" />
            <span className={styles.name}>{bossShortName(boss_type)}</span>
        </a>
    );
}

export function PlayerName({ fight, player }: { fight: Fight; player: Actor }) {
    ///////////////////
    // hooks
    const spec = useAppSelector((state) => get_spec(state, player.spec_slug));
    const role = useAppSelector((state) => spec ? get_role(state, spec.role) : undefined);
    const completion = useAppSelector(state => state.fights?.ranking_meta?.skillCompletion);
    const castsComplete = player.casts_complete ?? (!!completion && completion.complete === completion.total);
    const mode_spec = player.rank !== undefined;
    const mode_comp = fight.composition !== undefined;

    ///////////////////
    // apply filters
    if (!player) {
        return null;
    }
    if (!spec) {
        return null;
    }
    ///////////////////
    // vars
    let report_url = `${WCL_URL}/reports/${fight.report_id}#fight=${fight.fight_id}`;
    if (player.source_id && player.source_id > 0) {
        report_url = `${report_url}&source=${player.source_id}`;
    }

    const className = spec_ranking_color(player.rank) || `wow-${player.class_slug}`;

    ///////////////////
    // render
    return (
        <div className={`${styles.player_name} ${className}`} data-player-row>
            <a
                className={`${styles.playerLink} ${mode_comp ? styles.compLink : ""}`}
                target="_blank"
                rel="noreferrer"
                href={report_url}
                aria-label={`查看${player.name}的 WCL 报告`}
            >
                <span className={styles.identityIcons} aria-hidden="true">
                    {mode_comp && role && <img className={styles.icon} src={role.icon_path} alt="" />}
                    <WebpImg className={styles.icon} src={spec.icon_path} alt="" />
                </span>
                <span className={styles.rank} data-player-rank>{mode_spec && player.rank ? `#${player.rank}` : ""}</span>
                <span className={styles.name} title={player.name}>{player.name}
                    {mode_spec && <small className={styles.castStatus} title={castsComplete ? "全部主动技能已补齐" : "技能缺失不代表未施放"}>
                        {castsComplete ? "已补齐" : "待补齐"}
                    </small>}
                </span>
                <span className={styles.total} data-player-total>{player.total ? kFormatter(player.total) : "—"}</span>
            </a>
            <CopyAsNoteButton fight={fight} player={player} />
        </div>
    );
}
