/*
    Component to show the currently selected Boss
*/

import WebpImg from "../../components/WebpImg";
import { ZH_CN } from "../../localization/zhCN";
import { get_boss } from '../../store/bosses';
import { useAppSelector } from '../../store/store_hooks';
import { useWatch } from "react-hook-form";


export default function BossSelection() {

    // currently selected boss name
    const boss_name_slug = useWatch({name: "boss_name_slug"})
    const boss = useAppSelector(state => get_boss(state, boss_name_slug))

    const displayName = boss ? ZH_CN.bossNames[boss.full_name_slug] : undefined;
    if (!boss || !displayName) {
        return <p className="boss-selection__placeholder">尚未选择首领</p>;
    }

    return (
        <div className="boss-selection">
            <WebpImg
                className="boss-selection__icon icon-l rounded wow-border-boss"
                src={boss.icon_path}
                alt=""
                aria-hidden="true"
            />
            <span className="boss-selection__name wow-boss">{displayName}</span>
        </div>
    )
}
