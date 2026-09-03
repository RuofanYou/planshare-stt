/*
    Component to display a comp or comp-search.
    >>> eg.: 2x Tank, 4+ Healers, max 2x Holy Paladin

    Used for the CompSearch and CompRankings.

*/
import { useMemo } from "react";

import { ZH_CN } from "../localization/zhCN";
import { useAppSelector } from "../store/store_hooks";
import styles from "./CompPreview.module.scss";
import WebpImg from "./WebpImg";

export interface CompCountType {
    /**  number as string */
    count: string;

    /** allow any string to make it easier to set */
    op: "eq" | "lt" | "gt" | "lte" | "gte" | string;
}

export interface CompCountMap {
    [key: string]: CompCountType;
}

// convert "eq", "lt", "gt" etc to "<", ">""
function op_to_symbol(op: string) {
    if (op == "eq") {
        return "";
    }
    if (op == "lt") {
        return "<";
    }
    if (op == "gt") {
        return ">";
    }
    if (op == "lte") {
        return "≤";
    }
    if (op == "gte") {
        return "≥";
    }
    return "";
}

interface PreviewCatalogEntry {
    classSlug: string;
    iconPath: string;
    label: string;
}

function create_icon(
    name: string,
    count: string,
    op: string,
    entry: PreviewCatalogEntry | undefined,
): { node: React.ReactNode; spokenLabel: string } | null {
    if (count === "") {
        return null;
    }
    if (!entry) return null;

    // special case for excludes
    const excluded = op === "eq" && count === "0";

    const label = `${op_to_symbol(op)}${count}`;
    const spokenLabel = `${entry.label} ${label || count}人`;

    return {
        spokenLabel,
        node: (
            <div
                key={name}
                className={`${styles.icon} rounded border-mid wow-${entry.classSlug} wow-border-${entry.classSlug} ${
                    excluded ? "excluded" : ""
                }`}
                aria-hidden="true"
            >
                <WebpImg className="icon-l" src={entry.iconPath} alt="" />
                {!excluded && <div className={`${styles.label} wow-${entry.classSlug}`}>{label}</div>}
                {excluded && <div className={styles.label}>X</div>}
            </div>
        ),
    };
}

function create_icons(
    items: { [key: string]: CompCountType },
    catalog: Record<string, PreviewCatalogEntry>,
): Array<{ node: React.ReactNode; spokenLabel: string }> {
    const icons: Array<{ node: React.ReactNode; spokenLabel: string }> = [];
    for (const [key, value] of Object.entries(items)) {
        const icon = create_icon(key, value.count, value.op, catalog[key]);
        if (icon) {
            icons.push(icon);
        }
    }
    return icons;
}

export default function CompPreview({
    roles = {},
    specs = {},
    placeholder = "",
}: {
    roles?: CompCountMap;
    specs?: CompCountMap;
    placeholder?: string;
}) {
    const rolesByCode = useAppSelector((state) => state.roles);
    const specsByName = useAppSelector((state) => state.specs.specs_by_name);
    const roleCatalog = useMemo<Record<string, PreviewCatalogEntry>>(() => {
        const catalog: Record<string, PreviewCatalogEntry> = {};
        Object.values(rolesByCode).forEach((role) => {
            const label = ZH_CN.comp.roles[role.code];
            if (!label) return;
            catalog[role.code] = {
                classSlug: role.code,
                iconPath: role.icon_path,
                label,
            };
        });
        return catalog;
    }, [rolesByCode]);
    const specCatalog = useMemo<Record<string, PreviewCatalogEntry>>(() => {
        const catalog: Record<string, PreviewCatalogEntry> = {};
        Object.values(specsByName).forEach((spec) => {
            const label = ZH_CN.specNames[spec.full_name_slug];
            if (!label) return;
            catalog[spec.full_name_slug] = {
                classSlug: spec.class.name_slug,
                iconPath: spec.icon_path,
                label,
            };
        });
        return catalog;
    }, [specsByName]);
    const icons: Array<{ node: React.ReactNode; spokenLabel: string }> = [];
    icons.push(...create_icons(roles, roleCatalog));
    icons.push(...create_icons(specs, specCatalog));

    const spokenSummary = icons.map(({ spokenLabel }) => spokenLabel).join("；") || placeholder;
    return (
        <div className={styles.comp_preview} role="img" aria-label={spokenSummary}>
            {icons.length > 0 ? icons.map(({ node }) => node) : <span aria-hidden="true">{placeholder}</span>}
        </div>
    );
}
