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
 * 装备库页的慢速剑与魔法拱门。
 * 只承载氛围，不承载数据；筛选和结果仍由页面 DOM 完成。
 */
export default function LootVaultMotion({ accent, highlight }: LootVaultMotionProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const cycle = frame % durationInFrames
  const pulse = interpolate(
    cycle,
    [0, durationInFrames * 0.25, durationInFrames * 0.5, durationInFrames * 0.75, durationInFrames],
    [0.16, 0.34, 0.18, 0.3, 0.16],
    { easing: Easing.inOut(Easing.sin), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const beamOpacity = interpolate(
    cycle,
    [0, fps * 4, fps * 8, durationInFrames],
    [0.08, 0.2, 0.1, 0.08],
    { easing: Easing.inOut(Easing.sin), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const runeRotation = interpolate(
    cycle,
    [0, durationInFrames],
    ['0deg', '360deg'],
    { easing: Easing.linear, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const counterRuneRotation = interpolate(
    cycle,
    [0, durationInFrames],
    ['360deg', '0deg'],
    { easing: Easing.linear, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const glintY = interpolate(
    cycle,
    [0, durationInFrames * 0.18, durationInFrames * 0.42, durationInFrames * 0.7, durationInFrames],
    [224, 164, 96, 166, 224],
    { easing: Easing.inOut(Easing.sin), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

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
          <radialGradient id="loot-armory-glow" cx="72%" cy="52%" r="50%">
            <stop offset="0%" stopColor={highlight} stopOpacity="0.16" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.05" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="loot-arch-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={highlight} stopOpacity="0.08" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.03" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="loot-beam" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={highlight} stopOpacity="0" />
            <stop offset="50%" stopColor={highlight} stopOpacity="0.9" />
            <stop offset="100%" stopColor={highlight} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="loot-blade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="48%" stopColor={highlight} stopOpacity="0.94" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.42" />
          </linearGradient>
        </defs>
        <rect x="360" y="0" width="540" height="360" fill="url(#loot-armory-glow)" />

        {/* 拱门与石柱：构图稳定，动效只在光线和符文上 */}
        <path
          d="M 500 316 V 164 C 500 78 566 32 650 32 C 734 32 800 78 800 164 V 316 Z"
          fill="url(#loot-arch-fill)"
          stroke={accent}
          strokeOpacity="0.22"
          strokeWidth="2"
        />
        <path
          d="M 518 316 V 166 C 518 94 574 52 650 52 C 726 52 782 94 782 166 V 316"
          fill="none"
          stroke={highlight}
          strokeOpacity="0.38"
          strokeWidth="1.5"
          style={{ opacity: 0.7 + pulse }}
        />
        <path d="M 476 316 H 824" stroke={accent} strokeOpacity="0.34" strokeWidth="2" />
        <path d="M 452 328 H 848" stroke={accent} strokeOpacity="0.12" strokeWidth="1" />
        <path d="M 482 164 H 518 M 782 164 H 818" stroke={accent} strokeOpacity="0.34" strokeWidth="3" />
        <path d="M 486 316 V 166 M 814 316 V 166" stroke={accent} strokeOpacity="0.28" strokeWidth="4" />
        <path d="M 474 316 V 158 M 826 316 V 158" stroke={highlight} strokeOpacity="0.12" strokeWidth="1" />
        <path d="M 476 154 H 526 M 774 154 H 824" stroke={highlight} strokeOpacity="0.2" strokeWidth="2" />
        <path d="M 468 322 H 532 M 768 322 H 832" stroke={accent} strokeOpacity="0.25" strokeWidth="2" />

        {/* 拱门内的圣光 */}
        <rect
          x="618"
          y="66"
          width="64"
          height="244"
          fill="url(#loot-beam)"
          style={{ opacity: beamOpacity }}
        />
        <path
          d="M 650 46 L 650 306"
          stroke={highlight}
          strokeOpacity="0.24"
          strokeWidth="1"
          style={{ opacity: 0.35 + pulse }}
        />

        {/* 剑：作为装备库的视觉锚点 */}
        <g style={{ opacity: 0.72 + pulse * 0.7 }}>
          <path d="M 650 72 L 671 224 L 650 242 L 629 224 Z" fill="url(#loot-blade)" stroke={highlight} strokeOpacity="0.58" strokeWidth="1" />
          <path d="M 650 84 V 235" stroke={highlight} strokeOpacity="0.64" strokeWidth="1" />
          <path d="M 606 244 H 694" stroke={accent} strokeOpacity="0.78" strokeWidth="5" />
          <path d="M 614 240 H 686" stroke={highlight} strokeOpacity="0.6" strokeWidth="1" />
          <rect x="645" y="246" width="10" height="39" rx="3" fill={accent} fillOpacity="0.68" />
          <path d="M 640 286 Q 650 296 660 286" fill="none" stroke={highlight} strokeOpacity="0.64" strokeWidth="3" />
          <circle cx="650" cy="296" r="5" fill={highlight} fillOpacity="0.5" />
          <path d={`M 632 ${glintY} H 668`} stroke={highlight} strokeOpacity="0.8" strokeWidth="2" />
        </g>

        {/* 少量符文：低速旋转，避免把浏览内容变成噪点 */}
        <g style={{ rotate: runeRotation, transformOrigin: '568px 126px', opacity: 0.28 + pulse }}>
          <circle cx="568" cy="126" r="17" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1" />
          <path d="M 568 113 L 574 126 L 568 139 L 562 126 Z M 562 126 H 574" fill="none" stroke={highlight} strokeOpacity="0.62" strokeWidth="1" />
        </g>
        <g style={{ rotate: counterRuneRotation, transformOrigin: '732px 126px', opacity: 0.22 + pulse * 0.8 }}>
          <circle cx="732" cy="126" r="17" fill="none" stroke={accent} strokeOpacity="0.42" strokeWidth="1" />
          <path d="M 732 112 V 140 M 720 126 H 744 M 724 118 L 740 134 M 740 118 L 724 134" fill="none" stroke={highlight} strokeOpacity="0.52" strokeWidth="1" />
        </g>
        <g style={{ opacity: 0.22 + pulse * 0.55 }}>
          <path d="M 548 216 h 16 m-8-8 v 16 M 752 216 h 16 m-8-8 v 16" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="548" cy="216" r="3" fill={highlight} fillOpacity="0.62" />
          <circle cx="768" cy="216" r="3" fill={highlight} fillOpacity="0.62" />
        </g>
      </svg>
    </AbsoluteFill>
  )
}
