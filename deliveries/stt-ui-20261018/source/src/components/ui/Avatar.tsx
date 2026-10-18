import './Avatar.css'

export interface AvatarProps {
  /** 来源名称：取首字符作占位，统一首字母方案。 */
  name: string
  /** 直径像素（圆形，宽高一致）。BoardCard ~22、详情 ~28、Hero 浮卡 ~40、作者头部 ~84 */
  size?: number
  className?: string
}

/**
 * Avatar —— 首字母玻璃圆原语（暖金描边，整站唯一权威）。
 *
 * 替代 BoardCard / Hero 浮卡 / 详情作者署名 / 作者头部 各处重复的首字母占位块。
 * 纯装饰占位（aria-hidden），语义由外层链接 / 作者名承担。
 * 字号随直径联动（CSS var --avatar-size 驱动），不写多套尺寸样式。
 */
export default function Avatar({ name, size = 24, className }: AvatarProps) {
  const initial = name.slice(0, 1)
  return (
    <span
      className={['ps-avatar', className ?? ''].filter(Boolean).join(' ')}
      style={{ '--avatar-size': `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}
