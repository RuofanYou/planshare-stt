import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiPayloadError, fetch_data } from "./api";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetch_data", () => {
    it("相对 API 请求统一落在 /log 下", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ));
        vi.stubGlobal("fetch", fetchMock);

        await fetch_data("/api/example");

        expect(fetchMock).toHaveBeenCalledWith("/log/api/example");
    });

    it("HTTP 200 的错误载荷会抛出结构化异常", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ detail: "Not found." }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        )));

        await expect(fetch_data("/api/example")).rejects.toBeInstanceOf(ApiPayloadError);
    });

    it("非 2xx 响应会抛错", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ detail: "Not found." }),
            { status: 404, headers: { "Content-Type": "application/json" } },
        )));

        await expect(fetch_data("/api/example")).rejects.toMatchObject({ status: 404 });
    });
});
