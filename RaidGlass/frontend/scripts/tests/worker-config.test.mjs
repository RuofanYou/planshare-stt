import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(await readFile(resolve(frontendRoot, "wrangler.jsonc"), "utf8"));

test("RaidGlass Web Production 与 Preview 绑定独立 D1", () => {
    assert.equal(config.name, "raidglass-web");
    assert.equal(config.main, "./public/_worker.js");
    assert.deepEqual(config.assets, {
        directory: "./build",
        binding: "ASSETS",
        run_worker_first: true,
    });
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    assert.equal(config.d1_databases.length, 1);
    assert.deepEqual(config.d1_databases[0], {
        binding: "RANKING_DB",
        database_name: "raidglass-data",
        database_id: "7764d3d9-18cc-4506-a58f-de7f473fb47c",
    });
    assert.equal(config.env.preview.name, "raidglass-web-preview");
    assert.deepEqual(config.env.preview.d1_databases, [{
        binding: "RANKING_DB",
        database_name: "raidglass-data-preview",
        database_id: "bc5f6867-3803-4a0d-9e41-376528090a6f",
    }]);
    assert.equal(Object.hasOwn(config, "r2_buckets"), false);
    assert.equal(Object.hasOwn(config.env.preview, "r2_buckets"), false);
});
