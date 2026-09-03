/*
    Component to show the currently selected Roles/Specs
*/

import { useWatch } from "react-hook-form";
import CompPreview, { type CompCountMap } from '../../components/CompPreview';
import { ZH_CN } from '../../localization/zhCN';


export default function PlayerSelection() {

    // Fetch Form Vars
    const roles = useWatch({name: "comp.role"}) as CompCountMap | undefined
    const specs = useWatch({name: "comp.spec"}) as CompCountMap | undefined

    const has_filters = [...Object.values(roles ?? {}), ...Object.values(specs ?? {})]
        .some((value) => value?.count !== undefined && value.count !== "");

    if (!has_filters) {
        return <p className="player-selection__placeholder">{ZH_CN.comp.anyComp}</p>;
    }

    return (
        <div className="player-selection">
            <CompPreview roles={roles} specs={specs} />
        </div>
    );
}
