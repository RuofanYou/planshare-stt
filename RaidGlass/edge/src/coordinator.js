import { DurableObject } from "cloudflare:workers";
import { graphql } from "./wcl-client.js";
import { enrichActiveCasts, CASTS_VERSION } from "./wcl-casts.js";

import { COMP_EXPECTED_COUNT, SPEC_EXPECTED_COUNT } from "./matrix.js";
import { validateTarget } from "./refresh.js";

const WCL_BUDGET_FRACTION = 0.8;
const quotaReached = quota => quota && quota.spent >= quota.limit * WCL_BUDGET_FRACTION;

const TERMINAL_TARGET_STATUSES = new Set(["published", "reused", "failed"]);
const RUN_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function rows(cursor) {
    return cursor.toArray();
}

function oneOrNull(cursor) {
    return cursor.toArray()[0] || null;
}

function requireToken(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._&=/-]{1,256}$/.test(value)) {
        throw new Error(`invalid ${label}`);
    }
    return value;
}

function requireTimestamp(value, label) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new Error(`invalid ${label}`);
    }
    return value;
}

function validateExpectedCounts(value) {
    if (
        !value
        || value.spec_expected !== SPEC_EXPECTED_COUNT
        || value.comp_expected !== COMP_EXPECTED_COUNT
    ) {
        throw new Error("invalid matrix expected counts");
    }
    return value;
}

function targetFromRow(row) {
    if (row.kind === "comp") {
        return {
            kind: "comp",
            targetKey: row.target_key,
            bossSlug: row.boss_slug,
        };
    }
    return {
        kind: "spec",
        targetKey: row.target_key,
        bossSlug: row.boss_slug,
        specSlug: row.spec_slug,
        role: row.role,
        difficulty: row.difficulty,
        metric: row.metric,
    };
}

function publicTargetStatus(row) {
    if (!row) throw new Error("latest target status is missing");
    return {
        schema_version: 2,
        target_key: row.target_key,
        status: row.status,
        checked_at: row.checked_at,
        published_at: row.published_at,
        upstream_updated: row.upstream_updated,
        last_error_code: row.last_error_code,
    };
}

export class RefreshCoordinator extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => this.#migrate());
    }

    // ponytail: serialize this account's WCL work; split by credential only if multiple accounts are added.
    #wclQueue = Promise.resolve();
    #castsQueue = Promise.resolve();

    async wclPauseReason() {
        const now = Date.now();
        if (Number(this.#state("wcl_retry_after")) > now) return "wcl_temporarily_unavailable";
        const quota = JSON.parse(this.#state("wcl_quota") || "null");
        return quota && quota.resetAt > now && quotaReached(quota)
            ? "wcl_hourly_budget" : null;
    }

    async wclQuery(query, variables, target) {
        const work = this.#wclQueue.then(async () => {
            const now = Date.now();
            if (Number(this.#state("wcl_retry_after")) > now) throw new Error("wcl_temporarily_unavailable");
            const log = (event, fields) => console.log(JSON.stringify({ event, ...fields }));
            const saved = JSON.parse(this.#state("wcl_quota") || "null");
            if (saved && saved.resetAt > now && quotaReached(saved)) {
                throw new Error("wcl_hourly_budget");
            }
            const saveQuota = (data) => {
                const quota = data.rateLimitData;
                if (!quota || !Number.isFinite(quota.limitPerHour) || quota.limitPerHour <= 0
                    || !Number.isFinite(quota.pointsSpentThisHour) || quota.pointsSpentThisHour < 0
                    || !Number.isFinite(quota.pointsResetIn) || quota.pointsResetIn < 0) {
                    throw new Error("wcl_quota_invalid");
                }
                const value = { limit: quota.limitPerHour, spent: quota.pointsSpentThisHour,
                    checkedAt: Date.now(), resetAt: Date.now() + quota.pointsResetIn * 1000 };
                this.#setState("wcl_quota", JSON.stringify(value));
                log("wcl_quota_updated", { target_key: target.targetKey, ...value });
                return value;
            };
            const request = async (text, values = {}) => {
                try {
                    return await graphql(this.env, fetch, () => new Date(), log, target, text, values);
                } catch (error) {
                    // A report-level GraphQL error must not pause unrelated public reports.
                    if (!String(error).includes("wcl_graphql_error:")) {
                        this.#setState("wcl_retry_after", Date.now() + 5 * 60_000);
                    }
                    throw error;
                }
            };
            // Refresh account-wide usage after idle periods, including use by other applications.
            if (!saved || saved.resetAt <= now || now - saved.checkedAt >= 60_000) {
                const quota = saveQuota(await request("query{rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}}"));
                if (quotaReached(quota)) throw new Error("wcl_hourly_budget");
            }
            const before = JSON.parse(this.#state("wcl_quota") || "null");
            const started = Date.now();
            const data = await request(query, variables);
            const after = saveQuota(data);
            log("wcl_query_finished", { target_key: target.targetKey, trace_id: target.traceId || null,
                elapsed_ms: Date.now() - started, account_points_delta: before && after.spent >= before.spent ? after.spent - before.spent : null });
            return data;
        });
        this.#wclQueue = work.catch(() => {});
        return work.catch(error => {
            const pause = this.castPause();
            if (pause) error.retryAt = pause.retry_at;
            throw error;
        });
    }

    async cacheCasts(ranking, target) {
        return enrichActiveCasts(ranking, target, this.env.RANKING_DB, null,
            new Date().toISOString(), () => {});
    }

    castPause() {
        const now = Date.now();
        const quota = JSON.parse(this.#state("wcl_quota") || "null");
        if (quota?.resetAt > now && quotaReached(quota))
            return { status: "budget_wait", retry_at: new Date(quota.resetAt).toISOString() };
        const retry = Number(this.#state("wcl_retry_after"));
        if (retry > now) return { status: "failed", retry_at: new Date(retry).toISOString() };
        return null;
    }

    async registerCasts(target, completion, foreground = false, clientKey = null) {
        validateTarget(target);
        if (target.kind !== "spec") throw new Error("invalid_target");
        const now = Date.now();
        if (clientKey) {
            if (!/^[a-f0-9]{64}$/.test(clientKey)) throw new Error("invalid_client");
            this.ctx.storage.sql.exec("DELETE FROM casts_clients WHERE reset_at<=?", now);
            const client = oneOrNull(this.ctx.storage.sql.exec("SELECT * FROM casts_clients WHERE client_key=?", clientKey));
            if (client?.count >= 6) return { error: "rate_limited", retry_at: new Date(client.reset_at).toISOString() };
            this.ctx.storage.sql.exec(`INSERT INTO casts_clients VALUES(?,1,?)
                ON CONFLICT(client_key) DO UPDATE SET count=count+1`, clientKey, now + 60_000);
        }
        if (completion?.version === CASTS_VERSION && completion.complete === completion.total) {
            return { ...completion, status: "complete", retry_at: null };
        }
        this.ctx.storage.sql.exec(`INSERT INTO casts_jobs(target_key,target_json,priority,last_served,next_at,status)
            VALUES(?,?,?,0,0,'queued') ON CONFLICT(target_key) DO UPDATE SET
            priority=MAX(priority,excluded.priority), target_json=excluded.target_json`,
            target.targetKey, JSON.stringify(target), Number(foreground));
        await this.#wakeCasts();
        return this.castStatus(target.targetKey, completion);
    }

    castStatus(key, completion) {
        const job = oneOrNull(this.ctx.storage.sql.exec("SELECT * FROM casts_jobs WHERE target_key=?", key));
        if (completion?.complete === completion?.total && completion?.version === CASTS_VERSION)
            return { ...completion, status: "complete", retry_at: null };
        const pause = this.castPause();
        return { version: CASTS_VERSION, complete: 0, total: 10, failed: 0, ...completion,
            status: pause?.status || job?.status || completion?.status || "queued",
            retry_at: pause?.retry_at || (job?.next_at > Date.now() ? new Date(job.next_at).toISOString() : completion?.retry_at || null) };
    }

    async #wakeCasts() {
        if (this.env.WCL_ALL_CASTS !== "true") return;
        const job = oneOrNull(this.ctx.storage.sql.exec("SELECT MIN(next_at) AS next_at FROM casts_jobs"));
        if (job?.next_at == null) return;
        const when = Math.max(Date.now() + 1000, job.next_at, Date.parse(this.castPause()?.retry_at || '') || 0);
        const alarm = await this.ctx.storage.getAlarm();
        if (alarm == null || alarm > when || (this.castPause() && alarm < when)) await this.ctx.storage.setAlarm(when);
    }

    async alarm() {
        if (this.env.WCL_ALL_CASTS !== "true") return;
        if (this.castPause()) { await this.#wakeCasts(); return; }
        // Queue owns execution/retries; the alarm is a durable wake-up and delivery watchdog.
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
        await this.env.REFRESH_QUEUE.send({ schema_version: 2, trigger: "casts_tick" });
    }

    async processCastPage() {
        const work = this.#castsQueue.then(async () => {
            const now = Date.now();
            if (this.castPause()) { await this.#wakeCasts(); return; }
            const streak = Number(this.#state("casts_foreground_streak") || 0);
            let job = streak >= 3 ? oneOrNull(this.ctx.storage.sql.exec(
                "SELECT * FROM casts_jobs WHERE next_at<=? AND priority=0 ORDER BY last_served,target_key LIMIT 1", now)) : null;
            job ||= oneOrNull(this.ctx.storage.sql.exec(
                "SELECT * FROM casts_jobs WHERE next_at<=? ORDER BY priority DESC,last_served,target_key LIMIT 1", now));
            if (!job) { await this.ctx.storage.deleteAlarm(); await this.#wakeCasts(); return; }
            this.#setState("casts_foreground_streak", job.priority ? streak + 1 : 0);
            this.ctx.storage.sql.exec("UPDATE casts_jobs SET status='collecting',last_served=? WHERE target_key=?", now, job.target_key);
            const target = { ...JSON.parse(job.target_json), traceId: `${job.target_key}/${now}` };
            const log = (event, fields) => console.log(JSON.stringify({ event, target_key: job.target_key, trace_id: `${job.target_key}/${now}`, ...fields }));
            try {
                const row = await this.env.RANKING_DB.prepare("SELECT ranking_json FROM ranking_targets WHERE target_key=?").bind(job.target_key).first();
                if (!row?.ranking_json) throw new Error("ranking_unavailable");
                const ranking = await enrichActiveCasts(JSON.parse(row.ranking_json), target, this.env.RANKING_DB,
                    (query, variables) => this.wclQuery(query, variables, target), new Date(now).toISOString(), log);
                ranking.skill_completion.updated_at = new Date().toISOString();
                const pause = this.castPause();
                if (pause && ranking.skill_completion.status !== "complete") Object.assign(ranking.skill_completion, pause);
                const saved = await this.env.RANKING_DB.prepare(`UPDATE ranking_targets SET ranking_json=?
                    WHERE target_key=? AND ranking_json=?`).bind(JSON.stringify(ranking), job.target_key, row.ranking_json).run();
                if (saved.meta?.changes !== 1) {
                    log("wcl_casts_ranking_changed", {});
                    this.ctx.storage.sql.exec("UPDATE casts_jobs SET status='queued',next_at=0 WHERE target_key=?", job.target_key);
                } else if (ranking.skill_completion.status === "complete") {
                    this.ctx.storage.sql.exec("DELETE FROM casts_jobs WHERE target_key=?", job.target_key);
                } else {
                    const state = ranking.skill_completion;
                    this.ctx.storage.sql.exec("UPDATE casts_jobs SET status=?,next_at=? WHERE target_key=?",
                        state.status, Date.parse(state.retry_at || '') || 0, job.target_key);
                }
            } catch (error) {
                log("wcl_casts_job_failed", { reason: String(error).slice(0,180) });
                this.ctx.storage.sql.exec("UPDATE casts_jobs SET status='failed',next_at=? WHERE target_key=?", Date.now() + 300_000, job.target_key);
            }
            await this.ctx.storage.deleteAlarm();
            await this.#wakeCasts();
        });
        this.#castsQueue = work.catch(() => {});
        return work;
    }

    #migrate() {
        this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS casts_jobs (
                target_key TEXT PRIMARY KEY, target_json TEXT NOT NULL, priority INTEGER NOT NULL,
                last_served INTEGER NOT NULL, next_at INTEGER NOT NULL, status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS casts_clients (
                client_key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                trigger TEXT NOT NULL,
                retry_of TEXT,
                status TEXT NOT NULL,
                expected_targets INTEGER NOT NULL,
                expected_batches INTEGER NOT NULL,
                matrix_id TEXT NOT NULL,
                spec_expected INTEGER NOT NULL,
                comp_expected INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                enqueued_at TEXT,
                completed_at TEXT,
                error_code TEXT
            );
            CREATE INDEX IF NOT EXISTS runs_status_created_idx ON runs(status, created_at);
            CREATE TABLE IF NOT EXISTS batches (
                run_id TEXT NOT NULL,
                batch_id TEXT NOT NULL,
                status TEXT NOT NULL,
                target_count INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                enqueued_at TEXT NOT NULL,
                completed_at TEXT,
                PRIMARY KEY (run_id, batch_id)
            );
            CREATE TABLE IF NOT EXISTS run_targets (
                run_id TEXT NOT NULL,
                target_key TEXT NOT NULL,
                batch_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                boss_slug TEXT NOT NULL,
                spec_slug TEXT,
                role TEXT,
                difficulty TEXT,
                metric TEXT,
                status TEXT NOT NULL,
                checked_at TEXT,
                published_at TEXT,
                upstream_updated TEXT,
                error_code TEXT,
                error_message TEXT,
                PRIMARY KEY (run_id, target_key)
            );
            CREATE INDEX IF NOT EXISTS run_targets_batch_idx ON run_targets(run_id, batch_id, status);
            CREATE TABLE IF NOT EXISTS latest_targets (
                target_key TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                boss_slug TEXT NOT NULL,
                spec_slug TEXT,
                role TEXT,
                difficulty TEXT,
                metric TEXT,
                status TEXT NOT NULL,
                checked_at TEXT NOT NULL,
                published_at TEXT,
                upstream_updated TEXT,
                last_error_code TEXT,
                last_error_message TEXT,
                last_run_id TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS latest_targets_status_idx ON latest_targets(status, checked_at);
            CREATE TABLE IF NOT EXISTS global_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);
    }

    #state(key) {
        return oneOrNull(this.ctx.storage.sql.exec(
            "SELECT value FROM global_state WHERE key = ?",
            key,
        ))?.value ?? null;
    }

    #setState(key, value) {
        this.ctx.storage.sql.exec(
            `INSERT INTO global_state(key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            key,
            String(value),
        );
    }

    #deleteState(key) {
        this.ctx.storage.sql.exec("DELETE FROM global_state WHERE key = ?", key);
    }

    #cleanupExpiredRuns(now) {
        const cutoff = new Date(Date.parse(now) - RUN_TIMEOUT_MS).toISOString();
        const expired = rows(this.ctx.storage.sql.exec(
            "SELECT run_id FROM runs WHERE status IN ('enqueuing', 'running') AND created_at < ?",
            cutoff,
        ));
        if (expired.length === 0) return;
        this.ctx.storage.sql.exec(
            `UPDATE runs
             SET status = 'failed', completed_at = ?, error_code = 'run_timeout'
             WHERE status IN ('enqueuing', 'running') AND created_at < ?`,
            now,
            cutoff,
        );
        console.log(JSON.stringify({
            event: "cleanup",
            reason: "run_timeout",
            run_ids: expired.map((row) => row.run_id),
        }));
    }

    #cleanupHistoricalRuns(now) {
        const cutoff = new Date(Date.parse(now) - RUN_RETENTION_MS).toISOString();
        const expired = rows(this.ctx.storage.sql.exec(
            `SELECT run_id FROM runs
             WHERE status IN ('complete', 'partial', 'failed')
               AND COALESCE(completed_at, created_at) < ?
             ORDER BY created_at`,
            cutoff,
        ));
        if (expired.length === 0) return;
        for (const { run_id: runId } of expired) {
            this.ctx.storage.sql.exec("DELETE FROM run_targets WHERE run_id = ?", runId);
            this.ctx.storage.sql.exec("DELETE FROM batches WHERE run_id = ?", runId);
            this.ctx.storage.sql.exec("DELETE FROM runs WHERE run_id = ?", runId);
            if (this.#state("latest_run_id") === runId) this.#deleteState("latest_run_id");
            if (this.#state("last_completed_run_id") === runId) this.#deleteState("last_completed_run_id");
        }
        console.log(JSON.stringify({
            event: "cleanup",
            reason: "run_retention",
            retention_days: 30,
            deleted_count: expired.length,
            run_ids: expired.map((row) => row.run_id),
        }));
    }

    #activeRun() {
        return oneOrNull(this.ctx.storage.sql.exec(
            `SELECT run_id, status FROM runs
             WHERE status IN ('enqueuing', 'running')
             ORDER BY created_at DESC LIMIT 1`,
        ));
    }

    async runProgress() {
        const active = this.#activeRun();
        if (!active) return { active: false };
        const run = oneOrNull(this.ctx.storage.sql.exec(
            "SELECT matrix_id, expected_batches, expected_targets FROM runs WHERE run_id = ?", active.run_id,
        ));
        const batches = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT COUNT(*) AS registered,
                    SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS complete,
                    SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) AS claimed
             FROM batches WHERE run_id = ?`, active.run_id,
        ));
        const targets = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT COUNT(*) AS registered,
                    SUM(CASE WHEN status IN ('published', 'reused', 'failed') THEN 1 ELSE 0 END) AS terminal
             FROM run_targets WHERE run_id = ?`, active.run_id,
        ));
        return { active: true, run_id: active.run_id, status: active.status, matrix_id: run.matrix_id,
            expected_batches: Number(run.expected_batches), registered_batches: Number(batches.registered),
            complete_batches: Number(batches.complete || 0), claimed_batches: Number(batches.claimed || 0),
            expected_targets: Number(run.expected_targets), registered_targets: Number(targets.registered),
            terminal_targets: Number(targets.terminal || 0) };
    }

    #resetMatrixIfChanged(matrixId, expected) {
        const previousMatrixId = this.#state("matrix_id");
        if (previousMatrixId && previousMatrixId !== matrixId) {
            this.ctx.storage.sql.exec("DELETE FROM latest_targets");
            console.log(JSON.stringify({
                event: "cleanup",
                reason: "matrix_changed",
                previous_matrix_id: previousMatrixId,
                matrix_id: matrixId,
            }));
        }
        this.#setState("matrix_id", matrixId);
        this.#setState("spec_expected", expected.spec_expected);
        this.#setState("comp_expected", expected.comp_expected);
    }

    #globalStatus(runId, checkedAt) {
        const specExpected = Number(this.#state("spec_expected") || SPEC_EXPECTED_COUNT);
        const compExpected = Number(this.#state("comp_expected") || COMP_EXPECTED_COUNT);
        const counts = oneOrNull(this.ctx.storage.sql.exec(`
            SELECT
                COUNT(*) AS observed_count,
                SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) AS available_count,
                SUM(CASE WHEN status = 'fresh' THEN 1 ELSE 0 END) AS fresh_count,
                SUM(CASE WHEN status = 'stale' THEN 1 ELSE 0 END) AS stale_count,
                SUM(CASE WHEN kind = 'spec' THEN 1 ELSE 0 END) AS spec_observed,
                SUM(CASE WHEN kind = 'spec' AND published_at IS NOT NULL THEN 1 ELSE 0 END) AS spec_available,
                SUM(CASE WHEN kind = 'spec' AND status = 'fresh' THEN 1 ELSE 0 END) AS spec_fresh,
                SUM(CASE WHEN kind = 'spec' AND status = 'stale' THEN 1 ELSE 0 END) AS spec_stale,
                SUM(CASE WHEN kind = 'comp' THEN 1 ELSE 0 END) AS comp_observed,
                SUM(CASE WHEN kind = 'comp' AND published_at IS NOT NULL THEN 1 ELSE 0 END) AS comp_available,
                SUM(CASE WHEN kind = 'comp' AND status = 'fresh' THEN 1 ELSE 0 END) AS comp_fresh,
                SUM(CASE WHEN kind = 'comp' AND status = 'stale' THEN 1 ELSE 0 END) AS comp_stale,
                MAX(checked_at) AS latest_checked_at
            FROM latest_targets
        `)) || {};
        const expectedCount = specExpected + compExpected;
        const observedCount = Number(counts.observed_count || 0);
        const availableCount = Number(counts.available_count || 0);
        const freshCount = Number(counts.fresh_count || 0);
        const staleCount = Number(counts.stale_count || 0);
        const specObserved = Number(counts.spec_observed || 0);
        const compObserved = Number(counts.comp_observed || 0);
        const active = this.#activeRun();
        const uncheckedCount = Math.max(0, expectedCount - observedCount);
        return {
            schema_version: 2,
            run_id: runId || this.#state("latest_run_id"),
            latest_run_id: this.#state("latest_run_id"),
            active_run_id: active?.run_id ?? null,
            last_completed_run_id: this.#state("last_completed_run_id"),
            status: active ? "refreshing" : (staleCount > 0 || uncheckedCount > 0 ? "stale" : "fresh"),
            matrix_id: this.#state("matrix_id"),
            expected_count: expectedCount,
            available_count: availableCount,
            fresh_count: freshCount,
            stale_count: staleCount,
            unchecked_count: uncheckedCount,
            spec_expected: specExpected,
            spec_available: Number(counts.spec_available || 0),
            spec_fresh: Number(counts.spec_fresh || 0),
            spec_stale: Number(counts.spec_stale || 0),
            spec_unchecked: Math.max(0, specExpected - specObserved),
            comp_expected: compExpected,
            comp_available: Number(counts.comp_available || 0),
            comp_fresh: Number(counts.comp_fresh || 0),
            comp_stale: Number(counts.comp_stale || 0),
            comp_unchecked: Math.max(0, compExpected - compObserved),
            checked_at: counts.latest_checked_at || checkedAt,
        };
    }

    #runStatus(runId, checkedAt) {
        const run = oneOrNull(this.ctx.storage.sql.exec("SELECT * FROM runs WHERE run_id = ?", runId));
        if (!run) throw new Error("run not found");
        const counts = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count,
                SUM(CASE WHEN status = 'reused' THEN 1 ELSE 0 END) AS reused_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                MAX(checked_at) AS latest_checked_at
             FROM run_targets WHERE run_id = ?`,
            runId,
        )) || {};
        const publishedCount = Number(counts.published_count || 0);
        const reusedCount = Number(counts.reused_count || 0);
        const failedCount = Number(counts.failed_count || 0);
        return {
            schema_version: 2,
            run_id: runId,
            trigger: run.trigger,
            retry_of: run.retry_of,
            status: run.status,
            expected_count: Number(run.expected_targets),
            completed_count: publishedCount + reusedCount + failedCount,
            published_count: publishedCount,
            reused_count: reusedCount,
            failed_count: failedCount,
            created_at: run.created_at,
            enqueued_at: run.enqueued_at,
            completed_at: run.completed_at,
            checked_at: counts.latest_checked_at || checkedAt,
            error_code: run.error_code,
        };
    }

    async beginRun(runId, trigger, retryOf, expectedTargets, expectedBatches, matrixId, expected, now) {
        requireToken(runId, "run id");
        requireToken(trigger, "trigger");
        if (retryOf !== null) requireToken(retryOf, "retry source");
        requireToken(matrixId, "matrix id");
        requireTimestamp(now, "run timestamp");
        validateExpectedCounts(expected);
        if (!Number.isInteger(expectedTargets) || expectedTargets < 1) throw new Error("invalid expected targets");
        if (!Number.isInteger(expectedBatches) || expectedBatches < 1) throw new Error("invalid expected batches");
        if (expectedTargets > expected.spec_expected + expected.comp_expected) {
            throw new Error("invalid matrix target count");
        }

        this.#cleanupExpiredRuns(now);
        this.#cleanupHistoricalRuns(now);
        const existing = oneOrNull(this.ctx.storage.sql.exec(
            "SELECT run_id, status FROM runs WHERE run_id = ?",
            runId,
        ));
        if (existing) return { accepted: false, reason: "duplicate_run", status: existing.status };
        const active = this.#activeRun();
        if (active) return { accepted: false, reason: "active_run", active_run_id: active.run_id };

        this.#resetMatrixIfChanged(matrixId, expected);
        this.ctx.storage.sql.exec(
            `INSERT INTO runs(
                run_id, trigger, retry_of, status, expected_targets, expected_batches,
                matrix_id, spec_expected, comp_expected, created_at
             ) VALUES (?, ?, ?, 'enqueuing', ?, ?, ?, ?, ?, ?)`,
            runId,
            trigger,
            retryOf,
            expectedTargets,
            expectedBatches,
            matrixId,
            expected.spec_expected,
            expected.comp_expected,
            now,
        );
        this.#setState("latest_run_id", runId);
        return {
            accepted: true,
            global_status: this.#globalStatus(runId, now),
            run_status: this.#runStatus(runId, now),
        };
    }

    async markBatchEnqueued(runId, batchId, targetValues, now) {
        requireToken(runId, "run id");
        requireToken(batchId, "batch id");
        requireTimestamp(now, "enqueue timestamp");
        if (!Array.isArray(targetValues) || targetValues.length < 1 || targetValues.length > 20) {
            throw new Error("invalid batch target count");
        }
        const targets = targetValues.map((target) => validateTarget(target));
        const run = oneOrNull(this.ctx.storage.sql.exec("SELECT status FROM runs WHERE run_id = ?", runId));
        if (!run || run.status !== "enqueuing") throw new Error("run is not enqueuing");

        this.ctx.storage.sql.exec(
            `INSERT OR IGNORE INTO batches(run_id, batch_id, status, target_count, enqueued_at)
             VALUES (?, ?, 'enqueued', ?, ?)`,
            runId,
            batchId,
            targets.length,
            now,
        );
        for (const target of targets) {
            this.ctx.storage.sql.exec(
                `INSERT OR IGNORE INTO run_targets(
                    run_id, target_key, batch_id, kind, boss_slug, spec_slug, role,
                    difficulty, metric, status
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'enqueued')`,
                runId,
                target.targetKey,
                batchId,
                target.kind,
                target.bossSlug,
                target.specSlug ?? null,
                target.role ?? null,
                target.difficulty ?? null,
                target.metric ?? null,
            );
        }
        return { accepted: true };
    }

    async finalizeEnqueue(runId, now) {
        requireToken(runId, "run id");
        requireTimestamp(now, "enqueue timestamp");
        const run = oneOrNull(this.ctx.storage.sql.exec("SELECT * FROM runs WHERE run_id = ?", runId));
        if (!run) throw new Error("run not found");
        if (run.status === "running") {
            return {
                global_status: this.#globalStatus(runId, now),
                run_status: this.#runStatus(runId, now),
            };
        }
        if (run.status !== "enqueuing") throw new Error("run cannot be finalized");
        const counts = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT
                (SELECT COUNT(*) FROM batches WHERE run_id = ?) AS batch_count,
                (SELECT COUNT(*) FROM run_targets WHERE run_id = ?) AS target_count`,
            runId,
            runId,
        ));
        if (
            Number(counts?.batch_count) !== Number(run.expected_batches)
            || Number(counts?.target_count) !== Number(run.expected_targets)
        ) {
            throw new Error("enqueued run count mismatch");
        }
        this.ctx.storage.sql.exec(
            "UPDATE runs SET status = 'running', enqueued_at = ? WHERE run_id = ?",
            now,
            runId,
        );
        return {
            global_status: this.#globalStatus(runId, now),
            run_status: this.#runStatus(runId, now),
        };
    }

    #terminalStatuses(runId, batchId) {
        return rows(this.ctx.storage.sql.exec(
            `SELECT rt.*, lt.status, lt.checked_at, lt.published_at,
                    lt.upstream_updated, lt.last_error_code
             FROM run_targets rt
             JOIN latest_targets lt ON lt.target_key = rt.target_key
             WHERE rt.run_id = ? AND rt.batch_id = ?
               AND rt.status IN ('published', 'reused', 'failed')
             ORDER BY rt.target_key`,
            runId,
            batchId,
        )).map((row) => ({
            target: targetFromRow(row),
            public_status: publicTargetStatus(row),
        }));
    }

    async claimBatch(runId, batchId, targetValues, now) {
        requireToken(runId, "run id");
        requireToken(batchId, "batch id");
        requireTimestamp(now, "claim timestamp");
        if (!Array.isArray(targetValues) || targetValues.length < 1 || targetValues.length > 20) {
            throw new Error("invalid claim targets");
        }
        const targets = targetValues.map((target) => validateTarget(target));
        const batch = oneOrNull(this.ctx.storage.sql.exec(
            "SELECT status, target_count FROM batches WHERE run_id = ? AND batch_id = ?",
            runId,
            batchId,
        ));
        if (!batch || Number(batch.target_count) !== targets.length) throw new Error("batch not found");
        const terminalStatuses = this.#terminalStatuses(runId, batchId);
        if (batch.status === "complete") {
            return {
                status: "complete",
                terminal_statuses: terminalStatuses,
                global_status: this.#globalStatus(runId, now),
                run_status: this.#runStatus(runId, now),
            };
        }
        this.ctx.storage.sql.exec(
            `UPDATE batches SET status = 'processing', attempts = attempts + 1
             WHERE run_id = ? AND batch_id = ?`,
            runId,
            batchId,
        );
        return { status: "claimed", terminal_statuses: terminalStatuses };
    }

    #latestTarget(targetKey) {
        return oneOrNull(this.ctx.storage.sql.exec(
            "SELECT * FROM latest_targets WHERE target_key = ?",
            targetKey,
        ));
    }

    async recordTarget(runId, batchId, result) {
        requireToken(runId, "run id");
        requireToken(batchId, "batch id");
        if (!result?.target) throw new Error("target result is required");
        const target = validateTarget(result.target);
        const current = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT status FROM run_targets
             WHERE run_id = ? AND batch_id = ? AND target_key = ?`,
            runId,
            batchId,
            target.targetKey,
        ));
        if (!current) throw new Error("run target not found");
        if (TERMINAL_TARGET_STATUSES.has(current.status)) {
            return publicTargetStatus(this.#latestTarget(target.targetKey));
        }
        if (!TERMINAL_TARGET_STATUSES.has(result.status)) throw new Error("invalid target result status");
        if (typeof result.available !== "boolean") throw new Error("invalid target availability");
        requireTimestamp(result.checkedAt, "target checked timestamp");

        this.ctx.storage.sql.exec(
            `UPDATE run_targets
             SET status = ?, checked_at = ?, published_at = ?, upstream_updated = ?,
                 error_code = ?, error_message = ?
             WHERE run_id = ? AND batch_id = ? AND target_key = ?`,
            result.status,
            result.checkedAt,
            result.publishedAt,
            result.upstreamUpdated,
            result.errorCode,
            result.errorMessage,
            runId,
            batchId,
            target.targetKey,
        );
        if (result.status === "published" || result.status === "reused") {
            if (!result.available) throw new Error("successful target must be available");
            requireTimestamp(result.publishedAt, "target published timestamp");
            requireTimestamp(result.upstreamUpdated, "upstream updated timestamp");
            this.ctx.storage.sql.exec(
                `INSERT INTO latest_targets(
                    target_key, kind, boss_slug, spec_slug, role, difficulty, metric, status,
                    checked_at, published_at, upstream_updated, last_error_code,
                    last_error_message, last_run_id
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fresh', ?, ?, ?, NULL, NULL, ?)
                 ON CONFLICT(target_key) DO UPDATE SET
                    kind = excluded.kind,
                    boss_slug = excluded.boss_slug,
                    spec_slug = excluded.spec_slug,
                    role = excluded.role,
                    difficulty = excluded.difficulty,
                    metric = excluded.metric,
                    status = 'fresh',
                    checked_at = excluded.checked_at,
                    published_at = excluded.published_at,
                    upstream_updated = excluded.upstream_updated,
                    last_error_code = NULL,
                    last_error_message = NULL,
                    last_run_id = excluded.last_run_id`,
                target.targetKey,
                target.kind,
                target.bossSlug,
                target.specSlug ?? null,
                target.role ?? null,
                target.difficulty ?? null,
                target.metric ?? null,
                result.checkedAt,
                result.publishedAt,
                result.upstreamUpdated,
                runId,
            );
        } else {
            if (result.available) {
                requireTimestamp(result.publishedAt, "stored target published timestamp");
                requireTimestamp(result.upstreamUpdated, "stored upstream updated timestamp");
            } else if (result.publishedAt !== null || result.upstreamUpdated !== null) {
                throw new Error("unavailable target has stored timestamps");
            }
            this.ctx.storage.sql.exec(
                `INSERT INTO latest_targets(
                    target_key, kind, boss_slug, spec_slug, role, difficulty, metric, status,
                    checked_at, published_at, upstream_updated, last_error_code,
                    last_error_message, last_run_id
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stale', ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(target_key) DO UPDATE SET
                    kind = excluded.kind,
                    boss_slug = excluded.boss_slug,
                    spec_slug = excluded.spec_slug,
                    role = excluded.role,
                    difficulty = excluded.difficulty,
                    metric = excluded.metric,
                    status = 'stale',
                    checked_at = excluded.checked_at,
                    published_at = excluded.published_at,
                    upstream_updated = excluded.upstream_updated,
                    last_error_code = excluded.last_error_code,
                    last_error_message = excluded.last_error_message,
                    last_run_id = excluded.last_run_id`,
                target.targetKey,
                target.kind,
                target.bossSlug,
                target.specSlug ?? null,
                target.role ?? null,
                target.difficulty ?? null,
                target.metric ?? null,
                result.checkedAt,
                result.publishedAt,
                result.upstreamUpdated,
                requireToken(result.errorCode || "refresh_failed", "error code"),
                String(result.errorMessage || "refresh failed").slice(0, 256),
                runId,
            );
        }
        return publicTargetStatus(this.#latestTarget(target.targetKey));
    }

    async completeBatch(runId, batchId, now) {
        requireToken(runId, "run id");
        requireToken(batchId, "batch id");
        requireTimestamp(now, "batch completion timestamp");
        const batch = oneOrNull(this.ctx.storage.sql.exec(
            "SELECT target_count FROM batches WHERE run_id = ? AND batch_id = ?",
            runId,
            batchId,
        ));
        if (!batch) throw new Error("batch not found");
        const terminalCount = Number(oneOrNull(this.ctx.storage.sql.exec(
            `SELECT COUNT(*) AS count FROM run_targets
             WHERE run_id = ? AND batch_id = ?
               AND status IN ('published', 'reused', 'failed')`,
            runId,
            batchId,
        ))?.count || 0);
        if (terminalCount !== Number(batch.target_count)) throw new Error("batch targets are incomplete");
        this.ctx.storage.sql.exec(
            "UPDATE batches SET status = 'complete', completed_at = ? WHERE run_id = ? AND batch_id = ?",
            now,
            runId,
            batchId,
        );

        const run = oneOrNull(this.ctx.storage.sql.exec(
            "SELECT expected_targets FROM runs WHERE run_id = ?",
            runId,
        ));
        const runCounts = oneOrNull(this.ctx.storage.sql.exec(
            `SELECT
                SUM(CASE WHEN status IN ('published', 'reused') THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
             FROM run_targets WHERE run_id = ?`,
            runId,
        ));
        const successCount = Number(runCounts?.success_count || 0);
        const failedCount = Number(runCounts?.failed_count || 0);
        if (run && successCount + failedCount === Number(run.expected_targets)) {
            this.ctx.storage.sql.exec(
                "UPDATE runs SET status = ?, completed_at = ? WHERE run_id = ?",
                failedCount > 0 ? "partial" : "complete",
                now,
                runId,
            );
            this.#setState("last_completed_run_id", runId);
        }
        return {
            global_status: this.#globalStatus(runId, now),
            run_status: this.#runStatus(runId, now),
        };
    }

    async abortRun(runId, errorCode, now) {
        requireToken(runId, "run id");
        requireToken(errorCode, "error code");
        requireTimestamp(now, "abort timestamp");
        this.ctx.storage.sql.exec(
            `UPDATE runs SET status = 'failed', completed_at = ?, error_code = ?
             WHERE run_id = ? AND status IN ('enqueuing', 'running')`,
            now,
            errorCode,
            runId,
        );
        this.#setState("last_completed_run_id", runId);
        return {
            global_status: this.#globalStatus(runId, now),
            run_status: this.#runStatus(runId, now),
        };
    }

    async prepareRetry(runId, sourceRunId, limit, matrixId, expected, now) {
        requireToken(runId, "run id");
        if (sourceRunId !== null) requireToken(sourceRunId, "source run id");
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid retry limit");
        if (sourceRunId !== null) {
            const source = oneOrNull(this.ctx.storage.sql.exec(
                "SELECT run_id FROM runs WHERE run_id = ?",
                sourceRunId,
            ));
            if (!source) throw new Error("source run not found");
        }
        const candidates = sourceRunId === null
            ? rows(this.ctx.storage.sql.exec(
                `SELECT * FROM latest_targets
                 WHERE status = 'stale'
                 ORDER BY checked_at, target_key LIMIT ?`,
                limit,
            ))
            : rows(this.ctx.storage.sql.exec(
                `SELECT lt.* FROM latest_targets lt
                 WHERE lt.status = 'stale'
                   AND EXISTS (
                     SELECT 1 FROM run_targets rt
                     WHERE rt.run_id = ? AND rt.target_key = lt.target_key AND rt.status = 'failed'
                   )
                 ORDER BY lt.checked_at, lt.target_key LIMIT ?`,
                sourceRunId,
                limit,
            ));
        if (candidates.length === 0) return { accepted: false, reason: "no_failed_targets" };
        const started = await this.beginRun(
            runId,
            "manual_retry",
            sourceRunId,
            candidates.length,
            Math.ceil(candidates.length / 20),
            matrixId,
            expected,
            now,
        );
        if (!started.accepted) return started;
        return {
            accepted: true,
            targets: candidates.map((row) => targetFromRow(row)),
        };
    }
}
