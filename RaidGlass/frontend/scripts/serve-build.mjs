import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import worker from "../public/_worker.js";
import { openLocalD1 } from "../../testing/local-d1.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = resolve(process.env.RAIDGLASS_BUILD_DIR || resolve(frontendRoot, "build"));
const d1Path = process.env.RAIDGLASS_D1_PATH
    ? resolve(process.env.RAIDGLASS_D1_PATH)
    : null;
const rankingDatabase = d1Path ? openLocalD1(d1Path) : null;
const host = process.env.RAIDGLASS_DEV_HOST || "127.0.0.1";
const port = Number(process.env.RAIDGLASS_DEV_PORT || 4174);
const origin = `http://${host}:${port}`;

const CONTENT_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".cur", "image/x-icon"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
    [".txt", "text/plain; charset=utf-8"],
]);

function requestHeaders(incoming) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
    }
    return headers;
}

async function assetFetch(request) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const path = resolve(buildRoot, `.${pathname}`);
    if (path !== buildRoot && !path.startsWith(`${buildRoot}${sep}`)) {
        return new Response("invalid_asset_path", { status: 400 });
    }

    try {
        const fileStat = await stat(path);
        if (!fileStat.isFile()) return new Response("asset_not_found", { status: 404 });
        const body = request.method === "HEAD" ? null : await readFile(path);
        return new Response(body, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
                "Content-Length": String(fileStat.size),
                "Content-Type": CONTENT_TYPES.get(extname(path).toLowerCase()) || "application/octet-stream",
            },
        });
    } catch (error) {
        if (error?.code === "ENOENT") return new Response("asset_not_found", { status: 404 });
        throw error;
    }
}

const server = createServer(async (incoming, outgoing) => {
    const startedAt = Date.now();
    try {
        const request = new Request(new URL(incoming.url || "/", origin), {
            method: incoming.method,
            headers: requestHeaders(incoming),
        });
        const response = await worker.fetch(request, {
            ASSETS: { fetch: assetFetch },
            RANKING_DB: rankingDatabase,
            // Offline E2E fixtures have no credentials or remote queue. Keep their stored progress unchanged.
            ...(process.env.RAIDGLASS_E2E_FIXTURE === "generated" && rankingDatabase ? {
                CAST_BACKFILL: { async request(targetKey) {
                    const row = await rankingDatabase.prepare("SELECT ranking_json FROM ranking_targets WHERE target_key=?").bind(targetKey).first();
                    if (!row?.ranking_json) return { error: "ranking_unavailable", http_status: 404 };
                    const ranking = JSON.parse(row.ranking_json);
                    return { target_key: targetKey, revision: `fixture/${ranking.updated}`,
                        skill_completion: ranking.skill_completion || { version: 1, complete: 0,
                            total: ranking.reports.length, failed: 0, status: "queued", retry_at: null } };
                } },
            } : {}),
        });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        if (!response.body || incoming.method === "HEAD") {
            outgoing.end();
        } else {
            Readable.fromWeb(response.body).pipe(outgoing);
        }
        console.info("[LocalSurface] served", {
            method: incoming.method,
            path: new URL(request.url).pathname,
            status: response.status,
            duration_ms: Date.now() - startedAt,
        });
    } catch (error) {
        outgoing.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        outgoing.end(JSON.stringify({ error: "local_surface_failed" }));
        console.error("[LocalSurface] failed", {
            method: incoming.method,
            path: incoming.url,
            reason: error instanceof Error ? error.message : String(error),
        });
    }
});

server.listen(port, host, () => {
    console.info("[LocalSurface] ready", { origin, build_root: buildRoot });
});

function shutdown(signal) {
    console.info("[LocalSurface] stopping", { signal });
    server.close(() => {
        rankingDatabase?.close();
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
