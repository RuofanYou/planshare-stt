import { set_region_filter } from '../../../store/ui'
import { useAppDispatch, useAppSelector } from '../../../store/store_hooks'
import { useContext, useEffect } from 'react'
import ButtonGroup, { ButtonGroupContext } from '../shared/ButtonGroup'
import styles from "./RegionFilter.module.scss"
import { ZH_CN } from "../../../localization/zhCN"


interface Region {
    id: number
    slug: string
}

/* Based on
```
query Operations {
    worldData {
        regions {
            id
            slug
            name
        }
    }
}
```
*/
const REGIONS: Region[] = [
    { id: 1, slug: "US" },
    { id: 2, slug: "EU" },
    { id: 3, slug: "KR" },
    { id: 4, slug: "TW" },
    { id: 5, slug: "CN" },
];


function Button({ region }: { region: Region }) {

    const dispatch = useAppDispatch()
    const selected = useAppSelector(state => state.ui.filters.region[region.slug] !== false)
    const group_context = useContext(ButtonGroupContext)

    function applySelected(visible: boolean) {
        dispatch(set_region_filter({
            region: region.slug,
            value: visible
        }))
        console.info("[TimelineSettings] region filter applied", {
            region: region.slug,
            visible,
        })
    }

    function onClick() {
        applySelected(!selected)
    }

    useEffect(() => {
        if (group_context.source !== "group") { return }
        applySelected(group_context.active)
    }, [group_context.active, group_context.source])

    ////////////////////////
    // Render
    //
    return (
        <button
            type="button"
            className={`${styles.button} button icon-s rounded border-white ${selected ? "" : "disabled"}`}
            onClick={onClick}
            data-tooltip={`${ZH_CN.regionNames[region.slug]}（${region.slug}）`}
            aria-label={`${ZH_CN.regionNames[region.slug]}（${region.slug}）`}
            aria-pressed={selected}
        >
            {region.slug}
        </button>
    )
}


/**
 * 
 *
 * @returns {ReactComponent}
 */
export default function RegionFilterGroup() {
    return (
        <ButtonGroup name={ZH_CN.settings.region}>
            {REGIONS.map(region => (
                <Button key={region.id} region={region} />
            ))}
        </ButtonGroup>
    )
}
