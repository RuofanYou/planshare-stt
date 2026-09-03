import type Fight from "../../types/fight";
import type { FightComposition } from "../../types/fight";

export type CompOperator = "eq" | "lt" | "gt" | "lte" | "gte";
export type CompCountGroup = "role" | "spec";

export interface CompCountCriterion {
    group: CompCountGroup;
    key: string;
    op: CompOperator;
    count: number;
}

export interface CompCriteria {
    counts: CompCountCriterion[];
    killtimeMinSeconds: number | null;
    killtimeMaxSeconds: number | null;
}

export interface ParsedCompCriteria {
    criteria: CompCriteria;
    errors: string[];
}

export interface CompCriteriaCatalog {
    roleKeys: ReadonlySet<string>;
    specKeys: ReadonlySet<string>;
}

const OPERATORS = new Set<CompOperator>(["eq", "lt", "gt", "lte", "gte"]);

export function buildCompCriteriaCatalog(
    roles: Readonly<Record<string, unknown>>,
    specs: Readonly<Record<string, unknown>>,
): CompCriteriaCatalog {
    return {
        roleKeys: new Set(Object.keys(roles)),
        specKeys: new Set(Object.keys(specs)),
    };
}

function nonNegativeInteger(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function isCompOperator(value: string | undefined): value is CompOperator {
    return value !== undefined && OPERATORS.has(value as CompOperator);
}

function compareCountCriteria(left: CompCountCriterion, right: CompCountCriterion): number {
    const leftKey = `${left.group}/${left.key}/${left.op}/${left.count}`;
    const rightKey = `${right.group}/${right.key}/${right.op}/${right.count}`;
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
}

export function parseCompCriteria(
    search: string,
    catalog: CompCriteriaCatalog,
): ParsedCompCriteria {
    const criteria: CompCriteria = {
        counts: [],
        killtimeMinSeconds: null,
        killtimeMaxSeconds: null,
    };
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const [name, value] of new URLSearchParams(search)) {
        if (name === "role" || name === "spec") {
            const [key, rawOp, rawCount, extra] = value.split(".");
            const count = nonNegativeInteger(rawCount ?? "");
            if (!key || extra !== undefined || !isCompOperator(rawOp) || count === null) {
                errors.push(`${name} 条件格式无效: ${value}`);
                continue;
            }

            const identity = `${name}:${key}`;
            if (seen.has(identity)) {
                errors.push(`重复阵容条件: ${name}.${key}`);
                continue;
            }
            seen.add(identity);

            const allowedKeys = name === "role" ? catalog.roleKeys : catalog.specKeys;
            if (!allowedKeys.has(key)) {
                errors.push(name === "role" ? `未知职责条件: ${key}` : `未知专精条件: ${key}`);
                continue;
            }

            criteria.counts.push({ group: name, key, op: rawOp, count });
            continue;
        }

        if (name === "killtime_min" || name === "killtime_max") {
            if (seen.has(name)) {
                errors.push(`重复阵容参数: ${name}`);
                continue;
            }
            seen.add(name);

            const seconds = nonNegativeInteger(value);
            if (seconds === null) {
                errors.push(`${name} 必须是非负整数秒`);
            } else if (seconds > 0) {
                if (name === "killtime_min") criteria.killtimeMinSeconds = seconds;
                else criteria.killtimeMaxSeconds = seconds;
            }
            continue;
        }

        errors.push(`未知阵容参数: ${name}`);
    }

    criteria.counts.sort(compareCountCriteria);
    if (
        criteria.killtimeMinSeconds !== null
        && criteria.killtimeMaxSeconds !== null
        && criteria.killtimeMinSeconds > criteria.killtimeMaxSeconds
    ) {
        errors.push("最短击杀时间不能大于最长击杀时间");
    }

    return { criteria, errors };
}

export function serializeCompCriteria(criteria: CompCriteria): string {
    const params = new URLSearchParams();
    [...criteria.counts]
        .sort(compareCountCriteria)
        .forEach(({ group, key, op, count }) => {
            params.append(group, `${key}.${op}.${count}`);
        });
    if (criteria.killtimeMinSeconds) {
        params.set("killtime_min", String(criteria.killtimeMinSeconds));
    }
    if (criteria.killtimeMaxSeconds) {
        params.set("killtime_max", String(criteria.killtimeMaxSeconds));
    }
    return params.toString();
}

function isCompCountMap(value: unknown): value is Record<string, number> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).every((count) => Number.isSafeInteger(count) && count >= 0);
}

function isFightComposition(value: unknown): value is FightComposition {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const composition = value as Record<string, unknown>;
    return isCompCountMap(composition.roles)
        && isCompCountMap(composition.specs)
        && isCompCountMap(composition.classes);
}

export function assertCompFightComposition(
    fight: { composition?: unknown },
): asserts fight is { composition: FightComposition } {
    if (!isFightComposition(fight.composition)) {
        throw new Error("阵容样本 composition 无效");
    }
}

function matchesCount(actual: number, op: CompOperator, expected: number): boolean {
    if (op === "eq") return actual === expected;
    if (op === "lt") return actual < expected;
    if (op === "gt") return actual > expected;
    if (op === "lte") return actual <= expected;
    return actual >= expected;
}

export function matchesCompFight(fight: Fight, criteria: CompCriteria): boolean {
    assertCompFightComposition(fight);
    const durationSeconds = fight.duration / 1000;
    if (criteria.killtimeMinSeconds !== null && durationSeconds < criteria.killtimeMinSeconds) {
        return false;
    }
    if (criteria.killtimeMaxSeconds !== null && durationSeconds > criteria.killtimeMaxSeconds) {
        return false;
    }
    return criteria.counts.every(({ group, key, op, count }) => {
        const values = group === "role" ? fight.composition.roles : fight.composition.specs;
        const actual = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : 0;
        return matchesCount(actual, op, count);
    });
}

export function buildCompReferencePath(bossSlug: string, criteria: CompCriteria): string {
    const search = serializeCompCriteria(criteria);
    return `/comp_ranking/${bossSlug}${search ? `?${search}` : ""}`;
}

export function compTargetKey(bossSlug: string, criteria: CompCriteria): string {
    const search = serializeCompCriteria(criteria);
    return `comp/${bossSlug}${search ? `?${search}` : ""}`;
}

export function parseCompTargetKey(
    targetKey: string,
    catalog: CompCriteriaCatalog,
    bossKeys: ReadonlySet<string>,
): { bossSlug: string; criteria: CompCriteria } | null {
    if (!targetKey.startsWith("comp/")) return null;

    const target = targetKey.slice("comp/".length);
    const queryIndex = target.indexOf("?");
    const bossSlug = queryIndex === -1 ? target : target.slice(0, queryIndex);
    const search = queryIndex === -1 ? "" : target.slice(queryIndex + 1);
    if (!bossKeys.has(bossSlug)) return null;

    const parsed = parseCompCriteria(search, catalog);
    if (parsed.errors.length > 0 || compTargetKey(bossSlug, parsed.criteria) !== targetKey) {
        return null;
    }
    return { bossSlug, criteria: parsed.criteria };
}
