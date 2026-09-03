import { afterEach, describe, expect, it, vi } from "vitest";

import { recordDiagnostic, setDiagnosticSinkForTests } from "./diagnostics";
import type { DiagnosticDetails, DiagnosticEvent } from "./diagnostics";

const DIAGNOSTIC_EVENTS = [
    "bootstrap_started",
    "bootstrap_succeeded",
    "bootstrap_failed",
    "bootstrap_retried",
    "target_request_started",
    "target_request_accepted",
    "target_request_failed",
    "target_request_discarded",
    "target_copy_started",
    "target_copy_succeeded",
    "target_copy_failed",
    "target_copy_blocked",
    "target_picker_opened",
    "target_picker_closed",
    "target_selection_submitted",
    "target_difficulty_changed",
    "settings_opened",
    "settings_closed",
    "skip_link_activated",
    "route_focus_restored",
    "timeline_pan_started",
    "timeline_pan_settled",
    "timeline_zoom_applied",
    "comp_search_submitted",
    "comp_search_empty",
    "comp_search_succeeded",
    "comp_search_failed",
] as const satisfies readonly DiagnosticEvent[];

afterEach(() => {
    setDiagnosticSinkForTests(null);
});

describe("recordDiagnostic", () => {
    it("无接收器时静默且不写控制台", () => {
        const consoleSpies = [
            vi.spyOn(console, "log").mockImplementation(() => undefined),
            vi.spyOn(console, "info").mockImplementation(() => undefined),
            vi.spyOn(console, "warn").mockImplementation(() => undefined),
            vi.spyOn(console, "error").mockImplementation(() => undefined),
        ];

        expect(() => recordDiagnostic("bootstrap_started")).not.toThrow();
        for (const spy of consoleSpies) {
            expect(spy).not.toHaveBeenCalled();
        }
    });

    it("有接收器时按顺序传递每个事件", () => {
        const received: Array<{ event: DiagnosticEvent; details: DiagnosticDetails }> = [];
        setDiagnosticSinkForTests((event, details) => {
            received.push({ event, details });
        });

        DIAGNOSTIC_EVENTS.forEach((event, index) => {
            recordDiagnostic(event, { index });
        });

        expect(received.map(({ event }) => event)).toEqual(DIAGNOSTIC_EVENTS);
        expect(received.map(({ details }) => details)).toEqual(
            DIAGNOSTIC_EVENTS.map((_, index) => ({ index })),
        );
    });

    it("省略详情时每次传递新鲜空对象", () => {
        const received: DiagnosticDetails[] = [];
        setDiagnosticSinkForTests((_event, details) => {
            received.push(details);
        });

        recordDiagnostic("settings_opened");
        recordDiagnostic("settings_closed");

        expect(received).toEqual([{}, {}]);
        expect(received[0]).not.toBe(received[1]);
    });

    it("重置接收器后恢复静默", () => {
        const received: DiagnosticEvent[] = [];
        setDiagnosticSinkForTests((event) => {
            received.push(event);
        });

        recordDiagnostic("target_request_accepted");
        setDiagnosticSinkForTests(null);
        recordDiagnostic("target_request_discarded");

        expect(received).toEqual(["target_request_accepted"]);
    });
});
