import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const SOURCE_DIRECTORIES = ["src", "scss", "config"];
const SOURCE_FILES = [
    ".node-version",
    "index.html",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.verify.json",
    "vite.config.ts",
];

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function filesUnder(root, predicate = () => true) {
    const files = [];

    async function walk(path) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
            const child = join(path, entry.name);
            if (entry.isDirectory()) {
                await walk(child);
            } else if (entry.isFile()) {
                const relativePath = relative(root, child).replaceAll("\\", "/");
                if (predicate(relativePath)) files.push({ path: child, relativePath });
            }
        }
    }

    if (await exists(root)) await walk(root);
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function updateFiles(hash, label, root, predicate) {
    for (const file of await filesUnder(root, predicate)) {
        hash.update(label);
        hash.update("/");
        hash.update(file.relativePath);
        hash.update("\0");
        hash.update(await readFile(file.path));
        hash.update("\0");
    }
}

function isStaticPublicFile(relativePath) {
    return relativePath !== "snapshot-manifest.json"
        && !relativePath.startsWith("api/")
        && !relativePath.startsWith("assets/");
}

export async function releaseSourceHash({ frontendRoot, deploymentRoot }) {
    if (!frontendRoot || !deploymentRoot) throw new Error("release source roots are required");

    const root = resolve(frontendRoot);
    const deployment = resolve(deploymentRoot);
    const hash = createHash("sha256");
    hash.update("raidglass-release-source-v2\0");

    await updateFiles(hash, "deployment", deployment);
    for (const directory of SOURCE_DIRECTORIES) {
        await updateFiles(hash, directory, join(root, directory));
    }
    await updateFiles(hash, "public", join(root, "public"), isStaticPublicFile);

    for (const relativePath of SOURCE_FILES) {
        const path = join(root, relativePath);
        if (!(await exists(path))) continue;
        hash.update(`root/${relativePath}\0`);
        hash.update(await readFile(path));
        hash.update("\0");
    }

    return hash.digest("hex");
}
