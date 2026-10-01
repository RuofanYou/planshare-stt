import { configureStore } from "@reduxjs/toolkit";
import { act, render, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, expect, it, vi } from "vitest";
import { appReducer } from "../../store/store";
import { fightsRequestStarted, fightsRequestSucceeded } from "../../store/fights";
import { set_spell_visible } from "../../store/spells";
import { useCastBackfill } from "./useCastBackfill";
import type Fight from "../../types/fight";

const key = "ulatek/warlock-demonology/heroic/dps";
const completion = { version: 1, complete: 0, total: 1, failed: 0, status: "queued" as const };
const refresh = { status: "fresh" as const, checked_at: "2026-10-01T00:00:00Z", published_at: "2026-10-01T00:00:00Z", upstream_updated: "2026-10-01T00:00:00Z", last_error_code: null };
const meta = { updated: refresh.checked_at, edgeTopN: 10 as const, sourceReportCount: 1, refresh, skillCompletion: completion };
const fight = { report_id: "sample", fight_id: 1, pinned: true, players: [{ source_id: 1, name: "Ayazz", casts: [], spec_slug: "warlock-demonology" }] } as unknown as Fight;
function fixture() {
    const store = configureStore({ reducer: appReducer });
    store.dispatch(fightsRequestStarted({ requestId: "initial", targetKey: key }));
    store.dispatch(fightsRequestSucceeded({ requestId: "initial", targetKey: key, fights: [{ ...fight, players: [{ ...fight.players[0], casts: [{ id: 1, ts: 1 }] }] }], meta }));
    return store;
}
function Panel({ target = key }: { target?: string }) { useCastBackfill(target, true, completion); return null; }
function ranking(done: boolean) {
    return { ...meta, edge_top_n: 10, skill_completion: { ...completion, complete: Number(done) },
        reports: [{ report_id: "sample", fights: [{ ...fight, players: [{ ...fight.players[0], casts_complete: done, casts: [{ id: 104316, ts: 21000 }] }] }] }] };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("只登记一次；30秒轻量查询；完成后更新技能并停止，保留固定行和筛选", async () => {
    vi.useFakeTimers();
    const store = fixture();
    store.dispatch(set_spell_visible({ spell_id: 104316, visible: true }));
    let done = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/backfill")) {
            done = init?.method === "GET";
            return Response.json({ revision: done ? "2" : "1", skill_completion: { ...completion, complete: Number(done), status: done ? "complete" : "queued" } });
        }
        return Response.json(ranking(done));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<Provider store={store}><Panel /></Provider>);
    await act(async () => {});
    expect(fetcher.mock.calls.filter(([url]) => url.includes("backfill"))).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(store.getState().fights.ranking_meta?.skillCompletion?.complete).toBe(1);
    expect(store.getState().fights.fights_by_id["sample/1/1"].pinned).toBe(true);
    expect(store.getState().fights.fights_by_id["sample/1/1"].players[0].casts_complete).toBe(true);
    expect(store.getState().spells.spell_display[104316]).toBe(true);
    const count = fetcher.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetcher).toHaveBeenCalledTimes(count);
});

it("额度等待到恢复时间；隐藏页面和卸载后不再轮询", async () => {
    vi.useFakeTimers();
    const retry_at = new Date(Date.now() + 120_000).toISOString();
    const fetcher = vi.fn(async (url: string) => Response.json(url.includes("backfill")
        ? { revision: "1", skill_completion: { ...completion, status: "budget_wait", retry_at } } : ranking(false)));
    vi.stubGlobal("fetch", fetcher);
    const view = render(<Provider store={fixture()}><Panel /></Provider>);
    await act(async () => {});
    const count = fetcher.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(119_000); });
    expect(fetcher).toHaveBeenCalledTimes(count);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(count);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetcher.mock.calls.length).toBe(count + 1);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetcher.mock.calls.length).toBe(count + 1);
});

it("切换目标时中止旧请求，旧响应不能写入新榜单", async () => {
    const store = fixture();
    const pending: Array<(response: Response) => void> = [];
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise<Response>(resolve => pending.push(resolve));
    }));
    const view = render(<Provider store={store}><Panel /></Provider>);
    const newKey = "ulatek/warlock-demonology/mythic/dps";
    act(() => {
        store.dispatch(fightsRequestStarted({ requestId: "new", targetKey: newKey }));
        store.dispatch(fightsRequestSucceeded({ requestId: "new", targetKey: newKey, fights: [fight], meta }));
    });
    view.rerender(<Provider store={store}><Panel target={newKey} /></Provider>);
    expect(signals[0].aborted).toBe(true);
    await act(async () => {
        pending[0](Response.json({ revision: "old", skill_completion: { ...completion, complete: 1, status: "complete" } }));
    });
    expect(store.getState().fights.accepted_target).toBe(newKey);
    expect(store.getState().fights.ranking_meta?.skillCompletion?.complete).toBe(0);
});
