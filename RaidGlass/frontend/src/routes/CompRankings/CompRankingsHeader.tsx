import CompPreview, { type CompCountMap } from "../../components/CompPreview";
import type {
    CompCountCriterion,
    CompCriteria,
} from "../../features/comp-reference/criteria";
import { ZH_CN } from "../../localization/zhCN";
import { toMMSS } from "../../utils";
import styles from "./CompRankings.module.scss";

function countLabel(criterion: CompCountCriterion): string {
    const name = criterion.group === "role"
        ? ZH_CN.comp.roles[criterion.key]
        : ZH_CN.specNames[criterion.key];
    return ZH_CN.comp.countCriterion(
        name,
        ZH_CN.comp.criteriaOperators[criterion.op],
        criterion.count,
    );
}

export function formatCompCriteriaSummary(criteria: CompCriteria): string {
    const labels = criteria.counts.map(countLabel);
    if (criteria.killtimeMinSeconds !== null && criteria.killtimeMaxSeconds !== null) {
        labels.push(
            ZH_CN.comp.killtimeRange(
                toMMSS(criteria.killtimeMinSeconds),
                toMMSS(criteria.killtimeMaxSeconds),
            ),
        );
    } else if (criteria.killtimeMinSeconds !== null) {
        labels.push(ZH_CN.comp.killtimeAtLeast(toMMSS(criteria.killtimeMinSeconds)));
    } else if (criteria.killtimeMaxSeconds !== null) {
        labels.push(ZH_CN.comp.killtimeAtMost(toMMSS(criteria.killtimeMaxSeconds)));
    }
    return labels.length > 0 ? labels.join("；") : ZH_CN.comp.anyComp;
}

function criteriaMaps(criteria: CompCriteria): {
    roles: CompCountMap;
    specs: CompCountMap;
} {
    const roles: CompCountMap = {};
    const specs: CompCountMap = {};
    criteria.counts.forEach(({ group, key, op, count }) => {
        (group === "role" ? roles : specs)[key] = { op, count: String(count) };
    });
    return { roles, specs };
}

export default function CompRankingsHeader({
    bossName,
    criteria,
    criteriaSummary,
}: {
    bossName: string;
    criteria: CompCriteria;
    criteriaSummary: string;
}) {
    const preview = criteriaMaps(criteria);
    return (
        <header className={styles.header}>
            <div className={styles.heading}>
                <p>{ZH_CN.comp.title}</p>
                <h1>{bossName} · {ZH_CN.comp.title}</h1>
                <p>{criteriaSummary}</p>
            </div>
            <CompPreview
                {...preview}
                placeholder={ZH_CN.comp.anyComp}
            />
        </header>
    );
}
