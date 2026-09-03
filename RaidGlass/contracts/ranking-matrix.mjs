export const DIFFICULTIES = Object.freeze(["heroic", "mythic"]);
export const MATRIX_ID = "midnight-s1-1870-v3";
export const SPEC_EXPECTED_COUNT = 1860;
export const COMP_EXPECTED_COUNT = 10;
export const GLOBAL_EXPECTED_COUNT = SPEC_EXPECTED_COUNT + COMP_EXPECTED_COUNT;
export const MAX_TARGETS_PER_MESSAGE = 20;

const EXPECTED_BOSS_COUNT = 10;
const EXPECTED_SPEC_COUNT = 40;
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
    if (bosses.length !== EXPECTED_BOSS_COUNT) {
        throw new Error(`boss count mismatch: ${bosses.length}`);
    }
    return bosses;
}

export function buildRankingMatrix({ product, roles, specs, season, zones }) {
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
    if (combatSpecs.length !== EXPECTED_SPEC_COUNT) {
        throw new Error(`combat spec count mismatch: ${combatSpecs.length}`);
    }

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
    if (targets.length !== SPEC_EXPECTED_COUNT) {
        throw new Error(`spec target count mismatch: ${targets.length}`);
    }
    for (const bossSlug of bosses) {
        targets.push({
            kind: "comp",
            targetKey: `comp/${bossSlug}`,
            bossSlug,
        });
    }
    if (targets.length !== GLOBAL_EXPECTED_COUNT) {
        throw new Error(`global target count mismatch: ${targets.length}`);
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
