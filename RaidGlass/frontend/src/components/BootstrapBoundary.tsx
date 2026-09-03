import type { ReactNode } from "react";

import StatePanel from "./StatePanel/StatePanel";
import {
    loadBootstrapData,
    selectBootstrap,
    selectHasBootstrapTargets,
} from "../store/bootstrap";
import { useAppDispatch, useAppSelector } from "../store/store_hooks";
import styles from "./BootstrapBoundary.module.scss";

function BootstrapLoading() {
    return (
        <section className={styles.loadingPage} role="status" aria-labelledby="bootstrap-loading-title">
            <div className={styles.loadingIntro}>
                <span className={styles.loadingEyebrow}>顶榜实战参考</span>
                <h1 id="bootstrap-loading-title">正在载入目标目录</h1>
                <p>正在同步当前赛季、首领与专精资料。</p>
            </div>
            <div className={styles.loadingSurface} aria-hidden="true">
                <div className={styles.loadingContext}>
                    <span />
                    <strong />
                    <small />
                </div>
                <div className={styles.loadingRows}>
                    {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
                </div>
            </div>
        </section>
    );
}

export default function BootstrapBoundary({ children }: { children: ReactNode }) {
    const dispatch = useAppDispatch();
    const bootstrap = useAppSelector(selectBootstrap);
    const hasTargets = useAppSelector(selectHasBootstrapTargets);
    const retry = () => dispatch(loadBootstrapData({ retry: true }));

    if (bootstrap.status === "idle" || bootstrap.status === "loading") {
        return <BootstrapLoading />;
    }

    if (bootstrap.status === "error") {
        return (
            <StatePanel
                role="alert"
                title="目标目录载入失败"
                description={bootstrap.error ?? "暂时无法载入目标目录，请稍后重试。"}
                actions={(
                    <button className="rg-button rg-button-primary" type="button" onClick={retry}>
                        重试载入
                    </button>
                )}
            />
        );
    }

    if (!hasTargets) {
        return (
            <StatePanel
                role="status"
                title="暂时没有可用目标"
                description="当前目录没有完整的赛季目标，可以重新载入后再试。"
                actions={(
                    <button className="rg-button" type="button" onClick={retry}>
                        重新载入
                    </button>
                )}
            />
        );
    }

    return children;
}
