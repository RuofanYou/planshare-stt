import { useState } from "react";
import { recordDiagnostic } from "../../diagnostics";
import { useAppDispatch, useAppSelector } from "../../store/store_hooks";
import { replace_spell_display, set_spell_visible } from "../../store/spells";
import SpellSettings from "../../components/SettingsBar/SpellSettings/SpellSettings";
import SettingsBar from "../../components/SettingsBar/SettingsBar";
import styles from "./TimelineWorkbench.module.scss";

export default function TimelineSpellFilter({ target, disabled = false }: { target: string; disabled?: boolean }) {
    const dispatch = useAppDispatch();
    const { all_spells: spells, used_spell_ids: usedIds, spell_display: display } = useAppSelector(state => state.spells);
    const specSlug = target.split('/')[1];
    const catalogIds = useAppSelector(state => Object.values(state.specs.specs_by_name[specSlug]?.spells_by_type || {}).flat());
    const manualKey = `raidglass:manual-spell-ids:${target}`;
    const [manualIds, setManualIds] = useState<number[]>(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(manualKey) || '[]');
            return Array.isArray(saved) ? saved.filter(id => Number.isSafeInteger(id) && id > 0) : [];
        } catch { return []; }
    });
    const ids = [...new Set([...catalogIds, ...usedIds, ...manualIds])].filter(id => id > 0);
    const [query, setQuery] = useState("");
    const completion = useAppSelector(state => state.fights.ranking_meta?.skillCompletion);
    const collectionComplete = !!completion && completion.complete === completion.total;
    const filters = useAppSelector(state => state.ui.filters);
    const [undo, setUndo] = useState<Record<number, boolean> | null>(null);
    const selected = ids.filter(id => display[id] !== false).length;
    const search = query.trim().toLocaleLowerCase();
    const matches = ids.filter(id => String(id).includes(search)
        || spells[id]?.name.toLocaleLowerCase().includes(search)
        || spells[id]?.search_names?.some(name => name.toLocaleLowerCase().includes(search)));
    const manualId = /^\d+$/.test(search) ? Number(search) : 0;

    function addManualId() {
        if (!Number.isSafeInteger(manualId) || manualId <= 0 || ids.includes(manualId)) return;
        const next = [...manualIds, manualId];
        try { sessionStorage.setItem(manualKey, JSON.stringify(next)); }
        catch { recordDiagnostic('timeline_session_failed', { target, operation: 'write' }); }
        setManualIds(next);
        dispatch(set_spell_visible({ spell_id: manualId, visible: true }));
        recordDiagnostic('spell_filter_applied', { target, action: 'add-id', spell: manualId });
    }

    function batch(kind: "all" | "default" | "only", only?: number) {
        const previous = Object.fromEntries(ids.map(id => [id, display[id] !== false]));
        setUndo(previous);
        const next = { ...display };
        ids.forEach(id => { next[id] = kind === "all" || (kind === "only" ? id === only : spells[id]?.show === true); });
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
            <div className={styles.spellFilterBody}>
                <fieldset disabled={disabled}>
                    <div className={styles.spellFilterHeading}>
                        <h3>技能筛选</h3>
                        <span role="status">已选 {selected}/{ids.length}</span>
                        <span>点击分类批量开关，点击图标选择技能</span>
                    </div>
                    <div onClickCapture={event => {
                        if (!(event.target instanceof Element)) return;
                        const button = event.target.closest("button");
                        if (!button || button.hasAttribute("aria-expanded")) return;
                        setUndo(button.hasAttribute("data-spell_id") ? null
                            : Object.fromEntries(ids.map(id => [id, display[id] !== false])));
                        recordDiagnostic("spell_filter_applied", {
                            target, action: "icon-control", control: button.getAttribute("aria-label") || button.textContent || "",
                        });
                    }}>
                        <SettingsBar><SpellSettings filters={filters} /></SettingsBar>
                    </div>
                    {completion && <p role="status">
                        主动技能已补全 {completion.complete}/{completion.total} 个样本
                        {completion.complete < completion.total && " · 其余样本的施放时间将在后续自动刷新中补齐。"}
                        {completion.failed > 0 && " 补采遇到读取失败，后续会重试。"}
                    </p>}
                    <div className={styles.spellFilterActions}>
                        <button type="button" onClick={() => batch("all")}>全选</button>
                        <button type="button" onClick={() => batch("default")}>恢复默认</button>
                        <button type="button" disabled={!undo} onClick={undoBatch}>撤销</button>
                    </div>
                    {ids.length > 0 && selected === 0 && <p role="status">当前筛选隐藏了全部技能，可全选或恢复默认。</p>}
                    <details className={styles.spellSearch}>
                        <summary>查看全部 {ids.length} 个可选技能（名称 / ID 搜索）</summary>
                        <label>搜索技能
                            <input type="search" value={query} placeholder="名称或技能 ID"
                                onChange={event => setQuery(event.target.value)} />
                        </label>
                        <p role="status">当前专精技能与本组事件 · 搜索结果 {matches.length}。{collectionComplete ? "本组无记录的技能勾选后暂无时间轴标记。" : "施放记录尚未补齐，勾选后可能暂时没有时间轴标记。"}</p>
                        {manualId > 0 && Number.isSafeInteger(manualId) && !ids.includes(manualId)
                            && <button type="button" onClick={addManualId}>按 ID 添加技能 {manualId}</button>}
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
                                        <span>{spells[id]?.name || `技能 ${id}`}<small>{id}</small>
                                            {!usedIds.includes(id) && <small>{collectionComplete ? "本组无记录" : "记录待补全"}</small>}</span>
                                    </label>
                                    <button type="button" aria-label={`仅看 ${spells[id]?.name || `技能 ${id}`}`}
                                        onClick={() => batch("only", id)}>仅看</button>
                                </div>
                            ))}
                            {matches.length === 0 && <p>{ids.length === 0 ? "当前数据暂无技能" : "未找到匹配技能，试试技能 ID 或其他名称"}</p>}
                        </div>
                    </details>
                </fieldset>
            </div>
        </aside>
    );
}
