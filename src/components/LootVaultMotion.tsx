import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

type LootVaultMotionProps = {
  accent: string
  highlight: string
}

/**
 * 装备库页的慢速奥术索引层。
 * 只承载氛围，不承载数据；筛选和结果仍由页面 DOM 完成。
 */
export default function LootVaultMotion({ accent, highlight }: LootVaultMotionProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const cycle = frame % durationInFrames

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 900 360"
        role="presentation"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <defs>
          <radialGradient id="loot-vault-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={highlight} stopOpacity="0.22" />
            <stop offset="66%" stopColor={accent} stopOpacity="0.06" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="700" cy="180" r="155" fill="url(#loot-vault-glow)" />
        <circle
          cx="700"
          cy="180"
          r="106"
          fill="none"
          stroke={accent}
          strokeOpacity="0.42"
          strokeWidth="1.5"
          strokeDasharray="2 12"
          style={{
            rotate: interpolate(cycle, [0, durationInFrames], ['0deg', '360deg'], {
              easing: Easing.linear,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transformOrigin: '700px 180px',
          }}
        />
        <circle
          cx="700"
          cy="180"
          r="138"
          fill="none"
          stroke={highlight}
          strokeOpacity="0.28"
          strokeWidth="1.5"
          strokeDasharray="1 18"
          style={{
            rotate: interpolate(cycle, [0, durationInFrames], ['360deg', '0deg'], {
              easing: Easing.linear,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transformOrigin: '700px 180px',
          }}
        />
        <path
          d="M 520 180 C 590 78 810 78 880 180"
          fill="none"
          stroke={accent}
          strokeOpacity="0.2"
          strokeWidth="1.5"
          style={{
            opacity: interpolate(cycle, [0, fps * 3, fps * 6, durationInFrames], [0.25, 0.75, 0.4, 0.25], {
              easing: Easing.inOut(Easing.sin),
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        />
        <circle
          cx="700"
          cy="180"
          r="4"
          fill={highlight}
          style={{
            opacity: interpolate(cycle, [0, fps * 3, fps * 6], [0.35, 0.9, 0.35], {
              easing: Easing.inOut(Easing.sin),
              extrapolateLeft: 'extend',
              extrapolateRight: 'extend',
            }),
            scale: interpolate(cycle, [0, fps * 3, fps * 6], [0.85, 1.18, 0.85], {
              easing: Easing.inOut(Easing.sin),
              output: 'perceptual-scale',
              extrapolateLeft: 'extend',
              extrapolateRight: 'extend',
            }),
            transformOrigin: '700px 180px',
          }}
        />
        <circle cx="594" cy="180" r="2.5" fill={accent} fillOpacity="0.55" />
        <circle cx="806" cy="180" r="2.5" fill={highlight} fillOpacity="0.42" />
      </svg>
    </AbsoluteFill>
  )
}
