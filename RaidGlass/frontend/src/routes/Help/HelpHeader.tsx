import styles from "./Help.module.scss";

export default function HelpHeader() {
    return (
        <header className={styles.header}>
            <p className={styles.eyebrow}>RAIDGLASS · 使用指南</p>
            <h1>RaidGlass 使用帮助</h1>
            <p className={styles.lead}>
                从选择目标到复制 Top10 作业，快速掌握时间轴与阵容参考。
            </p>
        </header>
    );
}
