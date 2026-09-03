const SAFE_RUN_ID = /^[A-Za-z0-9._-]{1,128}$/;

const TARGET_COLUMNS = `
    target_key, kind, boss_slug, spec_slug, role, difficulty, metric,
    ranking_json, refresh_status, checked_at, published_at, upstream_updated,
    last_error_code, last_run_id
`;

function requireDatabase(database) {
    if (!database || typeof database.prepare !== "function") {
        throw new Error("D1 ranking database binding is missing");
    }
    return database;
}

function requireRunId(runId) {
    if (typeof runId !== "string" || !SAFE_RUN_ID.test(runId)) {
        throw new Error("invalid ranking run id");
    }
    return runId;
}

function identity(target) {
    if (!target || typeof target.targetKey !== "string" || typeof target.bossSlug !== "string") {
        throw new Error("invalid ranking target identity");
    }
    return [
        target.targetKey,
        target.kind,
        target.bossSlug,
        target.specSlug ?? null,
        target.role ?? null,
        target.difficulty ?? null,
        target.metric ?? null,
    ];
}

function changedRows(result) {
    return Number(result?.meta?.changes ?? 0);
}

export async function loadTargetRecord(database, targetKey) {
    requireDatabase(database);
    if (typeof targetKey !== "string" || targetKey.length === 0) {
        throw new Error("invalid ranking target key");
    }
    return database.prepare(
        `SELECT ${TARGET_COLUMNS} FROM ranking_targets WHERE target_key = ?`,
    ).bind(targetKey).first();
}

async function writePublished(database, result, runId) {
    if (!result.ranking || typeof result.ranking !== "object") {
        throw new Error("published ranking payload is missing");
    }
    const values = identity(result.target);
    const write = await database.prepare(`
        INSERT INTO ranking_targets(
            ${TARGET_COLUMNS}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fresh', ?, ?, ?, NULL, ?)
        ON CONFLICT(target_key) DO UPDATE SET
            kind = excluded.kind,
            boss_slug = excluded.boss_slug,
            spec_slug = excluded.spec_slug,
            role = excluded.role,
            difficulty = excluded.difficulty,
            metric = excluded.metric,
            ranking_json = excluded.ranking_json,
            refresh_status = 'fresh',
            checked_at = excluded.checked_at,
            published_at = excluded.published_at,
            upstream_updated = excluded.upstream_updated,
            last_error_code = NULL,
            last_run_id = excluded.last_run_id
    `).bind(
        ...values,
        JSON.stringify(result.ranking),
        result.checkedAt,
        result.publishedAt,
        result.upstreamUpdated,
        runId,
    ).run();
    if (changedRows(write) !== 1) throw new Error("published ranking was not stored");
    return {
        available: true,
        publishedAt: result.publishedAt,
        upstreamUpdated: result.upstreamUpdated,
    };
}

async function writeReused(database, result, runId) {
    const write = await database.prepare(`
        UPDATE ranking_targets
        SET refresh_status = 'fresh',
            checked_at = ?,
            last_error_code = NULL,
            last_run_id = ?
        WHERE target_key = ?
          AND ranking_json IS NOT NULL
          AND published_at = ?
          AND upstream_updated = ?
    `).bind(
        result.checkedAt,
        runId,
        result.target.targetKey,
        result.publishedAt,
        result.upstreamUpdated,
    ).run();
    if (changedRows(write) !== 1) throw new Error("reused ranking is missing or changed");
    return {
        available: true,
        publishedAt: result.publishedAt,
        upstreamUpdated: result.upstreamUpdated,
    };
}

async function writeFailed(database, result, runId) {
    const values = identity(result.target);
    const stored = await database.prepare(`
        INSERT INTO ranking_targets(
            ${TARGET_COLUMNS}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'stale', ?, NULL, NULL, ?, ?)
        ON CONFLICT(target_key) DO UPDATE SET
            kind = excluded.kind,
            boss_slug = excluded.boss_slug,
            spec_slug = excluded.spec_slug,
            role = excluded.role,
            difficulty = excluded.difficulty,
            metric = excluded.metric,
            refresh_status = 'stale',
            checked_at = excluded.checked_at,
            last_error_code = excluded.last_error_code,
            last_run_id = excluded.last_run_id
        RETURNING ranking_json IS NOT NULL AS available, published_at, upstream_updated
    `).bind(
        ...values,
        result.checkedAt,
        result.errorCode,
        runId,
    ).first();
    if (!stored) throw new Error("failed ranking status was not stored");
    return {
        available: Boolean(stored.available),
        publishedAt: stored.published_at,
        upstreamUpdated: stored.upstream_updated,
    };
}

export async function writeTargetResult(database, result, runId) {
    requireDatabase(database);
    requireRunId(runId);
    if (!result || !["published", "reused", "failed"].includes(result.status)) {
        throw new Error("invalid ranking target result");
    }
    if (result.status === "published") return writePublished(database, result, runId);
    if (result.status === "reused") return writeReused(database, result, runId);
    return writeFailed(database, result, runId);
}

export async function writeGlobalStatus(database, status) {
    if (!status) return;
    requireDatabase(database);
    if (
        typeof status !== "object"
        || typeof status.checked_at !== "string"
        || Number.isNaN(Date.parse(status.checked_at))
    ) {
        throw new Error("invalid global refresh status");
    }
    const write = await database.prepare(`
        INSERT INTO global_status(singleton, payload_json, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
    `).bind(JSON.stringify(status), status.checked_at).run();
    if (changedRows(write) !== 1) throw new Error("global refresh status was not stored");
}
