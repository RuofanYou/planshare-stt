import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { lstat, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
    buildReleaseCandidate,
    createReleaseVerifier,
    prepareReleaseCandidate,
} from "../lib/release-candidate.mjs";

async function write(root, relativePath, value) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
}

test("候选发布目录只复制受控 public 并写入静态部署资产", async () => {
    const root = await mkdtemp(join(homedir(), ".Trash", "raidglass-candidate-test-"));
    const frontendRoot = join(root, "frontend");
    const staticAssetRoot = join(root, "static-assets");
    const releaseParent = join(root, "cache", "site-publish", "releases");
    await write(frontendRoot, "public/_worker.js", "worker\n");
    await write(frontendRoot, "public/img/logo.png", Buffer.from([1, 2, 3]));
    await write(root, "outside/api/stale.json", "stale\n");
    await write(root, "outside/assets/images/stale.png", "stale\n");
    await write(root, "outside/snapshot-manifest.json", "stale\n");
    await write(root, "outside/untracked-link.txt", "untracked link\n");
    await write(frontendRoot, "public/untracked-static.txt", "untracked file\n");
    await symlink(join(root, "outside/api"), join(frontendRoot, "public/api"), "dir");
    await symlink(join(root, "outside/assets"), join(frontendRoot, "public/assets"), "dir");
    await symlink(
        join(root, "outside/snapshot-manifest.json"),
        join(frontendRoot, "public/snapshot-manifest.json"),
        "file",
    );
    await symlink(
        join(root, "outside/untracked-link.txt"),
        join(frontendRoot, "public/untracked-link.txt"),
        "file",
    );
    execFileSync("git", ["-C", frontendRoot, "init", "--quiet"]);
    execFileSync("git", [
        "-C",
        frontendRoot,
        "add",
        "--",
        "public/_worker.js",
        "public/img/logo.png",
    ]);
    await mkdir(staticAssetRoot, { recursive: true });

    const ids = ["release-candidate-test", "build-candidate-test"];
    const candidate = await prepareReleaseCandidate({
        frontendRoot,
        staticAssetRoot,
        releaseParent,
        now: () => "2026-07-10T10:00:00.000Z",
        randomId: () => ids.shift(),
        prepareDeploymentAssetsImpl: async (options) => {
            assert.equal(options.sourceRoot, staticAssetRoot);
            assert.equal(options.releaseId, "release-candidate-test");
            assert.equal(options.buildId, "build-candidate-test");
            assert.equal(options.publishedAt, "2026-07-10T10:00:00.000Z");
            await write(options.outputRoot, "api/current.json", "current\n");
            const manifest = {
                schema_version: 2,
                deployment_mode: "worker-assets-d1",
                worker_entry: "_worker.js",
                top_n: 10,
                release_id: options.releaseId,
                build_id: options.buildId,
                source_tree_hash: "a".repeat(64),
                published_at: options.publishedAt,
                static_file_count: 3,
            };
            await write(options.outputRoot, "snapshot-manifest.json", `${JSON.stringify(manifest)}\n`);
            return manifest;
        },
    });

    assert.equal(await readFile(join(candidate.publicDir, "_worker.js"), "utf8"), "worker\n");
    assert.deepEqual(await readFile(join(candidate.publicDir, "img", "logo.png")), Buffer.from([1, 2, 3]));
    assert.equal(await readFile(join(candidate.publicDir, "api", "current.json"), "utf8"), "current\n");
    await assert.rejects(readFile(join(candidate.publicDir, "api", "stale.json")), /ENOENT/);
    await assert.rejects(readFile(join(candidate.publicDir, "assets", "images", "stale.png")), /ENOENT/);
    await assert.rejects(readFile(join(candidate.publicDir, "untracked-static.txt")), /ENOENT/);
    await assert.rejects(readFile(join(candidate.publicDir, "untracked-link.txt")), /ENOENT/);
    assert.equal((await lstat(candidate.manifestPath)).isSymbolicLink(), false);
    assert.equal(await readFile(join(root, "outside/snapshot-manifest.json"), "utf8"), "stale\n");
    assert.equal(candidate.releaseRoot, join(releaseParent, "release-candidate-test"));
    assert.equal(candidate.manifestPath, join(candidate.publicDir, "snapshot-manifest.json"));
});

test("构建候选时显式传入隔离 public 与 build", async () => {
    const calls = [];
    const candidate = { publicDir: "/cache/release/public", buildDir: "/cache/release/build" };
    await buildReleaseCandidate({
        candidate,
        frontendRoot: "/frontend",
        runCommand: async (request) => {
            calls.push(request);
            return { status: 0 };
        },
    });

    assert.deepEqual(calls[0].args, ["run", "build"]);
    assert.equal(calls[0].cwd, "/frontend");
    assert.equal(calls[0].env.RAIDGLASS_PUBLIC_DIR, candidate.publicDir);
    assert.equal(calls[0].env.RAIDGLASS_BUILD_DIR, candidate.buildDir);
});

test("验证器按 artifact 与 live 阶段调用固定门禁", async () => {
    const calls = [];
    const runVerify = createReleaseVerifier({
        consecutiveReadyChecks: 1,
        fetchImpl: async (value) => {
            const url = new URL(value);
            if (url.pathname === "/log/snapshot-manifest.json") {
                return Response.json({ release_id: "release-test", matrix_id: "midnight-s2-1683-v1", expected_count: 1683 });
            }
            if (url.pathname === "/log/api/health") {
                return Response.json({
                    ok: true,
                    release_id: "release-test",
                    matrix_id: "midnight-s2-1683-v1",
                    expected_count: 1683,
                    available_count: 1683,
                });
            }
            if (url.pathname.startsWith("/log/api/spec_ranking/")) {
                return Response.json({
                    edge_top_n: 10,
                    reports: [{}],
                    refresh: { status: "fresh", checked_at: "2026-08-09T12:00:00.000Z" },
                });
            }
            return new Response('<!doctype html><html lang="zh-CN"></html>');
        },
        frontendRoot: "/frontend",
        maxReadyAttempts: 1,
        runCommand: async (request) => {
            calls.push(request);
            return { status: 0 };
        },
    });
    const artifact = { path: "/cache/release/build", hash: "a".repeat(64) };
    const manifest = { release_id: "release-test" };
    const candidate = { manifestPath: "/cache/release/public/snapshot-manifest.json" };

    await runVerify({ stage: "artifact", artifact, manifest, candidate });
    await runVerify({ stage: "preview", artifact, manifest, baseUrl: "https://preview.zhaobanzi.pages.dev/log/", candidate });

    assert.deepEqual(calls[0].args, ["run", "verify:artifact"]);
    assert.equal(calls[0].env.RAIDGLASS_BUILD_DIR, artifact.path);
    assert.deepEqual(calls[1].args, [
        "scripts/verify-live.mjs",
        "https://preview.zhaobanzi.pages.dev/log/",
        candidate.manifestPath,
    ]);
    assert.equal(calls[1].env.RAIDGLASS_SCREENSHOT_ROOT, "/tmp/raidglass-release-preview-release-test");
    assert.equal(calls[1].env.RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT, "/cache/release/playwright/preview");
    assert.equal(calls[1].env.HTTPS_PROXY, undefined);
    assert.equal(calls[1].env.HTTP_PROXY, undefined);
    assert.equal(calls[1].env.ALL_PROXY, undefined);
    assert.equal(calls[1].env.NO_PROXY, "*");
    assert.equal(calls[1].env.no_proxy, "*");
});

test("Preview 复验等待同一 release 的页面与 API 连续就绪", async () => {
    const commands = [];
    let fetchCount = 0;
    const releaseId = "release-preview-propagation-test";
    const fetchImpl = async (value) => {
        fetchCount += 1;
        const url = new URL(value);
        if (fetchCount <= 4) return new Response("not ready", { status: 404 });
        if (url.pathname === "/log/snapshot-manifest.json") {
            return Response.json({ release_id: releaseId, matrix_id: "midnight-s2-1683-v1", expected_count: 1683 });
        }
        if (url.pathname === "/log/api/health") {
            return Response.json({
                ok: true,
                release_id: releaseId,
                matrix_id: "midnight-s2-1683-v1",
                expected_count: 1683,
                available_count: 1683,
            });
        }
        if (url.pathname.startsWith("/log/api/spec_ranking/")) {
            return Response.json({
                edge_top_n: 10,
                reports: [{}],
                refresh: { status: "fresh", checked_at: "2026-08-09T12:00:00.000Z" },
            });
        }
        return new Response('<!doctype html><html lang="zh-CN"></html>');
    };
    const runVerify = createReleaseVerifier({
        consecutiveReadyChecks: 3,
        fetchImpl,
        frontendRoot: "/frontend",
        maxReadyAttempts: 4,
        runCommand: async (request) => {
            commands.push(request);
            return { status: 0 };
        },
        wait: async () => {},
    });

    await runVerify({
        stage: "preview",
        artifact: { path: "/cache/release/build" },
        manifest: { release_id: releaseId },
        baseUrl: "https://preview.zhaobanzi.pages.dev/log/",
    });

    assert.equal(fetchCount, 16);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].args[1], "https://preview.zhaobanzi.pages.dev/log/");
});

test("生产复验要求首页、健康和排行连续多轮同时切换", async () => {
    const commands = [];
    let fetchCount = 0;
    const releaseId = "release-propagation-test";
    const fetchImpl = async (value) => {
        fetchCount += 1;
        const url = new URL(value);
        const ready = fetchCount > 4;
        if (!ready) {
            return new Response("<!doctype html><html lang=\"en\"></html>", {
                status: 200,
                headers: { "Content-Type": "text/html" },
            });
        }
        if (url.pathname === "/log/snapshot-manifest.json") {
            return Response.json({ release_id: releaseId, matrix_id: "midnight-s2-1683-v1", expected_count: 1683 });
        }
        if (url.pathname === "/log/api/health") {
            return Response.json({
                ok: true,
                release_id: releaseId,
                matrix_id: "midnight-s2-1683-v1",
                expected_count: 1683,
                available_count: 1683,
            });
        }
        if (url.pathname.startsWith("/log/api/spec_ranking/")) {
            return Response.json({
                edge_top_n: 10,
                reports: [{}],
                refresh: { status: "fresh", checked_at: "2026-08-09T12:00:00.000Z" },
            });
        }
        return new Response('<!doctype html><html lang="zh-CN"></html>', {
            status: 200,
            headers: { "Content-Type": "text/html" },
        });
    };
    const runVerify = createReleaseVerifier({
        fetchImpl,
        frontendRoot: "/frontend",
        consecutiveReadyChecks: 3,
        maxReadyAttempts: 4,
        runCommand: async (request) => {
            commands.push(request);
            return { status: 0 };
        },
        wait: async () => {},
    });

    await runVerify({
        stage: "production",
        artifact: { path: "/cache/release/build" },
        manifest: { release_id: releaseId },
        baseUrl: "https://zhaobanzi.pages.dev/log/",
        deployment: { url: "https://immutable.zhaobanzi.pages.dev/log/" },
    });

    assert.equal(fetchCount, 28);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].args[1], "https://zhaobanzi.pages.dev/log/");
});
