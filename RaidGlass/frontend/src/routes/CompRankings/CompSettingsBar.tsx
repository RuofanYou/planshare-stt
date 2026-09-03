import { Link } from "react-router-dom";

import { AdaptiveDialogPanel } from "../../components/AdaptiveDialogPanel/AdaptiveDialogPanel";
import DisplaySettings from "../../components/SettingsBar/DisplaySettings";
import SettingsBar from "../../components/SettingsBar/SettingsBar";
import SpellSettings from "../../components/SettingsBar/SpellSettings/SpellSettings";
import { recordDiagnostic } from "../../diagnostics";
import { ZH_CN } from "../../localization/zhCN";
import type { FilterValues } from "../../store/ui";
import styles from "./CompSettingsBar.module.scss";

export default function CompSettingsBar({ filters }: { filters: FilterValues }) {
    return (
        <div className={styles.actions}>
            <AdaptiveDialogPanel
                title={ZH_CN.comp.timelineSettingsTitle}
                description={ZH_CN.comp.timelineSettingsDescription}
                trigger={({ ref, ...triggerProps }) => (
                    <button ref={ref} type="button" {...triggerProps}>
                        {ZH_CN.comp.openTimelineSettings}
                    </button>
                )}
                onStateChange={(open, transition) => recordDiagnostic(
                    open ? "settings_opened" : "settings_closed",
                    { surface: transition.surface, reason: transition.reason },
                )}
            >
                <SettingsBar>
                    <DisplaySettings showMetric={false} />
                    <SpellSettings filters={filters} />
                </SettingsBar>
            </AdaptiveDialogPanel>
            <Link to="/comp_ranking/search">{ZH_CN.comp.changeCriteria}</Link>
        </div>
    );
}
