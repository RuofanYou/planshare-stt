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
        expect(screen.getByRole("button", { name: "治疗技能" })).toBeVisible();
        expect(screen.getByText(/查看全部 \d+ 个可选技能/).parentElement).not.toHaveAttribute("open");
        fireEvent.click(screen.getByText(/查看全部 \d+ 个可选技能/));
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
        fireEvent.click(screen.getByText(/查看全部 \d+ 个可选技能/));
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
        fireEvent.click(screen.getByText(/查看全部 \d+ 个可选技能/));
        expect(screen.getByRole("checkbox", { name: /爆发/ })).toBeChecked();
    });
    it("原分类按钮批量开关后可以撤销", () => {
        const store = fixture();
        render(<Provider store={store}><Panel target="a" /></Provider>);
        const before = store.getState().spells.spell_display[1];
        fireEvent.click(screen.getByRole("button", { name: "全部技能" }));
        expect(store.getState().spells.spell_display[1]).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "撤销" }));
        expect(store.getState().spells.spell_display[1]).toBe(before);
    });
    it("视图保存不会覆盖筛选，损坏的本地值安全忽略", () => {
        saveTimelineSession("a", { spells: { 1: false } });
        saveTimelineSession("a", { view: { zoom: 6, time: 20 } });
        expect(readTimelineSession("a")).toEqual({ spells: { 1: false }, view: { zoom: 6, time: 20 } });
        sessionStorage.setItem("raidglass:timeline:v1:a", '{"view":{"zoom":-2,"time":null},"filters":{}}');
        expect(readTimelineSession("a")).toEqual({});
    });
});

describe("自动补采技能", () => {
    it("新技能默认隐藏、可按原始名称搜索勾选并恢复默认；覆盖不足明确显示", async () => {
        const { fightsRequestStarted, fightsRequestSucceeded } = await import("../../store/fights");
        const store = configureStore({ reducer: appReducer });
        store.dispatch(fightsRequestStarted({ requestId: "new", targetKey: "a" }));
        store.dispatch(fightsRequestSucceeded({ requestId: "new", targetKey: "a",
            fights: [{ report_id: "sample", fight_id: 1, players: [{ source_id: 42,
                casts: [{ id: 999999, ts: 1000 }] }] }] as Fight[],
            extraSpells: { 999999: { spell_id: 999999, spell_type: "additional", name: "Example Cast",
                icon: "", show: false, cooldown: 0, duration: 0, color: "", icon_path: "" } },
            meta: { updated: "2026-09-27", edgeTopN: 10, sourceReportCount: 10,
                refresh: { status: "fresh", checked_at: "2026-09-27", published_at: "2026-09-27", upstream_updated: "2026-09-27", last_error_code: null },
                skillCompletion: { version: 1, complete: 1, total: 10, failed: 1 } },
        }));
        render(<Provider store={store}><Panel target="a" /></Provider>);
        expect(screen.getByText(/主动技能已补全 1\/10/)).toBeVisible();
        expect(screen.getByText(/补采遇到读取失败，后续会重试/)).toBeVisible();
        fireEvent.click(screen.getByText(/查看全部 \d+ 个可选技能/));
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Example" } });
        const checkbox = screen.getByRole("checkbox", { name: /Example Cast/ });
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
        expect(checkbox).not.toBeChecked();
        const before = store.getState();
        store.dispatch(fightsRequestSucceeded({ requestId: "stale", targetKey: "b", fights: [], meta: null,
            extraSpells: { 888888: { spell_id: 888888, name: "wrong" } as Spell } }));
        expect(store.getState()).toBe(before);
    });
});

it("未施放的专精技能可按中英文或别名勾选，目录外 ID 可自行加入并按目标保存", () => {
    const store = configureStore({ reducer: appReducer });
    store.dispatch({ type: "specs/set_specs", payload: [{ id: 1468, index: 3, class: { name: "Evoker", name_slug: "evoker" },
        role: "heal", name: "Preservation", full_name: "Preservation Evoker",
        full_name_slug: "evoker-preservation" }] });
    store.dispatch(set_spec_spells({ spec_slug: "evoker-preservation", spells: {
        366155: { spell_id: 366155, name: "逆转", show: false, icon: "",
            spell_type: "evoker-preservation", search_names: ["Reversion"] } as Spell,
        1256581: { spell_id: 1256581, name: "麦琳瑟拉的祝福", show: false, icon: "",
            spell_type: "evoker-preservation", search_names: ["Merithra's Blessing", "麦林斯拉的祝福"] } as Spell,
    } }));
    const target = "nymrissa-wavecaller/evoker-preservation/mythic/hps";
    const view = render(<Provider store={store}><Panel target={target} /></Provider>);
    fireEvent.click(screen.getByText("查看全部 2 个可选技能（名称 / ID 搜索）"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "逆转" } });
    const reversion = screen.getByRole("checkbox", { name: /逆转/ });
    expect(reversion).not.toBeChecked();
    expect(screen.getByText("记录待补全")).toBeVisible();
    fireEvent.click(reversion);
    expect(reversion).toBeChecked();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Merithra" } });
    expect(screen.getByRole("checkbox", { name: /麦琳瑟拉的祝福/ })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "麦林斯拉" } });
    expect(screen.getByRole("checkbox", { name: /麦琳瑟拉的祝福/ })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: "按 ID 添加技能 999999" }));
    expect(screen.getByRole("checkbox", { name: /技能 999999/ })).toBeChecked();
    view.unmount();
    render(<Provider store={store}><Panel target={target} /></Provider>);
    fireEvent.click(screen.getByText(/查看全部 3 个可选技能/));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "999999" } });
    expect(screen.getByRole("checkbox", { name: /技能 999999/ })).toBeChecked();
});
