import assert from "node:assert/strict";
import test from "node:test";

import {
    enrichWclSwiftness,
    resetWclTokenForTests,
    shouldEnrichWclSwiftness,
} from "../src/wcl-swiftness.js";

const target = {
    targetKey: "spec/nymrissa-wavecaller/shaman-restoration/mythic/hps",
    bossSlug: "nymrissa-wavecaller",
    specSlug: "shaman-restoration",
    difficulty: "mythic",
    metric: "hps",
};

function ranking() {
    return {
        reports: [{
            report_id: "REPORTCODE123456",
            start_time: "2026-09-15T00:00:00.000Z",
            fights: [{
                fight_id: 7,
                start_time: "2026-09-15T00:00:10.000Z",
                duration: 60_000,
                players: [{ source_id: 42, casts: [{ id: 98008, ts: 20_000 }] }],
            }],
        }],
    };
}

function response(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

test("奶萨 HPS 只补精确匹配报告的自然迅捷与先祖迅捷", async () => {
    resetWclTokenForTests();
    const value = ranking();
    const calls = [];
    const logs = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith("/oauth/token")) {
            return response({ access_token: "token", expires_in: 3600 });
        }
        const body = JSON.parse(init.body);
        if (body.query.includes("characterRankings")) {
            return response({ data: {
                rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 10, pointsResetIn: 3000 },
                worldData: { encounter: { characterRankings: { rankings: [{
                    report: { code: "REPORTCODE123456", fightID: 7 },
                }] } } },
            } });
        }
        return response({ data: {
            rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 28, pointsResetIn: 2990 },
            reportData: { r0: {
                natural: { nextPageTimestamp: null, data: [
                    { timestamp: 13_000, type: "applybuff", targetID: 42, abilityGameID: 378081 },
                    { timestamp: 16_000, type: "removebuff", targetID: 42, abilityGameID: 378081 },
                    { timestamp: 18_000, type: "applybuff", targetID: 99, abilityGameID: 378081 },
                ] },
                ancestral: { nextPageTimestamp: null, data: [
                    { timestamp: 22_000, type: "applybuff", targetID: 42, abilityGameID: 443454 },
                ] },
            } },
        } });
    };

    await enrichWclSwiftness(value, target, {
        WCL_CLIENT_ID: "client",
        WCL_CLIENT_SECRET: "secret",
    }, {
        fetchImpl,
        now: () => new Date("2026-09-15T01:00:00.000Z"),
        log: (event, details) => logs.push({ event, details }),
        bossIds: new Map([["nymrissa-wavecaller", 3379]]),
    });

    assert.deepEqual(value.reports[0].fights[0].players[0].casts, [
        { id: 378081, ts: 3_000 },
        { id: 443454, ts: 12_000 },
        { id: 98008, ts: 20_000 },
    ]);
    assert.equal(calls.length, 3);
    assert.deepEqual(logs.map(({ event }) => event), [
        "wcl_enrichment_started",
        "wcl_enrichment_authenticated",
        "wcl_enrichment_applied",
    ]);
    assert.deepEqual(logs.at(-1).details, {
        target_key: target.targetKey,
        matched_reports: 1,
        added_events: 2,
        points_spent: 28,
        points_limit: 3600,
    });
});

test("达到每小时 10% 预算后保留原排行并跳过事件请求", async () => {
    resetWclTokenForTests();
    const value = ranking();
    const before = JSON.stringify(value);
    const logs = [];
    let calls = 0;
    await enrichWclSwiftness(value, target, {
        WCL_CLIENT_ID: "client",
        WCL_CLIENT_SECRET: "secret",
    }, {
        fetchImpl: async (url, init) => {
            calls += 1;
            if (String(url).endsWith("/oauth/token")) return response({ access_token: "token", expires_in: 3600 });
            assert.match(JSON.parse(init.body).query, /characterRankings/);
            return response({ data: {
                rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 360, pointsResetIn: 3000 },
                worldData: { encounter: { characterRankings: { rankings: [] } } },
            } });
        },
        now: () => new Date("2026-09-15T01:00:00.000Z"),
        log: (event, details) => logs.push({ event, details }),
        bossIds: new Map([["nymrissa-wavecaller", 3379]]),
    });

    assert.equal(JSON.stringify(value), before);
    assert.equal(calls, 2);
    assert.equal(logs.at(-1).event, "wcl_enrichment_skipped");
    assert.equal(logs.at(-1).details.reason, "hourly_budget");
});

test("WCL 事件分页时不写入部分结果并保留原排行", async () => {
    resetWclTokenForTests();
    const value = ranking();
    const before = JSON.stringify(value);
    const logs = [];
    await enrichWclSwiftness(value, target, {
        WCL_CLIENT_ID: "client",
        WCL_CLIENT_SECRET: "secret",
    }, {
        fetchImpl: async (url, init) => {
            if (String(url).endsWith("/oauth/token")) return response({ access_token: "token", expires_in: 3600 });
            if (JSON.parse(init.body).query.includes("characterRankings")) {
                return response({ data: {
                    rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 10, pointsResetIn: 3000 },
                    worldData: { encounter: { characterRankings: { rankings: [{
                        report: { code: "REPORTCODE123456", fightID: 7 },
                    }] } } },
                } });
            }
            return response({ data: {
                rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 20, pointsResetIn: 2990 },
                reportData: { r0: {
                    natural: { nextPageTimestamp: 15_000, data: [
                        { timestamp: 13_000, type: "applybuff", targetID: 42, abilityGameID: 378081 },
                    ] },
                    ancestral: { nextPageTimestamp: null, data: [] },
                } },
            } });
        },
        now: () => new Date("2026-09-15T01:00:00.000Z"),
        log: (event, details) => logs.push({ event, details }),
        bossIds: new Map([["nymrissa-wavecaller", 3379]]),
    });

    assert.equal(JSON.stringify(value), before);
    assert.equal(logs.at(-1).event, "wcl_enrichment_failed");
    assert.equal(logs.at(-1).details.reason, "wcl_events_paginated");
});

test("其他专精或指标不触发 WCL", async () => {
    assert.equal(shouldEnrichWclSwiftness(target), true);
    assert.equal(shouldEnrichWclSwiftness({ ...target, metric: "dps" }), false);
    assert.equal(shouldEnrichWclSwiftness({ ...target, specSlug: "shaman-elemental" }), false);
    await enrichWclSwiftness(ranking(), { ...target, metric: "dps" }, {}, {
        fetchImpl: () => { throw new Error("unexpected fetch"); },
        now: () => new Date(),
        log: () => {},
    });
});

test("WCL GraphQL 错误保留有限字段摘要以便诊断", async () => {
    const { graphql, resetWclTokenForTests } = await import("../src/wcl-client.js");
    resetWclTokenForTests();
    const fetchImpl = async (url) => String(url).endsWith("/oauth/token")
        ? response({ access_token: "token", expires_in: 3600 })
        : response({ errors: [{ message: "Unknown argument 'sourceID'\non field 'events'" }] });
    await assert.rejects(
        graphql({ WCL_CLIENT_ID: "test", WCL_CLIENT_SECRET: "secret" }, fetchImpl,
            () => new Date(), () => {}, target, "query{...}"),
        /wcl_graphql_error: Unknown argument 'sourceID' on field 'events'/,
    );
});
