import { useLayoutEffect } from "react";
import { useStore } from "react-redux";
import { recordDiagnostic } from "../../diagnostics";
import type { RootState } from "../../store/store";
import { replace_spell_display } from "../../store/spells";
import { createDefaultFilters, set_filters, type FilterValues } from "../../store/ui";
import { TIMELINE_ZOOM_MAX, TIMELINE_ZOOM_MIN } from "../../components/Timeline/constants";

export interface TimelineSession {
    filters?: FilterValues;
    spells?: Record<number, boolean>;
    view?: { zoom: number; time: number };
}
const prefix = "raidglass:timeline:v1:";
function booleanMap(value: unknown): value is Record<string, boolean> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        && Object.values(value).every(item => typeof item === "boolean");
}

export function readTimelineSession(target: string): TimelineSession {
    try {
        const raw = sessionStorage.getItem(prefix + target);
        if (!raw) return {};
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object") throw new Error("invalid-session");
        const result: TimelineSession = {};
        if (booleanMap(value.spells)) result.spells = value.spells;
        const f = value.filters;
        if (f && [f.role, f.class, f.spec, f.region].every(booleanMap)
            && typeof f.hide_empty_rows === "boolean"
            && f.killtime && [f.killtime.min, f.killtime.max].every(v => v === null || (Number.isFinite(v) && v >= 0))
            && f.log_date && [f.log_date.from, f.log_date.to].every(v => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)))) {
            result.filters = f;
        }
        if (value.view && Number.isFinite(value.view.zoom) && Number.isFinite(value.view.time)
            && value.view.zoom >= TIMELINE_ZOOM_MIN && value.view.zoom <= TIMELINE_ZOOM_MAX
            && value.view.time >= 0) result.view = value.view;
        return result;
    } catch {
        recordDiagnostic("timeline_session_failed", { target, operation: "read" });
        return {};
    }
}

export function saveTimelineSession(target: string, patch: TimelineSession) {
    try {
        sessionStorage.setItem(prefix + target, JSON.stringify({ ...readTimelineSession(target), ...patch }));
        recordDiagnostic("timeline_session_saved", { target, part: patch.view ? "view" : "filters" });
    } catch {
        recordDiagnostic("timeline_session_failed", { target, operation: "write" });
    }
}

export function useTimelineSession(target: string) {
    const store = useStore<RootState>();
    useLayoutEffect(() => {
        const saved = readTimelineSession(target);
        const defaults = Object.fromEntries(Object.values(store.getState().spells.all_spells)
            .map(spell => [spell.spell_id, spell.show]));
        store.dispatch(set_filters(saved.filters ?? createDefaultFilters()));
        store.dispatch(replace_spell_display({ ...defaults, ...saved.spells }));
        recordDiagnostic("timeline_session_restored", { target, found: Object.keys(saved).length > 0 });
        let previous = store.getState();
        return store.subscribe(() => {
            const state = store.getState();
            if (state.ui.filters !== previous.ui.filters || state.spells.spell_display !== previous.spells.spell_display) {
                saveTimelineSession(target, { filters: state.ui.filters, spells: state.spells.spell_display });
            }
            previous = state;
        });
    }, [store, target]);
}
