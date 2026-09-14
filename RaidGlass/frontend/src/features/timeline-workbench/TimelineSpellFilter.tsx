import { useState } from "react";
import { recordDiagnostic } from "../../diagnostics";
import { useAppDispatch, useAppSelector } from "../../store/store_hooks";
import { replace_spell_display, set_spell_visible } from "../../store/spells";
import styles from "./TimelineWorkbench.module.scss";

export default function TimelineSpellFilter({ target, disabled = false }: { target: string; disabled?: boolean }) {
    const dispatch = useAppDispatch();
    const { all_spells: spells, used_spell_ids: ids, spell_display: display } = useAppSelector(state => state.spells);
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [undo, setUndo] = useState<Record<number, boolean> | null>(null);
    const selected = ids.filter(id => display[id] !== false).length;
    const search = query.trim().toLocaleLowerCase();
    const matches = ids.filter(id => String(id).includes(search) || spells[id]?.name.toLocaleLowerCase().includes(search));

    function batch(kind: "all" | "default" | "only", only?: number) {
        const previous = Object.fromEntries(ids.map(id => [id, display[id] !== false]));
        setUndo(previous);
        const next = { ...display };
        ids.forEach(id => { next[id] = kind === "all" || (kind === "only" ? id === only : spells[id]?.show !== false); });
        dispatch(replace_spell_display(next));
        recordDiagnostic("spell_filter_applied", { target, action: kind, count: ids.length, spell: only ?? null });
    }
    function undoBatch() {
        if (!undo) return;
        dispatch(replace_spell_display({ ...display, ...undo }));
        setUndo(null);
        recordDiagnostic("spell_filter_applied", { target, action: "undo", count: Object.keys(undo).length });
    }
    return (
        <aside className={styles.spellFilter} aria-label="技能筛选">
            <button type="button" className={styles.spellFilterToggle} aria-expanded={expanded}
                aria-controls="timeline-spell-options" onClick={() => setExpanded(!expanded)}>
                技能筛选 · 已选 {selected}/{ids.length}
            </button>
            <div className={styles.spellFilterBody} id="timeline-spell-options" data-expanded={expanded}>
                <h3>技能筛选</h3>
                <p>当前数据包含的技能</p>
                <fieldset disabled={disabled}>
                    <label>搜索技能
                        <input type="search" value={query} placeholder="名称或技能 ID"
                            onChange={event => setQuery(event.target.value)} />
                    </label>
                    <div className={styles.spellFilterActions}>
                        <button type="button" onClick={() => batch("all")}>全选</button>
                        <button type="button" onClick={() => batch("default")}>恢复默认</button>
                        <button type="button" disabled={!undo} onClick={undoBatch}>撤销</button>
                    </div>
                    <p role="status">已选 {selected}/{ids.length} · 搜索结果 {matches.length}</p>
                    {ids.length > 0 && selected === 0 && <p role="status">当前筛选隐藏了全部技能，可全选或恢复默认。</p>}
                    <div className={styles.spellList}>
                        {matches.map(id => (
                            <div key={id} className={styles.spellOption}>
                                <label>
                                    <input type="checkbox" checked={display[id] !== false} onChange={event => {
                                        setUndo(null);
                                        dispatch(set_spell_visible({ spell_id: id, visible: event.target.checked }));
                                        recordDiagnostic("spell_filter_applied", { target, action: "toggle", spell: id, visible: event.target.checked });
                                    }} />
                                    {spells[id]?.icon_path && <img src={spells[id].icon_path} alt="" />}
                                    <span>{spells[id]?.name || `技能 ${id}`}<small>{id}</small></span>
                                </label>
                                <button type="button" aria-label={`仅看 ${spells[id]?.name || `技能 ${id}`}`}
                                    onClick={() => batch("only", id)}>仅看</button>
                            </div>
                        ))}
                        {matches.length === 0 && <p>{ids.length === 0 ? "当前数据暂无技能" : "未找到匹配技能，试试技能 ID 或其他名称"}</p>}
                    </div>
                </fieldset>
            </div>
        </aside>
    );
}
