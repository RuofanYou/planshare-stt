export const DIFFICULTIES = Object.freeze(["heroic", "mythic"]);
export const MATRIX_ID = "midnight-s2-1683-v1";
export const SPEC_EXPECTED_COUNT = 1674;
export const COMP_EXPECTED_COUNT = 9;
export const GLOBAL_EXPECTED_COUNT = SPEC_EXPECTED_COUNT + COMP_EXPECTED_COUNT;
export const MAX_TARGETS_PER_MESSAGE = 20;

const ALLOWED_METRICS = new Set(["dps", "hps", "bossdps"]);
const SAFE_SLUG = /^[a-z0-9][a-z0-9&=-]{0,95}$/;

function payloadArray(payload, key) {
    const value = Array.isArray(payload) ? payload : payload?.[key];
    if (!Array.isArray(value)) throw new Error(`invalid ${key} payload`);
    return value;
}

function requireSlug(value, label) {
    if (typeof value !== "string" || !SAFE_SLUG.test(value)) {
        throw new Error(`invalid ${label}`);
    }
    return value;
}

function unique(values, label) {
    const result = [...new Set(values)];
    if (result.length !== values.length) throw new Error(`duplicate ${label}`);
    return result;
}

function roleMetricMap(rolesPayload, combatRoles) {
    const roles = payloadArray(rolesPayload, "roles");
    return new Map(combatRoles.map((roleCode) => {
        const role = roles.find((candidate) => candidate?.code === roleCode);
        if (!role) throw new Error(`missing role: ${roleCode}`);
        const metrics = unique(
            payloadArray(role.metrics, "metrics").map((metric) => {
                if (!ALLOWED_METRICS.has(metric)) throw new Error(`invalid metric: ${metric}`);
                return metric;
            }),
            `metric for role ${roleCode}`,
        ).sort();
        if (metrics.length === 0) throw new Error(`missing metrics for role: ${roleCode}`);
        return [roleCode, metrics];
    }));
}

function currentBosses(seasonPayload, zonesPayload) {
    const raidIds = payloadArray(seasonPayload?.raids, "raids");
    const raidIdSet = new Set(raidIds.map(String));
    const zones = payloadArray(zonesPayload, "zones")
        .filter((zone) => raidIdSet.has(String(zone?.id)));
    if (zones.length !== raidIdSet.size) throw new Error("current season zone count mismatch");

    const bosses = zones.flatMap((zone) => payloadArray(zone?.bosses, "bosses"))
        .map((boss) => requireSlug(boss?.full_name_slug ?? boss?.boss_slug, "boss slug"))
        .sort();
    unique(bosses, "boss slug");
    if (bosses.length === 0) throw new Error("current season has no bosses");
    return bosses;
}

function buildTargets({ product, roles, specs, season, zones }) {
    const combatRoles = product?.combatRoles;
    if (!Array.isArray(combatRoles) || combatRoles.length === 0) {
        throw new Error("invalid combat roles config");
    }
    unique(combatRoles, "combat role");
    const metricsByRole = roleMetricMap(roles, combatRoles);
    const combatRoleSet = new Set(combatRoles);
    const combatSpecs = payloadArray(specs, "specs")
        .filter((spec) => combatRoleSet.has(spec?.role))
        .map((spec) => ({
            specSlug: requireSlug(spec?.full_name_slug, "spec slug"),
            role: spec.role,
        }))
        .sort((left, right) => left.specSlug.localeCompare(right.specSlug));
    unique(combatSpecs.map((spec) => spec.specSlug), "combat spec slug");
    if (combatSpecs.length === 0) throw new Error("current season has no combat specs");

    const bosses = currentBosses(season, zones);
    const targets = [];
    for (const bossSlug of bosses) {
        for (const spec of combatSpecs) {
            for (const difficulty of DIFFICULTIES) {
                for (const metric of metricsByRole.get(spec.role)) {
                    targets.push({
                        kind: "spec",
                        targetKey: `spec/${bossSlug}/${spec.specSlug}/${difficulty}/${metric}`,
                        bossSlug,
                        specSlug: spec.specSlug,
                        role: spec.role,
                        difficulty,
                        metric,
                    });
                }
            }
        }
    }
    for (const bossSlug of bosses) {
        targets.push({
            kind: "comp",
            targetKey: `comp/${bossSlug}`,
            bossSlug,
        });
    }
    return targets;
}

export function matrixStats(input) {
    const bosses = currentBosses(input.season, input.zones);
    const combatRoles = Array.isArray(input.product?.combatRoles) ? input.product.combatRoles : [];
    const roles = payloadArray(input.roles, "roles");
    const roleMetrics = new Map(roles.map((role) => [role?.code, Array.isArray(role?.metrics) ? role.metrics : []]));
    const combatSpecCount = payloadArray(input.specs, "specs")
        .filter((spec) => combatRoles.includes(spec?.role) && (roleMetrics.get(spec?.role)?.length ?? 0) > 0)
        .length;
    const metricsPerBoss = payloadArray(input.specs, "specs")
        .filter((spec) => combatRoles.includes(spec?.role))
        .reduce((total, spec) => total + (roleMetrics.get(spec?.role)?.length ?? 0), 0);
    const specExpected = bosses.length * 2 * metricsPerBoss;
    const compExpected = bosses.length;
    const expectedCount = specExpected + compExpected;
    const seasonSlug = input.season?.slug;
    if (typeof seasonSlug !== "string" || seasonSlug.length === 0) {
        throw new Error("current season slug is required");
    }
    return {
        matrix_id: `${seasonSlug.replaceAll("_", "-")}-${expectedCount}-v1`,
        expected_count: expectedCount,
        spec_expected: specExpected,
        comp_expected: compExpected,
        boss_count: bosses.length,
        combat_spec_count: combatSpecCount,
    };
}

export function buildRankingMatrix(input) {
    const targets = buildTargets(input);
    const stats = matrixStats(input);
    if (
        stats.matrix_id !== MATRIX_ID
        || stats.spec_expected !== SPEC_EXPECTED_COUNT
        || stats.comp_expected !== COMP_EXPECTED_COUNT
    ) {
        throw new Error(
            `ranking matrix mismatch: expected=${MATRIX_ID}/${GLOBAL_EXPECTED_COUNT}`
            + ` actual=${stats.matrix_id}/${stats.expected_count}`,
        );
    }
    return targets;
}

export function chunkTargets(targets, size = MAX_TARGETS_PER_MESSAGE) {
    if (!Array.isArray(targets)) throw new Error("targets must be an array");
    if (!Number.isInteger(size) || size < 1 || size > MAX_TARGETS_PER_MESSAGE) {
        throw new Error("invalid target chunk size");
    }
    const chunks = [];
    for (let index = 0; index < targets.length; index += size) {
        chunks.push(targets.slice(index, index + size));
    }
    return chunks;
}
