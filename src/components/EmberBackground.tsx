/**
 * EmberBackground —— 全站固定的「余烬奥术暗场」氛围背景。
 *
 * 视觉：深空径向暖黑底（CSS） + 微弱奥术金雾（fbm 噪声平面，极缓慢漂移）
 *      + 缓慢上浮的余烬/尘埃微光（金 ↔ 奶金，sin 呼吸 opacity）+ 暗角 vignette。
 * 色彩纪律：只用暖金/奶金/暖橙，严禁紫/蓝/彩虹。
 *
 * 性能与降级（DESIGN.md §5 强制）：
 *  - DPR 上限 1.5；document.hidden 暂停渲染；运动极缓 GPU 负载低。
 *  - prefers-reduced-motion / 无 WebGL：退化为纯 CSS 静态暗场（不跑 RAF）。
 *  - Suspense 懒加载 Canvas，不阻塞首屏；three 背景是增强而非必需。
 *  - 纯氛围，绝不承载内容或可点元素（pointer-events:none）。
 */
import { Suspense, lazy, useMemo, useState, useEffect } from 'react'
import './EmberBackground.css'

/* Canvas 与 three 相关代码独立成块并懒加载，首屏不阻塞、无 WebGL 时不付出代价。 */
const EmberScene = lazy(() => import('./EmberScene'))

/** 运行时检测 WebGL 可用性（一次性）。 */
function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

/** 读取 prefers-reduced-motion，并随系统设置变化更新。 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function EmberBackground() {
  const reducedMotion = usePrefersReducedMotion()
  const webglOk = useMemo(detectWebGL, [])

  // 无 WebGL 或要求降低动效 → 纯 CSS 静态暗场，不挂 three。
  const useFallback = !webglOk || reducedMotion

  return (
    <div className="ember-bg" aria-hidden="true">
      {useFallback ? (
        <div className="ember-bg__fallback" />
      ) : (
        // Suspense 兜底也是 CSS 静态暗场：three 加载完成前不空窗、不阻塞首屏。
        <Suspense fallback={<div className="ember-bg__fallback" />}>
          <EmberScene />
        </Suspense>
      )}
      {/* 画布之上的暗角，保证中心内容区可读、边缘电影感 */}
      <div className="ember-bg__vignette" />
    </div>
  )
}
