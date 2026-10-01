import {
    COMP_EXPECTED_COUNT,
    MATRIX_ID,
    SPEC_EXPECTED_COUNT,
    chunkTargets,
} from "./matrix.js";
import {
    COORDINATOR_NAME,
    structuredLog,
    validateTarget,
} from "./refresh.js";
import { loadTargetRecord, writeGlobalStatus } from "./ranking-store.js";
import { CASTS_VERSION } from "./wcl-casts.js";

const MAX_MANUAL_RETRY_TARGETS = 100;
const HOURLY_BACKFILL_TARGETS = 300;
const TARGETS_PER_QUEUE_MESSAGE = 8;

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

function safeMessage(error) {
    return (error instanceof Error ? error.message : String(error))
        .replace(/[\r\n\t]+/g, " ")
        .slice(0, 256);
}

async function writeRunState(env, state) {
    await writeGlobalStatus(env.RANKING_DB, state?.global_status);
}

async function requireD1Writes(env) {
    await env.RANKING_DB.prepare("UPDATE global_status SET updated_at=updated_at WHERE singleton=1").run();
}

async function enqueuePreparedRun({ runId, trigger, targets, coordinator, env, now, log, startIndex = 0 }) {
    const chunks = chunkTargets(targets, TARGETS_PER_QUEUE_MESSAGE);
    try {
        const pending = [];
        for (let index = startIndex; index < chunks.length; index += 1) {
            const batchId = `batch-${String(index + 1).padStart(4, "0")}`;
            const message = {
                schema_version: 2,
                run_id: runId,
                batch_id: batchId,
                trigger,
                targets: chunks[index],
            };
            await coordinator.markBatchEnqueued(runId, batchId, chunks[index], now().toISOString());
            pending.push({ body: message });
            if (pending.length === 10 || index === chunks.length - 1) {
                await env.REFRESH_QUEUE.sendBatch(pending);
                for (const item of pending) log("enqueued", {
                    run_id: runId, batch_id: item.body.batch_id,
                    trigger, target_count: item.body.targets.length,
                });
                pending.length = 0;
            }
        }
        const state = await coordinator.finalizeEnqueue(runId, now().toISOString());
        await writeRunState(env, state);
        log("cleanup", {
            run_id: runId,
            trigger,
            result: "enqueue_complete",
            batch_count: chunks.length,
            target_count: targets.length,
        });
        return {
            status: "enqueued",
            run_id: runId,
            batch_count: chunks.length,
            target_count: targets.length,
        };
    } catch (error) {
        const state = await coordinator.abortRun(runId, "enqueue_failed", now().toISOString());
        await writeRunState(env, state);
        log("failed", {
            run_id: runId,
            trigger,
            error_code: "enqueue_failed",
            error: safeMessage(error),
        });
        throw error;
    }
}

function expectedCounts() {
    return {
        spec_expected: SPEC_EXPECTED_COUNT,
        comp_expected: COMP_EXPECTED_COUNT,
    };
}

export async function runScheduledRefresh(controller, env, matrix, dependencies = {}) {
    const now = dependencies.now || (() => new Date());
    const log = dependencies.log || structuredLog;
    log("received", {
        trigger: "scheduled",
        cron: controller?.cron,
        scheduled_time: controller?.scheduledTime,
    });
    if (
        typeof env.ALLOWED_CRON !== "string"
        || controller?.cron !== env.ALLOWED_CRON
        || !Number.isFinite(controller?.scheduledTime)
        || (env.WCL_ALL_CASTS === "true" && new Date(controller.scheduledTime).getUTCHours() % 6 !== 0)
    ) {
        log("filtered", { trigger: "scheduled", reason: "unexpected_schedule" });
        if (typeof controller?.noRetry === "function") controller.noRetry();
        return { status: "skipped", reason: "unexpected_schedule" };
    }

    try {
        await requireD1Writes(env);
    } catch (error) {
        log("skipped", { trigger: "scheduled", reason: "d1_writes_unavailable", error: safeMessage(error) });
        return { status: "skipped", reason: "d1_writes_unavailable" };
    }

    const targets = matrix.map((target) => validateTarget(target));
    const runId = `scheduled-${controller.scheduledTime}`;
    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    const started = await coordinator.beginRun(
        runId,
        "scheduled",
        null,
        targets.length,
        chunkTargets(targets, TARGETS_PER_QUEUE_MESSAGE).length,
        MATRIX_ID,
        expectedCounts(),
        now().toISOString(),
    );
    if (!started.accepted) {
        const reason = started.reason || "run_rejected";
        if (reason === "active_run") {
            const progress = await coordinator.runProgress();
            if (progress.active && progress.status === "enqueuing"
                && progress.run_id.startsWith("scheduled-") && progress.matrix_id === MATRIX_ID
                && progress.expected_batches === chunkTargets(targets, TARGETS_PER_QUEUE_MESSAGE).length
                && progress.expected_targets === targets.length
                && progress.registered_batches === progress.complete_batches) {
                log("resumed", { run_id: progress.run_id,
                    registered_batches: progress.registered_batches,
                    expected_batches: progress.expected_batches });
                return enqueuePreparedRun({ runId: progress.run_id, trigger: "scheduled_resume",
                    targets, coordinator, env, now, log, startIndex: progress.registered_batches });
            }
        }
        log("filtered", { trigger: "scheduled", run_id: runId, reason });
        log("skipped", { trigger: "scheduled", run_id: runId, reason });
        return { status: "skipped", reason, run_id: runId };
    }
    await writeRunState(env, started);
    return enqueuePreparedRun({ runId, trigger: "scheduled", targets, coordinator, env, now, log });
}

export async function runScheduledBackfill(controller, env, dependencies = {}) {
    const now = dependencies.now || (() => new Date());
    const log = dependencies.log || structuredLog;
    log("wcl_backfill_started", { cron: controller?.cron, scheduled_time: controller?.scheduledTime });
    if (env.WCL_ALL_CASTS !== "true" || controller?.cron !== env.ALLOWED_CRON
        || !Number.isFinite(controller?.scheduledTime)
        || new Date(controller.scheduledTime).getUTCHours() % 6 === 0) {
        log("wcl_backfill_skipped", { reason: "unexpected_schedule" });
        controller?.noRetry?.();
        return { status: "skipped", reason: "unexpected_schedule" };
    }
    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    let rows;
    try {
        if ((await coordinator.runProgress()).active) {
            log("wcl_backfill_skipped", { reason: "refresh_active" });
            return { status: "skipped", reason: "refresh_active" };
        }
        const pauseReason = await coordinator.wclPauseReason();
        if (pauseReason) {
            log("wcl_backfill_skipped", { reason: pauseReason });
            return { status: "skipped", reason: pauseReason };
        }
        await requireD1Writes(env);
        rows = await env.RANKING_DB.prepare(`SELECT target_key FROM ranking_targets
            WHERE kind='spec' AND refresh_status='fresh' AND ranking_json IS NOT NULL
              AND last_run_id=(SELECT json_extract(payload_json, '$.latest_run_id')
                FROM global_status WHERE singleton=1)
              AND (COALESCE(json_extract(ranking_json, '$.skill_completion.version'), -1) <> ?
                OR COALESCE(json_extract(ranking_json, '$.skill_completion.complete'), 0)
                  < COALESCE(json_extract(ranking_json, '$.skill_completion.total'), 10))
            ORDER BY published_at, target_key LIMIT ${HOURLY_BACKFILL_TARGETS}`)
            .bind(CASTS_VERSION).all();
    } catch (error) {
        log("wcl_backfill_failed", { reason: safeMessage(error) });
        return { status: "failed", reason: "backfill_setup_failed" };
    }
    const keys = rows.results.map(row => row.target_key);
    const messages = [];
    for (let index = 0; index < keys.length; index += TARGETS_PER_QUEUE_MESSAGE) {
        messages.push({ body: { schema_version: 2, trigger: "casts_backfill",
            scheduled_time: controller.scheduledTime,
            target_keys: keys.slice(index, index + TARGETS_PER_QUEUE_MESSAGE) } });
    }
    try {
        for (let index = 0; index < messages.length; index += 10) {
            await env.REFRESH_QUEUE.sendBatch(messages.slice(index, index + 10));
        }
    } catch (error) {
        log("wcl_backfill_failed", { reason: safeMessage(error), candidate_count: keys.length });
        return { status: "failed", reason: "backfill_enqueue_failed" };
    }
    log("wcl_backfill_finished", { candidate_count: keys.length, message_count: messages.length });
    return { status: "enqueued", target_count: keys.length, message_count: messages.length };
}

export async function consumeBackfillBatch(batch, env, targetIndex, dependencies = {}) {
    const now = dependencies.now || (() => new Date());
    const log = dependencies.log || structuredLog;
    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    for (const message of batch.messages) {
        const body = message.body;
        const keys = body?.target_keys;
        if (env.WCL_ALL_CASTS !== "true" || body?.schema_version !== 2
            || body?.trigger !== "casts_backfill" || !Number.isFinite(body.scheduled_time)
            || !Array.isArray(keys) || keys.length < 1 || keys.length > TARGETS_PER_QUEUE_MESSAGE
            || new Set(keys).size !== keys.length
            || keys.some(key => targetIndex.get(key)?.kind !== "spec")) {
            log("wcl_backfill_skipped", { reason: "invalid_message" });
            message.ack();
            continue;
        }
        let processed = 0;
        let stoppedBy = null;
        for (const targetKey of keys) {
            try {
                const row = await loadTargetRecord(env.RANKING_DB, targetKey);
                if (!row?.ranking_json || !row.spec_slug || row.refresh_status !== "fresh") continue;
                const ranking = JSON.parse(row.ranking_json);
                if (ranking.skill_completion?.version === CASTS_VERSION
                    && ranking.skill_completion.complete >= ranking.skill_completion.total) continue;
                await coordinator.registerCasts(targetIndex.get(targetKey), ranking.skill_completion);
                processed++;
            } catch (error) {
                log("wcl_backfill_failed", { target_key: targetKey, reason: safeMessage(error) });
                message.retry();
                return;
            }
        }
        log("wcl_backfill_batch_finished", { scheduled_time: body.scheduled_time,
            target_count: keys.length, processed, stopped_by: stoppedBy });
        message.ack();
    }
}

async function constantTimeEqual(left, right) {
    const encoder = new TextEncoder();
    const [leftHash, rightHash] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(left)),
        crypto.subtle.digest("SHA-256", encoder.encode(right)),
    ]);
    const a = new Uint8Array(leftHash);
    const b = new Uint8Array(rightHash);
    let different = 0;
    for (let index = 0; index < a.length; index += 1) different |= a[index] ^ b[index];
    return different === 0;
}

async function authorized(request, secret) {
    if (typeof secret !== "string") return false;
    const expected = secret.trim();
    if (expected.length < 1) return false;
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    return constantTimeEqual(provided, expected);
}

async function retryRequestBody(request) {
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid request body");
    const allowedKeys = new Set(["run_id", "limit"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) throw new Error("unsupported request field");
    const sourceRunId = body.run_id ?? null;
    if (
        sourceRunId !== null
        && (typeof sourceRunId !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(sourceRunId))
    ) {
        throw new Error("invalid source run id");
    }
    const limit = body.limit ?? MAX_MANUAL_RETRY_TARGETS;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MANUAL_RETRY_TARGETS) {
        throw new Error("invalid retry limit");
    }
    return { sourceRunId, limit };
}

export async function handleAdminRequest(request, env, dependencies = {}) {
    const now = dependencies.now || (() => new Date());
    const randomUUID = dependencies.randomUUID || (() => crypto.randomUUID());
    const log = dependencies.log || structuredLog;
    const url = new URL(request.url);
    log("received", { trigger: "http", method: request.method, path: url.pathname });
    if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "raidglass-refresh", matrix_id: MATRIX_ID });
    }
    if (url.pathname === "/run-progress" && request.method === "GET") {
        const progress = await env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME).runProgress();
        log("published", { trigger: "http", path: url.pathname, active: progress.active });
        return json(progress);
    }
    if (url.pathname === "/admin/backfill-casts") {
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        if (!env.CASTS_ADMIN_TOKEN || !(await authorized(request, env.CASTS_ADMIN_TOKEN))) {
            log("filtered", { trigger: "http", path: url.pathname, reason: "unauthorized" });
            return json({ error: "unauthorized" }, 401);
        }
        let target;
        try {
            const body = await request.json();
            target = dependencies.targetIndex?.get(body?.target_key);
            if (target?.kind !== "spec") throw new Error("invalid_target");
        } catch {
            log("filtered", { trigger: "http", path: url.pathname, reason: "invalid_target" });
            return json({ error: "invalid_target" }, 400);
        }
        log("wcl_casts_manual_started", { target_key: target.targetKey });
        try {
            const row = await loadTargetRecord(env.RANKING_DB, target.targetKey);
            if (!row?.ranking_json) {
                log("wcl_casts_manual_failed", { target_key: target.targetKey, reason: "ranking_unavailable" });
                return json({ error: "ranking_unavailable" }, 404);
            }
            const completion = await env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME)
                .registerCasts(target, JSON.parse(row.ranking_json).skill_completion, true);
            return json({ target_key: target.targetKey, skill_completion: completion }, 202);
        } catch (error) {
            log("wcl_casts_manual_failed", { target_key: target.targetKey, reason: safeMessage(error) });
            return json({ error: "backfill_failed" }, 503);
        }
    }
    if (url.pathname !== "/admin/retry") return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (typeof env.RETRY_TOKEN !== "string" || env.RETRY_TOKEN.trim().length < 1) {
        log("failed", { trigger: "http", error_code: "retry_secret_missing" });
        return json({ error: "retry_unavailable" }, 503);
    }
    if (!(await authorized(request, env.RETRY_TOKEN))) {
        const authorization = request.headers.get("authorization") || "";
        const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        log("filtered", {
            trigger: "http",
            reason: "unauthorized",
            expected_token_length: env.RETRY_TOKEN.trim().length,
            provided_token_length: provided.length,
        });
        return json({ error: "unauthorized" }, 401);
    }

    let input;
    try {
        input = await retryRequestBody(request);
    } catch (error) {
        log("filtered", { trigger: "http", reason: safeMessage(error) });
        return json({ error: "invalid_retry_request" }, 400);
    }

    const runId = `manual-${randomUUID()}`;
    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    let prepared;
    try {
        prepared = await coordinator.prepareRetry(
            runId,
            input.sourceRunId,
            input.limit,
            MATRIX_ID,
            expectedCounts(),
            now().toISOString(),
        );
    } catch (error) {
        log("failed", { trigger: "http", error_code: "retry_prepare_failed", error: safeMessage(error) });
        return json({ error: "retry_prepare_failed" }, 409);
    }
    if (!prepared.accepted) {
        const reason = prepared.reason || "retry_rejected";
        log("filtered", { trigger: "http", run_id: runId, reason });
        return json({ status: "skipped", reason }, reason === "no_failed_targets" ? 200 : 409);
    }

    let targets;
    try {
        targets = prepared.targets.map((target) => validateTarget(target));
        if (targets.length < 1 || targets.length > input.limit) throw new Error("retry target count is invalid");
    } catch (error) {
        const state = await coordinator.abortRun(runId, "retry_targets_invalid", now().toISOString());
        await writeRunState(env, state);
        log("failed", {
            trigger: "http",
            run_id: runId,
            error_code: "retry_targets_invalid",
            error: safeMessage(error),
        });
        return json({ error: "retry_targets_invalid" }, 503);
    }

    try {
        const result = await enqueuePreparedRun({
            runId,
            trigger: "manual_retry",
            targets,
            coordinator,
            env,
            now,
            log,
        });
        return json({
            status: "accepted",
            run_id: runId,
            source_run_id: input.sourceRunId,
            queued_target_count: result.target_count,
            queued_batch_count: result.batch_count,
        }, 202);
    } catch {
        return json({ error: "retry_enqueue_failed", run_id: runId }, 503);
    }
}
