import { describe, expect, it } from "vitest";

import reducer, {
    clear_copynote,
    createDefaultFilters,
    reset_filters,
    set_filters,
} from "./ui";

describe("UI 默认筛选", () => {
    it("工厂返回全部默认筛选维度", () => {
        expect(createDefaultFilters()).toEqual({
            killtime: { min: null, max: null },
            log_date: { from: null, to: null },
            role: {},
            spec: {},
            class: {},
            region: {},
            hide_empty_rows: false,
        });
    });

    it("每次调用都返回深层隔离的新对象", () => {
        const first = createDefaultFilters();
        const second = createDefaultFilters();

        expect(first).not.toBe(second);
        expect(first.killtime).not.toBe(second.killtime);
        expect(first.log_date).not.toBe(second.log_date);
        expect(first.role).not.toBe(second.role);
        expect(first.spec).not.toBe(second.spec);
        expect(first.class).not.toBe(second.class);
        expect(first.region).not.toBe(second.region);

        first.killtime.min = 60;
        first.log_date.from = "2026-07-10";
        first.role.tank = false;
        first.spec["mage-fire"] = false;
        first.class.mage = false;
        first.region.EU = false;

        expect(second).toEqual({
            killtime: { min: null, max: null },
            log_date: { from: null, to: null },
            role: {},
            spec: {},
            class: {},
            region: {},
            hide_empty_rows: false,
        });
    });

    it("reset_filters 无载荷恢复全部筛选维度", () => {
        const dirty = reducer(undefined, set_filters({
            killtime: { min: 60, max: 180 },
            log_date: { from: "2026-07-01", to: "2026-07-31" },
            role: { tank: false },
            spec: { "mage-fire": false },
            class: { mage: false },
            region: { EU: false },
            hide_empty_rows: true,
        }));

        const reset = reducer(dirty, reset_filters());

        expect(reset.filters).toEqual(createDefaultFilters());
        expect(reset.filters).not.toBe(dirty.filters);
        expect(reset.filters.killtime).not.toBe(dirty.filters.killtime);
        expect(reset.filters.log_date).not.toBe(dirty.filters.log_date);
        expect(reset.filters.role).not.toBe(dirty.filters.role);
        expect(reset.filters.spec).not.toBe(dirty.filters.spec);
        expect(reset.filters.class).not.toBe(dirty.filters.class);
        expect(reset.filters.region).not.toBe(dirty.filters.region);
    });
});

describe("作业弹窗状态", () => {
    it("统一清理动作同时关闭弹窗并移除玩家与战斗", () => {
        const dirty = {
            ...reducer(undefined, { type: "初始化" }),
            show_copynote: true,
            copynote_player: { name: "旧玩家" },
            copynote_fight: { fight_id: 99 },
        } as ReturnType<typeof reducer>;

        const cleared = reducer(dirty, clear_copynote());

        expect(cleared.show_copynote).toBe(false);
        expect(cleared.copynote_player).toBeNull();
        expect(cleared.copynote_fight).toBeNull();
    });
});
