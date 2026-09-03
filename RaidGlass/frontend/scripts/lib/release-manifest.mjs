function identifier(value) {
    return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function hash(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function timestamp(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function count(value) {
    return Number.isInteger(value) && value > 0;
}

function validReleaseManifest(manifest) {
    return Boolean(
        manifest
        && manifest.schema_version === 2
        && manifest.deployment_mode === "worker-assets-d1"
        && manifest.worker_entry === "_worker.js"
        && manifest.top_n === 10
        && hash(manifest.source_tree_hash)
        && identifier(manifest.build_id)
        && identifier(manifest.release_id)
        && identifier(manifest.matrix_id)
        && count(manifest.expected_count)
        && count(manifest.spec_expected)
        && count(manifest.comp_expected)
        && manifest.spec_expected + manifest.comp_expected === manifest.expected_count
        && timestamp(manifest.published_at)
        && Number.isInteger(manifest.static_file_count)
        && manifest.static_file_count > 0
    );
}

function validLegacyManifest(manifest) {
    return Boolean(
        manifest
        && manifest.schema_version === 1
        && manifest.top_n === 10
        && manifest.source_root === "raidglass-public-cache"
        && hash(manifest.source_tree_hash)
        && hash(manifest.ranking_data_hash)
        && Array.isArray(manifest.difficulties)
        && manifest.difficulties.length === 2
        && manifest.difficulties[0] === "heroic"
        && manifest.difficulties[1] === "mythic"
        && manifest.ranking_expected_count === 1860
        && manifest.ranking_valid_count === 1860
        && manifest.ranking_difficulty_counts?.heroic === 930
        && manifest.ranking_difficulty_counts?.mythic === 930
        && timestamp(manifest.snapshot_created_at)
        && identifier(manifest.build_id)
        && identifier(manifest.release_id)
        && timestamp(manifest.published_at)
        && Number.isInteger(manifest.file_count)
        && manifest.file_count > 0
    );
}

export function validateReleaseManifest(manifest) {
    if (!validReleaseManifest(manifest)) throw new Error("release manifest is invalid");
    return manifest;
}

export function validateLiveManifest(manifest) {
    if (validReleaseManifest(manifest) || validLegacyManifest(manifest)) return manifest;
    throw new Error("live manifest is invalid");
}
