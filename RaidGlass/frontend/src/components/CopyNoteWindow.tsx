import { FaCopy } from "react-icons/fa";
import { FaXmark } from "react-icons/fa6";
import { get_spell_display } from "../store/spells";
import { toMMSS } from "../utils";
import { useAppDispatch, useAppSelector } from "../store/store_hooks";
import {
    useEffect,
    useId,
    useRef,
    useState,
    type MouseEvent,
} from "react";
import {
    trapDialogTab,
    useModalDialogLifecycle,
} from "../hooks/useModalDialogLifecycle";
import { recordDiagnostic } from "../diagnostics";
import { ZH_CN } from "../localization/zhCN";
import * as ui_store from "../store/ui"
import style from "./CopyNoteWindow.module.scss";
import type Actor from "../types/actor";
import type Fight from "../types/fight";
import type Phase from "../types/phase";


type SpellDisplayMap = Record<number, boolean | undefined>;

const VENOMOUS_ABYSS_STT_PHASES: Record<string, readonly (readonly [number, string])[] | null> = {
    "nekzali-the-soulcoiler": [[1.5, "i1"], [1.75, "i2"], [2, "p2"]],
    "entombed-sentinels": [[2, "p2"], [3, "p3"], [4, "p4"], [5, "p5"], [6, "p6"]],
    "the-lost-explorers": null,
    "vashnik-the-malignant": null,
    sszorak: null,
    "the-twin-fangs": null,
    "the-coiled-altar": [[2, "p2"], [2.5, "i2"], [3, "p3"]],
    ulatek: [[2, "p2"], [2.5, "i2"], [3, "p3"]],
};

function get_stt_phase_map(fight: Fight): Map<number, string> | null | undefined {
    const expected = VENOMOUS_ABYSS_STT_PHASES[fight.boss_slug ?? fight.boss?.boss_slug ?? ""];
    if (expected === undefined) return undefined;
    if (expected === null || fight.phases.some((phase, index) => phase.phase_id !== expected[index]?.[0])) return null;
    return new Map(expected);
}


/**
 * Finds the most recent phase in a fight that started before or at the given timestamp.
 *
 * @param fight - The fight object containing an array of phases.
 * @param timestamp - The timestamp to find the corresponding phase for.
 * @returns The latest phase that started before or at the given timestamp, or null if no phase exists.
 */
function get_phase_at_time(fight: Fight, timestamp: number): Phase | null {
    const phases = fight.phases;
    if (!phases?.length) return null;

    let result: Phase | null = null;

    for (const phase of phases) {
        if (phase.ts <= timestamp) {
            result = phase; // Keep updating until we find the latest valid phase
        } else {
            break; // Stop once we pass the timestamp
        }
    }

    return result;
}

export function get_note_mrt(
    player: Actor,
    fight: Fight,
    spell_display: SpellDisplayMap,
): string {

    const rows: string[] = [];
    const phaseMap = get_stt_phase_map(fight);

    player.casts.forEach((cast) => {

        if (!spell_display[cast.id]) {
            return;
        }

        let ts = cast.ts;
        let trigger = "";

        const phase = get_phase_at_time(fight, cast.ts);
        if (phase && phaseMap !== null) {
            ts -= phase.ts;
            trigger = `,${phaseMap?.get(phase.phase_id ?? NaN) ?? `p${phase.id}`}`;
        }

        const ts_string = toMMSS(ts / 1000, 1);
        rows.push(`{time:${ts_string}${trigger}} - {spell:${cast.id}}`);
    });
    return rows.join("\n");
}

export default function CopyNoteWindow() {

    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const copyFeedbackTimerRef = useRef<number | null>(null);
    const titleId = useId();

    // Redux
    const show_window = useAppSelector(ui_store.get_show_copynote)
    const fight = useAppSelector(ui_store.get_copynote_fight)
    const dispatch = useAppDispatch()

    const player = useAppSelector(ui_store.get_copynote_player);
    const dialogRef = useModalDialogLifecycle({
        open: show_window,
        initialFocusRef: closeButtonRef,
    });

    const spellDisplay = useAppSelector(get_spell_display) as SpellDisplayMap;
    const note = player && fight ? get_note_mrt(player, fight, spellDisplay) : "";

    useEffect(() => () => {
        if (copyFeedbackTimerRef.current !== null) {
            window.clearTimeout(copyFeedbackTimerRef.current);
        }
    }, []);


    function closeWindow() {
        dispatch(ui_store.clear_copynote());
    }

    async function doCopy() {
        if (copyFeedbackTimerRef.current !== null) {
            window.clearTimeout(copyFeedbackTimerRef.current);
            copyFeedbackTimerRef.current = null;
        }
        const details = {
            target: `${fight?.report_id}/${fight?.fight_id}/${player?.source_id}`,
            format: "STT",
            length: note.length,
            phaseMode: fight && get_stt_phase_map(fight) === null ? "absolute_fallback" : "relative",
        };
        recordDiagnostic("target_copy_started", details);
        try {
            await navigator.clipboard.writeText(note);
            recordDiagnostic("target_copy_succeeded", details);
            setCopyStatus("copied");
            copyFeedbackTimerRef.current = window.setTimeout(() => {
                copyFeedbackTimerRef.current = null;
                setCopyStatus("idle");
            }, 1500);
        } catch {
            recordDiagnostic("target_copy_failed", { ...details, reason: "clipboard-write-failed" });
            setCopyStatus("failed");
        }
    }

    if (!show_window) {
        return null;
    }

    /*
        Main Render
    */
    return (
        <dialog
            ref={dialogRef}
            className={style.modal}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                closeWindow();
            }}
            onClick={(event: MouseEvent<HTMLDialogElement>) => {
                if (event.target === event.currentTarget) closeWindow();
            }}
            onKeyDown={trapDialogTab}
        >
            <div className={style.panel}>

                {/* Header */}
                <header className={style.header}>
                    <h2 id={titleId}><FaCopy aria-hidden="true" /> {ZH_CN.copyNote.title}</h2>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className={style.closeButton}
                        onClick={closeWindow}
                        aria-label={ZH_CN.copyNote.close}
                    >
                        <FaXmark aria-hidden="true" />
                    </button>
                </header>

                {/* Note */}
                <div className={style.textarea} data-blur="false">
                    <textarea
                        ref={textareaRef}
                        readOnly
                        aria-label={ZH_CN.copyNote.text}
                        onFocus={() => textareaRef.current?.select()}
                        value={note}
                    />
                </div>

                <div className={style.copyRow}>
                    <button
                        type="button"
                        className={`${style.copyAction} rg-button rg-button-primary`}
                        onClick={doCopy}
                    >
                        {copyStatus === "copied" ? ZH_CN.copyNote.copied : ZH_CN.copyNote.copy}
                    </button>
                </div>
                <p className={style.notification} role="status" aria-live="polite">
                    {copyStatus === "failed" ? ZH_CN.copyNote.copyFailed : ""}
                </p>
            </div>
        </dialog>
    )
}
