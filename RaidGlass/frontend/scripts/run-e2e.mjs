import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    prepareGeneratedTestSurface,
    resolveE2EMode,
    writeGeneratedTestSource,
} from "./lib/generated-test-surface.mjs";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function defaultRunCommand({ command, args, cwd, env }) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd,
            env,
            shell: false,
            stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (status) => resolvePromise({ status: Number.isInteger(status) ? status : 1 }));
    });
}

async function createOwnedWorkRoot() {
    return mkdtemp(join(homedir(), ".raidglass-e2e-"));
}

async function moveOwnedRootToTrash(workRoot) {
    const trashRoot = join(homedir(), ".Trash");
    await mkdir(trashRoot, { recursive: true });
    const evidenceRoot = join(trashRoot, `raidglass-e2e-${randomUUID()}`);
    await rename(workRoot, evidenceRoot);
    return evidenceRoot;
}

function commandStatus(result) {
    return Number.isInteger(result?.status) ? result.status : 1;
}

export async function prepareGeneratedBuildForE2E(buildRoot) {
    const indexPath = join(buildRoot, "index.html");
    const html = await readFile(indexPath, "utf8");
    const offlineHtml = html.replace(
        /<script\s+async\s+src=["']https:\/\/wow\.zamimg\.com\/js\/tooltips\.js["']><\/script>\s*/,
        "",
    );
    await writeFile(indexPath, offlineHtml);
}

export async function runE2E({
    args = [],
    env = process.env,
    prepareGeneratedTestSurfaceImpl = prepareGeneratedTestSurface,
    prepareGeneratedBuildForE2EImpl = prepareGeneratedBuildForE2E,
    runCommand = defaultRunCommand,
    createWorkRoot = createOwnedWorkRoot,
    moveEvidenceRoot = moveOwnedRootToTrash,
    writeLine = (line) => console.log(line),
} = {}) {
    const mode = resolveE2EMode(env);
    const workRoot = await createWorkRoot();
    const screenshotRoot = join(workRoot, "screens");
    const playwrightOutputRoot = join(workRoot, "playwright");
    let exitCode = 1;
    let evidenceRoot;

    try {
        await mkdir(screenshotRoot, { recursive: true });
        await mkdir(playwrightOutputRoot, { recursive: true });

        let publicRoot = env.RAIDGLASS_PUBLIC_DIR;
        let buildRoot = env.RAIDGLASS_BUILD_DIR;
        let d1Path;
        if (mode === "generated") {
            const generated = await prepareGeneratedTestSurfaceImpl(workRoot);
            publicRoot = generated.publicRoot;
            buildRoot = generated.buildRoot;
            d1Path = generated.d1Path;
        } else {
            d1Path = join(workRoot, "ranking.sqlite3");
            await writeGeneratedTestSource(join(workRoot, "fixture-source"), d1Path);
        }

        const childEnv = {
            ...process.env,
            ...env,
            RAIDGLASS_PUBLIC_DIR: publicRoot,
            RAIDGLASS_BUILD_DIR: buildRoot,
            RAIDGLASS_D1_PATH: d1Path,
            RAIDGLASS_SCREENSHOT_ROOT: screenshotRoot,
            RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT: playwrightOutputRoot,
        };

        if (mode === "generated") {
            exitCode = commandStatus(await runCommand({
                command: "npm",
                args: ["run", "build"],
                cwd: frontendRoot,
                env: childEnv,
            }));
            if (exitCode === 0) {
                await prepareGeneratedBuildForE2EImpl(buildRoot);
            }
        } else {
            exitCode = 0;
        }

        if (exitCode === 0) {
            const playwrightArgs = mode === "artifact"
                ? [...args, "--workers=1"]
                : args;
            exitCode = commandStatus(await runCommand({
                command: "npm",
                args: ["run", "test:e2e:direct", "--", ...playwrightArgs],
                cwd: frontendRoot,
                env: childEnv,
            }));
        }
    } catch (error) {
        exitCode = 1;
        console.error("[E2E] run failed", {
            mode,
            reason: error instanceof Error ? error.message : String(error),
        });
    } finally {
        evidenceRoot = await moveEvidenceRoot(workRoot);
    }

    const receipt = {
        schema_version: 1,
        status: exitCode === 0 ? "passed" : "failed",
        mode,
        evidence_root: evidenceRoot,
        screenshot_root: join(evidenceRoot, "screens"),
        playwright_output_root: join(evidenceRoot, "playwright"),
    };
    writeLine(JSON.stringify(receipt));
    return { exitCode, receipt };
}

const isDirectExecution = process.argv[1]
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    const { exitCode } = await runE2E({ args: process.argv.slice(2) });
    process.exitCode = exitCode;
}

export { resolveE2EMode };
