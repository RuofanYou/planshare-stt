import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDiagnosticSinkForTests } from "../diagnostics";
import { bootstrapFailed, bootstrapStarted, bootstrapSucceeded } from "../store/bootstrap";
import { catalogsAccepted, type CatalogsAcceptedPayload } from "../store/catalogCommit";
import { appReducer } from "../store/store";
import BootstrapBoundary from "./BootstrapBoundary";

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

function renderBoundary(setup?: (store: ReturnType<typeof makeStore>) => void) {
    const store = makeStore();
    setup?.(store);
    render(
        <Provider store={store}>
            <BootstrapBoundary>
                <div>受保护内容</div>
            </BootstrapBoundary>
        </Provider>,
    );
    return store;
}

function makeStore() {
    return configureStore({ reducer: appReducer });
}

afterEach(() => {
    setDiagnosticSinkForTests(null);
    vi.unstubAllGlobals();
});

describe("BootstrapBoundary", () => {
    it("idle 与 loading 都显示稳定加载状态并隐藏 children", () => {
        const { rerender } = render(
            <Provider store={makeStore()}>
                <BootstrapBoundary><div>受保护内容</div></BootstrapBoundary>
            </Provider>,
        );
        expect(screen.getByRole("status", { name: "正在载入目标目录" })).toBeVisible();
        expect(screen.queryByText("受保护内容")).not.toBeInTheDocument();

        const loadingStore = makeStore();
        loadingStore.dispatch(bootstrapStarted({ attempt: 1 }));
        rerender(
            <Provider store={loadingStore}>
                <BootstrapBoundary><div>受保护内容</div></BootstrapBoundary>
            </Provider>,
        );
        expect(screen.getByRole("status", { name: "正在载入目标目录" })).toBeVisible();
        expect(screen.queryByText("受保护内容")).not.toBeInTheDocument();
    });

    it("error 显示 alert 和可恢复的重试动作", async () => {
        const user = userEvent.setup();
        const events: string[] = [];
        setDiagnosticSinkForTests((event) => events.push(event));
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("still unavailable")));
        renderBoundary((store) => {
            store.dispatch(bootstrapStarted({ attempt: 1 }));
            store.dispatch(bootstrapFailed({ attempt: 1, error: "安全错误" }));
        });

        expect(screen.getByRole("alert", { name: "目标目录载入失败" })).toBeVisible();
        expect(screen.queryByText("受保护内容")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "重试载入" }));
        expect(events[0]).toBe("bootstrap_retried");
    });

    it("ready 但目录为空时显示独立空状态并复用 reload 动作", async () => {
        const user = userEvent.setup();
        const events: string[] = [];
        setDiagnosticSinkForTests((event) => events.push(event));
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("still empty")));
        renderBoundary((store) => {
            store.dispatch(bootstrapStarted({ attempt: 1 }));
            store.dispatch(bootstrapSucceeded({ attempt: 1 }));
        });

        expect(screen.getByRole("status", { name: "暂时没有可用目标" })).toBeVisible();
        expect(screen.getByRole("button", { name: "重新载入" })).toBeVisible();
        expect(screen.queryByText("受保护内容")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "重新载入" }));
        expect(events[0]).toBe("bootstrap_retried");
    });

    it("仅在 ready 且五份目录可用时渲染 children", () => {
        renderBoundary((store) => {
            store.dispatch(catalogsAccepted(readyCatalogs));
            store.dispatch(bootstrapStarted({ attempt: 1 }));
            store.dispatch(bootstrapSucceeded({ attempt: 1 }));
        });

        expect(screen.getByText("受保护内容")).toBeVisible();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
