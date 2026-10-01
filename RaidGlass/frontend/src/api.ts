import { APP_BASE_URL, BACKEND_URL } from "./constants";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue> | URLSearchParams | string;

export class ApiPayloadError extends Error {
    status: number;
    url: string;

    constructor(message: string, { status, url }: { status: number; url: string }) {
        super(message);
        this.name = "ApiPayloadError";
        this.status = status;
        this.url = url;
    }
}

function queryString(params: QueryParams) {
    if (typeof params === "string") {
        return params.replace(/^\?/, "");
    }
    if (params instanceof URLSearchParams) {
        return params.toString();
    }

    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            search.set(key, String(value));
        }
    });
    return search.toString();
}

function payloadError(data: unknown) {
    if (!data || typeof data !== "object") {
        return "";
    }

    const payload = data as Record<string, unknown>;
    const errors = Array.isArray(payload.errors)
        ? payload.errors.length > 0
        : Boolean(payload.errors);
    if (!payload.error && !payload.detail && !errors) {
        return "";
    }

    const reason = payload.detail || payload.error || payload.errors;
    return typeof reason === "string" ? reason : JSON.stringify(reason);
}

export async function fetch_data<T = any>(url: string, params: QueryParams = {}, options?: RequestInit): Promise<T> {
    const search = queryString(params);
    if (search) {
        url = `${url}?${search}`;
    }

    const requestUrl = (BACKEND_URL || APP_BASE_URL) + url;
    const response = await (options ? fetch(requestUrl, options) : fetch(requestUrl));
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new ApiPayloadError("接口返回了无法解析的 JSON", {
            status: response.status,
            url: requestUrl,
        });
    }

    const errorReason = payloadError(data);
    if (!response.ok || errorReason) {
        throw new ApiPayloadError(errorReason || response.statusText || "接口请求失败", {
            status: response.status,
            url: requestUrl,
        });
    }

    return data as T;
}
