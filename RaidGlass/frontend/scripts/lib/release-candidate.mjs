import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { prepareDeploymentAssets } from "./deployment-assets.mjs";
import { createStaticPublicFilter } from "./static-public-shell.mjs";

function defaultRunCommand({ command, args, cwd, env }) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd,
            env,
            shell: false,
            stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (status) => resolvePromise({ status }));
    });
}

function directNetworkEnvironment(environment) {
    const direct = { ...environment };
    for (const key of [
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "ALL_PROXY",
        "https_proxy",
        "http_proxy",
        "all_proxy",
    ]) {
        delete direct[key];
    }
    direct.NO_PROXY = "*";
    direct.no_proxy = "*";
    return direct;
}

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function safeId(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
        throw new Error(`${label} is invalid`);
    }
    return value;
}

export async function prepareReleaseCandidate({
    staticAssetRoot,
    frontendRoot,
    now = () => new Date().toISOString(),
    prepareDeploymentAssetsImpl = prepareDeploymentAssets,
    randomId = randomUUID,
    releaseParent,
}) {
    const releaseId = safeId(randomId(), "release id");
    const buildId = safeId(randomId(), "build id");
    const publishedAt = now();
    const resolvedFrontendRoot = resolve(frontendRoot);
    const resolvedReleaseParent = resolve(releaseParent);
    const releaseRoot = join(resolvedReleaseParent, releaseId);
    const publicDir = join(releaseRoot, "public");
    const buildDir = join(releaseRoot, "build");
    const manifestPath = join(publicDir, "snapshot-manifest.json");

    if (await exists(releaseRoot)) throw new Error("candidate release already exists");
    await mkdir(resolvedReleaseParent, { recursive: true });
    await mkdir(releaseRoot, { recursive: false });
    await cp(join(resolvedFrontendRoot, "public"), publicDir, {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: createStaticPublicFilter(join(resolvedFrontendRoot, "public")),
    });

    await prepareDeploymentAssetsImpl({
        sourceRoot: resolve(staticAssetRoot),
        outputRoot: publicDir,
        buildId,
        releaseId,
        publishedAt,
    });

    return { releaseRoot, publicDir, buildDir, manifestPath };
}

async function runChecked(runCommand, request, reason) {
    const result = await runCommand(request);
    if (result?.status !== 0) throw new Error(reason);
}

export async function buildReleaseCandidate({
    candidate,
    frontendRoot,
    runCommand = defaultRunCommand,
}) {
    await runChecked(runCommand, {
        command: "npm",
        args: ["run", "build"],
        cwd: resolve(frontendRoot),
        env: {
            ...process.env,
            RAIDGLASS_PUBLIC_DIR: candidate.publicDir,
            RAIDGLASS_BUILD_DIR: candidate.buildDir,
        },
    }, "candidate build failed");
}

async function responseBody(fetchImpl, baseUrl, path) {
    const url = new URL(path.replace(/^\/+/, ""), baseUrl);
    url.searchParams.set("rollback_check", String(Date.now()));
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) throw new Error("rollback verification request failed");
    return Buffer.from(await response.arrayBuffer());
}

export function createReleaseVerifier({
    consecutiveReadyChecks = 3,
    fetchImpl = fetch,
    frontendRoot,
    maxReadyAttempts = 18,
    runCommand = defaultRunCommand,
    wait = (delayMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs)),
}) {
    const root = resolve(frontendRoot);

    async function liveReleaseIsReady(baseUrl, releaseId) {
        const paths = [
            "/snapshot-manifest.json",
            "/api/health",
            "/api/spec_ranking/deathknight-blood/entombed-sentinels?difficulty=heroic&metric=dps",
            "/",
        ];
        try {
            const responses = await Promise.all(paths.map((path) => {
                const url = new URL(path.replace(/^\/+/, ""), baseUrl);
                url.searchParams.set("propagation_check", String(Date.now()));
                return fetchImpl(url, { cache: "no-store" });
            }));
            if (responses.some((response) => !response.ok)) return false;
            const [manifest, health, ranking, home] = await Promise.all([
                responses[0].json(),
                responses[1].json(),
                responses[2].json(),
                responses[3].text(),
            ]);
            return manifest.release_id === releaseId
                && health.ok === true
                && health.release_id === releaseId
                && health.expected_count === manifest.expected_count
                && health.available_count === manifest.expected_count
                && health.matrix_id === manifest.matrix_id
                && ranking.edge_top_n === 10
                && Array.isArray(ranking.reports)
                && ranking.reports.length > 0
                && ["fresh", "stale"].includes(ranking.refresh?.status)
                && typeof ranking.refresh?.checked_at === "string"
                && /<html lang="zh-CN"/.test(home);
        } catch {
            return false;
        }
    }

    async function waitForLiveRelease(baseUrl, releaseId) {
        let readyStreak = 0;
        for (let attempt = 1; attempt <= maxReadyAttempts; attempt += 1) {
            if (await liveReleaseIsReady(baseUrl, releaseId)) {
                readyStreak += 1;
                if (readyStreak >= consecutiveReadyChecks) return;
            } else {
                readyStreak = 0;
            }
            if (attempt < maxReadyAttempts) await wait(5_000);
        }
        throw new Error("live release propagation timed out");
    }

    return async function runVerify({
        artifact,
        baseUrl,
        deployment,
        expectedDeployment,
        manifest,
        stage,
    }) {
        if (stage === "rollback") {
            const [liveHome, expectedHome] = await Promise.all([
                responseBody(fetchImpl, baseUrl, "/"),
                responseBody(fetchImpl, expectedDeployment.url, "/"),
            ]);
            if (!liveHome.equals(expectedHome)) throw new Error("rollback verification failed");
            return;
        }

        if (!artifact?.path) throw new Error("verified artifact is required");
        const releaseRoot = dirname(artifact.path);
        const publicDir = join(releaseRoot, "public");
        const manifestPath = join(publicDir, "snapshot-manifest.json");
        const sharedEnv = {
            ...process.env,
            RAIDGLASS_PUBLIC_DIR: publicDir,
            RAIDGLASS_BUILD_DIR: artifact.path,
        };

        if (stage === "artifact") {
            await runChecked(runCommand, {
                command: "npm",
                args: ["run", "verify:artifact"],
                cwd: root,
                env: sharedEnv,
            }, "artifact verification failed");
            return;
        }

        if (!baseUrl || !manifest?.release_id) throw new Error("live verification identity is required");
        if (stage === "preview") {
            await waitForLiveRelease(baseUrl, manifest.release_id);
        } else if (stage === "production") {
            if (!deployment?.url) throw new Error("production deployment identity is required");
            await waitForLiveRelease(deployment.url, manifest.release_id);
            await waitForLiveRelease(baseUrl, manifest.release_id);
        }
        await runChecked(runCommand, {
            command: process.execPath,
            args: ["scripts/verify-live.mjs", baseUrl, manifestPath],
            cwd: root,
            env: directNetworkEnvironment({
                ...sharedEnv,
                RAIDGLASS_SCREENSHOT_ROOT: `/tmp/raidglass-release-${stage}-${manifest.release_id}`,
                RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT: join(releaseRoot, "playwright", stage),
            }),
        }, `${stage} verification failed`);
    };
}
