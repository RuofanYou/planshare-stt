import { Link, useLocation } from "react-router-dom";

import StatePanel from "../components/StatePanel/StatePanel";

export type RouteStateKind = "report-unavailable" | "not-found";

export default function RouteStatePage({
    kind,
    address,
}: {
    kind: RouteStateKind;
    address?: string;
}): React.ReactElement {
    const location = useLocation();
    const currentAddress = address ?? `${location.pathname}${location.search}`;

    if (kind === "report-unavailable") {
        return (
            <StatePanel
                title="报告导入暂不可用"
                description="报告导入功能当前未开放，请返回 Top10 时间轴继续查看公开作业。"
                actions={(
                    <Link className="rg-button rg-button-primary" to="/">返回 Top10 时间轴</Link>
                )}
            />
        );
    }

    return (
        <StatePanel
            title="没有找到这个页面"
            description={<>当前地址：<code>{currentAddress}</code></>}
            actions={(
                <>
                    <Link className="rg-button rg-button-primary" to="/">返回 Top10 时间轴</Link>
                    <Link className="rg-button" to="/comp_ranking/search">前往阵容参考</Link>
                </>
            )}
        />
    );
}
