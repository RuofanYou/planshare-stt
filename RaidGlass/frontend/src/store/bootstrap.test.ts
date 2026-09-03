import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../diagnostics";
import {
    BOOTSTRAP_LOADING_KEYS,
    bootstrapFailed,
    bootstrapStarted,
    loadBootstrapData,
} from "./bootstrap";
import { load_current_season_bosses, validateBossCatalog } from "./bosses";
import { catalogsAccepted, type CatalogsAcceptedPayload } from "./catalogCommit";
import { load_classes } from "./classes";
import { load_roles, validateRolesCatalog } from "./roles";
import { load_season } from "./seasons";
import { load_specs, validateSpecsCatalog } from "./specs";
import { appReducer } from "./store";

function makeCatalogs(prefix: string): CatalogsAcceptedPayload {
    const classSlug = `${prefix}-class`;
    const roleCode = `${prefix}-role`;
    const specSlug = `${prefix}-spec`;
    const bossSlug = `${prefix}-boss`;

    return {
        classes: {
            [classSlug]: {
                name: `${prefix} Class`,
                name_slug: classSlug,
                color: "#123456",
                specs: [specSlug],
                spec_ids: [1],
            },
        },
        roles: [{
            id: 1,
            code: roleCode,
            name: `${prefix} Role`,
            specs: [specSlug],
            spec_ids: [1],
            metrics: ["dps"],
        }],
        specs: [{
            id: 1,
            index: 1,
            class: { name: `${prefix} Class`, name_slug: classSlug },
            role: roleCode,
            name: `${prefix} Spec`,
            full_name: `${prefix} Full Spec`,
            full_name_slug: specSlug,
        }],
        seasons: {
            name: `${prefix} Season`,
            slug: `${prefix}-season`,
            raids: [46.1],
        },
        bosses: [{
            id: 46.1,
            name: `${prefix} Zone`,
            name_slug: `${prefix}-zone`,
            bosses: [{
                id: 1001,
                name: `${prefix} Boss`,
                full_name: `${prefix} Full Boss`,
                full_name_slug: bossSlug,
                icon: `${prefix}-boss.jpg`,
                phase_type: "static",
            }],
        }],
    };
}

function apiPayloads(catalogs: CatalogsAcceptedPayload): Record<string, unknown> {
    return {
        "/log/api/classes": catalogs.classes,
        "/log/api/roles": { roles: catalogs.roles },
        "/log/api/specs": { specs: catalogs.specs },
        "/log/api/seasons/current": catalogs.seasons,
        "/log/api/current_season/zones": catalogs.bosses,
    };
}

function requestPath(input: RequestInfo | URL): string {
    const value = input instanceof Request ? input.url : String(input);
    return new URL(value, "https://raidglass.test").pathname;
}

function installCatalogFetch(
    catalogs: CatalogsAcceptedPayload,
    overrides: Record<string, unknown | Error> = {},
) {
    const payloads = { ...apiPayloads(catalogs), ...overrides };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const value = payloads[requestPath(input)];
        if (value instanceof Error) throw value;
        if (value === undefined) throw new Error(`未声明的测试请求：${requestPath(input)}`);
        return new Response(JSON.stringify(value), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function stateCatalogKeys(state: ReturnType<typeof appReducer>) {
    return {
        classes: Object.keys(state.classes.classes),
        roles: Object.keys(state.roles),
        specs: Object.keys(state.specs.specs_by_name),
        seasons: Object.keys(state.seasons.seasons),
        zones: Object.keys(state.zones.zones),
        bosses: Object.keys(state.zones.bosses),
    };
}

afterEach(() => {
    setDiagnosticSinkForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("bootstrap 原子目录状态", () => {
    it("从 idle 同步进入 loading，五份验证后原子进入 ready", async () => {
        const store = configureStore({ reducer: appReducer });
        const next = makeCatalogs("next");
        installCatalogFetch(next);

        const pending = store.dispatch(loadBootstrapData());

        expect(store.getState().bootstrap).toEqual({
            status: "loading",
            error: null,
            attempt: 1,
        });
        BOOTSTRAP_LOADING_KEYS.forEach((key) => {
            expect(store.getState().ui._loading[key]).toBe(true);
        });

        await pending;

        expect(store.getState().bootstrap).toEqual({
            status: "ready",
            error: null,
            attempt: 1,
        });
        expect(stateCatalogKeys(store.getState())).toEqual({
            classes: ["next-class"],
            roles: ["next-role"],
            specs: ["next-spec"],
            seasons: ["next-season"],
            zones: ["46.1"],
            bosses: ["next-boss"],
        });
        expect(store.getState().zones.bosses["next-boss"].zone_id).toBe(46.1);
        BOOTSTRAP_LOADING_KEYS.forEach((key) => {
            expect(store.getState().ui._loading[key]).toBe(false);
        });
    });

    it("loading 期间忽略第二次非 retry 调用", async () => {
        const store = configureStore({ reducer: appReducer });
        const next = makeCatalogs("dedupe");
        const payloads = apiPayloads(next);
        const resolvers: Array<(response: Response) => void> = [];
        const fetchMock = vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
            resolvers.push(() => resolve(new Response(JSON.stringify(payloads[requestPath(input)]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })));
        }));
        vi.stubGlobal("fetch", fetchMock);

        const first = store.dispatch(loadBootstrapData());
        await store.dispatch(loadBootstrapData());

        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(store.getState().bootstrap.attempt).toBe(1);
        resolvers.forEach((resolve) => resolve(new Response()));
        await first;
    });

    it("loading 中显式 retry 接管 attempt，旧批次完成后不会覆盖或提前清 loading", async () => {
        const store = configureStore({ reducer: appReducer });
        const previous = makeCatalogs("previous");
        store.dispatch(catalogsAccepted(previous));
        const oldPayloads = apiPayloads(makeCatalogs("slow"));
        const oldResolvers: Array<() => void> = [];
        vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
            oldResolvers.push(() => resolve(new Response(
                JSON.stringify(oldPayloads[requestPath(input)]),
                { status: 200, headers: { "Content-Type": "application/json" } },
            )));
        })));
        const first = store.dispatch(loadBootstrapData());

        const retryPayloads = apiPayloads(makeCatalogs("retry-owner"));
        const retryResolvers: Array<() => void> = [];
        vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
            retryResolvers.push(() => resolve(new Response(
                JSON.stringify(retryPayloads[requestPath(input)]),
                { status: 200, headers: { "Content-Type": "application/json" } },
            )));
        })));
        const retry = store.dispatch(loadBootstrapData({ retry: true }));

        oldResolvers.forEach((resolve) => resolve());
        await first;

        expect(store.getState().bootstrap).toEqual({
            status: "loading",
            error: null,
            attempt: 2,
        });
        expect(stateCatalogKeys(store.getState()).bosses).toEqual(["previous-boss"]);
        BOOTSTRAP_LOADING_KEYS.forEach((key) => {
            expect(store.getState().ui._loading[key]).toBe(true);
        });

        retryResolvers.forEach((resolve) => resolve());
        await retry;

        expect(store.getState().bootstrap).toEqual({
            status: "ready",
            error: null,
            attempt: 2,
        });
        expect(stateCatalogKeys(store.getState()).bosses).toEqual(["retry-owner-boss"]);
        BOOTSTRAP_LOADING_KEYS.forEach((key) => {
            expect(store.getState().ui._loading[key]).toBe(false);
        });
    });

    it("任一请求失败时保留五份旧代目录且清理 loading", async () => {
        const store = configureStore({ reducer: appReducer });
        const previous = makeCatalogs("old");
        const next = makeCatalogs("new");
        store.dispatch(catalogsAccepted(previous));
        const previousSlices = {
            classes: store.getState().classes,
            roles: store.getState().roles,
            specs: store.getState().specs,
            seasons: store.getState().seasons,
            zones: store.getState().zones,
        };
        installCatalogFetch(next, {
            "/log/api/current_season/zones": new Error("zones unavailable"),
        });

        await store.dispatch(loadBootstrapData());

        expect(store.getState().bootstrap.status).toBe("error");
        expect(store.getState().classes).toBe(previousSlices.classes);
        expect(store.getState().roles).toBe(previousSlices.roles);
        expect(store.getState().specs).toBe(previousSlices.specs);
        expect(store.getState().seasons).toBe(previousSlices.seasons);
        expect(store.getState().zones).toBe(previousSlices.zones);
        expect(stateCatalogKeys(store.getState()).bosses).toEqual(["old-boss"]);
        BOOTSTRAP_LOADING_KEYS.forEach((key) => {
            expect(store.getState().ui._loading[key]).toBe(false);
        });
    });

    it("接受生产端已证明的派生字段缺省与 nullable 标识", async () => {
        const store = configureStore({ reducer: appReducer });
        const productionShape = makeCatalogs("production");
        productionShape.classes["production-class"].spec_ids = [null];
        productionShape.roles[0].spec_ids = [null];
        productionShape.specs[0].id = null;
        productionShape.specs[0].index = null;
        productionShape.bosses[0].bosses[0].full_name_slug = "vaelgor-&-ezzorak";
        installCatalogFetch(productionShape);

        await store.dispatch(loadBootstrapData());

        expect(store.getState().bootstrap.status).toBe("ready");
        expect(store.getState().classes.classes["production-class"].id).toBeUndefined();
        expect(store.getState().specs.specs_by_name["production-spec"].spells_by_type)
            .toEqual({});
        expect(store.getState().zones.bosses["vaelgor-&-ezzorak"].zone_id).toBe(46.1);
    });

    it.each([
        ["错误顶层", { "/log/api/classes": [] }],
        ["缺少条目标识", {
            "/log/api/classes": {
                broken: {
                    name: "Broken",
                    color: "#000000",
                    specs: [],
                    spec_ids: [],
                },
            },
        }],
    ])("畸形 200：%s 进入 error 且不提交新代", async (_label, overrides) => {
        const store = configureStore({ reducer: appReducer });
        store.dispatch(catalogsAccepted(makeCatalogs("old")));
        installCatalogFetch(makeCatalogs("new"), overrides);

        await store.dispatch(loadBootstrapData());

        expect(store.getState().bootstrap.status).toBe("error");
        expect(stateCatalogKeys(store.getState()).bosses).toEqual(["old-boss"]);
    });

    it.each([
        "classes.spec_ids",
        "roles.spec_ids",
        "bosses.icon",
    ] as const)("必填生产字段缺失：%s 拒绝整代提交", async (missingField) => {
        const acceptedActions: string[] = [];
        const observer: Middleware = () => (next) => (action) => {
            if (typeof action === "object" && action && "type" in action) {
                acceptedActions.push(String(action.type));
            }
            return next(action);
        };
        const store = configureStore({
            reducer: appReducer,
            middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(observer),
        });
        const previous = makeCatalogs("old");
        const next = makeCatalogs("new");
        store.dispatch(catalogsAccepted(previous));
        acceptedActions.length = 0;
        const previousSlices = {
            classes: store.getState().classes,
            roles: store.getState().roles,
            specs: store.getState().specs,
            seasons: store.getState().seasons,
            zones: store.getState().zones,
        };

        let endpoint: string;
        let malformed: unknown;
        if (missingField === "classes.spec_ids") {
            const classes = structuredClone(next.classes);
            delete (classes["new-class"] as { spec_ids?: Array<number | null> }).spec_ids;
            endpoint = "/log/api/classes";
            malformed = classes;
        } else if (missingField === "roles.spec_ids") {
            const roles = structuredClone(next.roles);
            delete (roles[0] as { spec_ids?: Array<number | null> }).spec_ids;
            endpoint = "/log/api/roles";
            malformed = { roles };
        } else {
            const zones = structuredClone(next.bosses);
            delete (zones[0].bosses[0] as { icon?: string }).icon;
            endpoint = "/log/api/current_season/zones";
            malformed = zones;
        }
        installCatalogFetch(next, { [endpoint]: malformed });

        await store.dispatch(loadBootstrapData());

        expect(store.getState().bootstrap.status).toBe("error");
        expect(acceptedActions).not.toContain(catalogsAccepted.type);
        expect(store.getState().classes).toBe(previousSlices.classes);
        expect(store.getState().roles).toBe(previousSlices.roles);
        expect(store.getState().specs).toBe(previousSlices.specs);
        expect(store.getState().seasons).toBe(previousSlices.seasons);
        expect(store.getState().zones).toBe(previousSlices.zones);
    });

    it("retry 的诊断有序且成功 attempt 精确递增", async () => {
        const store = configureStore({ reducer: appReducer });
        const next = makeCatalogs("retry");
        installCatalogFetch(next, {
            "/log/api/classes": new Error("first failure"),
        });
        await store.dispatch(loadBootstrapData());

        const events: string[] = [];
        setDiagnosticSinkForTests((event) => events.push(event));
        installCatalogFetch(next);
        await store.dispatch(loadBootstrapData({ retry: true }));

        expect(events).toEqual([
            "bootstrap_retried",
            "bootstrap_started",
            "bootstrap_succeeded",
        ]);
        expect(store.getState().bootstrap).toEqual({
            status: "ready",
            error: null,
            attempt: 2,
        });
    });

    it("单个 catalogsAccepted 同时替换五份目录，ready 在下一 action 才发布", async () => {
        const snapshots: Array<{
            action: string;
            status: string;
            keys: ReturnType<typeof stateCatalogKeys>;
        }> = [];
        const observer: Middleware = (storeApi) => (next) => (action) => {
            const result = next(action);
            if (typeof action === "object" && action && "type" in action) {
                const state = storeApi.getState() as ReturnType<typeof appReducer>;
                snapshots.push({
                    action: String(action.type),
                    status: state.bootstrap.status,
                    keys: stateCatalogKeys(state),
                });
            }
            return result;
        };
        const store = configureStore({
            reducer: appReducer,
            middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(observer),
        });
        store.dispatch(catalogsAccepted(makeCatalogs("old")));
        snapshots.length = 0;
        installCatalogFetch(makeCatalogs("new"));

        await store.dispatch(loadBootstrapData());

        const commits = snapshots.filter(({ action }) => action === catalogsAccepted.type);
        expect(commits).toHaveLength(1);
        const commitIndex = snapshots.findIndex(({ action }) => action === catalogsAccepted.type);
        const oldKeys = {
            classes: ["old-class"],
            roles: ["old-role"],
            specs: ["old-spec"],
            seasons: ["old-season"],
            zones: ["46.1"],
            bosses: ["old-boss"],
        };
        snapshots.slice(0, commitIndex).forEach(({ keys }) => {
            expect(keys).toEqual(oldKeys);
        });
        expect(commits[0]).toMatchObject({
            status: "loading",
            keys: {
                classes: ["new-class"],
                roles: ["new-role"],
                specs: ["new-spec"],
                seasons: ["new-season"],
                zones: ["46.1"],
                bosses: ["new-boss"],
            },
        });
        expect(snapshots.find(({ status }) => status === "ready")?.keys)
            .toEqual(commits[0].keys);
    });

    it("完整替换会移除过期 key，也接受五份有效空目录", () => {
        const store = configureStore({ reducer: appReducer });
        const payload = makeCatalogs("frozen");
        const before = structuredClone(payload);
        store.dispatch(catalogsAccepted(payload));
        expect(payload).toEqual(before);

        store.dispatch(catalogsAccepted({
            classes: {},
            roles: [],
            specs: [],
            seasons: { name: "Empty", slug: "empty", raids: [] },
            bosses: [],
        }));

        expect(stateCatalogKeys(store.getState())).toEqual({
            classes: [],
            roles: [],
            specs: [],
            seasons: ["empty"],
            zones: [],
            bosses: [],
        });
    });

    it.each([
        ["classes", "classes", load_classes],
        ["roles", "roles", load_roles],
        ["specs", "specs", load_specs],
        ["season", "season", load_season],
        ["bosses", "current-season-zones", load_current_season_bosses],
    ] as const)("独立 %s loader 重新抛出原错误并清理 loading", async (_name, key, thunkFactory) => {
        const store = configureStore({ reducer: appReducer });
        const failure = new Error(`${key} failure`);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

        await expect(store.dispatch(thunkFactory())).rejects.toBe(failure);
        expect(store.getState().ui._loading[key]).toBe(false);
    });

    it("公开 bootstrap action 保持可预测状态转换", () => {
        const store = configureStore({ reducer: appReducer });
        store.dispatch(bootstrapStarted({ attempt: 3 }));
        store.dispatch(bootstrapFailed({ attempt: 3, error: "安全错误" }));
        expect(store.getState().bootstrap).toEqual({
            status: "error",
            error: "安全错误",
            attempt: 3,
        });
    });
});

describe("catalog 严格 validator", () => {
    const role = {
        id: 1,
        code: "rdps",
        name: "Range",
        specs: ["mage-fire"],
        spec_ids: [63],
        metrics: ["dps"],
    };
    const spec = {
        id: 63,
        index: 1,
        class: { name: "Mage", name_slug: "mage" },
        role: "rdps",
        name: "Fire",
        full_name: "Fire Mage",
        full_name_slug: "mage-fire",
    };
    const boss = {
        id: 1,
        name: "Boss",
        full_name: "Full Boss",
        full_name_slug: "boss",
        icon: "boss.jpg",
        phase_type: "static",
    };
    const zone = {
        id: 46.1,
        name: "Raid",
        name_slug: "raid",
        bosses: [boss],
    };

    it.each([
        ["重复 role code", () => validateRolesCatalog({ roles: [role, role] })],
        ["重复 spec slug", () => validateSpecsCatalog({ specs: [spec, spec] })],
        ["错误 nullable id", () => validateSpecsCatalog({
            specs: [{ ...spec, id: "63" }],
        })],
        ["重复 zone id", () => validateBossCatalog([
            zone,
            { ...zone, name_slug: "raid-two", bosses: [{ ...boss, full_name_slug: "boss-two" }] },
        ])],
        ["重复全局 boss slug", () => validateBossCatalog([
            zone,
            { ...zone, id: 46.2, name_slug: "raid-two" },
        ])],
        ["非法 phase_type", () => validateBossCatalog([
            { ...zone, bosses: [{ ...boss, phase_type: "timed" }] },
        ])],
        ["spec slug 破坏路径", () => validateSpecsCatalog({
            specs: [{ ...spec, full_name_slug: "mage/fire" }],
        })],
        ["spec slug 含控制字符", () => validateSpecsCatalog({
            specs: [{ ...spec, full_name_slug: "mage\u0000fire" }],
        })],
        ["spec slug 含非 ASCII 字符", () => validateSpecsCatalog({
            specs: [{ ...spec, full_name_slug: "法师-fire" }],
        })],
        ["spec slug 含浏览器重编码字符", () => validateSpecsCatalog({
            specs: [{ ...spec, full_name_slug: "mage\"fire" }],
        })],
        ["boss slug 带首尾空白", () => validateBossCatalog([
            { ...zone, bosses: [{ ...boss, full_name_slug: " boss " }] },
        ])],
    ])("拒绝%s", (_label, validate) => {
        expect(validate).toThrow(/元数据格式错误/);
    });
});
