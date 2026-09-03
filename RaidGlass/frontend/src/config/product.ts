import productConfig from "../../config/product.json";

export const PRODUCT_CONFIG = Object.freeze({
    rankingTopN: productConfig.rankingTopN as 10,
    deploymentManifestSchemaVersion: productConfig.deploymentManifestSchemaVersion as 2,
    combatRoles: Object.freeze([...productConfig.combatRoles]) as readonly string[],
});
