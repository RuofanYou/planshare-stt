export function expectRecord(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`元数据格式错误：${path} 应为对象`);
    }
    return value as Record<string, unknown>;
}

export function expectArray(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) {
        throw new Error(`元数据格式错误：${path} 应为数组`);
    }
    return value;
}

export function expectString(value: unknown, path: string): string {
    if (typeof value !== "string") {
        throw new Error(`元数据格式错误：${path} 应为字符串`);
    }
    return value;
}

export function expectNonEmptyString(value: unknown, path: string): string {
    const result = expectString(value, path);
    if (result.trim().length === 0) {
        throw new Error(`元数据格式错误：${path} 不能为空`);
    }
    return result;
}

export function expectRouteSegment(value: unknown, path: string): string {
    const result = expectNonEmptyString(value, path);
    if (!/^[A-Za-z0-9._~!$&'()*+,;=:@-]+$/.test(result)
        || result === "."
        || result === "..") {
        throw new Error(`元数据格式错误：${path} 不是安全路径段`);
    }
    return result;
}

export function expectFiniteNumber(value: unknown, path: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`元数据格式错误：${path} 应为有限数字`);
    }
    return value;
}

export function expectNullableFiniteNumber(value: unknown, path: string): number | null {
    if (value === null) return null;
    return expectFiniteNumber(value, path);
}

export function expectStringArray(value: unknown, path: string): string[] {
    return expectArray(value, path).map((item, index) => (
        expectNonEmptyString(item, `${path}[${index}]`)
    ));
}

export function expectRouteSegmentArray(value: unknown, path: string): string[] {
    return expectArray(value, path).map((item, index) => (
        expectRouteSegment(item, `${path}[${index}]`)
    ));
}

export function expectNullableNumberArray(value: unknown, path: string): Array<number | null> {
    return expectArray(value, path).map((item, index) => (
        expectNullableFiniteNumber(item, `${path}[${index}]`)
    ));
}

export function assertUnique(values: readonly (string | number)[], path: string): void {
    if (new Set(values).size !== values.length) {
        throw new Error(`元数据格式错误：${path} 含重复标识`);
    }
}
