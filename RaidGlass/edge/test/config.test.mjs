import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(relativePath) {
    return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

test("Production 与 Preview 配置锁住唯一 D1 Queue SQLite DO 免费刷新链", async () => {
    const config = await readJson("../wrangler.jsonc");
    const productionConsumer = config.queues.consumers[0];
    const preview = config.env.preview;
    const previewConsumer = preview.queues.consumers[0];

    assert.equal(config.name, "raidglass-refresh");
    assert.deepEqual(config.triggers.crons, ["0 */6 * * *"]);
    assert.equal(config.vars.ALLOWED_CRON, "0 */6 * * *");
    assert.deepEqual(config.d1_databases[0], {
        binding: "RANKING_DB",
        database_name: "raidglass-data",
        database_id: "7764d3d9-18cc-4506-a58f-de7f473fb47c",
    });
    assert.equal(Object.hasOwn(config, "r2_buckets"), false);
    assert.equal(config.queues.producers[0].queue, "raidglass-refresh");
    assert.deepEqual(productionConsumer, {
        queue: "raidglass-refresh",
        max_batch_size: 1,
        max_batch_timeout: 5,
        max_retries: 3,
        retry_delay: 60,
        max_concurrency: 4,
    });
    assert.equal(config.durable_objects.bindings[0].class_name, "RefreshCoordinator");
    assert.deepEqual(config.exports.RefreshCoordinator, {
        type: "durable-object",
        storage: "sqlite",
    });
    assert.equal(Object.hasOwn(config, "migrations"), false);

    assert.equal(preview.name, "raidglass-refresh-preview");
    assert.deepEqual(preview.triggers.crons, []);
    assert.equal(preview.vars.ALLOWED_CRON, "* * * * *");
    assert.deepEqual(preview.d1_databases[0], {
        binding: "RANKING_DB",
        database_name: "raidglass-data-preview",
        database_id: "bc5f6867-3803-4a0d-9e41-376528090a6f",
    });
    assert.equal(Object.hasOwn(preview, "r2_buckets"), false);
    assert.equal(preview.queues.producers[0].queue, "raidglass-refresh-preview");
    assert.equal(previewConsumer.queue, "raidglass-refresh-preview");
    assert.equal(previewConsumer.max_batch_size, 1);
    assert.equal(previewConsumer.max_retries, 3);
    assert.equal(previewConsumer.retry_delay, 60);
    assert.equal(previewConsumer.max_concurrency, 4);
});

test("发布脚本只使用严格 wrangler deploy", async () => {
    const pkg = await readJson("../package.json");
    const scripts = Object.values(pkg.scripts).join("\n");

    assert.equal(pkg.devDependencies.miniflare, "4.20260730.0");
    assert.equal(pkg.devDependencies.wrangler, "4.120.0");
    assert.match(pkg.scripts["deploy:production"], /^wrangler deploy\b/);
    assert.match(pkg.scripts["deploy:preview"], /^wrangler deploy\b/);
    assert.match(pkg.scripts["migrate:production"], /^wrangler d1 migrations apply\b/);
    assert.match(pkg.scripts["migrate:preview"], /^wrangler d1 migrations apply\b/);
    assert.doesNotMatch(pkg.scripts["cron:disable:production"], /--triggers\s+""/);
    assert.doesNotMatch(pkg.scripts["cron:disable:preview"], /--triggers\s+""/);
    assert.doesNotMatch(scripts, /versions upload/);
    assert.doesNotMatch(scripts, /wrangler r2\b/);
});
