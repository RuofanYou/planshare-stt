import DisplaySettings from "../../components/SettingsBar/DisplaySettings";
import FilterSettings from "../../components/SettingsBar/FilterSettings/FilterSettings";
import SettingsBar from "../../components/SettingsBar/SettingsBar";

export default function TimelineSettings() {
    return (
        <SettingsBar>
            <DisplaySettings showMetric={false} />
            <div className="ml-auto" />
            <FilterSettings />
        </SettingsBar>
    );
}
