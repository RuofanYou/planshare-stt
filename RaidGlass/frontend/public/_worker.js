const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

const STALE_JSON_HEADERS = {
  ...JSON_HEADERS,
  "Cache-Control": "public, max-age=60",
};

const STATIC_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-cache",
};

const STALE_AFTER_MS = 8 * 60 * 60 * 1000;
const ALLOWED_DIFFICULTIES = new Set(["heroic", "mythic"]);
const SAFE_SLUG = /^[a-z0-9][a-z0-9&=-]{0,95}$/;

function json(data, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(data), { status, headers });
}

function cloneWithHeaders(response, headers = STATIC_JSON_HEADERS) {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

async function asset(env, request, assetPath, headers = STATIC_JSON_HEADERS) {
  const target = new URL(request.url);
  target.pathname = assetPath;
  target.search = "";
  const response = await env.ASSETS.fetch(new Request(target, request));
  if (response.ok || response.status === 304) return cloneWithHeaders(response, headers);
  return json({ error: "not_found", path: assetPath }, 404);
}

async function assetJson(env, request, assetPath) {
  const target = new URL(request.url);
  target.pathname = assetPath;
  target.search = "";
  const response = await env.ASSETS.fetch(new Request(target, {
    method: "GET",
    headers: { Accept: "application/json" },
  }));
  if (!response.ok) throw new Error(`metadata request failed path=${assetPath} status=${response.status}`);
  return response.json();
}

export async function loadManifest(request, env) {
  const manifest = await assetJson(env, request, "/snapshot-manifest.json");
  if (
    !manifest
    || manifest.schema_version !== 2
    || manifest.top_n !== 10
    || typeof manifest.build_id !== "string"
    || manifest.build_id.length === 0
    || typeof manifest.release_id !== "string"
    || manifest.release_id.length === 0
    || typeof manifest.matrix_id !== "string"
    || manifest.matrix_id.length === 0
    || !Number.isInteger(manifest.expected_count)
    || manifest.expected_count < 1
    || !Number.isInteger(manifest.spec_expected)
    || manifest.spec_expected < 1
    || !Number.isInteger(manifest.comp_expected)
    || manifest.comp_expected < 1
    || manifest.spec_expected + manifest.comp_expected !== manifest.expected_count
    || !/^[a-f0-9]{64}$/.test(manifest.source_tree_hash || "")
    || !(
      manifest.published_at === null
      || (typeof manifest.published_at === "string" && !Number.isNaN(Date.parse(manifest.published_at)))
    )
  ) {
    throw new Error("deployment manifest is invalid");
  }
  return manifest;
}

function payloadArray(payload, key) {
  const value = Array.isArray(payload) ? payload : payload?.[key];
  if (!Array.isArray(value)) throw new Error(`invalid ${key} metadata`);
  return value;
}

function bossSlug(boss) {
  return typeof boss === "string" ? boss : boss?.full_name_slug || boss?.boss_slug || "";
}

async function rankingMetadata(request, env) {
  const [specPayload, rolePayload, zonePayload] = await Promise.all([
    assetJson(env, request, "/api/specs.json"),
    assetJson(env, request, "/api/roles.json"),
    assetJson(env, request, "/api/current_season/zones.json"),
  ]);
  const specs = payloadArray(specPayload, "specs");
  const roles = payloadArray(rolePayload, "roles");
  const bosses = new Set(
    payloadArray(zonePayload, "zones")
      .flatMap((zone) => Array.isArray(zone?.bosses) ? zone.bosses : [])
      .map(bossSlug)
      .filter(Boolean),
  );
  return { specs, roles, bosses };
}

async function specTarget(request, env, rawSpecSlug, rawBossSlug, searchParams) {
  let specSlug;
  let bossSlugValue;
  try {
    specSlug = decodeURIComponent(rawSpecSlug);
    bossSlugValue = decodeURIComponent(rawBossSlug);
  } catch {
    return { error: json({ error: "invalid_ranking_target" }, 400) };
  }
  if (!SAFE_SLUG.test(specSlug) || !SAFE_SLUG.test(bossSlugValue)) {
    return { error: json({ error: "invalid_ranking_target" }, 400) };
  }
  const difficulty = searchParams.get("difficulty") ?? "mythic";
  if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
    return { error: json({ error: "invalid_difficulty", value: difficulty }, 400) };
  }

  let metadata;
  try {
    metadata = await rankingMetadata(request, env);
  } catch (error) {
    console.error(JSON.stringify({
      event: "failed",
      reason: "ranking_metadata_unavailable",
      error: error instanceof Error ? error.message : String(error),
    }));
    return { error: json({ error: "ranking_metadata_unavailable" }, 503) };
  }
  if (!metadata.bosses.has(bossSlugValue)) {
    return { error: json({ error: "invalid_boss", value: bossSlugValue }, 400) };
  }
  const spec = metadata.specs.find((candidate) => candidate?.full_name_slug === specSlug);
  if (!spec || !["tank", "heal", "mdps", "rdps"].includes(spec.role)) {
    return { error: json({ error: "invalid_spec", value: specSlug }, 400) };
  }
  const role = metadata.roles.find((candidate) => candidate?.code === spec.role);
  const metrics = Array.isArray(role?.metrics) ? role.metrics : [];
  const defaultMetric = spec.role === "heal" ? "hps" : "dps";
  const metric = searchParams.get("metric") ?? defaultMetric;
  if (!metrics.includes(metric)) {
    return {
      error: json({
        error: "unsupported_metric_for_spec",
        spec_slug: specSlug,
        value: metric,
      }, 400),
    };
  }
  return {
    kind: "spec",
    target_key: `spec/${bossSlugValue}/${specSlug}/${difficulty}/${metric}`,
    boss_slug: bossSlugValue,
    spec_slug: specSlug,
    difficulty,
    metric,
  };
}

async function compTarget(request, env, rawBossSlug) {
  let bossSlugValue;
  try {
    bossSlugValue = decodeURIComponent(rawBossSlug);
  } catch {
    return { error: json({ error: "invalid_ranking_target" }, 400) };
  }
  if (!SAFE_SLUG.test(bossSlugValue)) {
    return { error: json({ error: "invalid_ranking_target" }, 400) };
  }
  try {
    const { bosses } = await rankingMetadata(request, env);
    if (!bosses.has(bossSlugValue)) {
      return { error: json({ error: "invalid_boss", value: bossSlugValue }, 400) };
    }
  } catch {
    return { error: json({ error: "ranking_metadata_unavailable" }, 503) };
  }
  return {
    kind: "comp",
    target_key: `comp/${bossSlugValue}`,
    boss_slug: bossSlugValue,
  };
}

const TARGET_ROW_QUERY = `
  SELECT target_key, kind, boss_slug, spec_slug, difficulty, metric,
         ranking_json, refresh_status, checked_at, published_at,
         upstream_updated, last_error_code
  FROM ranking_targets
  WHERE target_key = ?
`;

async function rankingRow(database, targetKey) {
  return database.prepare(TARGET_ROW_QUERY).bind(targetKey).first();
}

function validTimestampOrNull(value) {
  return value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function publicRefreshStatus(status, targetKey, servedAt) {
  if (
    !status
    || status.schema_version !== 2
    || status.target_key !== targetKey
    || !["fresh", "stale"].includes(status.status)
    || typeof status.checked_at !== "string"
    || Number.isNaN(Date.parse(status.checked_at))
    || !validTimestampOrNull(status.published_at)
    || !validTimestampOrNull(status.upstream_updated)
    || !(status.last_error_code === null || typeof status.last_error_code === "string")
  ) {
    return null;
  }
  const overdue = servedAt.getTime() - Date.parse(status.checked_at) > STALE_AFTER_MS;
  return {
    status: status.status === "stale" || overdue ? "stale" : "fresh",
    checked_at: status.checked_at,
    published_at: status.published_at,
    upstream_updated: status.upstream_updated,
    last_error_code: status.last_error_code,
  };
}

function validRanking(ranking, target) {
  if (
    !ranking
    || ranking.boss_slug !== target.boss_slug
    || typeof ranking.updated !== "string"
    || Number.isNaN(Date.parse(ranking.updated))
    || !Array.isArray(ranking.reports)
    || ranking.reports.length > 10
    || ranking.edge_top_n !== 10
    || !Number.isInteger(ranking.source_report_count)
    || ranking.source_report_count < ranking.reports.length
  ) return false;
  if (target.kind === "comp") return true;
  return ranking.spec_slug === target.spec_slug
    && ranking.difficulty === target.difficulty
    && ranking.metric === target.metric;
}

function validRowIdentity(row, target) {
  if (
    !row
    || row.target_key !== target.target_key
    || row.kind !== target.kind
    || row.boss_slug !== target.boss_slug
  ) return false;
  if (target.kind === "comp") {
    return row.spec_slug === null && row.difficulty === null && row.metric === null;
  }
  return row.spec_slug === target.spec_slug
    && row.difficulty === target.difficulty
    && row.metric === target.metric;
}

function targetSummary(target) {
  if (target.kind === "comp") {
    return { kind: "comp", boss_slug: target.boss_slug };
  }
  return {
    kind: "spec",
    boss_slug: target.boss_slug,
    spec_slug: target.spec_slug,
    difficulty: target.difficulty,
    metric: target.metric,
  };
}

async function fallbackRanking(request, target, infoOnly, servedAt) {
  const path = target.kind === "spec"
    ? `/api/spec_ranking/${encodeURIComponent(target.spec_slug)}/${encodeURIComponent(target.boss_slug)}`
    : `/api/comp_ranking/${encodeURIComponent(target.boss_slug)}`;
  const url = new URL(path, "https://api2.lorrgs.io");
  if (target.kind === "spec") {
    url.search = new URLSearchParams({ difficulty: target.difficulty, metric: target.metric }).toString();
  } else {
    url.searchParams.set("limit", "20");
  }
  const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "manual" });
  if (!response.ok || Number(response.headers.get("content-length")) > 2_000_000) {
    throw new Error(`upstream_http_${response.status}`);
  }
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("upstream_too_large");
  const upstream = JSON.parse(text);
  const reports = upstream?.reports;
  const ranking = { ...upstream, reports: Array.isArray(reports) ? reports.slice(0, 10) : reports,
    edge_top_n: 10, source_report_count: upstream?.source_report_count ?? reports?.length };
  if (!validRanking(ranking, target)) throw new Error("upstream_ranking_invalid");
  const refresh = { schema_version: 2, target_key: target.target_key, status: "stale",
    checked_at: servedAt.toISOString(), published_at: servedAt.toISOString(),
    upstream_updated: ranking.updated, last_error_code: "d1_daily_read_limit" };
  console.warn(JSON.stringify({ event: "published", source: "public_upstream",
    target_key: target.target_key, reason: "d1_daily_read_limit", report_count: ranking.reports.length }));
  const payload = infoOnly ? { ...ranking, reports: undefined,
    report_count: ranking.reports.length, refresh } : { ...ranking, refresh };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: STALE_JSON_HEADERS });
  return json(payload, 200, STALE_JSON_HEADERS);
}

async function serveRanking(request, env, target, infoOnly = false) {
  const servedAt = new Date();
  const summary = targetSummary(target);
  let row;
  let ranking;
  try {
    row = await rankingRow(env.RANKING_DB, target.target_key);
    if (!row || typeof row.ranking_json !== "string") {
      return json({ error: "ranking_unavailable", retryable: true, target: summary }, 503);
    }
    ranking = JSON.parse(row.ranking_json);
  } catch (error) {
    console.error(JSON.stringify({
      event: "failed",
      reason: "ranking_row_read_failed",
      target_key: target.target_key,
      error: error instanceof Error ? error.message : String(error),
    }));
    if (/daily row read limit/i.test(String(error))) {
      try { return await fallbackRanking(request, target, infoOnly, servedAt); }
      catch (fallbackError) {
        console.error(JSON.stringify({ event: "failed", reason: "ranking_fallback_failed",
          target_key: target.target_key,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) }));
      }
    }
    return json({ error: "ranking_data_invalid", retryable: true, target: summary }, 503);
  }
  if (!validRowIdentity(row, target) || !validRanking(ranking, target)) {
    return json({ error: "ranking_identity_invalid", retryable: true, target: summary }, 503);
  }
  const refresh = publicRefreshStatus({
    schema_version: 2,
    target_key: row.target_key,
    status: row.refresh_status,
    checked_at: row.checked_at,
    published_at: row.published_at,
    upstream_updated: row.upstream_updated,
    last_error_code: row.last_error_code,
  }, target.target_key, servedAt);
  if (!refresh) {
    return json({ error: "ranking_status_invalid", retryable: true, target: summary }, 503);
  }

  const payload = infoOnly
    ? {
      ...ranking,
      reports: undefined,
      report_count: ranking.reports.length,
      refresh,
    }
    : { ...ranking, refresh };
  const headers = refresh.status === "stale" ? STALE_JSON_HEADERS : JSON_HEADERS;
  console.log(JSON.stringify({
    event: "published",
    source: "d1",
    target_key: target.target_key,
    refresh_status: refresh.status,
  }));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return json(payload, 200, headers);
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function publicGlobalStatus(status, servedAt, manifest) {
  const countKeys = [
    "expected_count", "available_count", "fresh_count", "stale_count", "unchecked_count",
    "spec_expected", "spec_available", "spec_fresh", "spec_stale", "spec_unchecked",
    "comp_expected", "comp_available", "comp_fresh", "comp_stale", "comp_unchecked",
  ];
  if (
    !status
    || status.schema_version !== 2
    || !["refreshing", "fresh", "stale"].includes(status.status)
    || countKeys.some((key) => !isCount(status[key]))
    || status.matrix_id !== manifest.matrix_id
    || status.expected_count !== manifest.expected_count
    || status.spec_expected !== manifest.spec_expected
    || status.comp_expected !== manifest.comp_expected
    || status.spec_expected + status.comp_expected !== status.expected_count
    || typeof status.checked_at !== "string"
    || Number.isNaN(Date.parse(status.checked_at))
  ) return null;
  const overdue = servedAt.getTime() - Date.parse(status.checked_at) > STALE_AFTER_MS;
  return {
    ...status,
    status: status.status === "fresh" && overdue ? "stale" : status.status,
  };
}

async function loadGlobalStatus(env, servedAt, manifest) {
  const row = await env.RANKING_DB.prepare(
    "SELECT payload_json FROM global_status WHERE singleton = 1",
  ).first();
  if (!row || typeof row.payload_json !== "string") return null;
  return publicGlobalStatus(JSON.parse(row.payload_json), servedAt, manifest);
}

async function serveGlobalStatus(request, env, mode) {
  const servedAt = new Date();
  try {
    const manifest = await loadManifest(request, env);
    const refresh = await loadGlobalStatus(env, servedAt, manifest);
    if (!refresh) return json({ error: "refresh_status_unavailable", retryable: true }, 503);
    if (mode === "health") {
      return json({
        ok: refresh.available_count === refresh.expected_count,
        service: "raidglass-web",
        mode: "worker-assets-d1",
        freshness: refresh.status,
        matrix_id: refresh.matrix_id,
        available_count: refresh.available_count,
        expected_count: refresh.expected_count,
        release_id: manifest.release_id,
        build_id: manifest.build_id,
        source_tree_hash: manifest.source_tree_hash,
        published_at: manifest.published_at,
        served_at: servedAt.toISOString(),
        refresh,
      });
    }
    return json({
      mode: "worker-assets-d1",
      ...refresh,
      release_id: manifest.release_id,
      build_id: manifest.build_id,
      source_tree_hash: manifest.source_tree_hash,
      published_at: manifest.published_at,
    }, 200, refresh.status === "fresh" ? JSON_HEADERS : STALE_JSON_HEADERS);
  } catch (error) {
    console.error(JSON.stringify({
      event: "failed",
      reason: "refresh_status_read_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return json({ error: "refresh_status_unavailable", retryable: true }, 503);
  }
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  const backfillMatch = pathname.match(/^\/api\/spec_ranking\/([^/]+)\/([^/]+)\/backfill$/);
  if (backfillMatch) {
    if (!["GET", "POST"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
    if (request.method === "POST" && request.headers.get("Origin") && request.headers.get("Origin") !== url.origin)
      return json({ error: "origin_not_allowed" }, 403);
    const target = await specTarget(request, env, backfillMatch[1], backfillMatch[2], searchParams);
    if (target.error) return target.error;
    if (!env.CAST_BACKFILL) return json({ error: "backfill_disabled" }, 503);
    try {
      let clientKey = null;
      if (request.method === "POST") {
        // Hash the edge-provided address; never persist or log client addresses.
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.headers.get("CF-Connecting-IP") || "unknown"));
        clientKey = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      }
      const result = await env.CAST_BACKFILL.request(target.target_key, clientKey);
      const { http_status, ...payload } = result;
      return json(payload, http_status || (request.method === "POST" && payload.skill_completion?.status !== "complete" ? 202 : 200),
        { "Content-Type": "application/json", "Cache-Control": "no-store" });
    } catch (error) {
      console.error(JSON.stringify({ event: "wcl_backfill_request_failed", target_key: target.target_key, reason: String(error).slice(0,180) }));
      return json({ error: "backfill_unavailable" }, 503);
    }
  }

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!env.RANKING_DB) return json({ error: "ranking_store_unavailable" }, 503);
  if (pathname === "/api/health") return serveGlobalStatus(request, env, "health");
  if (pathname === "/api/admin/refresh-state") return serveGlobalStatus(request, env, "admin");

  if (pathname === "/api/seasons/current") return asset(env, request, "/api/season_current.json");
  if (pathname === "/api/current_season/zones") return asset(env, request, "/api/current_season/zones.json");
  if (pathname === "/api/zones") return asset(env, request, "/api/zones.json");
  if (pathname === "/api/bosses") return asset(env, request, "/api/bosses.json");
  if (pathname === "/api/classes") return asset(env, request, "/api/classes.json");
  if (pathname === "/api/roles") return asset(env, request, "/api/roles.json");
  if (pathname === "/api/specs") return asset(env, request, "/api/specs.json");
  if (pathname === "/api/spellbook") return asset(env, request, "/api/spellbook.json");

  const zoneMatch = pathname.match(/^\/api\/zones\/([^/]+)$/);
  if (zoneMatch) return asset(env, request, `/api/current_season/zones/${zoneMatch[1]}.json`);

  const bossSpellMatch = pathname.match(/^\/api\/bosses\/([^/]+)\/spells$/);
  if (bossSpellMatch) return asset(env, request, `/api/boss_spells/${bossSpellMatch[1]}.json`);

  const specSpellMatch = pathname.match(/^\/api\/specs\/([^/]+)\/spells$/);
  if (specSpellMatch) return asset(env, request, `/api/spec_spells/${specSpellMatch[1]}.json`);

  const infoMatch = pathname.match(/^\/api\/spec_ranking\/([^/]+)\/([^/]+)\/info$/);
  if (infoMatch) {
    const target = await specTarget(request, env, infoMatch[1], infoMatch[2], searchParams);
    if (target.error) return target.error;
    return serveRanking(request, env, target, true);
  }

  const specMatch = pathname.match(/^\/api\/spec_ranking\/([^/]+)\/([^/]+)$/);
  if (specMatch) {
    const target = await specTarget(request, env, specMatch[1], specMatch[2], searchParams);
    if (target.error) return target.error;
    return serveRanking(request, env, target);
  }

  const compMatch = pathname.match(/^\/api\/comp_ranking\/([^/]+)$/);
  if (compMatch) {
    const target = await compTarget(request, env, compMatch[1]);
    if (target.error) return target.error;
    return serveRanking(request, env, target);
  }

  return json({ error: "not_found", path: pathname }, 404);
}

function internalRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === "/log") url.pathname = "/";
  else if (url.pathname.startsWith("/log/")) url.pathname = url.pathname.slice(4) || "/";
  return new Request(url, request);
}

function secure(response) {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, response.status === 304
    ? { status: 304, headers }
    : { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const externalUrl = new URL(request.url);
    const traceId = request.headers.get("x-planshare-trace-id") || crypto.randomUUID();
    const routedRequest = internalRequest(request);
    const url = new URL(routedRequest.url);
    const event = {
      chain: "raidglass-web",
      traceId,
      method: request.method,
      path: externalUrl.pathname,
      routedPath: url.pathname,
    };
    console.info(JSON.stringify({ ...event, stage: "started" }));

    try {
      let response;
      if (url.pathname.startsWith("/api/")) response = await handleApi(routedRequest, env);

      else if (url.pathname.startsWith("/assets/")) {
        response = await env.ASSETS.fetch(routedRequest);
        const contentType = response.headers.get("content-type") || "";
        if (response.status !== 304 && (!response.ok || contentType.includes("text/html"))) {
          response = new Response("asset_not_found", {
            status: 404,
            headers: {
              "Cache-Control": "public, max-age=60",
              "Content-Type": "text/plain; charset=utf-8",
            },
          });
        }
      } else {
        response = await env.ASSETS.fetch(routedRequest);
        if (response.status === 404 && request.method === "GET") {
          response = await env.ASSETS.fetch(new Request(new URL("/", url), routedRequest));
        }
      }

      console.info(JSON.stringify({ ...event, stage: "completed", status: response.status }));
      return secure(response);
    } catch (error) {
      console.error(JSON.stringify({
        ...event,
        stage: "failed",
        reason: error instanceof Error ? error.message : String(error),
      }));
      return secure(json({ error: "raidglass_request_failed", trace_id: traceId }, 500));
    }
  },
};
