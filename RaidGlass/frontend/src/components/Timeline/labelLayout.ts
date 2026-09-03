export interface TimelineLabelBox {
    left: number;
    right: number;
}

function validBox(box: TimelineLabelBox) {
    return Number.isFinite(box.left) && Number.isFinite(box.right) && box.right >= box.left;
}

export function timelineBoxesOverlap(
    left: TimelineLabelBox,
    right: TimelineLabelBox,
    minGap = 0,
) {
    if (!validBox(left) || !validBox(right)) return false;
    const gap = Number.isFinite(minGap) ? Math.max(0, minGap) : 0;
    return left.left < right.right + gap && left.right > right.left - gap;
}

/**
 * 按屏幕横坐标决定时间文字是否可见，并保持输入顺序输出结果。
 * 无效矩形直接隐藏，避免 Konva 测量异常把整行标签挤乱。
 */
export function visibleTimelineLabels(
    boxes: TimelineLabelBox[],
    minGap = 4,
    reservedBoxes: TimelineLabelBox[] = [],
): boolean[] {
    const visible = boxes.map(() => false);
    const gap = Number.isFinite(minGap) ? Math.max(0, minGap) : 0;
    const reserved = reservedBoxes.filter(validBox);
    const ordered = boxes
        .map((box, index) => ({ ...box, index }))
        .filter(validBox)
        .sort((a, b) => a.left - b.left || a.right - b.right || a.index - b.index);

    let previousRight = Number.NEGATIVE_INFINITY;
    for (const box of ordered) {
        if (reserved.some((reservedBox) => timelineBoxesOverlap(box, reservedBox, gap))) {
            continue;
        }
        if (box.left < previousRight + gap) {
            continue;
        }
        visible[box.index] = true;
        previousRight = box.right;
    }

    return visible;
}
