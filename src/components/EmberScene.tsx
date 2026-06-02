/**
 * EmberScene —— EmberBackground 的 three.js 实现块（懒加载）。
 * 只在 WebGL 可用且未要求降低动效时加载，承载：
 *  1) 奥术金雾：全屏正交平面 + 自定义 fbm 噪声 shader，暖金、低 alpha、极缓慢漂移。
 *  2) 余烬粒子：~200 个点，金 ↔ 奶金随机，缓慢向上漂浮 + 轻微水平扰动 + sin 呼吸 opacity。
 *  3) 中上部略密略亮 = 一处发光焦点（hero/品牌区）。
 * 性能：DPR 上限 1.5；document.hidden 暂停渲染；运动极缓。
 * 色彩纪律：只用暖金/奶金/暖橙，严禁紫/蓝/彩虹。
 */
import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ---------- 调参常量（集中，避免散落魔法数字） ---------- */
const EMBER_COUNT = 200            // 余烬粒子数（稀疏、靠暗场衬托）
const FIELD_W = 16                 // 粒子场宽（世界单位）
const FIELD_H = 11                 // 粒子场高
const RISE_SPEED = 0.06            // 余烬上浮速度（极小）
const SWAY = 0.18                  // 水平扰动幅度
// 暖色调色板：仅金 / 奶金 / 暖橙（HEX 在此集中，渲染层不裸写）
const PALETTE = ['#E8B765', '#EBDEC2', '#F2CE86', '#C8923A']

/* ============================================================
   奥术金雾平面：自定义 fbm shader，覆盖全屏，暖金极低 alpha 缓慢漂移。
   ============================================================ */
const FOG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0); // 全屏 NDC 平面，正交无关相机
  }
`

const FOG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;

  // 经典 2D value noise + fbm
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for(int i = 0; i < 5; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
    return v;
  }

  void main(){
    vec2 uv = vUv;
    // 极缓慢漂移（周期 ≥ 30s 量级）
    float t = uTime * 0.012;
    float n = fbm(uv * 3.0 + vec2(t, t * 0.6));
    n = pow(n, 1.6);
    // 中上部更亮：一处发光焦点
    float focus = smoothstep(0.95, 0.15, distance(uv, vec2(0.5, 0.78)));
    float a = n * 0.10 * (0.45 + 0.55 * focus);  // 总 alpha ≈ 0.04 ~ 0.11
    gl_FragColor = vec4(uColor, a);
  }
`

function ArcaneFog() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#E8B765') }, // 暖金雾
    }),
    [],
  )
  useFrame((state) => {
    if (document.hidden) return // 不可见时不推进
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={FOG_VERT}
        fragmentShader={FOG_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/* ============================================================
   余烬粒子：缓慢上浮 + 水平扰动 + sin 呼吸 opacity，金 ↔ 奶金。
   ============================================================ */
const EMBER_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uPixelRatio;

  void main(){
    vColor = color;
    vec3 p = position;
    // 缓慢上浮，超出顶部后从底部回卷
    p.y = mod(p.y + uTime * ${RISE_SPEED.toFixed(3)} + ${FIELD_H.toFixed(1)} * 0.5, ${FIELD_H.toFixed(1)}) - ${FIELD_H.toFixed(1)} * 0.5;
    // 轻微水平正弦扰动
    p.x += sin(uTime * 0.4 + aSeed * 6.2831) * ${SWAY.toFixed(3)};
    // sin 呼吸式 opacity（0.2 ~ 0.8）
    vAlpha = 0.2 + 0.6 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 6.2831));
    // 中上部略亮：靠近焦点的粒子更亮
    float focus = smoothstep(6.0, 0.0, distance(p.xy, vec2(0.0, ${(FIELD_H * 0.18).toFixed(2)})));
    vAlpha *= (0.7 + 0.5 * focus);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio * (30.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const EMBER_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    // 圆形柔焦点：中心实、边缘渐隐
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    float soft = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, soft * vAlpha);
  }
`

function Embers() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  // 一次性生成粒子几何属性
  const geometry = useMemo(() => {
    const positions = new Float32Array(EMBER_COUNT * 3)
    const colors = new Float32Array(EMBER_COUNT * 3)
    const sizes = new Float32Array(EMBER_COUNT)
    const phases = new Float32Array(EMBER_COUNT)
    const seeds = new Float32Array(EMBER_COUNT)
    const c = new THREE.Color()
    for (let i = 0; i < EMBER_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * FIELD_W
      // 中上部略密：用偏置分布让更多粒子落在上半部
      positions[i * 3 + 1] = (Math.random() ** 0.8 - 0.5) * FIELD_H
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
      c.set(PALETTE[(Math.random() * PALETTE.length) | 0])
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      sizes[i] = 1 + Math.random() * 2 // 1~3px 基准
      phases[i] = Math.random()
      seeds[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5) },
    }),
    [],
  )

  useFrame((state) => {
    if (document.hidden) return
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={EMBER_VERT}
        fragmentShader={EMBER_FRAG}
        uniforms={uniforms}
        transparent
        vertexColors
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function EmberScene() {
  return (
    <Canvas
      className="ember-bg__canvas"
      // DPR 上限 1.5：控制开销
      dpr={[1, 1.5]}
      // 运动极缓但持续，靠 document.hidden 在帧内短路省电
      frameloop="always"
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 9], fov: 50 }}
    >
      {/* 透明场景，只画雾与粒子；底色由外层 CSS --grad-page 负责 */}
      <ArcaneFog />
      <Embers />
    </Canvas>
  )
}
