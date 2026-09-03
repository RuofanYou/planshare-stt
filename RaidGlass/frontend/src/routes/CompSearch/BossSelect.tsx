/* Component to select which boss to display */

import FormGroup from './FormGroup';
import WebpImg from "../../components/WebpImg";
import { ZH_CN } from "../../localization/zhCN";
import { get_boss, get_zones } from '../../store/bosses';
import { useAppSelector } from '../../store/store_hooks';
import { useFormContext, useWatch } from "react-hook-form";
import { shallowEqual } from "react-redux";
import type RaidZone from '../../types/raid_zone';



/* Button to select a single boss */
function BossButton({boss_name} : {boss_name: string}) {

    // State Vars
    const form_methods = useFormContext();
    const selected_boss_name_slug = useWatch({name: "boss_name_slug"})

    const boss = useAppSelector(state => get_boss(state, boss_name))
    if (!boss) {
        return null
    }
    const displayName = ZH_CN.bossNames[boss.full_name_slug];
    if (!displayName) return null;

    // Constants
    const is_selected = selected_boss_name_slug === boss.full_name_slug;

    function onClick() {
        form_methods.setValue("boss_name_slug", boss.full_name_slug, {
            shouldDirty: true,
            shouldTouch: true,
        });
    }

    // Render
    return (
        <button
            type="button"
            className={`boss-button ${is_selected ? "active" : ""}`}
            aria-label={displayName}
            aria-pressed={is_selected}
            title={displayName}
            onClick={onClick}
        >
            <WebpImg
                className="boss-button__image icon-spec icon-m rounded"
                src={boss.icon_path}
                alt=""
                aria-hidden="true"
            />
            <span className="boss-button__label">{displayName}</span>
        </button>
    )
}


function RaidZoneGroup({zone} : {zone: RaidZone}) {

    return (
        <section className="boss-zone" aria-label={zone.name}>
            <h3>{zone.name}</h3>
            <div className="boss-button-container">
                {zone.bosses.map(boss_name =>
                    <BossButton key={boss_name} boss_name={boss_name} />
                )}
            </div>
        </section>
    )
}

/* Group of Buttons to allow the user to choose a Boss */
export default function BossSelect() {

    const zones = useAppSelector(get_zones, shallowEqual)

    return (
        <FormGroup name={ZH_CN.comp.chooseBoss} className="boss-zone-list">
            {zones.map(zone =>
                <RaidZoneGroup key={zone.id} zone={zone} />
            )}
        </FormGroup>
    )
}
