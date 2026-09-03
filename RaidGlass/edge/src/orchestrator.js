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
import { writeGlobalStatus } from "./ranking-store.js";

const MAX_MANUAL_RETRY_TARGETS = 100;

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

async function enqueuePreparedRun({ runId, trigger, targets, coordinator, env, now, log }) {
    const chunks = chunkTargets(targets);
    try {
        for (let index = 0; index < chunks.length; index += 1) {
            const batchId = `batch-${String(index + 1).padStart(4, "0")}`;
            const message = {
                schema_version: 2,
                run_id: runId,
                batch_id: batchId,
                trigger,
                targets: chunks[index],
            };
            await coordinator.markBatchEnqueued(runId, batchId, chunks[index], now().toISOString());
            await env.REFRESH_QUEUE.send(message);
            log("enqueued", {
                run_id: runId,
                batch_id: batchId,
                trigger,
                target_count: chunks[index].length,
            });
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
    ) {
        log("filtered", { trigger: "scheduled", reason: "unexpected_schedule" });
        if (typeof controller?.noRetry === "function") controller.noRetry();
        return { status: "skipped", reason: "unexpected_schedule" };
    }

    const targets = matrix.map((target) => validateTarget(target));
    const runId = `scheduled-${controller.scheduledTime}`;
    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    const started = await coordinator.beginRun(
        runId,
        "scheduled",
        null,
        targets.length,
        chunkTargets(targets).length,
        MATRIX_ID,
        expectedCounts(),
        now().toISOString(),
    );
    if (!started.accepted) {
        const reason = started.reason || "run_rejected";
        log("filtered", { trigger: "scheduled", run_id: runId, reason });
        log("skipped", { trigger: "scheduled", run_id: runId, reason });
        return { status: "skipped", reason, run_id: runId };
    }
    await writeRunState(env, started);
    return enqueuePreparedRun({ runId, trigger: "scheduled", targets, coordinator, env, now, log });
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

async function authorized(request, env) {
    if (typeof env.RETRY_TOKEN !== "string") return false;
    const expected = env.RETRY_TOKEN.trim();
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
    if (url.pathname !== "/admin/retry") return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (typeof env.RETRY_TOKEN !== "string" || env.RETRY_TOKEN.trim().length < 1) {
        log("failed", { trigger: "http", error_code: "retry_secret_missing" });
        return json({ error: "retry_unavailable" }, 503);
    }
    if (!(await authorized(request, env))) {
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
