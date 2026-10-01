import { graphql as directGraphql } from "./wcl-client.js";
export { resetWclTokenForTests } from "./wcl-client.js";
const SPELL_IDS = [378081, 443454];
const HOURLY_BUDGET_FRACTION = 0.1;
function logDetails(target, extra = {}) { return { target_key: target.targetKey, ...extra }; }
function safeMessage(error) { return (error instanceof Error ? error.message : String(error)).slice(0, 180); }

function quota(data) {
    const value = data.rateLimitData;
    const limit = Number(value?.limitPerHour);
    const spent = Number(value?.pointsSpentThisHour);
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(spent) || spent < 0) {
        throw new Error("wcl_quota_invalid");
    }
    return { limit, spent };
}

function rankingRows(ranking) {
    return ranking.reports.flatMap((report) => (report.fights || []).map((fight) => ({
        report,
        fight,
        key: `${report.report_id}/${fight.fight_id}`,
    })));
}

function buildEventsQuery(rows) {
    const fields = rows.map(({ report, fight }, index) => {
        if (!/^[A-Za-z0-9]{16}$/.test(report.report_id) || !Number.isSafeInteger(fight.fight_id)) {
            throw new Error("wcl_report_identity_invalid");
        }
        const args = `dataType:Buffs fightIDs:[${fight.fight_id}] limit:100`;
        return `r${index}:report(code:"${report.report_id}"){`
            + `natural:events(${args} abilityID:378081){data nextPageTimestamp}`
            + `ancestral:events(${args} abilityID:443454){data nextPageTimestamp}`
            + "}";
    }).join("");
    return `query{rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}reportData{${fields}}}`;
}

function applyEvents(rows, reportData) {
    rows.forEach(({ report, fight }, index) => {
        if (!Number.isFinite(Date.parse(report.start_time)) || !Number.isFinite(Date.parse(fight.start_time))) {
            throw new Error("wcl_timeline_start_invalid");
        }
        const result = reportData[`r${index}`];
        for (const field of ["natural", "ancestral"]) {
            if (result?.[field]?.nextPageTimestamp != null) throw new Error("wcl_events_paginated");
        }
    });
    let added = 0;
    rows.forEach(({ report, fight }, index) => {
        const result = reportData[`r${index}`];
        if (!result) return;
        const reportStart = Date.parse(report.start_time);
        const fightStart = Date.parse(fight.start_time);
        const fightOffset = fightStart - reportStart;
        for (const field of ["natural", "ancestral"]) {
            for (const event of result[field]?.data || []) {
                if (event.type !== "applybuff" || !SPELL_IDS.includes(event.abilityGameID)) continue;
                const player = (fight.players || []).find((candidate) => candidate.source_id === event.targetID);
                const timestamp = Math.round(Number(event.timestamp) - fightOffset);
                if (!player || !Number.isFinite(timestamp) || timestamp < 0 || timestamp > fight.duration) continue;
                player.casts ||= [];
                if (player.casts.some((cast) => cast.id === event.abilityGameID && Math.abs(cast.ts - timestamp) < 500)) continue;
                player.casts.push({ id: event.abilityGameID, ts: timestamp });
                player.casts.sort((left, right) => left.ts - right.ts);
                added += 1;
            }
        }
    });
    return added;
}

export function shouldEnrichWclSwiftness(target) {
    return target.specSlug === "shaman-restoration" && target.metric === "hps";
}

export async function enrichWclSwiftness(ranking, target, env, options) {
    if (!shouldEnrichWclSwiftness(target) || ranking.reports.length === 0) return ranking;
    const { fetchImpl, log, now } = options;
    const graphql = options.graphql || directGraphql;
    log("wcl_enrichment_started", logDetails(target, { report_count: ranking.reports.length }));
    try {
        const encounterId = options.bossIds?.get(target.bossSlug);
        if (!Number.isSafeInteger(encounterId)) throw new Error("wcl_encounter_missing");
        const rankingData = await graphql(env, fetchImpl, now, log, target, `
            query($encounterId:Int!,$difficulty:Int!){
                rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
                worldData{encounter(id:$encounterId){characterRankings(
                    difficulty:$difficulty metric:hps className:"Shaman" specName:"Restoration" page:1
                )}}
            }
        `, { encounterId, difficulty: target.difficulty === "mythic" ? 5 : 4 });
        const currentQuota = quota(rankingData);
        const rankings = rankingData.worldData?.encounter?.characterRankings?.rankings;
        if (!Array.isArray(rankings)) throw new Error("wcl_rankings_invalid");
        if (currentQuota.spent >= currentQuota.limit * HOURLY_BUDGET_FRACTION) {
            log("wcl_enrichment_skipped", logDetails(target, {
                reason: "hourly_budget",
                points_spent: currentQuota.spent,
                points_limit: currentQuota.limit,
            }));
            return ranking;
        }
        const publicReports = new Set(rankings.flatMap((entry) => entry.report
            ? [`${entry.report.code}/${entry.report.fightID}`]
            : []));
        const matchedRows = rankingRows(ranking).filter(({ key }) => publicReports.has(key));
        if (matchedRows.length === 0) {
            log("wcl_enrichment_skipped", logDetails(target, { reason: "no_matching_reports" }));
            return ranking;
        }
        const eventData = await graphql(env, fetchImpl, now, log, target, buildEventsQuery(matchedRows));
        const added = applyEvents(matchedRows, eventData.reportData || {});
        const finalQuota = quota(eventData);
        log("wcl_enrichment_applied", logDetails(target, {
            matched_reports: matchedRows.length,
            added_events: added,
            points_spent: finalQuota.spent,
            points_limit: finalQuota.limit,
        }));
        return ranking;
    } catch (error) {
        log("wcl_enrichment_failed", logDetails(target, { reason: safeMessage(error) }));
        return ranking;
    }
}
