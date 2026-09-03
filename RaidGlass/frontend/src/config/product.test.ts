import { describe, expect, it } from "vitest";

import { PRODUCT_CONFIG } from "./product";

describe("PRODUCT_CONFIG", () => {
    it("固定发布前 10 名", () => {
        expect(PRODUCT_CONFIG.rankingTopN).toBe(10);
        expect(PRODUCT_CONFIG.deploymentManifestSchemaVersion).toBe(2);
        expect(PRODUCT_CONFIG.combatRoles).toEqual(["mdps", "rdps", "heal", "tank"]);
    });
});
