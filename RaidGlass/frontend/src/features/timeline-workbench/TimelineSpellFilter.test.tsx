import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";
import { appReducer } from "../../store/store";
import { update_used_spells } from "../../store/spells";
import { set_spec_spells } from "../../store/specs";
import { set_filters } from "../../store/ui";
import type Fight from "../../types/fight";
import type Spell from "../../types/spell";
import TimelineSpellFilter from "./TimelineSpellFilter";
import { useTimelineSession, readTimelineSession, saveTimelineSession } from "./timelineSession";

function fixture() {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(set_spec_spells({ full_name_slug: "test", spells: { 1: { spell_id: 1, name: "爆发技能", show: false, icon: "", spell_type: "test" } as Spell } }));
    store.dispatch(update_used_spells({ fights: [{ players: [{ casts: [{ id: 1, ts: 0 }, { id: 99, ts: 10 }] }] }] as Fight[] }));
    return store;
}
function Panel({ target }: { target: string }) {
    useTimelineSession(target);
    return <TimelineSpellFilter key={target} target={target} />;
}
beforeEach(() => sessionStorage.clear());
describe("当前事件技能筛选与目标恢复", () => {
    it("未知技能可搜索，搜索不改变选择，批量操作可撤销", () => {
        const store = fixture();
        render(<Provider store={store}><Panel target="a" /></Provider>);
        const before = store.getState().spells.spell_display;
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "99" } });
        expect(screen.getByRole("checkbox", { name: /技能 99/ })).toBeChecked();
        expect(screen.queryByRole("checkbox", { name: /爆发/ })).toBeNull();
        expect(store.getState().spells.spell_display).toEqual(before);
        fireEvent.click(screen.getByRole("button", { name: "全选" }));
        expect(store.getState().spells.spell_display[1]).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "撤销" }));
        expect(store.getState().spells.spell_display[1]).toBe(false);
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "爆发" } });
        fireEvent.click(screen.getByRole("button", { name: "仅看 爆发技能" }));
        expect(store.getState().spells.spell_display).toMatchObject({ 1: true, 99: false });
        fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
        expect(store.getState().spells.spell_display).toMatchObject({ 1: false, 99: true });
    });
    it("切换与重新挂载恢复各目标的过滤器，后续勾选不会被旧撤销覆盖", () => {
        const store = fixture();
        const ui = (target: string) => <Provider store={store}><Panel target={target} /></Provider>;
        const view = render(ui("a"));
        fireEvent.click(screen.getByRole("button", { name: "全选" }));
        fireEvent.click(screen.getByRole("checkbox", { name: /技能 99/ }));
        expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
        act(() => store.dispatch(set_filters({ region: { US: false } })));
        view.rerender(ui("b"));
        expect(store.getState().spells.spell_display[1]).toBe(false);
        expect(store.getState().ui.filters.region).toEqual({});
        view.rerender(ui("a"));
        expect(store.getState().spells.spell_display).toMatchObject({ 1: true, 99: false });
        expect(store.getState().ui.filters.region).toEqual({ US: false });
        view.unmount();
        render(<Provider store={fixture()}><Panel target="a" /></Provider>);
        expect(screen.getByRole("checkbox", { name: /爆发/ })).toBeChecked();
    });
    it("视图保存不会覆盖筛选，损坏的本地值安全忽略", () => {
        saveTimelineSession("a", { spells: { 1: false } });
        saveTimelineSession("a", { view: { zoom: 6, time: 20 } });
        expect(readTimelineSession("a")).toEqual({ spells: { 1: false }, view: { zoom: 6, time: 20 } });
        sessionStorage.setItem("raidglass:timeline:v1:a", '{"view":{"zoom":-2,"time":null},"filters":{}}');
        expect(readTimelineSession("a")).toEqual({});
    });
});
