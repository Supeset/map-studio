import type { Feature, LineString, Polygon } from 'geojson'
import type { RocketPreset, TrajectoryProfile } from '~/constants/rocket-presets'
import type { LngLat } from '~/utils/geometry'
import {
  EARTH_EFFECTIVE_RADIUS_KM,
  EARTH_RADIUS_KM,
  ROCKET_FRAME_COUNT,
  ROCKET_FRAME_COUNT_LONG,
  ROCKET_LOG_K,
  ROCKET_LONG_DISTANCE_THRESHOLD_KM,
} from '~/constants/rocket'
import {
  calculateBearing,
  destinationPoint,
  generateCirclePolygon,
  haversineDistance,
} from '~/utils/geometry'

/** 时间轴上的一个采样帧 */
export interface TrajectoryFrame {
  /** 飞行时间 min */
  t: number
  /** 归一化进度 τ = t / T,∈ [0, 1] */
  τ: number
  /** 地面投影位置 [lng, lat] */
  pos: [number, number]
  /** 高度 km */
  altitudeKm: number
  /** 该帧有效可见半径 km */
  visibilityRadiusKm: number
}

/** 弹道解算结果(纯算法产物,无渲染依赖) */
export interface TrajectorySolution {
  preset: RocketPreset
  launch: LngLat
  target: LngLat
  /** 大圆水平距离 km */
  rangeKm: number
  /** 发射方位角 ° */
  bearing: number
  /** 顶点帧索引 */
  apogeeIndex: number
  /** 等时间采样帧序列 */
  frames: TrajectoryFrame[]
  /** 可见包络多边形(capsule 近似,所有采样圆的凸包) */
  envelope: Polygon
}

/**
 * 几何可见半径(纯几何上限,地球曲率 + 大气折射)
 * d = √(2 · R_eff · h)
 */
export function visibilityRadiusGeometric(h: number): number {
  if (h <= 0)
    return 0
  return Math.sqrt(2 * EARTH_EFFECTIVE_RADIUS_KM * h)
}

/**
 * 给定地面观测者最小仰角 e 时的地面可见半径
 * 球面几何关系:cos(ρ + e) = R / (R + h) · cos(e),d = R_eff · ρ
 * - e = 0:退化为几何上限,与 visibilityRadiusGeometric 一致(小角度近似)
 * - e 增大:d 减小(要求更高的仰角才能观测,覆盖范围更小)
 */
export function visibilityRadiusAtElevation(h: number, elevationDeg: number): number {
  if (h <= 0)
    return 0
  const e = (elevationDeg * Math.PI) / 180
  const cosRhoPlusE = (EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h)) * Math.cos(e)
  const rho = Math.acos(Math.max(-1, Math.min(1, cosRhoPlusE))) - e
  if (rho <= 0)
    return 0
  return EARTH_EFFECTIVE_RADIUS_KM * rho
}

/**
 * 有效可见半径:几何上限 ∩ 大气能见度
 * 高空大气稀薄,能见度限制随高度放宽:f(h) = 1 + h / 30
 */
export function effectiveVisibilityRadius(h: number, atmosphericVisibilityKm: number): number {
  const dGeo = visibilityRadiusGeometric(h)
  const dAtm = atmosphericVisibilityKm * (1 + h / 30)
  return Math.min(dGeo, dAtm)
}

/**
 * 地面观测者看飞行中火箭的仰角(球面近似)
 * @param rocketAltitudeKm 火箭高度
 * @param groundDistKm 观测者到火箭地面投影点的距离
 */
export function elevationAngle(rocketAltitudeKm: number, groundDistKm: number): number {
  if (groundDistKm <= 0)
    return Math.PI / 2
  const hidden = (groundDistKm * groundDistKm) / (2 * EARTH_EFFECTIVE_RADIUS_KM)
  const visibleH = Math.max(rocketAltitudeKm - hidden, 0)
  return Math.atan2(visibleH, groundDistKm)
}

/**
 * 三段高度模型(L1 经验参数化)
 * - 起飞段 [0, s1]:近垂直线性爬升
 * - 爬升段 [s1, s2]:对数曲线(重力转向)
 * - 下降段 [s2, range]:抛物下落
 */
export function altitudeAt(
  s: number,
  range: number,
  maxAltitudeKm: number,
  profile: TrajectoryProfile,
): number {
  if (s <= 0)
    return 0
  const τ = s / range
  const { climbStart: s1, apogeeStart: s2, liftoffFrac } = profile

  // 起飞段
  if (τ <= s1)
    return maxAltitudeKm * liftoffFrac * (τ / s1)

  // 爬升段(对数曲线,liftoffFrac → 1)
  if (τ <= s2) {
    const localτ = (τ - s1) / (s2 - s1)
    const logT = Math.log(1 + ROCKET_LOG_K * localτ) / Math.log(1 + ROCKET_LOG_K)
    return maxAltitudeKm * (liftoffFrac + (1 - liftoffFrac) * logT)
  }

  // 下降段(抛物线,1 → 0)
  const localτ = (τ - s2) / (1 - s2)
  return maxAltitudeKm * (1 - localτ * localτ)
}

/** 清晰度评分:高度归一化(顶点处 = 1) */
export function clarityScore(altitudeKm: number, maxAltitudeKm: number): number {
  if (maxAltitudeKm <= 0)
    return 0
  return Math.max(0, Math.min(1, altitudeKm / maxAltitudeKm))
}

/** Andrew monotone chain 凸包(经纬度小范围近似平面) */
export function convexHull(points: [number, number][]): [number, number][] {
  const seen = new Map<string, [number, number]>()
  for (const p of points)
    seen.set(`${p[0].toFixed(4)},${p[1].toFixed(4)}`, p)
  const pts = [...seen.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])

  if (pts.length < 3)
    return pts

  const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower: [number, number][] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop()
    lower.push(p)
  }

  const upper: [number, number][] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop()
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

/**
 * 由采样帧 + 最小仰角构造可见包络多边形(capsule 近似)
 * 所有帧可见圆的凸包,外形类似双曲线的闭合胶囊
 */
export function buildVisibilityEnvelope(
  frames: { pos: [number, number], altitudeKm: number }[],
  elevationDeg: number,
): Polygon | null {
  const pts: [number, number][] = []
  for (const f of frames) {
    const r = visibilityRadiusAtElevation(f.altitudeKm, elevationDeg)
    if (r <= 0)
      continue
    const ring = generateCirclePolygon({ lng: f.pos[0], lat: f.pos[1] }, r, 24)[0]
    if (ring)
      pts.push(...ring.map(c => c as [number, number]))
  }
  if (pts.length < 3)
    return null
  const hull = convexHull(pts)
  if (hull.length < 3)
    return null
  return { type: 'Polygon', coordinates: [[...hull, hull[0]!]] }
}

/**
 * 解算弹道:发射点 → 落点,等时间采样
 */
export function solveTrajectory(
  launch: LngLat,
  target: LngLat,
  preset: RocketPreset,
): TrajectorySolution | null {
  const range = haversineDistance(launch, target)
  if (range < 1)
    return null

  const bearing = calculateBearing(launch, target)
  const Hmax = preset.maxAltitudeKm
  const T = preset.flightTimeMin
  const N
    = range > ROCKET_LONG_DISTANCE_THRESHOLD_KM ? ROCKET_FRAME_COUNT_LONG : ROCKET_FRAME_COUNT

  const frames: TrajectoryFrame[] = []
  for (let i = 0; i <= N; i++) {
    const τ = i / N
    const t = T * τ
    const s = range * τ
    const altitudeKm = altitudeAt(s, range, Hmax, preset.profile)
    const pos = destinationPoint(launch, bearing, s)
    const visibilityRadiusKm = effectiveVisibilityRadius(altitudeKm, preset.atmosphericVisibilityKm)
    frames.push({ t, τ, pos, altitudeKm, visibilityRadiusKm })
  }

  let apogeeIndex = 0
  for (let i = 1; i < frames.length; i++) {
    if (frames[i]!.altitudeKm > frames[apogeeIndex]!.altitudeKm)
      apogeeIndex = i
  }

  const envelope = buildVisibilityEnvelope(frames, 0) ?? { type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] }

  return {
    preset,
    launch,
    target,
    rangeKm: range,
    bearing,
    apogeeIndex,
    frames,
    envelope,
  }
}

/**
 * 在任意时刻 t 插值采样帧(用于时间轴连续拖动)
 */
export function sampleFrameAt(frames: TrajectoryFrame[], t: number): TrajectoryFrame {
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (!first || !last)
    return { t: 0, τ: 0, pos: [0, 0], altitudeKm: 0, visibilityRadiusKm: 0 }

  const totalT = last.t
  if (t <= 0)
    return first
  if (t >= totalT)
    return last

  const idx = (t / totalT) * (frames.length - 1)
  const i = Math.floor(idx)
  const f0 = frames[i]!
  const f1 = frames[i + 1] ?? f0
  const localτ = idx - i

  return {
    t,
    τ: t / totalT,
    pos: [
      f0.pos[0] + (f1.pos[0] - f0.pos[0]) * localτ,
      f0.pos[1] + (f1.pos[1] - f0.pos[1]) * localτ,
    ],
    altitudeKm: f0.altitudeKm + (f1.altitudeKm - f0.altitudeKm) * localτ,
    visibilityRadiusKm: f0.visibilityRadiusKm + (f1.visibilityRadiusKm - f0.visibilityRadiusKm) * localτ,
  }
}

/** 由采样帧生成热力圆要素(每帧一个圆,带 clarity score) */
export function buildHeatFeatures(frames: TrajectoryFrame[], maxAltitudeKm: number): Feature<Polygon>[] {
  return frames
    .filter(f => f.visibilityRadiusKm > 0)
    .map(f => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: generateCirclePolygon({ lng: f.pos[0], lat: f.pos[1] }, f.visibilityRadiusKm, 36),
      },
      properties: { score: clarityScore(f.altitudeKm, maxAltitudeKm) },
    }))
}

/** 由采样帧生成轨迹线 */
export function buildTrajectoryLine(frames: TrajectoryFrame[]): LineString {
  return {
    type: 'LineString',
    coordinates: frames.map(f => f.pos),
  }
}

// ============ 上升段(发射 → 入轨点)============

/** 上升段帧 */
export interface AscentFrame {
  /** 飞行时间 min */
  t: number
  /** 归一化进度 τ ∈ [0, 1] */
  τ: number
  /** 地面投影位置 [lng, lat] */
  pos: [number, number]
  /** 高度 km */
  altitudeKm: number
}

/**
 * 上升段高度模型(首陡尾平):
 * 起飞斜率最大(近垂直爬升),接近入轨点导数趋 0(水平入轨)
 * h(τ) = leoH · (2τ − τ²),h'(0) = 2·leoH,h'(1) = 0
 */
export function ascentAltitude(τ: number, leoAltitudeKm: number): number {
  if (τ <= 0)
    return 0
  if (τ >= 1)
    return leoAltitudeKm
  return leoAltitudeKm * (2 * τ - τ * τ)
}

/** 解算上升段:发射点 → 入轨点,等时间采样 */
export function solveAscent(
  launch: LngLat,
  insertPoint: LngLat,
  leoAltitudeKm: number,
  ascentTimeMin: number,
  sampleCount = 60,
): AscentFrame[] {
  const range = haversineDistance(launch, insertPoint)
  const bearing = calculateBearing(launch, insertPoint)
  const frames: AscentFrame[] = []
  for (let i = 0; i <= sampleCount; i++) {
    const τ = i / sampleCount
    const t = ascentTimeMin * τ
    const s = range * τ
    frames.push({
      t,
      τ,
      pos: destinationPoint(launch, bearing, s),
      altitudeKm: ascentAltitude(τ, leoAltitudeKm),
    })
  }
  return frames
}
