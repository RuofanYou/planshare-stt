import type { Difficulty } from '../../data/types'
import { Skeleton } from '../../components/ui'

export type AdminGuardProps = {
  isUnauthorized: (error: unknown) => boolean
  onLogout: () => void
}

/** 难度可选项：仅 英雄 / 史诗（靠文字区分，不靠颜色） */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'heroic', label: '英雄' },
  { value: 'mythic', label: '史诗' },
]

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-'

export function generateTemporaryPassword(length = 14) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => TEMP_PASSWORD_CHARS[byte % TEMP_PASSWORD_CHARS.length]).join('')
}

/* ============================================================
   列表加载骨架（表单块 + 几行卡片占位）
   ============================================================ */
export function ListSkeleton() {
  return (
    <div className="ps-admin__section" role="status" aria-busy="true" aria-label="正在加载">
      <div className="ps-admin__form glass" aria-hidden="true">
        <Skeleton shape="line" width={120} height={12} />
        <Skeleton shape="line" width="50%" height={28} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ps-admin__sk-field">
            <Skeleton shape="line" width={72} height={14} />
            <Skeleton shape="block" height={46} />
          </div>
        ))}
        <Skeleton shape="block" width={160} height={46} className="ps-admin__sk-btn" />
      </div>
      <div className="ps-admin__rows" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ps-admin__row-card glass">
            <div className="ps-admin__row-main">
              <Skeleton shape="line" width="40%" height={18} />
              <Skeleton shape="line" width="60%" height={14} />
              <Skeleton shape="line" width="30%" height={14} />
            </div>
            <Skeleton shape="block" width={120} height={36} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   下拉箭头（select 右侧装饰）
   Icon 集合无向下 chevron，select 专用 inline SVG，currentColor 描边。
   ============================================================ */
export function SelectChevron() {
  return (
    <svg
      className="ps-admin__chevron"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
