// One cache identity across metrics and refresh rounds. Bump only when event semantics change.
export const CASTS_VERSION = 1;
const PAGE_SIZE = 1000;

export function rankingSamples(ranking) {
    const samples = new Map();
    for (const report of ranking.reports.slice(0, 10)) {
        for (const fight of report.fights || []) {
            const start = Date.parse(fight.start_time) - Date.parse(report.start_time);
            for (const player of fight.players || []) {
                if (!/^[A-Za-z0-9]{16}$/.test(report.report_id)
                    || !Number.isSafeInteger(fight.fight_id) || fight.fight_id < 1
                    || !Number.isSafeInteger(player.source_id) || player.source_id < 1
                    || !Number.isFinite(start) || start < 0
                    || !Number.isFinite(fight.duration) || fight.duration <= 0) {
                    throw new Error("wcl_sample_identity_invalid");
                }
                const key = `${report.report_id}/${fight.fight_id}/${player.source_id}/v${CASTS_VERSION}`;
                samples.set(key, { key, report: report.report_id, fight: fight.fight_id,
                    source: player.source_id, start, duration: fight.duration });
            }
        }
    }
    return [...samples.values()];
}

export function castsQuery(sample) {
    const pageVariable = sample.cursor == null ? "" : ",$start:Float!";
    const pageStart = sample.cursor == null ? "" : " startTime:$start";
    return `query($code:String!,$fight:Int!,$source:Int!${pageVariable}){
        rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
        reportData{report(code:$code){
            fights(fightIDs:[$fight]){id startTime endTime}
            masterData{abilities{gameID name icon} ${sample.cursor == null ? "actors{id type}" : ""}}
            events(dataType:Casts fightIDs:[$fight] sourceID:$source${pageStart}
                limit:${PAGE_SIZE}){data nextPageTimestamp}
        }}
    }`;
}

function mergeCasts(existing, additions) {
    const seen = new Set(existing.map(cast => `${cast.id}/${cast.ts}`));
    const result = [...existing];
    for (const cast of additions) {
        const key = `${cast.id}/${cast.ts}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cast);
    }
    return result.sort((a, b) => a.ts - b.ts);
}

export function parseCastsPage(sample, data) {
    const report = data.reportData?.report;
    const fight = report?.fights?.find(value => value.id === sample.fight_id);
    if (!fight || !Number.isFinite(fight.startTime) || !Number.isFinite(fight.endTime)
        || Math.abs(fight.startTime - sample.fight_start) > 1
        || Math.abs(fight.endTime - fight.startTime - sample.fight_duration) > 1000) {
        throw new Error("wcl_fight_identity_mismatch");
    }
    if (sample.cursor == null && !report.masterData?.actors?.some(actor => actor.id === sample.source_id && actor.type === "Player")) {
        throw new Error("wcl_player_identity_mismatch");
    }
    const events = report.events;
    if (!events || !Array.isArray(events.data) || !Object.hasOwn(events, "nextPageTimestamp")) throw new Error("wcl_events_missing");
    const cursor = events.nextPageTimestamp;
    if (cursor != null && (!Number.isFinite(cursor)
        || cursor <= (sample.cursor ?? sample.fight_start) || cursor > fight.endTime)) {
        throw new Error("wcl_pagination_stalled");
    }
    const additions = [];
    for (const event of events.data) {
        if (event.type !== "cast" || event.sourceID !== sample.source_id) continue;
        if (!Number.isSafeInteger(event.abilityGameID) || event.abilityGameID <= 0
            || !Number.isFinite(event.timestamp)) throw new Error("wcl_cast_invalid");
        const ts = Math.round(event.timestamp - sample.fight_start);
        if (ts < 0 || ts > sample.fight_duration) throw new Error("wcl_cast_outside_fight");
        additions.push({ id: event.abilityGameID, ts });
    }
    const casts = mergeCasts(JSON.parse(sample.casts_json), additions);
    const usedIds = new Set(casts.map(cast => cast.id));
    const spells = JSON.parse(sample.spells_json);
    for (const ability of report.masterData?.abilities || []) {
        if (!usedIds.has(ability.gameID)) continue;
        spells[ability.gameID] = {
            name: typeof ability.name === "string" ? ability.name : `技能 ${ability.gameID}`,
            icon: typeof ability.icon === "string" && /^[a-zA-Z0-9_-]+\.(jpg|png)$/.test(ability.icon) ? ability.icon : "",
        };
    }
    return { casts, spells,
        cursor: cursor ?? null, complete: cursor == null };
}

export async function enrichActiveCasts(ranking, target, db, query, now, log) {
    // Reuse the authoritative catalog to preserve aura/variant semantics without a second spell list.
    const { default: catalog } = await import(`../../reference/api/spec_spells/${target.specSlug}.json`, { with: { type: "json" } });
    const aliases = new Map();
    for (const spell of Object.values(catalog)) {
        for (const variation of spell.variations || []) aliases.set(variation, spell.spell_id);
    }
    const trace = { target_key: target.targetKey, trace_id: target.traceId || `${target.targetKey}/${now}` };
    const samples = rankingSamples(ranking);
    log("wcl_casts_started", { ...trace, sample_count: samples.length });
    const chunks = [];
    for (let index = 0; index < samples.length; index += 10) {
        const batch = samples.slice(index, index + 10);
        chunks.push(batch);
        await db.prepare(`INSERT INTO wcl_samples(sample_key, report_code, fight_id, source_id,
            fight_start, fight_duration, queued_at, last_seen, retry_at) VALUES
            ${batch.map(() => "(?,?,?,?,?,?,?,?,?)").join(",")}
            ON CONFLICT(sample_key) DO NOTHING`)
            .bind(...batch.flatMap(sample => [sample.key, sample.report, sample.fight,
                sample.source, sample.start, sample.duration, now, now, now])).run();
    }
    const cached = new Map();
    for (const batch of chunks) {
        const rows = await db.prepare(`SELECT * FROM wcl_samples WHERE sample_key IN
            (${batch.map(() => "?").join(",")})`).bind(...batch.map(sample => sample.key)).all();
        for (const row of rows.results) cached.set(row.sample_key, row);
    }
    // One page from this target's Top10 only; bounded primary-key lookups avoid a global D1 scan.
    const waiting = [...cached.values()]
        .filter(row => row.complete === 0 && row.retry_at <= now)
        .sort((left, right) => Number(right.cursor != null) - Number(left.cursor != null)
            || left.queued_at.localeCompare(right.queued_at)
            || left.sample_key.localeCompare(right.sample_key))[0];
    if (waiting && query) {
        // Confirm D1 can still checkpoint this page before spending WCL points.
        await db.prepare("UPDATE wcl_samples SET last_seen=? WHERE sample_key=?")
            .bind(now, waiting.sample_key).run();
        try {
            const data = await query(castsQuery(waiting), {
                code: waiting.report_code, fight: waiting.fight_id, source: waiting.source_id,
                start: waiting.cursor ?? waiting.fight_start,
            });
            const page = parseCastsPage(waiting, data);
            await db.prepare(`UPDATE wcl_samples SET cursor=?, complete=?, casts_json=?, spells_json=?,
                last_error=NULL WHERE sample_key=?`).bind(page.cursor, Number(page.complete),
                JSON.stringify(page.casts), JSON.stringify(page.spells), waiting.sample_key).run();
            cached.set(waiting.sample_key, { ...waiting, cursor: page.cursor,
                complete: Number(page.complete), casts_json: JSON.stringify(page.casts),
                spells_json: JSON.stringify(page.spells), last_error: null });
            log("wcl_casts_page_saved", { ...trace, sample_key: waiting.sample_key,
                event_count: page.casts.length, complete: page.complete, cursor: page.cursor });
        } catch (error) {
            const reason = error instanceof Error ? error.message : "wcl_failed";
            const delay = reason === "wcl_hourly_budget" ? 3600_000
                : reason === "wcl_temporarily_unavailable" ? 5 * 60_000 : 24 * 3600_000;
            const retryAt = error?.retryAt || new Date(Date.parse(now) + delay).toISOString();
            await db.prepare("UPDATE wcl_samples SET retry_at=?, last_error=? WHERE sample_key=?")
                .bind(retryAt, reason.slice(0, 180), waiting.sample_key).run();
            cached.set(waiting.sample_key, { ...waiting, retry_at: retryAt, last_error: reason });
            log("wcl_casts_deferred", { ...trace, sample_key: waiting.sample_key, reason, retry_at: retryAt });
        }
    }
    ranking.extra_spells ||= {};
    const completion = { version: CASTS_VERSION, complete: 0, total: samples.length, failed: 0 };
    const baseIds = new Set(ranking.reports.flatMap(report => (report.fights || [])
        .flatMap(fight => (fight.players || []).flatMap(player => (player.casts || []).map(cast => cast.id)))));
    for (const sample of cached.values()) {
        if (sample.complete) completion.complete++;
        if (sample.last_error && sample.last_error !== "wcl_hourly_budget") completion.failed++;
    }
    for (const report of ranking.reports) for (const fight of report.fights || []) {
        for (const player of fight.players || []) {
            const sample = cached.get(`${report.report_id}/${fight.fight_id}/${player.source_id}/v${CASTS_VERSION}`);
            player.casts_complete = !!sample?.complete;
            if (!sample?.complete) continue;
            const casts = JSON.parse(sample.casts_json);
            const metadata = JSON.parse(sample.spells_json);
            const existing = player.casts || [];
            const represented = new Set(existing.map(cast => cast.id));
            const additions = casts.map(cast => ({ ...cast, id: aliases.get(cast.id) ?? cast.id }))
                .filter(cast => {
                    // Aura-derived markers retain their curated timing. Active casts add missing uses.
                    if (represented.has(cast.id) && catalog[cast.id]?.event_type !== "cast") return false;
                    return !existing.some(previous => previous.id === cast.id && Math.abs(previous.ts - cast.ts) < 500);
                });
            player.casts = mergeCasts(existing, additions);
            for (const cast of additions) if (!baseIds.has(cast.id)) {
                ranking.extra_spells[cast.id] = {
                    spell_id: cast.id, name: metadata[cast.id]?.name || `技能 ${cast.id}`,
                    icon: metadata[cast.id]?.icon || "", spell_type: "additional", color: "",
                    cooldown: 0, duration: 0, show: false,
                };
            }
        }
    }
    const pending = [...cached.values()].filter(sample => !sample.complete);
    const ready = pending.some(sample => sample.retry_at <= now);
    completion.status = pending.length === 0 ? "complete" : ready ? "queued"
        : pending.every(sample => sample.last_error === "wcl_hourly_budget") ? "budget_wait" : "failed";
    completion.retry_at = pending.length && !ready
        ? pending.map(sample => sample.retry_at).sort()[0] : null;
    ranking.skill_completion = completion;
    log("wcl_casts_finished", { ...trace, ...completion });
    return ranking;
}
