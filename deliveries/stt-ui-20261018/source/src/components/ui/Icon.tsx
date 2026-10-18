/**
 * Icon —— 命名图标单一来源（整站唯一权威）。
 * 把全站各页内联重复的 Lucide 风格 SVG path 收进这一处：
 * arrow / star / eye / heart / copy / check / chevron / search / empty / error / author / question。
 * 各处不再手写 svg path，统一 <Icon name=".." size=.. />。
 *
 * 约定：
 *  - 描边图标 stroke=currentColor、fill=none，跟随父级文字色（双金 / ink 体系）。
 *  - 实心图标（star、heart filled）fill=currentColor。
 *  - 装饰图标 aria-hidden；语义图标传 label 自动补 aria-label + role="img"。
 *  - size 走数值像素（图标尺寸是组件内在度量，非令牌阶；与既有 14/16/18/40/44 一致）。
 */

/** 可用图标名（整站收口于此，新增图标只在本文件加一个 case）。 */
export type IconName =
  | 'arrow' // 右箭头（入口卡 / CTA 尾随）
  | 'star' // 实心星（精选角标 / eyebrow）
  | 'eye' // 浏览量
  | 'heart' // 点赞（filled 切换实心）
  | 'copy' // 复制
  | 'check' // 对勾（复制成功 / Toast）
  | 'chevron' // 右向 chevron（面包屑分隔）
  | 'search' // 搜索
  | 'empty' // 空态线框（列表为空）
  | 'error' // 错误态警示三角
  | 'author' // 作者占位（找不到作者）
  | 'question' // 未找到 / 问号方框

export interface IconProps {
  /** 图标名 */
  name: IconName
  /** 像素尺寸（宽高一致），默认 18 */
  size?: number
  /** heart 是否实心（仅 name="heart" 生效；其余忽略） */
  filled?: boolean
  /** 语义标签：传了即 role="img" + aria-label；不传则 aria-hidden 当装饰 */
  label?: string
  /** 透传 className（用于色彩/定位微调） */
  className?: string
}

/** 描边类图标的统一外框属性（fill=none + currentColor 描边）。 */
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * 渲染命名图标。viewBox 统一 0 0 24 24，宽高由 size 控制。
 * filled 仅作用于 heart（描边 ↔ 实心切换）。
 */
export default function Icon({
  name,
  size = 18,
  filled = false,
  label,
  className,
}: IconProps) {
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    ...a11y,
  }

  switch (name) {
    case 'arrow':
      return (
        <svg {...common} {...strokeProps} strokeWidth={2}>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2 2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.1 20.3l1.7-6.6L2.6 9.3l6.8-.5z" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common} {...strokeProps}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common} {...strokeProps} fill={filled ? 'currentColor' : 'none'}>
          <path d="M19 5.5a4.4 4.4 0 0 0-6.2 0L12 6.3l-.8-.8a4.4 4.4 0 0 0-6.2 6.2l.8.8L12 19l6.2-6.5.8-.8a4.4 4.4 0 0 0 0-6.2Z" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...common} {...strokeProps}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common} {...strokeProps} strokeWidth={2}>
          <path d="m20 6-11 11-5-5" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.75}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.75}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </svg>
      )
    case 'empty':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.5}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <path d="M8 14h8" />
        </svg>
      )
    case 'error':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.5}>
          <path d="M10.3 3.7 1.8 18a1.9 1.9 0 0 0 1.7 2.9h17a1.9 1.9 0 0 0 1.7-2.9L13.7 3.7a1.9 1.9 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'author':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.5}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
        </svg>
      )
    case 'question':
      return (
        <svg {...common} {...strokeProps} strokeWidth={1.5}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.7" />
          <path d="M12 16.5h.01" />
        </svg>
      )
  }
}
