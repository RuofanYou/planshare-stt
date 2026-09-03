import { FaCopy } from "react-icons/fa";
import { FaXmark } from "react-icons/fa6";
import { get_boss } from "../store/bosses";
import { get_difficulty_name } from "../store/fights";
import { get_spec } from "../store/specs";
import { get_spell_display } from "../store/spells";
import { toMMSS } from "../utils";
import { useAppDispatch, useAppSelector } from "../store/store_hooks";
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type MouseEvent,
} from "react";
import {
    trapDialogTab,
    useModalDialogLifecycle,
} from "../hooks/useModalDialogLifecycle";
import { ZH_CN } from "../localization/zhCN";
import * as ui_store from "../store/ui"
import style from "./CopyNoteWindow.module.scss";
import type Actor from "../types/actor";
import type Boss from "../types/boss";
import type Fight from "../types/fight";
import type Phase from "../types/phase";


/** Output format for the copy-note modal. */
export enum NoteFormat {
    MRT = "MRT",
    NSRT = "NSRT",
}

export enum NameInputMode {
    PLAYER_NAME = "player_name",
    PLAYER_SPEC = "player_spec",
}

type SpellDisplayMap = Record<number, boolean | undefined>;


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

/**
 * One NSRT line: ordered `key:value` segments separated by `;`, trailing `;`.
 */
function format_nsrt_row(entries: readonly [string, string | number][]): string {
    return entries.map(([key, value]) => `${key}:${value}`).join(";") + ";";
}


/**
 * MRT-format ERT note lines.
 */
function get_note_mrt(
    name: string,
    player: Actor,
    fight: Fight,
    spell_display: SpellDisplayMap,
): string {

    const rows: string[] = [];

    player.casts.forEach((cast) => {

        if (!spell_display[cast.id]) {
            return;
        }

        let ts = cast.ts;
        let trigger = "";

        const phase = get_phase_at_time(fight, cast.ts);
        if (phase) {
            ts -= phase.ts;
            trigger = `,p${phase.id}`;
        }

        const ts_string = toMMSS(ts / 1000, 1);
        rows.push(`{time:${ts_string}${trigger}} - ${name} {spell:${cast.id}}`);
    });
    return rows.join("\n");
}

/**
 * "Northern Sky Raid Tools" style note.
 */
function get_note_nsrt(
    name: string,
    player: Actor,
    fight: Fight,
    boss: Boss,
    spell_display: SpellDisplayMap,
): string {

    const rows: string[] = [];

    const encounterId = boss.id;
    const encounterName = boss.full_name;

    rows.push(
        format_nsrt_row([
            ["EncounterID", encounterId],
            ["Difficulty", get_difficulty_name(fight.difficulty)],
            ["Name", encounterName],
        ]),
    );

    player.casts.forEach((cast) => {

        if (!spell_display[cast.id]) {
            return;
        }

        // key-value pairs for the row
        const pairs: [string, string | number][] = [];

        // let phase: Phase | null = null;
        const phase = get_phase_at_time(fight, cast.ts);

        // +2 because ph1 = from pull; ph2 = first real phase (phase.id = 0 -> 2)
        const phase_id = phase ? phase.id : 1;
        pairs.push(["ph", phase_id]);

        let ts = cast.ts;
        if (phase) {
            ts = cast.ts - phase.ts;
        }
        const seconds = (ts / 1000).toFixed(1);
        pairs.push(["time", seconds]);

        if (name) {
            pairs.push(["tag", name]);
        } else {
            // use tag based on spec id
            // TODO: ids need to be implemented on backend first
            // pairs.push(["tag", spec.id]);
        }

        pairs.push(["spellid", cast.id]);

        rows.push(format_nsrt_row(pairs));
    });

    return rows.join("\n");
}


/**
 * Get formatted note text based on current selection
 * 
 * @param name - The name of the player
 * @param dynamic - Whether to use dynamic timers
 * @param noteFormat - The format of the note
 * @returns The formatted note text
 */
function get_formatted_note(
    name: string,
    noteFormat: NoteFormat,
): string {

    const player = useAppSelector(ui_store.get_copynote_player);
    const spell_display = useAppSelector(get_spell_display) as SpellDisplayMap;
    const fight = useAppSelector(ui_store.get_copynote_fight);
    const boss = useAppSelector(state => get_boss(state, fight?.boss?.boss_slug));

    if (!player) {
        return "no player selected";
    }
    if (!fight) {
        return "no fight selected";
    }

    switch (noteFormat) {
        case NoteFormat.MRT:
            return get_note_mrt(name, player, fight, spell_display);
        case NoteFormat.NSRT:
            return get_note_nsrt(
                name,
                player,
                fight,
                boss,
                spell_display,
            );
    }
}


export default function CopyNoteWindow() {

    // React
    const [name, setName] = useState("");
    const [nameInputMode, setNameInputMode] = useState<NameInputMode>(NameInputMode.PLAYER_NAME);
    const lastManualNameRef = useRef("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const [noteFormat, setNoteFormat] = useState<NoteFormat>(NoteFormat.NSRT);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const copyFeedbackTimerRef = useRef<number | null>(null);
    const titleId = useId();

    // Redux
    const show_window = useAppSelector(ui_store.get_show_copynote)
    const fight = useAppSelector(ui_store.get_copynote_fight)
    const dispatch = useAppDispatch()

    const player = useAppSelector(ui_store.get_copynote_player);
    const spec = useAppSelector(state => get_spec(state, player?.spec_slug));
    const dialogRef = useModalDialogLifecycle({
        open: show_window,
        initialFocusRef: closeButtonRef,
    });

    // Update name
    useEffect(() => {
        if (nameInputMode !== "player_spec") {
            return;
        }
        if (!spec) {
            return;
        }

        if (noteFormat === NoteFormat.NSRT) {
            setName(`${spec.id}`);
        } else if (noteFormat === NoteFormat.MRT) {
            const class_name = spec.class.name.toUpperCase();
            setName(`spec:${class_name}:${spec?.index}`);
        }

    }, [nameInputMode, noteFormat, spec?.id]);

    // Generate Note
    const note = get_formatted_note(name, noteFormat);

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
        try {
            await navigator.clipboard.writeText(note);
            setCopyStatus("copied");
            copyFeedbackTimerRef.current = window.setTimeout(() => {
                copyFeedbackTimerRef.current = null;
                setCopyStatus("idle");
            }, 1500);
        } catch {
            setCopyStatus("failed");
        }
    }

    function nameInputChanged(event: ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        lastManualNameRef.current = value;
        setName(value);
    }

    function nameInputModeChanged(event: ChangeEvent<HTMLSelectElement>) {
        const mode = event.target.value as NameInputMode;
        setNameInputMode(mode);
        if (mode === "player_name") {
            setName(lastManualNameRef.current);
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

                {/* Settings */}
                <div className={style.formGrid}>
                    <label className={style.field}>
                        <span>{ZH_CN.copyNote.nameMode}</span>
                        <select
                            className={style.name_dropdown}
                            value={nameInputMode}
                            onChange={nameInputModeChanged}
                        >
                            <option value="player_name">{ZH_CN.copyNote.playerName}</option>
                            <option value="player_spec">{ZH_CN.copyNote.specTag}</option>
                        </select>
                    </label>
                    <label className={style.field}>
                        <span>{ZH_CN.copyNote.name}</span>
                        <input
                            onChange={nameInputChanged}
                            disabled={nameInputMode === "player_spec"}
                            value={name}
                            placeholder={ZH_CN.copyNote.namePlaceholder}
                        />
                    </label>

                    <div className={style.field}>
                        <span id={`${titleId}-format`}>{ZH_CN.copyNote.format}</span>
                        <div
                            className={style.noteFormatToggle}
                            role="group"
                            aria-labelledby={`${titleId}-format`}
                        >
                            <button
                                type="button"
                                className={style.noteFormatBtn}
                                data-note-format="mrt"
                                aria-pressed={noteFormat === NoteFormat.MRT}
                                aria-label={ZH_CN.copyNote.useMrt}
                                onClick={() => setNoteFormat(NoteFormat.MRT)}
                            >
                                MRT
                            </button>
                            <button
                                type="button"
                                className={style.noteFormatBtn}
                                data-note-format="nsrt"
                                aria-pressed={noteFormat === NoteFormat.NSRT}
                                aria-label={ZH_CN.copyNote.useStructured}
                                onClick={() => setNoteFormat(NoteFormat.NSRT)}
                            >
                                {ZH_CN.copyNote.structured}
                            </button>
                        </div>
                    </div>
                </div>

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
                    <p className={style.usage_counter}>{ZH_CN.copyNote.usage}</p>
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

                {/* Info & Disclaimer */}
                <div className={style.guidance}>
                    <p>{ZH_CN.copyNote.visibleSpells}</p>
                    <p>{ZH_CN.copyNote.reference}</p>
                </div>

            </div>
        </dialog>
    )
}
