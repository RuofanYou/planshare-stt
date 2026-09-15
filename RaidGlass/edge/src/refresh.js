import { MAX_TARGETS_PER_MESSAGE } from "./matrix.js";
import {
    loadTargetRecord,
    writeGlobalStatus,
    writeTargetResult,
} from "./ranking-store.js";
import { enrichWclSwiftness, shouldEnrichWclSwiftness } from "./wcl-swiftness.js";

const TOP_N = 10;
const MAX_JSON_BYTES = 2_000_000;
const SAFE_SLUG = /^[a-z0-9][a-z0-9&=-]{0,95}$/;
const SAFE_RUN_ID = /^[A-Za-z0-9._-]{1,128}$/;
const SPEC_METRICS = Object.freeze({
    mdps: new Set(["dps", "bossdps"]),
    rdps: new Set(["dps", "bossdps"]),
    heal: new Set(["dps", "hps", "bossdps"]),
    tank: new Set(["dps", "hps", "bossdps"]),
});

export const COORDINATOR_NAME = "raidglass-refresh-global-v2";

export function structuredLog(event, fields = {}) {
    const entry = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...fields,
    });
    if (event === "failed") console.error(entry);
    else console.log(entry);
}

class TargetRefreshError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "TargetRefreshError";
        this.code = code;
    }
}

function safeErrorCode(value) {
    const code = String(value || "refresh_failed").toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return code.slice(0, 96) || "refresh_failed";
}

function safeErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/[\r\n\t]+/g, " ").slice(0, 256);
}

function requireSlug(value, label) {
    if (typeof value !== "string" || !SAFE_SLUG.test(value)) throw new Error(`invalid ${label}`);
    return value;
}

export function validateTarget(value, targetIndex = null) {
    if (!value || typeof value !== "object") throw new Error("target is required");
    const bossSlug = requireSlug(value.bossSlug, "boss slug");
    let target;
    if (value.kind === "comp") {
        target = {
            kind: "comp",
            targetKey: `comp/${bossSlug}`,
            bossSlug,
        };
    } else if (value.kind === "spec") {
        const role = value.role;
        const difficulty = value.difficulty;
        const metric = value.metric;
        if (!Object.hasOwn(SPEC_METRICS, role)) throw new Error("invalid spec role");
        if (!new Set(["heroic", "mythic"]).has(difficulty)) throw new Error("invalid difficulty");
        if (!SPEC_METRICS[role].has(metric)) throw new Error("invalid metric for role");
        const specSlug = requireSlug(value.specSlug, "spec slug");
        target = {
            kind: "spec",
            targetKey: `spec/${bossSlug}/${specSlug}/${difficulty}/${metric}`,
            bossSlug,
            specSlug,
            role,
            difficulty,
            metric,
        };
    } else {
        throw new Error("invalid target kind");
    }
    if (value.targetKey !== target.targetKey) throw new Error("invalid target key");
    if (targetIndex) {
        const canonical = targetIndex.get(target.targetKey);
        if (!canonical || JSON.stringify(canonical) !== JSON.stringify(target)) {
            throw new Error("target is outside matrix");
        }
    }
    return target;
}

async function readJsonBounded(response, requestKind) {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
        throw new TargetRefreshError(`upstream_${requestKind}_too_large`, `${requestKind} payload is too large`);
    }
    if (!response.body) {
        throw new TargetRefreshError(`upstream_${requestKind}_empty`, `${requestKind} response has no body`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_JSON_BYTES) {
            await reader.cancel("payload limit exceeded");
            throw new TargetRefreshError(`upstream_${requestKind}_too_large`, `${requestKind} payload is too large`);
        }
        text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
        return JSON.parse(text);
    } catch {
        throw new TargetRefreshError(`upstream_${requestKind}_invalid_json`, `${requestKind} payload is invalid JSON`);
    }
}

function upstreamUrl(origin, target, requestKind) {
    if (target.kind === "comp") {
        const url = new URL(`/api/comp_ranking/${encodeURIComponent(target.bossSlug)}`, origin);
        url.searchParams.set("limit", "20");
        return url;
    }
    const suffix = requestKind === "info" ? "/info" : "";
    const url = new URL(
        `/api/spec_ranking/${encodeURIComponent(target.specSlug)}/${encodeURIComponent(target.bossSlug)}${suffix}`,
        origin,
    );
    url.search = new URLSearchParams({
        difficulty: target.difficulty,
        metric: target.metric,
    }).toString();
    return url;
}

async function fetchUpstreamJson(fetchImpl, origin, target, requestKind, log) {
    let response;
    try {
        response = await fetchImpl(upstreamUrl(origin, target, requestKind), {
            method: "GET",
            headers: { Accept: "application/json" },
            redirect: "manual",
        });
    } catch (error) {
        throw new TargetRefreshError(
            `upstream_${requestKind}_fetch_failed`,
            `${requestKind} request failed: ${safeErrorMessage(error)}`,
        );
    }
    if (!response.ok) {
        throw new TargetRefreshError(
            `upstream_${requestKind}_http_${response.status}`,
            `${requestKind} request returned HTTP ${response.status}`,
        );
    }
    const payload = await readJsonBounded(response, requestKind);
    log("fetched", {
        request_kind: requestKind,
        target_key: target.targetKey,
        http_status: response.status,
    });
    return payload;
}

function requireUpdated(payload, requestKind) {
    if (typeof payload.updated !== "string" || Number.isNaN(Date.parse(payload.updated))) {
        throw new TargetRefreshError(`upstream_${requestKind}_updated_invalid`, `${requestKind} updated is invalid`);
    }
    return payload.updated;
}

function validatePayload(payload, target, requestKind) {
    if (!payload || typeof payload !== "object" || payload.error || payload.errors || payload.detail) {
        throw new TargetRefreshError(`upstream_${requestKind}_error_payload`, `${requestKind} returned an error payload`);
    }
    if (payload.boss_slug !== target.bossSlug) {
        throw new TargetRefreshError(`upstream_${requestKind}_boss_slug_mismatch`, `${requestKind} target identity mismatch`);
    }
    if (target.kind === "spec") {
        for (const [payloadKey, targetKey] of [
            ["spec_slug", "specSlug"],
            ["difficulty", "difficulty"],
            ["metric", "metric"],
        ]) {
            if (payload[payloadKey] !== target[targetKey]) {
                throw new TargetRefreshError(
                    `upstream_${requestKind}_${payloadKey}_mismatch`,
                    `${requestKind} target identity mismatch`,
                );
            }
        }
    }
    requireUpdated(payload, requestKind);
    return payload;
}

function compactRanking(payload, requestKind) {
    if (!Array.isArray(payload.reports)) {
        throw new TargetRefreshError(`upstream_${requestKind}_reports_empty`, `${requestKind} reports are empty`);
    }
    const sourceReportCount = Number.isInteger(payload.source_report_count)
        ? payload.source_report_count
        : payload.reports.length;
    if (sourceReportCount < payload.reports.length) {
        throw new TargetRefreshError(`upstream_${requestKind}_report_count_invalid`, `${requestKind} report count is invalid`);
    }
    return {
        ...payload,
        reports: payload.reports.slice(0, TOP_N),
        source_report_count: sourceReportCount,
        edge_top_n: TOP_N,
        truncated: sourceReportCount > TOP_N,
    };
}

function reusableRanking(record, target, upstreamUpdated, log) {
    if (
        !record
        || record.upstream_updated !== upstreamUpdated
        || typeof record.published_at !== "string"
        || Number.isNaN(Date.parse(record.published_at))
        || typeof record.ranking_json !== "string"
    ) return null;
    try {
        const ranking = JSON.parse(record.ranking_json);
        validatePayload(ranking, target, "stored");
        if (
            !Array.isArray(ranking.reports)
            || ranking.reports.length > TOP_N
            || ranking.edge_top_n !== TOP_N
            || !Number.isInteger(ranking.source_report_count)
            || ranking.source_report_count < ranking.reports.length
        ) return null;
        return {
            published_at: record.published_at,
            upstream_updated: record.upstream_updated,
        };
    } catch (error) {
        log("filtered", {
            reason: "stored_ranking_invalid",
            target_key: target.targetKey,
            error: safeErrorMessage(error),
        });
        return null;
    }
}

async function refreshSpecTarget(target, env, options, checkedAt, stored) {
    const info = validatePayload(
        await fetchUpstreamJson(options.fetchImpl, env.UPSTREAM_ORIGIN, target, "info", options.log),
        target,
        "info",
    );
    const existing = shouldEnrichWclSwiftness(target)
        ? null
        : reusableRanking(stored, target, info.updated, options.log);
    if (existing) {
        options.log("reused", {
            run_id: options.runId,
            batch_id: options.batchId,
            target_key: target.targetKey,
            upstream_updated: info.updated,
        });
        return {
            target,
            status: "reused",
            checkedAt,
            publishedAt: existing.published_at,
            upstreamUpdated: info.updated,
            errorCode: null,
            errorMessage: null,
        };
    }

    const ranking = compactRanking(validatePayload(
        await fetchUpstreamJson(options.fetchImpl, env.UPSTREAM_ORIGIN, target, "ranking", options.log),
        target,
        "ranking",
    ), "ranking");
    await enrichWclSwiftness(ranking, target, env, options);
    return {
        target,
        status: "published",
        ranking,
        checkedAt,
        publishedAt: checkedAt,
        upstreamUpdated: ranking.updated,
        errorCode: null,
        errorMessage: null,
    };
}

async function refreshCompTarget(target, env, options, checkedAt) {
    const ranking = compactRanking(validatePayload(
        await fetchUpstreamJson(options.fetchImpl, env.UPSTREAM_ORIGIN, target, "comp", options.log),
        target,
        "comp",
    ), "comp");
    return {
        target,
        status: "published",
        ranking,
        checkedAt,
        publishedAt: checkedAt,
        upstreamUpdated: ranking.updated,
        errorCode: null,
        errorMessage: null,
    };
}

async function refreshTarget(target, env, options) {
    const checkedAt = options.now().toISOString();
    const stored = target.kind === "spec"
        ? await loadTargetRecord(env.RANKING_DB, target.targetKey)
        : null;
    let result;
    try {
        result = target.kind === "comp"
            ? await refreshCompTarget(target, env, options, checkedAt)
            : await refreshSpecTarget(target, env, options, checkedAt, stored);
    } catch (error) {
        const errorCode = safeErrorCode(error?.code);
        const errorMessage = safeErrorMessage(error);
        options.log("failed", {
            run_id: options.runId,
            batch_id: options.batchId,
            target_key: target.targetKey,
            error_code: errorCode,
            error: errorMessage,
        });
        result = {
            target,
            status: "failed",
            checkedAt,
            publishedAt: null,
            upstreamUpdated: null,
            errorCode,
            errorMessage,
        };
    }
    const storedState = await writeTargetResult(env.RANKING_DB, result, options.runId);
    result = {
        ...result,
        available: storedState.available,
        publishedAt: storedState.publishedAt,
        upstreamUpdated: storedState.upstreamUpdated,
    };
    options.log(result.status === "failed" ? "applied" : result.status, {
        run_id: options.runId,
        batch_id: options.batchId,
        target_key: target.targetKey,
        store: "d1",
        refresh_status: result.status === "failed" ? "stale" : "fresh",
        available: result.available,
        upstream_updated: result.upstreamUpdated,
        error_code: result.errorCode,
    });
    return result;
}

function validateQueueBody(body, targetIndex) {
    if (!body || typeof body !== "object" || body.schema_version !== 2) {
        throw new Error("invalid message schema");
    }
    if (typeof body.run_id !== "string" || !SAFE_RUN_ID.test(body.run_id)) throw new Error("invalid run id");
    if (typeof body.batch_id !== "string" || !/^batch-[0-9]{4}$/.test(body.batch_id)) {
        throw new Error("invalid batch id");
    }
    if (!Array.isArray(body.targets) || body.targets.length < 1 || body.targets.length > MAX_TARGETS_PER_MESSAGE) {
        throw new Error("invalid target count");
    }
    const targets = body.targets.map((target) => validateTarget(target, targetIndex));
    if (new Set(targets.map((target) => target.targetKey)).size !== targets.length) {
        throw new Error("duplicate target in message");
    }
    return { runId: body.run_id, batchId: body.batch_id, targets };
}

export async function consumeQueueBatch(batch, env, dependencies = {}) {
    const fetchImpl = dependencies.fetchImpl || fetch;
    const now = dependencies.now || (() => new Date());
    const log = dependencies.log || structuredLog;
    const messages = Array.isArray(batch?.messages) ? batch.messages : [];
    log("received", { trigger: "queue", message_count: messages.length });

    if (messages.length !== 1) {
        log("filtered", { trigger: "queue", reason: "consumer_batch_size", message_count: messages.length });
        if (typeof batch?.retryAll === "function") batch.retryAll({ delaySeconds: 60 });
        return;
    }

    const message = messages[0];
    let parsed;
    try {
        parsed = validateQueueBody(message.body, dependencies.targetIndex || null);
    } catch (error) {
        log("filtered", { trigger: "queue", reason: safeErrorMessage(error) });
        message.ack();
        return;
    }

    const coordinator = env.REFRESH_COORDINATOR.getByName(COORDINATOR_NAME);
    try {
        const claim = await coordinator.claimBatch(parsed.runId, parsed.batchId, parsed.targets, now().toISOString());
        if (claim.status === "complete") {
            await writeGlobalStatus(env.RANKING_DB, claim.global_status);
            log("skipped", { run_id: parsed.runId, batch_id: parsed.batchId, reason: "batch_complete" });
            message.ack();
            return;
        }

        const completedKeys = new Set((claim.terminal_statuses || []).map((entry) => entry.target?.targetKey));
        for (const target of parsed.targets) {
            if (completedKeys.has(target.targetKey)) {
                log("skipped", { run_id: parsed.runId, batch_id: parsed.batchId, target_key: target.targetKey, reason: "target_terminal" });
                continue;
            }
            const result = await refreshTarget(target, env, {
                fetchImpl,
                now,
                log,
                bossIds: dependencies.bossIds || null,
                runId: parsed.runId,
                batchId: parsed.batchId,
            });
            await coordinator.recordTarget(parsed.runId, parsed.batchId, result);
        }

        const completion = await coordinator.completeBatch(parsed.runId, parsed.batchId, now().toISOString());
        await writeGlobalStatus(env.RANKING_DB, completion.global_status);
        message.ack();
        log("cleanup", {
            run_id: parsed.runId,
            batch_id: parsed.batchId,
            result: "acknowledged",
            target_count: parsed.targets.length,
        });
    } catch (error) {
        log("failed", {
            run_id: parsed.runId,
            batch_id: parsed.batchId,
            error_code: "consumer_infrastructure_failed",
            error: safeErrorMessage(error),
        });
        message.retry({ delaySeconds: 60 });
    }
}
