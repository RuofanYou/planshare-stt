import type { ReactNode } from "react";
import { FaCheck } from "react-icons/fa6";

import { PRODUCT_CONFIG } from "../../config/product";
import { rankingRefreshPresentation } from "../ranking-refresh/presentation";
import { ZH_CN } from "../../localization/zhCN";
import type { RankingMeta, TimelineTarget } from "./types";
import styles from "./TimelineWorkbench.module.scss";

function formatUpdated(updated?: string) {
    if (!updated || Number.isNaN(Date.parse(updated))) {
        return "等待数据";
    }
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(updated));
}

export default function TargetSummary({
    target,
    meta,
    refreshing,
    copyDisabled,
    copyStatus,
    headingLevel,
    targetPicker,
    onCopy,
}: {
    target: TimelineTarget;
    meta: RankingMeta | null;
    refreshing: boolean;
    copyDisabled: boolean;
    copyStatus: string;
    headingLevel: 1 | 2;
    targetPicker: ReactNode;
    onCopy: () => void;
}) {
    const Heading = headingLevel === 1 ? "h1" : "h2";
    const freshness = meta ? rankingRefreshPresentation(meta.refresh) : null;
    const difficulty = target.difficulty === "heroic" ? "英雄" : "史诗";
    const copied = copyStatus === ZH_CN.workbench.copied;
    const copyFailed = copyStatus === ZH_CN.workbench.copyFailed;

    return (
        <section
            className={styles.summary}
            aria-label={ZH_CN.workbench.currentTarget}
            data-testid="workbench-context"
            aria-busy={refreshing}
        >
            <div className={styles.summaryTitle}>
                <span className={styles.summaryEyebrow}>{ZH_CN.workbench.eyebrow}</span>
                <Heading className={styles.workbenchHeading}>
                    {target.bossName} · {target.specName}
                </Heading>
                <p>{difficulty}难度 · {ZH_CN.workbench.metricNames[target.metric]} · Top{PRODUCT_CONFIG.rankingTopN}</p>
            </div>

            <div className={styles.summaryControls}>
                {targetPicker}
            </div>

            <dl className={styles.summaryMeta}>
                <div>
                    <dt>{ZH_CN.workbench.dataTime}</dt>
                    <dd>{formatUpdated(meta?.updated)}</dd>
                </div>
                <div>
                    <dt>{ZH_CN.workbench.reportCount}</dt>
                    <dd>{meta?.sourceReportCount ?? "—"}</dd>
                </div>
                <div>
                    <dt>{ZH_CN.workbench.status}</dt>
                    <dd data-freshness={freshness?.key || "loading"}>
                        {refreshing ? ZH_CN.workbench.updating : freshness?.label || ZH_CN.workbench.loading}
                    </dd>
                </div>
            </dl>

            <div className={styles.summaryAction}>
                <button
                    type="button"
                    className="rg-button rg-button-primary"
                    aria-label={copied ? ZH_CN.workbench.copied : ZH_CN.workbench.copyTop10}
                    data-copy-state={copied ? "copied" : "idle"}
                    disabled={copyDisabled}
                    onClick={onCopy}
                >
                    {copied ? (
                        <><FaCheck aria-hidden="true" /> {ZH_CN.workbench.copiedShort}</>
                    ) : (
                        <>
                            <span className={styles.copyLabelFull}>{ZH_CN.workbench.copyTop10}</span>
                            <span className={styles.copyLabelCompact}>复制</span>
                        </>
                    )}
                </button>
                <span
                    className={copyFailed ? styles.copyError : styles.copyLive}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {copyStatus}
                </span>
            </div>
        </section>
    );
}
