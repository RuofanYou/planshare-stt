import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.RAIDGLASS_E2E_BASE_URL;
const outputRoot = process.env.RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT;
const useSystemChrome = process.env.RAIDGLASS_E2E_SYSTEM_CHROME === "1";

if (!outputRoot) {
    throw new Error("RAIDGLASS_PLAYWRIGHT_OUTPUT_ROOT must be provided by the E2E runner");
}

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: { timeout: externalBaseURL ? 15_000 : 5_000 },
    fullyParallel: false,
    retries: 0,
    reporter: "line",
    outputDir: outputRoot,
    workers: externalBaseURL ? 1 : undefined,
    use: {
        baseURL: externalBaseURL || "http://127.0.0.1:4174",
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
        locale: "zh-CN",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: externalBaseURL ? undefined : {
        command: "node scripts/serve-build.mjs",
        url: "http://127.0.0.1:4174/log/api/classes",
        timeout: 30_000,
        reuseExistingServer: false,
    },
});
