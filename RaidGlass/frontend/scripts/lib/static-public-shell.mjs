import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { posix, relative, resolve } from "node:path";

function buildTrackedAllowlist(publicRoot) {
    const trackedPaths = execFileSync(
        "git",
        ["-C", publicRoot, "ls-files", "-z", "--", "."],
        { encoding: "utf8" },
    ).split("\0").filter(Boolean);
    const allowlist = new Set([""]);

    for (const trackedPath of trackedPaths) {
        allowlist.add(trackedPath);
        let ancestor = posix.dirname(trackedPath);
        while (ancestor !== ".") {
            allowlist.add(ancestor);
            ancestor = posix.dirname(ancestor);
        }
    }
    return allowlist;
}

export function createStaticPublicFilter(publicRoot) {
    const resolvedRoot = resolve(publicRoot);
    const trackedAllowlist = buildTrackedAllowlist(resolvedRoot);

    return (source) => {
        if (lstatSync(source).isSymbolicLink()) return false;

        const relativePath = relative(resolvedRoot, resolve(source)).replaceAll("\\", "/");
        if (!relativePath) return true;
        if (relativePath === ".." || relativePath.startsWith("../")) return false;
        if (!trackedAllowlist.has(relativePath)) return false;

        return relativePath !== "snapshot-manifest.json"
            && relativePath !== "api"
            && !relativePath.startsWith("api/")
            && relativePath !== "assets"
            && !relativePath.startsWith("assets/");
    };
}
