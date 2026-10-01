import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openLocalD1 } from "../../testing/local-d1.mjs";
import { enrichActiveCasts, parseCastsPage, rankingSamples } from "../src/wcl-casts.js";

const NOW = "2026-09-27T00:00:00.000Z";
const target = { specSlug: "mage-fire", targetKey: "spec/boss/mage-fire/mythic/dps" };
const ranking = () => ({ reports: [{ report_id: "REPORTCODE123456", start_time: "2026-09-26T00:00:00Z",
    fights: [{ fight_id: 1, start_time: "2026-09-26T00:00:10Z", duration: 60_000,
        players: [{ source_id: 42, casts: [{ id: 1, ts: 1000, d: 5000 }] }] }] }] });
function page(cursor = null, time = 12000) {
    return { reportData: { report: { fights: [{ id: 1, startTime: 10000, endTime: 70000 }],
        masterData: { actors: [{ id: 42, type: "Player" }], abilities: [{ gameID: 2, name: "Fireball", icon: "fire.jpg" }] },
        events: { nextPageTimestamp: cursor, data: [
            { type: "cast", sourceID: 42, abilityGameID: 2, timestamp: time },
            { type: "cast", sourceID: 99, abilityGameID: 3, timestamp: time },
            { type: "begincast", sourceID: 42, abilityGameID: 2, timestamp: time - 1000 },
        ] } } } };
}
async function dbFor(t) {
    const db = openLocalD1(); t.after(() => db.close());
    db.exec(await readFile(new URL("../migrations/0002_wcl_samples.sql", import.meta.url), "utf8"));
    return db;
}
const quiet = () => {};

test("分页断点持久化；整份完成后发布，跨指标和刷新零重复查询", async t => {
    const db = await dbFor(t); let requests = 0;
    const query = async (_query, vars) => {
        requests++;
        assert.doesNotMatch(_query, /includePets/);
        if (requests === 1) assert.doesNotMatch(_query, /startTime:\$start/);
        else assert.match(_query, /startTime:\$start/);
        assert.equal(vars.source, 42);
        assert.equal(vars.start, requests === 1 ? 10000 : 20000);
        return requests === 1 ? page(20000) : page(null, 22000);
    };
    const first = await enrichActiveCasts(ranking(), target, db, query, NOW, quiet);
    assert.deepEqual(first.skill_completion, { version: 1, complete: 0, total: 1, failed: 0, status: "queued", retry_at: null });
    assert.equal(first.reports[0].fights[0].players[0].casts.length, 1);
    const completed = await enrichActiveCasts(ranking(), target, db, query, NOW, quiet);
    assert.equal(completed.skill_completion.complete, 1);
    assert.deepEqual(completed.reports[0].fights[0].players[0].casts, [
        { id: 1, ts: 1000, d: 5000 }, { id: 2, ts: 2000 }, { id: 2, ts: 12000 },
    ]);
    assert.equal(completed.extra_spells[2].name, "Fireball");
    assert.equal(completed.extra_spells[2].show, false);
    const before = await db.prepare("SELECT last_seen FROM wcl_samples WHERE sample_key=?")
        .bind("REPORTCODE123456/1/42/v1").first();
    const reused = await enrichActiveCasts(completed, { ...target, targetKey: "other/hps" }, db, query,
        "2026-09-27T01:00:00.000Z", quiet);
    const after = await db.prepare("SELECT last_seen FROM wcl_samples WHERE sample_key=?")
        .bind("REPORTCODE123456/1/42/v1").first();
    assert.equal(requests, 2);
    assert.equal(after.last_seen, before.last_seen);
    assert.deepEqual(reused.extra_spells[2], completed.extra_spells[2]);
    assert.equal(reused.reports[0].fights[0].players[0].casts.length, 3);
});

test("D1 写入额度耗尽时不发 WCL 查询", async t => {
    const db = await dbFor(t);
    const prepare = db.prepare.bind(db);
    db.prepare = sql => {
        if (sql.startsWith("UPDATE wcl_samples SET last_seen")) {
            return { bind() { return { async run() { throw new Error("D1 daily row write limit"); } }; } };
        }
        return prepare(sql);
    };
    let queries = 0;
    await assert.rejects(() => enrichActiveCasts(ranking(), target, db, async () => {
        queries++;
        return page();
    }, NOW, quiet), /D1 daily row write limit/);
    assert.equal(queries, 0);
});

test("额度停止和读取失败不清空原记录，重试退避后从原分页恢复", async t => {
    const db = await dbFor(t); let requests = 0;
    await enrichActiveCasts(ranking(), target, db, async () => page(20000), NOW, quiet);
    const failed = await enrichActiveCasts(ranking(), target, db, async () => {
        requests++; throw new Error("wcl_hourly_budget");
    }, NOW, quiet);
    assert.equal(failed.skill_completion.complete, 0);
    await enrichActiveCasts(ranking(), target, db, async () => { requests++; }, NOW, quiet);
    assert.equal(requests, 1);
    const result = await enrichActiveCasts(ranking(), target, db, async (_q, vars) => {
        assert.equal(vars.start, 20000); return page(null, 22000);
    }, "2026-09-27T06:00:00.000Z", quiet);
    assert.equal(result.skill_completion.complete, 1);
});

test("账户短暂停止只退避五分钟，随后继续同一分页", async t => {
    const db = await dbFor(t);
    let calls = 0;
    await enrichActiveCasts(ranking(), target, db, async () => {
        calls++;
        throw new Error("wcl_temporarily_unavailable");
    }, NOW, quiet);
    await enrichActiveCasts(ranking(), target, db, async () => { calls++; },
        "2026-09-27T00:04:59.000Z", quiet);
    assert.equal(calls, 1);
    const retried = await enrichActiveCasts(ranking(), target, db, async () => {
        calls++;
        return page();
    }, "2026-09-27T00:05:00.000Z", quiet);
    assert.equal(calls, 2);
    assert.equal(retried.skill_completion.complete, 1);
});

test("旧队列样本先采；不可读样本退避，不阻塞后续样本", async t => {
    const db = await dbFor(t);
    await enrichActiveCasts(ranking(), target, db, async () => { throw new Error("wcl_report_unavailable"); }, NOW, quiet);
    const next = ranking(); next.reports[0].fights[0].players[0].source_id = 43;
    let source;
    await enrichActiveCasts(next, target, db, async (_q, vars) => {
        source = vars.source; throw new Error("wcl_report_unavailable");
    }, NOW, quiet);
    assert.equal(source, 43);
});

test("尚未完成的其它目标样本不会占用本目标的查询", async t => {
    const db = await dbFor(t);
    await enrichActiveCasts(ranking(), target, db, async () => page(20000), NOW, quiet);
    const next = ranking(); next.reports[0].fights[0].players[0].source_id = 43;
    let requestedSource;
    await enrichActiveCasts(next, target, db, async (_query, vars) => {
        requestedSource = vars.source;
        throw new Error("probe_end");
    }, NOW, quiet);
    assert.equal(requestedSource, 43);
});

test("身份、分页与数据形状校验，重复事件去重，原有 Buff 保留", async t => {
    assert.throws(() => rankingSamples({ reports: [{ report_id: 'bad', fights: [{ players: [{}] }] }] }), /identity/);
    const sample = { fight_id: 1, source_id: 42, fight_start: 10000, fight_duration: 60000,
        cursor: null, spells_json: '{}', casts_json: '[]' };
    assert.throws(() => parseCastsPage(sample, page(10000)), /pagination_stalled/);
    assert.throws(() => parseCastsPage({ ...sample, source_id: 99 }, page()), /player_identity/);
    assert.throws(() => parseCastsPage({ ...sample, fight_start: 0 }, page()), /fight_identity/);
    const empty = page(); empty.reportData.report.events.data = [];
    assert.deepEqual(parseCastsPage(sample, empty).casts, []);
    assert.equal(parseCastsPage(sample, empty).complete, true);
    const malformed = page(); delete malformed.reportData.report.events.nextPageTimestamp;
    assert.throws(() => parseCastsPage(sample, malformed), /events_missing/);
    const data = page(); data.reportData.report.events.data.push(data.reportData.report.events.data[0]);
    assert.equal(parseCastsPage(sample, data).casts.length, 1);
    const db = await dbFor(t);
    const mixed = ranking(); mixed.reports[0].fights[0].players[0].casts.push({ id: 2, ts: 2100, d: 3000 });
    const result = await enrichActiveCasts(mixed, target, db, async () => page(), NOW, quiet);
    assert.deepEqual(result.reports[0].fights[0].players[0].casts.at(-1), { id: 2, ts: 2100, d: 3000 });
});

test("目录内主动技能补齐遗漏次数，500ms内已有施法不重复", async t => {
    const db = await dbFor(t);
    const value = ranking();
    value.reports[0].fights[0].players[0].casts = [{ id: 190319, ts: 2100 }];
    const data = page();
    data.reportData.report.events.data = [12000, 32000].map(timestamp => ({
        type: "cast", sourceID: 42, abilityGameID: 190319, timestamp,
    }));
    const result = await enrichActiveCasts(value, target, db, async () => data, NOW, quiet);
    assert.deepEqual(result.reports[0].fights[0].players[0].casts,
        [{ id: 190319, ts: 2100 }, { id: 190319, ts: 22000 }]);
    assert.equal(result.extra_spells[190319], undefined);
});

test("Top10 样本批量登记与读取，保持有限 D1 往返", async t => {
    const db = await dbFor(t);
    const originalPrepare = db.prepare.bind(db);
    let statementCount = 0;
    db.prepare = sql => { statementCount++; return originalPrepare(sql); };
    const value = ranking();
    const first = value.reports[0].fights[0].players[0];
    value.reports[0].fights[0].players = Array.from({ length: 10 }, (_, index) => ({
        ...first, source_id: 42 + index, casts: [...first.casts],
    }));
    const result = await enrichActiveCasts(value, target, db, async () => page(), NOW, quiet);
    assert.equal(result.skill_completion.total, 10);
    assert.ok(statementCount <= 5, `D1 statements=${statementCount}`);
});

test("已有分页先完成；缓存登记不请求 WCL；真实零次保持完整状态", async t => {
    const db = await dbFor(t);
    const value = ranking();
    value.reports[0].fights[0].players.push({ source_id: 43, casts: [] });
    await enrichActiveCasts(value, target, db, null, NOW, quiet);
    await db.prepare("UPDATE wcl_samples SET cursor=20000 WHERE source_id=43").run();
    const result = await enrichActiveCasts(value, target, db, async (_q, vars) => {
        assert.equal(vars.source, 43);
        assert.equal(vars.start, 20000);
        const data = page(); data.reportData.report.events.data = [];
        return data;
    }, NOW, quiet);
    assert.equal(result.skill_completion.complete, 1);
    assert.equal(result.reports[0].fights[0].players[1].casts_complete, true);
    assert.equal(result.reports[0].fights[0].players[1].casts.length, 0);
    assert.equal(result.reports[0].fights[0].players[0].casts_complete, false);
});
