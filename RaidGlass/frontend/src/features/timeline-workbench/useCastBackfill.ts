import { useEffect, useRef } from "react";
import { fetch_data } from "../../api";
import { recordDiagnostic } from "../../diagnostics";
import { castProgressUpdated, refreshCastDetails } from "../../store/fights";
import { useAppDispatch } from "../../store/store_hooks";
import type { SkillCompletion } from "../../types/spec_ranking";

interface Progress { skill_completion: SkillCompletion; revision: string; }

export function useCastBackfill(targetKey: string, enabled: boolean, completion?: SkillCompletion) {
    const latest = useRef(completion);
    latest.current = completion;
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (!enabled) return;
        const [boss, spec, difficulty, metric] = targetKey.split("/");
        const url = `/api/spec_ranking/${spec}/${boss}/backfill?${new URLSearchParams({ difficulty, metric })}`;
        let disposed = false;
        let registered = false;
        let revision = "";
        let done = false;
        let retryAt = 0;
        let timer: ReturnType<typeof setTimeout>;
        let request: AbortController | null = null;
        function schedule() {
            if (disposed || done || document.hidden) return;
            timer = setTimeout(tick, Math.max(30_000, retryAt - Date.now()));
        }
        async function tick() {
            if (disposed || document.hidden || done || request) return;
            if (retryAt > Date.now()) { schedule(); return; }
            request = new AbortController();
            const signal = request.signal;
            try {
                const progress = await fetch_data<Progress>(url, {}, { method: registered ? "GET" : "POST", signal, cache: "no-store" });
                registered = true;
                if (disposed || signal.aborted) return;
                if (revision !== progress.revision) {
                    const details = await dispatch(refreshCastDetails(targetKey, signal));
                    if (details && details.complete > progress.skill_completion.complete) progress.skill_completion = details;
                }
                if (disposed || signal.aborted) return;
                revision = progress.revision;
                dispatch(castProgressUpdated({ targetKey, completion: progress.skill_completion }));
                retryAt = Date.parse(progress.skill_completion.retry_at || "") || 0;
                done = progress.skill_completion.status === "complete";
            } catch (error) {
                if (!signal.aborted && !disposed) {
                    const reason = error instanceof Error ? error.message : String(error);
                    recordDiagnostic("cast_backfill_failed", { target: targetKey, reason });
                    // Keep the displayed snapshot intact when the ranking changed underneath it.
                    done = reason === "ranking_changed";
                    dispatch(castProgressUpdated({ targetKey, completion: { version: 1, complete: 0, total: 10, failed: 0, ...latest.current,
                        status: "failed", retry_at: new Date(Date.now() + 60_000).toISOString() } }));
                    retryAt = Date.now() + 60_000;
                }
            } finally {
                request = null;
                schedule();
            }
        }
        function visibility() {
            clearTimeout(timer);
            if (document.hidden) request?.abort();
            else void tick();
        }
        document.addEventListener("visibilitychange", visibility);
        void tick();
        return () => { disposed = true; clearTimeout(timer); request?.abort(); document.removeEventListener("visibilitychange", visibility); };
    }, [dispatch, targetKey, enabled]);
}
