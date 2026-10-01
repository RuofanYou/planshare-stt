import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import type Fight from "../types/fight";
import type { SpellDict } from "../types/spell";
import {
    fightsRequestFailed,
    fightsRequestStarted,
    fightsRequestSucceeded,
    set_fights,
} from "./fights";
import { process_spells } from "./spells";
import { set_spec_spells } from "./specs";
import { appReducer } from "./store";

function spellFixture(spell_id: number, name: string): SpellDict[number] {
    return {
        spell_id,
        spell_type: "boss",
        name,
        color: "#ffffff",
        cooldown: 0,
        duration: 0,
        icon: "spell.jpg",
        show: true,
        icon_path: "",
    };
}

function fightWithSpell(spellId: number): Fight {
    return {
        fight_id: spellId,
        report_id: `report-${spellId}`,
        report_url: `https://www.warcraftlogs.com/reports/report-${spellId}`,
        duration: 90_000,
        difficulty: 5,
        phases: [],
        players: [{
            name: "玩家",
            spec_slug: "mage-fire",
            class_slug: "mage",
            total: 100,
            casts: [{ id: spellId, ts: 1_000 }],
            deaths: [],
            resurrects: [],
        }],
    };
}

describe("技能数据处理", () => {
    it("进入 Redux 前统一替换为简体中文名", () => {
        const spells: SpellDict = {
            1249265: spellFixture(1249265, "Umbral Collapse"),
            999999999: spellFixture(999999999, "Untranslated Spell"),
            48792: { ...spellFixture(48792, "冰封之韧"), catalog_source: "spellbook" },
        };

        const processed = process_spells(spells);

        expect(processed[1249265].name).toBe("幽影坍缩");
        expect(processed[999999999].name).toBe("未知技能（999999999）");
        expect(processed[48792].icon_path).toBe("/log/assets/images/spells/spell.jpg");
    });
});

describe("已接收战斗的技能派生", () => {
    it("技能书与 WCL 元数据任一先到都保留中文名和真实图标", () => {
        const book: SpellDict = { 1256581: { ...spellFixture(1256581, "麦琳瑟拉的祝福"),
            spell_type: "evoker-preservation", icon: "", catalog_source: "spellbook", show: false } };
        const extra: SpellDict = { 1256581: { ...spellFixture(1256581, "Merithra's Blessing"),
            spell_type: "additional", icon: "ability_evoker_spiritbloom.jpg", show: false } };
        for (const bookFirst of [true, false]) {
            const store = configureStore({ reducer: appReducer });
            if (bookFirst) store.dispatch(set_spec_spells({ spec_slug: "evoker-preservation", spells: book }));
            store.dispatch(fightsRequestStarted({ requestId: "new", targetKey: "target" }));
            store.dispatch(fightsRequestSucceeded({ requestId: "new", targetKey: "target",
                fights: [fightWithSpell(1256581)], extraSpells: extra, meta: null }));
            if (!bookFirst) store.dispatch(set_spec_spells({ spec_slug: "evoker-preservation", spells: book }));
            const spell = store.getState().spells.all_spells[1256581];
            expect(spell.name).toBe("麦琳瑟拉的祝福");
            expect(spell.icon_path).toBe("https://assets.rpglogs.com/img/warcraft/abilities/ability_evoker_spiritbloom.jpg");
        }
    });

    it("未初始化根状态拒绝无所有者的终态动作", () => {
        const initial = appReducer(undefined, { type: "test/init" });
        const staleSuccess = appReducer(undefined, fightsRequestSucceeded({
            requestId: "stale",
            targetKey: "boss/stale/mythic/dps",
            fights: [fightWithSpell(22_222)],
            meta: null,
        }));
        const staleFailure = appReducer(undefined, fightsRequestFailed({
            requestId: "stale",
            targetKey: "boss/stale/mythic/dps",
            error: "过期失败",
        }));

        expect(staleSuccess).toEqual(initial);
        expect(staleSuccess.spells.used_spell_ids).toEqual([]);
        expect(staleFailure).toEqual(initial);
    });

    it("报告旧路径与通用成功动作共用同一套 used spell 更新", () => {
        const store = configureStore({ reducer: appReducer });
        store.dispatch(set_fights([fightWithSpell(11_111)]));
        expect(store.getState().spells.used_spell_ids).toEqual([11_111]);

        store.dispatch(fightsRequestStarted({
            requestId: "request",
            targetKey: "boss/spec/mythic/dps",
        }));
        store.dispatch(fightsRequestSucceeded({
            requestId: "request",
            targetKey: "boss/spec/mythic/dps",
            fights: [fightWithSpell(22_222)],
            meta: null,
        }));

        expect(store.getState().spells.used_spell_ids).toEqual([22_222]);
    });

    it("发起和失败动作不会清除已接收技能", () => {
        const store = configureStore({ reducer: appReducer });
        store.dispatch(set_fights([fightWithSpell(11_111)]));
        const acceptedSpells = store.getState().spells;
        store.dispatch(fightsRequestStarted({
            requestId: "request",
            targetKey: "boss/spec/mythic/dps",
        }));
        expect(store.getState().spells).toBe(acceptedSpells);

        store.dispatch(fightsRequestFailed({
            requestId: "request",
            targetKey: "boss/spec/mythic/dps",
            error: "失败",
        }));

        expect(store.getState().spells).toBe(acceptedSpells);
        expect(store.getState().spells.used_spell_ids).toEqual([11_111]);
    });

    it("过期终态动作不会改变完整根状态或技能", () => {
        const store = configureStore({ reducer: appReducer });
        store.dispatch(set_fights([fightWithSpell(11_111)]));
        store.dispatch(fightsRequestStarted({
            requestId: "current",
            targetKey: "boss/current/mythic/dps",
        }));
        const current = store.getState();

        store.dispatch(fightsRequestSucceeded({
            requestId: "stale",
            targetKey: "boss/current/mythic/dps",
            fights: [fightWithSpell(22_222)],
            meta: null,
        }));

        expect(store.getState()).toBe(current);
        expect(store.getState().spells.used_spell_ids).toEqual([11_111]);

        store.dispatch(fightsRequestFailed({
            requestId: "current",
            targetKey: "boss/wrong/mythic/dps",
            error: "过期失败",
        }));
        expect(store.getState()).toBe(current);
    });
});
