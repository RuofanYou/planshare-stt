import DisplaySettings from "../../components/SettingsBar/DisplaySettings";
import FilterSettings from "../../components/SettingsBar/FilterSettings/FilterSettings";
import SettingsBar from "../../components/SettingsBar/SettingsBar";
import SpellSettings from "../../components/SettingsBar/SpellSettings/SpellSettings";
import type { FilterValues } from "../../store/ui";

export default function TimelineSettings({ filters }: { filters: FilterValues }) {
    return (
        <SettingsBar>
            <DisplaySettings showMetric={false} />
            <SpellSettings filters={filters} />
            <div className="ml-auto" />
            <FilterSettings />
        </SettingsBar>
    );
}
