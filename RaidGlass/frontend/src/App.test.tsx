import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogsAcceptedPayload } from "./store/catalogCommit";

const rootRender = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
    createRoot: () => ({ render: rootRender }),
}));
vi.mock("./components/GlobalDataLoader", () => ({ default: () => null }));
vi.mock("./components/ProductShell/ProductShell", () => ({
    default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./components/Footer/Footer", () => ({ default: () => null }));
vi.mock("./routes/Index/Index", () => ({ default: () => <div>目录数据页</div> }));
vi.mock("./routes/CompSearch", () => ({ default: () => <div>阵容搜索页</div> }));
vi.mock("./routes/CompRankings/CompRankings", () => ({ default: () => <div>阵容结果页</div> }));
vi.mock("./routes/Help/Help", () => ({ default: () => <div>帮助页可用</div> }));
vi.mock("./routes/DesignPreviews/DesignPreviews", () => ({ default: () => <div>设计预览页</div> }));
vi.mock("./routes/Admin/Admin", () => ({ default: () => <div>管理页</div> }));
vi.mock("./routes/RouteStatePage", () => ({
    default: ({ kind }: { kind: "report-unavailable" | "not-found" }) => (
        <div>{kind === "not-found" ? "页面不存在" : "报告入口已停用"}</div>
    ),
}));

const readyCatalogs: CatalogsAcceptedPayload = {
    classes: {
        mage: {
            name: "Mage",
            name_slug: "mage",
            color: "#3FC7EB",
            specs: ["mage-fire"],
            spec_ids: [63],
        },
    },
    roles: [{
        id: 4,
        code: "rdps",
        name: "Range",
        specs: ["mage-fire"],
        spec_ids: [63],
        metrics: ["dps"],
    }],
    specs: [{
        id: 63,
        index: 1,
        class: { name: "Mage", name_slug: "mage" },
        role: "rdps",
        name: "Fire",
        full_name: "Fire Mage",
        full_name_slug: "mage-fire",
    }],
    seasons: { name: "Season", slug: "season", raids: [46.1] },
    bosses: [{
        id: 46.1,
        name: "Raid",
        name_slug: "raid",
        bosses: [{
            id: 1,
            name: "Boss",
            full_name: "Full Boss",
            full_name_slug: "boss",
            icon: "boss.jpg",
            phase_type: "static",
        }],
    }],
};

async function renderAppAt(
    pathname: string,
    development: boolean,
    bootstrapStatus: "error" | "ready" = "error",
) {
    window.history.replaceState({}, "", `/log${pathname === "/" ? "/" : pathname}`);
    vi.stubEnv("DEV", development);
    vi.resetModules();
    rootRender.mockClear();

    const [{ default: store }, bootstrap, catalogs] = await Promise.all([
        import("./store/store"),
        import("./store/bootstrap"),
        import("./store/catalogCommit"),
    ]);
    store.dispatch(bootstrap.bootstrapStarted({ attempt: 1 }));
    if (bootstrapStatus === "ready") {
        store.dispatch(catalogs.catalogsAccepted(readyCatalogs));
        store.dispatch(bootstrap.bootstrapSucceeded({ attempt: 1 }));
    } else {
        store.dispatch(bootstrap.bootstrapFailed({ attempt: 1, error: "目录服务暂不可用" }));
    }

    await import("./App");
    const app = rootRender.mock.calls[0]?.[0];
    expect(app, "App 应挂载到根节点").toBeDefined();
    render(app);
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("App bootstrap 路由边界", () => {
    it.each([
        ["/help", "帮助页可用"],
        ["/user_report/REPORT-1", "报告入口已停用"],
        ["/missing/path", "页面不存在"],
    ])("bootstrap 失败时公共恢复路径 %s 仍可访问", async (pathname, visibleText) => {
        await renderAppAt(pathname, false);

        expect(await screen.findByText(visibleText)).toBeVisible();
        expect(screen.queryByRole("alert", { name: "目标目录载入失败" })).not.toBeInTheDocument();
    });

    it("bootstrap 失败时依赖目录的数据路径仍显示可恢复状态", async () => {
        await renderAppAt("/comp_ranking/search", false);

        expect(await screen.findByRole("alert", { name: "目标目录载入失败" })).toBeVisible();
        expect(screen.queryByText("阵容搜索页")).not.toBeInTheDocument();
    });
});

describe("App 内部路由环境边界", () => {
    it.each(["/design-previews", "/lorgmin/ping"])(
        "生产环境访问 %s 返回公共 404",
        async (pathname) => {
            await renderAppAt(pathname, false);

            expect(await screen.findByText("页面不存在")).toBeVisible();
            expect(screen.queryByText("设计预览页")).not.toBeInTheDocument();
            expect(screen.queryByText("管理页")).not.toBeInTheDocument();
        },
    );

    it.each([
        ["/design-previews", "设计预览页"],
        ["/lorgmin/ping", "管理页"],
    ])("开发环境保留内部路径 %s", async (pathname, visibleText) => {
        await renderAppAt(pathname, true, "ready");

        expect(await screen.findByText(visibleText)).toBeVisible();
    });
});
