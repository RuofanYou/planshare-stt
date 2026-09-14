import {
    DEFAULT_ZOOM,
    TIMELINE_ZOOM_MAX,
    TIMELINE_ZOOM_MIN,
} from "../../components/Timeline/constants";
import styles from "./Help.module.scss";

export default function HelpContent() {
    return (
        <div className={styles.content}>
            <section aria-labelledby="quick-start">
                <h2 id="quick-start">快速开始</h2>
                <ol className={styles.steps}>
                    <li>
                        <strong>选择目标</strong>
                        <span>进入 Top10 时间轴，默认显示治疗专精与治疗量排行。首领一排直接点击，治疗专精在一级入口切换，其他专精从“全部专精”菜单选择；难度可单独切换。</span>
                    </li>
                    <li>
                        <strong>阅读时间轴</strong>
                        <span>每一行对应一份排行样本，横向位置表示战斗中的施放时间。</span>
                    </li>
                    <li>
                        <strong>筛选并复制</strong>
                        <span>按需要调整显示内容和样本条件，再复制当前已接收目标的 Top10 作业。</span>
                    </li>
                </ol>
                <p className={styles.notice}>
                    切换目标时，页面会明确显示载入状态。新数据接收完成前，旧时间轴可能继续显示，
                    复制操作会暂停，避免目标与作业内容错配。
                </p>
            </section>

            <section aria-labelledby="top10-timeline">
                <h2 id="top10-timeline">Top10 时间轴</h2>
                <p>
                    时间轴把同一目标的排行样本放在统一刻度上，方便比较技能安排。
                    左侧玩家信息保持固定，右侧时间内容承担平移与缩放。
                </p>

                <h3 id="timeline-controls">平移、缩放与键盘</h3>
                <dl className={styles.controlList}>
                    <div>
                        <dt>拖动画布</dt>
                        <dd>
                            用鼠标或触控指针沿水平方向拖动，画布会按指针位移 1:1 跟随。
                            纵向手势继续用于滚动页面；松手后会在合法边界内自然停下。
                        </dd>
                    </div>
                    <div>
                        <dt>滚轮平移</dt>
                        <dd>
                            触控板或鼠标的横向滚轮可左右平移。按住 <kbd>Shift</kbd> 使用垂直滚轮，
                            也会转换为横向平移。普通垂直滚轮继续滚动页面。
                        </dd>
                    </div>
                    <div>
                        <dt>锚点缩放</dt>
                        <dd>
                            按住 <kbd>Ctrl</kbd>，或在 macOS 按住 <kbd>Meta</kbd>（⌘）再滚动，
                            会以指针所在位置为锚点缩放。
                        </dd>
                    </div>
                    <div>
                        <dt>工具栏</dt>
                        <dd>
                            桌面工具栏提供左右平移、缩小、放大和复位。移动端保留缩小、放大和复位，
                            横向拖动承担主要平移。工具栏以视口中心为缩放锚点。
                        </dd>
                    </div>
                    <div>
                        <dt>键盘</dt>
                        <dd>
                            时间轴或工具栏获得焦点后，使用 <kbd>←</kbd>/<kbd>→</kbd> 平移，
                            <kbd>+</kbd> 或 <kbd>=</kbd> 放大，<kbd>-</kbd> 缩小，<kbd>0</kbd> 复位。
                            快捷键只作用于当前获得焦点的时间轴范围。
                        </dd>
                    </div>
                </dl>
                <p className={styles.rangeNote}>
                    所有缩放入口共用 <strong>{TIMELINE_ZOOM_MIN.toFixed(1)}×–{TIMELINE_ZOOM_MAX.toFixed(0)}×</strong>
                    范围，复位回到 <strong>{DEFAULT_ZOOM.toFixed(1)}×</strong>。
                </p>

                <h3 id="timeline-settings-copy">筛选与复制</h3>
                <p>
                    打开“筛选与显示”可以控制图标、施放时间、持续时间、冷却、死亡与阶段，
                    也可以调整地区、击杀时长和日期条件。技能筛选在时间轴上方，点击分类批量开关，点击技能图标单独选择；技能分组可收起。
                    辅助搜索支持名称或技能 ID，搜索结果可勾选或仅看；保留全选、恢复默认和撤销。
                    搜索只缩小候选列表，当前数据未包含的技能无法显示。
                    同标签页返回或刷新后，按目标恢复筛选、缩放和时间位置。
                </p>
                <p>
                    “复制 Top10 作业”始终读取当前已接收的数据。复制成功会在原按钮显示“已复制”；
                    失败时会保留提示，可再次操作。筛选隐藏全部玩家时，先清除筛选再继续。
                </p>
            </section>

            <section aria-labelledby="comp-reference">
                <h2 id="comp-reference">阵容参考</h2>
                <ol className={styles.compSteps}>
                    <li>
                        <strong>选择首领</strong>
                        <span>先从首领按钮中选择本次要查找的目标。</span>
                    </li>
                    <li>
                        <strong>设置条件</strong>
                        <span>填写职责人数；需要更精确时，展开“更多筛选”设置击杀时间与专精人数。</span>
                    </li>
                    <li>
                        <strong>查看结果</strong>
                        <span>确认首领与条件摘要后提交。条件有误时，错误会留在当前步骤中显示。</span>
                    </li>
                </ol>
            </section>

            <section aria-labelledby="accessibility">
                <h2 id="accessibility">无障碍与减少动态效果</h2>
                <ul className={styles.plainList}>
                    <li>时间轴可获得键盘焦点，并提供与画布数据一致的文字摘要。</li>
                    <li>按钮、目录与表单控件保留清晰的键盘焦点状态和可访问名称。</li>
                    <li>
                        系统开启“减少动态效果”后，无限动画会关闭；时间轴停止惯性与回弹，
                        直接停在合法边界，页面滚动也会回到即时行为。
                    </li>
                </ul>
            </section>

            <section aria-labelledby="faq">
                <h2 id="faq">常见问题</h2>
                <div className={styles.faqList}>
                    <details>
                        <summary>为什么滚轮只滚动了页面？</summary>
                        <p>
                            普通垂直滚轮属于页面滚动。请使用横向滚轮，或按住 <kbd>Shift</kbd>
                            再滚动；缩放则使用 <kbd>Ctrl</kbd> 或 <kbd>Meta</kbd> 加滚轮。
                        </p>
                    </details>
                    <details>
                        <summary>为什么切换目标后暂时不能复制？</summary>
                        <p>页面正在等待新目标数据原子接收。载入完成后，标题、摘要、时间轴和复制内容会一起更新。</p>
                    </details>
                    <details>
                        <summary>为什么时间轴里没有玩家？</summary>
                        <p>当前筛选可能隐藏了全部玩家。打开“筛选与显示”并清除筛选即可恢复。</p>
                    </details>
                </div>
            </section>
        </div>
    );
}
