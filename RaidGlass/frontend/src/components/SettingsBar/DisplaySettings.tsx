import { FaClock, FaHourglass, FaImage, FaSkull, FaStream } from 'react-icons/fa';
import { IoFlagSharp } from 'react-icons/io5';
import { ReactNode, useContext, useEffect } from 'react'
import { update_settings } from '../../store/ui'
import { useAppSelector } from '../../store/store_hooks'
import { useDispatch } from 'react-redux'
import ButtonGroup, { ButtonGroupContext } from './shared/ButtonGroup'
import MetricSelect from "./MetricSelect"
import styles from "./DisplaySettings.module.scss";
import { ZH_CN } from "../../localization/zhCN";



function Button({attr_name, children, label} : {attr_name: string, children: ReactNode, label: string}) {

    ////////////////////////
    // Hooks
    //
    const attr_value = useAppSelector(state => state.ui.settings[attr_name])
    const dispatch = useDispatch()
    const group_context = useContext(ButtonGroupContext)

    function onClick() {
        const new_value = !attr_value

        dispatch(update_settings({
            [attr_name]: new_value
        }))

        if (new_value && group_context.setter) {
            group_context.setter({active: new_value, source: "child"})
        }
    }

    // see SpellButton,jsx
    useEffect(() => {
        if (group_context.source !== "group") { return}
        dispatch(update_settings({
            [attr_name]: group_context.active
        }))
    }, [group_context.active])

    ////////////////////////
    // Render
    //
    return (
        <button
            type="button"
            className={`${styles.button} button icon-s rounded border-white ${attr_value ? "" : "disabled"}`}
            onClick={onClick}
            data-tooltip={label}
            aria-label={label}
            aria-pressed={Boolean(attr_value)}
        >
            <span aria-hidden="true">{children}</span>
        </button>
    )
}


export default function DisplaySettings({ showMetric = true }: { showMetric?: boolean }) {

    return (
        <ButtonGroup name={ZH_CN.settings.timeline}>
            <Button attr_name="show_casticon" label={ZH_CN.settings.spellIcons}><FaImage /></Button>
            <Button attr_name="show_casttime" label={ZH_CN.settings.castTime}><FaClock /></Button>
            <Button attr_name="show_duration" label={ZH_CN.settings.duration}><FaStream /></Button>
            <Button attr_name="show_cooldown" label={ZH_CN.settings.cooldown}><FaHourglass /></Button>
            <Button attr_name="show_deaths" label={ZH_CN.settings.deaths}><FaSkull /></Button>
            <Button attr_name="show_phases" label={ZH_CN.settings.phases}><IoFlagSharp /></Button>

            {showMetric && <MetricSelect />}

        </ButtonGroup>
    )
}
