// Read-only WCL probe. Supply one public Top10 ranking JSON for each role; never writes D1 or deploys.
import { readFile } from "node:fs/promises";
import specs from "../../reference/api/specs.json" with { type: "json" };
import { graphql } from "../src/wcl-client.js";
import { castsQuery, parseCastsPage, rankingSamples } from "../src/wcl-casts.js";

async function main() {
    const paths = process.argv.slice(2);
    if (paths.length !== 3) throw new Error("usage: node scripts/probe-wcl-casts.mjs <dps-ranking.json> <heal-ranking.json> <tank-ranking.json>");
    if (!process.env.WCL_CLIENT_ID || !process.env.WCL_CLIENT_SECRET) throw new Error("wcl_credentials_missing");
    const results = [];
    const quotaQuery = "query{rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}}";
    for (const [index, path] of paths.entries()) {
        const ranking = JSON.parse(await readFile(path, "utf8"));
        const role = specs.find(spec => spec.full_name_slug === ranking.spec_slug)?.role;
        if (![ ["rdps", "mdps"], ["heal"], ["tank"] ][index].includes(role)) throw new Error("probe_role_mismatch");
        const identity = rankingSamples(ranking)[0];
        if (!identity) throw new Error("probe_sample_missing");
        const target = { targetKey: `probe/${["dps", "heal", "tank"][index]}` };
        const request = (query, variables) => graphql(process.env, fetch, () => new Date(), () => {}, target, query, variables);
        const before = (await request(quotaQuery)).rateLimitData;
        let quota = before;
        const sample = { sample_key: identity.key, report_code: identity.report, fight_id: identity.fight,
            source_id: identity.source, fight_start: identity.start, fight_duration: identity.duration,
            cursor: null, casts_json: "[]", spells_json: "{}" };
        const rawPages = [];
        let complete = false;
        while (!complete) {
            if (!Number.isFinite(quota?.limitPerHour) || !Number.isFinite(quota?.pointsSpentThisHour)
                || quota.limitPerHour <= 0) throw new Error("wcl_quota_invalid");
            if (quota.pointsSpentThisHour >= quota.limitPerHour * 0.1) throw new Error("wcl_hourly_budget");
            const data = await request(castsQuery(sample), { code: sample.report_code, fight: sample.fight_id,
                source: sample.source_id, start: sample.cursor ?? sample.fight_start });
            const page = parseCastsPage(sample, data);
            rawPages.push(data.reportData.report.events);
            complete = page.complete;
            Object.assign(sample, { cursor: page.cursor, casts_json: JSON.stringify(page.casts), spells_json: JSON.stringify(page.spells) });
            quota = data.rateLimitData;
        }
        if (quota.pointsSpentThisHour < before.pointsSpentThisHour) throw new Error("probe_quota_window_changed");
        results.push({ role: ["dps", "heal", "tank"][index], sample_key: sample.sample_key,
            event_count: JSON.parse(sample.casts_json).length, pages: rawPages.length,
            cache_bytes: Buffer.byteLength(sample.casts_json + sample.spells_json),
            account_points_delta: quota.pointsSpentThisHour - before.pointsSpentThisHour,
            quota_before: before, quota_after: quota, raw_pages: rawPages,
            casts: JSON.parse(sample.casts_json), spells: JSON.parse(sample.spells_json) });
    }
    console.log(JSON.stringify({ measured_at: new Date().toISOString(),
        note: "Account point deltas may include concurrent use by other applications.", samples: results }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
