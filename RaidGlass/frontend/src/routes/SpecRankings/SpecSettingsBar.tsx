import DisplaySettings from '../../components/SettingsBar/DisplaySettings'
import FilterSettings from '../../components/SettingsBar/FilterSettings/FilterSettings'
import SettingsBar from '../../components/SettingsBar/SettingsBar'
import SpellSettings from '../../components/SettingsBar/SpellSettings/SpellSettings'
import type { FilterValues } from '../../store/ui'


export default function SpecSettingsBar({ filters }: { filters: FilterValues }) {

    // Render
    return (
        <SettingsBar>
            <DisplaySettings />
            <SpellSettings filters={filters} />
            {/* spacer to push filter settings to the right side */}
            <div className="ml-auto"></div>

            <FilterSettings />
        </SettingsBar>
    )
}
