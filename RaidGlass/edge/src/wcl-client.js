const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const GRAPHQL_URL = "https://www.warcraftlogs.com/api/v2/client";
let cachedToken = null;

function logDetails(target, extra = {}) {
    return { target_key: target.targetKey, ...extra };
}

async function jsonResponse(response, label) {
    if (!response.ok) throw new Error(`${label}_http_${response.status}`);
    // Report master data is external and can be much larger than the bounded events page.
    const reader = response.body?.getReader();
    if (!reader) throw new Error(`${label}_empty`);
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8_000_000) {
            await reader.cancel();
            throw new Error(`${label}_too_large`);
        }
        text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let value;
    try { value = JSON.parse(text); } catch { throw new Error(`${label}_invalid_json`); }
    if (!value || typeof value !== "object") throw new Error(`${label}_invalid_json`);
    return value;
}

async function accessToken(env, fetchImpl, now, log, target) {
    const nowMs = Number(now());
    if (!Number.isFinite(nowMs)) throw new Error("wcl_clock_invalid");
    if (cachedToken && cachedToken.expiresAt > nowMs + 60_000) return cachedToken.value;
    if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET) throw new Error("wcl_credentials_missing");
    const response = await fetchImpl(TOKEN_URL, {
        signal: AbortSignal.timeout(15_000),
        method: "POST",
        headers: {
            Authorization: `Basic ${btoa(`${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const payload = await jsonResponse(response, "wcl_auth");
    if (typeof payload.access_token !== "string" || !payload.access_token) throw new Error("wcl_auth_token_missing");
    const expiresIn = Number(payload.expires_in);
    cachedToken = {
        value: payload.access_token,
        expiresAt: nowMs + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3_600_000),
    };
    log("wcl_enrichment_authenticated", logDetails(target));
    return cachedToken.value;
}

export async function graphql(env, fetchImpl, now, log, target, query, variables = {}) {
    const token = await accessToken(env, fetchImpl, now, log, target);
    const response = await fetchImpl(GRAPHQL_URL, {
        signal: AbortSignal.timeout(15_000),
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    const payload = await jsonResponse(response, "wcl_graphql");
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        const details = payload.errors.map((entry) => String(entry?.message || "unknown"))
            .join("; ").replace(/[\r\n\t]+/g, " ").slice(0, 180);
        throw new Error(`wcl_graphql_error: ${details}`);
    }
    if (!payload.data || typeof payload.data !== "object") throw new Error("wcl_graphql_data_missing");
    return payload.data;
}


export function resetWclTokenForTests() { cachedToken = null; }
