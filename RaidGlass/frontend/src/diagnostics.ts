export type DiagnosticDetails = Record<string, string | number | boolean | null>;

export type DiagnosticEvent =
    | "spell_filter_applied"
    | "timeline_session_restored"
    | "timeline_session_saved"
    | "timeline_session_failed"
    | "bootstrap_started"
    | "bootstrap_succeeded"
    | "bootstrap_failed"
    | "bootstrap_retried"
    | "target_request_started"
    | "target_request_accepted"
    | "target_request_failed"
    | "target_request_discarded"
    | "target_copy_started"
    | "target_copy_succeeded"
    | "target_copy_failed"
    | "target_copy_blocked"
    | "target_selection_submitted"
    | "settings_opened"
    | "settings_closed"
    | "skip_link_activated"
    | "route_focus_restored"
    | "timeline_pan_started"
    | "timeline_pan_settled"
    | "timeline_zoom_applied"
    | "comp_search_submitted"
    | "comp_search_empty"
    | "comp_search_succeeded"
    | "comp_search_failed";

export type DiagnosticSink = (event: DiagnosticEvent, details: DiagnosticDetails) => void;

let diagnosticSink: DiagnosticSink | null = null;

export function recordDiagnostic(event: DiagnosticEvent, details?: DiagnosticDetails): void {
    diagnosticSink?.(event, details ?? {});
}

export function setDiagnosticSinkForTests(sink: DiagnosticSink | null): void {
    diagnosticSink = sink;
}
