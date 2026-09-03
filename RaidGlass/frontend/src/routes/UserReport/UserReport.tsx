import { get_fights, get_occuring_bosses, get_occuring_specs, load_report_fights } from "../../store/fights"
import { load_boss_spells } from '../../store/bosses'
import { load_report_overview } from '../../store/user_reports'
import { load_spec_spells } from '../../store/specs'
import { useAppDispatch, useAppSelector } from '../../store/store_hooks'
import { useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useTitle } from 'react-use'
import * as ui_store from "../../store/ui"
import CopyNoteWindow from "../../components/CopyNoteWindow"
import LoadingOverlay from "./../../components/shared/LoadingOverlay"
import PlayerNamesList from "./../../components/PlayerNames/PlayerNamesList"
import ReportHeader from './ReportHeader'
import ReportSettingsBar from './ReportSettingsBar'
import TimelineCanvas from "./../../components/Timeline/TimelineCanvas"
import UserReportNavbar from './UserReportNavbar'
import { buildTimelineVisibility } from '../../filter_logic'


////////////////////////////////////////////////////////////////////////////////
// Component
//

export default function UserReport() {

    const mode = ui_store.MODES.USER_REPORT

    ////////////////////////////////////////////////////////////////////////////
    // Hooks
    const { report_id } = useParams<{report_id: string}>();
    const { search } = useLocation();

    const dispatch = useAppDispatch()
    const is_loading = useAppSelector(state => ui_store.get_is_loading(state))
    const specs = useAppSelector(get_occuring_specs)
    const bosses = useAppSelector(get_occuring_bosses)
    const fights = useAppSelector(get_fights)
    const filters = useAppSelector(state => state.ui.filters)
    const spellDisplay = useAppSelector(state => state.spells.spell_display)
    const visibility = useMemo(
        () => buildTimelineVisibility(fights, filters, spellDisplay),
        [fights, filters, spellDisplay],
    )

    ////////////////////////////////////////////////////////////////////////////
    // Update State
    //
    useTitle(`RaidGlass: 报告 ${report_id}`)


    useEffect(() => {
        dispatch(ui_store.set_mode(mode)) // in useEffect to only run once

        // initial display settings
        dispatch(ui_store.update_settings({
            show_deaths: true,
        }))
    }, [])


    useEffect(() => {
        if (!report_id) return
        dispatch(load_report_overview(report_id))
        dispatch(load_report_fights(report_id, search))
    }, [report_id])


    useEffect(() => {
        specs.forEach(spec_slug => {
            dispatch(load_spec_spells(spec_slug))
        })
    }, [specs])

    useEffect(() => {
        bosses.forEach(boss_slug => {
            // todo: check if loaded
            dispatch(load_boss_spells(boss_slug))
        })
    }, [bosses])


    ////////////////////////////////////////////////////////////////////////////
    // Render
    //
    return (
        <div className={mode}>

            <div className="mt-3 flex-row justify-content-space-between d-flex align-items-center">
                <ReportHeader />
                <UserReportNavbar />
            </div>

            <div className={`${is_loading ? "loading_trans" : ""} mt-2`}>
                <ReportSettingsBar filters={filters} />
            </div>
            {is_loading && <LoadingOverlay />}
            { <CopyNoteWindow />}

            <div className={`p-2 rg-panel d-flex ${is_loading ? "loading_trans" : ""}`}>
                <PlayerNamesList visibility={visibility} />
                <TimelineCanvas fights={fights} visibility={visibility} />
            </div>
        </div>
    );
}
