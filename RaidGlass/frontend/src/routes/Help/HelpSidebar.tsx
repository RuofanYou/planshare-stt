import styles from "./Help.module.scss";

const DIRECTORY = [
    { id: "quick-start", label: "快速开始" },
    {
        id: "top10-timeline",
        label: "Top10 时间轴",
        children: [
            { id: "timeline-controls", label: "平移、缩放与键盘" },
            { id: "timeline-settings-copy", label: "筛选与复制" },
        ],
    },
    { id: "comp-reference", label: "阵容参考" },
    { id: "accessibility", label: "无障碍与减少动态" },
    { id: "faq", label: "常见问题" },
] as const;

function DirectoryLinks() {
    return (
        <ul className={styles.directoryList}>
            {DIRECTORY.map((item) => (
                <li key={item.id}>
                    <a className={styles.directoryLink} href={`#${item.id}`}>{item.label}</a>
                    {"children" in item && (
                        <ul className={styles.directorySublist}>
                            {item.children.map((child) => (
                                <li key={child.id}>
                                    <a className={styles.directoryLink} href={`#${child.id}`}>
                                        {child.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default function HelpSidebar() {
    return (
        <aside className={styles.sidebar} aria-label="帮助页导航">
            <nav className={styles.desktopDirectory} aria-label="本页目录">
                <p className={styles.directoryTitle}>本页目录</p>
                <DirectoryLinks />
            </nav>

            <details className={styles.mobileDirectory}>
                <summary className={styles.directorySummary}>本页目录</summary>
                <nav className={styles.mobileDirectoryNav} aria-label="本页目录（移动）">
                    <DirectoryLinks />
                </nav>
            </details>
        </aside>
    );
}
