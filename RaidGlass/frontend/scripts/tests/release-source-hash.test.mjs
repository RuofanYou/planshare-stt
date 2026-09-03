import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { releaseSourceHash } from "../lib/release-source-hash.mjs";

async function write(root, relativePath, value) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
}

test("发布源哈希覆盖静态资产与实际产物输入并忽略生成目录", async () => {
    const root = await mkdtemp(join(homedir(), ".Trash", "raidglass-release-source-test-"));
    const deploymentRoot = join(root, "candidate-public");

    await write(root, "src/app.tsx", "export const value = 1;\n");
    await write(root, "scss/app.scss", ":root { color: black; }\n");
    await write(root, "config/product.json", "{\"rankingTopN\":10}\n");
    await write(root, "public/_worker.js", "export default {};\n");
    await write(root, "public/img/logo.png", Buffer.from([1, 2, 3]));
    await write(root, "public/api/old.json", "{\"stale\":true}\n");
    await write(root, "public/snapshot-manifest.json", "{\"stale\":true}\n");
    await write(root, "index.html", "<main></main>\n");
    await write(root, "vite.config.ts", "export default {};\n");
    await write(root, "package.json", "{}\n");
    await write(root, "package-lock.json", "{}\n");
    await write(root, ".node-version", "22.14.0\n");
    await write(deploymentRoot, "api/metadata.json", "{\"items\":[1]}\n");
    await write(deploymentRoot, "assets/images/spec.jpg", Buffer.from([0xff, 0xd8, 0xff]));

    const original = await releaseSourceHash({ frontendRoot: root, deploymentRoot });
    assert.match(original, /^[a-f0-9]{64}$/);

    await write(root, "build/generated.js", "changed\n");
    await write(root, "node_modules/dependency/index.js", "changed\n");
    await write(root, "public/api/old.json", "{\"stale\":false}\n");
    await write(root, "public/snapshot-manifest.json", "{\"stale\":false}\n");
    assert.equal(await releaseSourceHash({ frontendRoot: root, deploymentRoot }), original);

    await write(root, "src/app.tsx", "export const value = 2;\n");
    const codeChanged = await releaseSourceHash({ frontendRoot: root, deploymentRoot });
    assert.notEqual(codeChanged, original);

    await write(deploymentRoot, "api/metadata.json", "{\"items\":[2]}\n");
    assert.notEqual(await releaseSourceHash({ frontendRoot: root, deploymentRoot }), codeChanged);
});
