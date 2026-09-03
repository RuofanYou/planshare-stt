import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { recordDiagnostic } from "../diagnostics";
import { fetchBossCatalog } from "./bosses";
import { catalogsAccepted } from "./catalogCommit";
import { fetchClassesCatalog } from "./classes";
import { fetchRolesCatalog } from "./roles";
import { fetchSeasonCatalog } from "./seasons";
import { fetchSpecsCatalog } from "./specs";
import type { AppDispatch, RootState } from "./store";

export interface BootstrapState {
    status: "idle" | "loading" | "ready" | "error";
    error: string | null;
    attempt: number;
}

const BOOTSTRAP_ERROR = "暂时无法载入目标目录，请稍后重试。";
export const BOOTSTRAP_LOADING_KEYS = [
    "classes",
    "roles",
    "specs",
    "season",
    "current-season-zones",
] as const;

const INITIAL_STATE: BootstrapState = {
    status: "idle",
    error: null,
    attempt: 0,
};

const SLICE = createSlice({
    name: "bootstrap",
    initialState: INITIAL_STATE,
    reducers: {
        bootstrapStarted: (_state, action: PayloadAction<{ attempt: number }>) => ({
            status: "loading" as const,
            error: null,
            attempt: action.payload.attempt,
        }),
        bootstrapSucceeded: (_state, action: PayloadAction<{ attempt: number }>) => ({
            status: "ready" as const,
            error: null,
            attempt: action.payload.attempt,
        }),
        bootstrapFailed: (_state, action: PayloadAction<{ attempt: number; error: string }>) => ({
            status: "error" as const,
            error: action.payload.error,
            attempt: action.payload.attempt,
        }),
    },
});

export const {
    bootstrapFailed,
    bootstrapStarted,
    bootstrapSucceeded,
} = SLICE.actions;

export default SLICE.reducer;

export function selectBootstrap(state: RootState): BootstrapState {
    return state.bootstrap;
}

export function selectHasBootstrapTargets(state: RootState): boolean {
    const currentSeason = state.seasons.seasons[state.seasons.current_season];
    return state.classes.class_names.length > 0
        && Object.keys(state.roles).length > 0
        && Object.keys(state.specs.specs_by_name).length > 0
        && Boolean(currentSeason)
        && Object.keys(state.zones.zones).length > 0
        && Object.keys(state.zones.bosses).length > 0;
}

function setAllLoading(dispatch: AppDispatch, value: boolean): void {
    BOOTSTRAP_LOADING_KEYS.forEach((key) => {
        dispatch({ type: "ui/set_loading", payload: { key, value } });
    });
}

export function loadBootstrapData(options: { retry?: boolean } = {}) {
    return async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
        if (!options.retry && getState().bootstrap.status === "loading") return;

        const attempt = getState().bootstrap.attempt + 1;
        if (options.retry) {
            recordDiagnostic("bootstrap_retried", { attempt });
        }
        recordDiagnostic("bootstrap_started", { attempt });
        dispatch(bootstrapStarted({ attempt }));
        setAllLoading(dispatch, true);

        try {
            const [classes, roles, specs, seasons, bosses] = await Promise.allSettled([
                fetchClassesCatalog(),
                fetchRolesCatalog(),
                fetchSpecsCatalog(),
                fetchSeasonCatalog(),
                fetchBossCatalog(),
            ]);

            if (getState().bootstrap.attempt !== attempt) return;

            if (classes.status !== "fulfilled"
                || roles.status !== "fulfilled"
                || specs.status !== "fulfilled"
                || seasons.status !== "fulfilled"
                || bosses.status !== "fulfilled") {
                recordDiagnostic("bootstrap_failed", { attempt, source: "metadata" });
                dispatch(bootstrapFailed({ attempt, error: BOOTSTRAP_ERROR }));
                return;
            }

            dispatch(catalogsAccepted({
                classes: classes.value,
                roles: roles.value,
                specs: specs.value,
                seasons: seasons.value,
                bosses: bosses.value,
            }));

            const bossCount = bosses.value.reduce((count, zone) => count + zone.bosses.length, 0);
            recordDiagnostic("bootstrap_succeeded", {
                attempt,
                bosses: bossCount,
                specs: specs.value.length,
            });
            dispatch(bootstrapSucceeded({ attempt }));
        } catch {
            if (getState().bootstrap.attempt !== attempt) return;
            recordDiagnostic("bootstrap_failed", { attempt, source: "metadata" });
            dispatch(bootstrapFailed({ attempt, error: BOOTSTRAP_ERROR }));
        } finally {
            if (getState().bootstrap.attempt === attempt) {
                setAllLoading(dispatch, false);
            }
        }
    };
}
