import { createAction } from "@reduxjs/toolkit";

import type { BossCatalogPayload } from "./bosses";
import type { ClassesCatalogPayload } from "./classes";
import type { RolesCatalogPayload } from "./roles";
import type { SeasonCatalogPayload } from "./seasons";
import type { SpecsCatalogPayload } from "./specs";

export interface CatalogsAcceptedPayload {
    classes: ClassesCatalogPayload;
    roles: RolesCatalogPayload;
    specs: SpecsCatalogPayload;
    seasons: SeasonCatalogPayload;
    bosses: BossCatalogPayload;
}

export const catalogsAccepted = createAction<CatalogsAcceptedPayload>("catalogs/accepted");
