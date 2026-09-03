import type { Page } from "@playwright/test";

const GENERIC_RESOURCE_FAILURE = /^Failed to load resource: the server responded with a status of \d{3}/;

export function collectRuntimeFailures(page: Page) {
    const failures: string[] = [];
    let pageOrigin = "";
    page.on("console", (message) => {
        if (message.type() !== "error") return;
        if (GENERIC_RESOURCE_FAILURE.test(message.text())) return;
        failures.push(`console:${message.text()}`);
    });
    page.on("pageerror", (error) => failures.push(`page:${error.message}`));
    page.on("response", (response) => {
        const url = new URL(response.url());
        if (response.request().resourceType() === "document") pageOrigin = url.origin;
        if (pageOrigin && url.origin === pageOrigin && response.status() >= 400) {
            failures.push(`http:${response.status()}:${url.pathname}`);
        }
    });
    return failures;
}
