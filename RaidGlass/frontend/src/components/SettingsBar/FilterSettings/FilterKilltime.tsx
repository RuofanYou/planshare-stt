import { useDispatch } from 'react-redux'
import { set_filters } from '../../../store/ui'
import ButtonGroup from '../shared/ButtonGroup'
import DurationInputGroup from "../../shared/DurationInputGroup"

import styles from "./FilterKilltime.module.scss"
import { ZH_CN } from "../../../localization/zhCN"


/**
 * Group to set the min/max killtime-filter
 *
 * @returns {ReactComponent}
 */
export default function FilterKilltimeGroup() {

    const dispatch = useDispatch()

    // Callback when values get changed
    function onChange({min, max}: {min: number, max: number}) {
        dispatch(set_filters({killtime: {min, max}}))
    }

    // Render
    return (
        <ButtonGroup name={ZH_CN.settings.killtime} toggleable={false}>
            <DurationInputGroup
                onChange={onChange}
                className={styles.killtime_group}
                label_min="最短击杀时间"
                label_max="最长击杀时间"
            />
        </ButtonGroup>
    )
}
