import type { OrbitSolution } from '~/composables/rocket/useOrbit'
import type { AscentFrame } from '~/composables/rocket/useTrajectory'
import type { LngLat } from '~/utils/geometry'
import { inclinationFromBearing, solveOrbitTrack } from '~/composables/rocket/useOrbit'
import { ascentAltitude, effectiveVisibilityRadius, solveAscent } from '~/composables/rocket/useTrajectory'
import { DEFAULT_ATMOSPHERIC_VISIBILITY_KM } from '~/constants/rocket'
import { calculateBearing, destinationPoint, haversineDistance } from '~/utils/geometry'

/** 任务中的位置点(发射点 / 落区) */
export interface MissionPoint {
  lng: number
  lat: number
  name: string
}

/** 单个残骸(助推器)解算结果 */
export interface DebrisSolution {
  id: string
  /** 落区 */
  landing: MissionPoint
  /** 分离点 [lng, lat] */
  sepPoint: [number, number]
  /** 分离高度 km */
  sepAltitudeKm: number
  /** 分离时刻 min */
  sepTimeMin: number
  /** 下落时间 min */
  fallTimeMin: number
  /** 分离点 → 落区星下点 [lng, lat][] */
  path: [number, number][]
}

/** 一个活动对象在某时刻的状态 */
export interface ObjectState {
  id: string
  pos: [number, number]
  altitudeKm: number
  visibilityRadiusKm: number
}

/** 统一时间帧:某时刻所有对象状态 */
export interface MissionFrame {
  t: number
  /** 火箭主体(上升段或轨道) */
  booster: ObjectState | null
  /** 各活动残骸(已分离且未落地) */
  debris: ObjectState[]
}

/** 完整任务解算结果 */
export interface MissionSolution {
  launch: MissionPoint
  /** 发射方位角 ° */
  bearing: number
  /** 轨道倾角 ° */
  inclinationDeg: number
  /** LEO 高度 km */
  leoAltitudeKm: number
  /** 上升段时间 min */
  ascentTimeMin: number
  /** 总时长 min(上升 + 一圈) */
  totalTimeMin: number
  /** 上升段帧 */
  ascent: AscentFrame[]
  /** 入轨点 [lng, lat] */
  insertPoint: [number, number]
  /** 残骸解算 */
  debris: DebrisSolution[]
  /** 轨道一圈 */
  orbit: OrbitSolution
  /** 统一时间帧 */
  frames: MissionFrame[]
}

interface SolveOptions {
  ascentTimeMin?: number
  atmosphericVisibilityKm?: number
  frameCount?: number
}

const DEFAULT_ASCENT_TIME_MIN = 9
const DEFAULT_FRAME_COUNT = 240

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/** LEO 高度 → 经验入轨射程 km(高度越高射程越远) */
function insertRangeFor(leoAltitudeKm: number): number {
  return Math.max(800, 600 + leoAltitudeKm * 4)
}

/** 解算单个残骸(分离点 → 落区) */
function solveDebris(
  launch: LngLat,
  bearing: number,
  landing: MissionPoint,
  leoAltitudeKm: number,
  insertRangeKm: number,
  ascentTimeMin: number,
  idx: number,
): DebrisSolution {
  const dist = haversineDistance(launch, landing)
  // 落区距离 → 分离点距离(近落区早分离)
  const dSep = clamp(dist, 50, insertRangeKm * 0.95)
  const sepPoint = destinationPoint(launch, bearing, dSep)
  const sepAltitudeKm = ascentAltitude(dSep / insertRangeKm, leoAltitudeKm)
  const sepTimeMin = (dSep / insertRangeKm) * ascentTimeMin
  // 下落时间(按分离高度经验估算)
  const fallTimeMin = clamp(Math.sqrt(sepAltitudeKm) * 0.3, 2, 8)

  // 分离点 → 落区星下点路径
  const sepLngLat: LngLat = { lng: sepPoint[0], lat: sepPoint[1] }
  const pathDist = haversineDistance(sepLngLat, landing)
  const pathBearing = calculateBearing(sepLngLat, landing)
  const path: [number, number][] = []
  const N = 24
  for (let k = 0; k <= N; k++) {
    const τ = k / N
    path.push(destinationPoint(sepLngLat, pathBearing, pathDist * τ))
  }

  return {
    id: `debris-${idx + 1}`,
    landing,
    sepPoint,
    sepAltitudeKm,
    sepTimeMin,
    fallTimeMin,
    path,
  }
}

/** 轨迹数组浮点索引线性插值 */
function interpolateTrack(track: [number, number][], idx: number): [number, number] {
  const last = track.length - 1
  const i = Math.floor(idx)
  const a = track[clamp(i, 0, last)]!
  const b = track[clamp(i + 1, 0, last)]!
  const f = idx - i
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** 上升帧浮点插值 */
function interpolateAscent(ascent: AscentFrame[], t: number, atmVis: number): ObjectState {
  const last = ascent.length - 1
  const ratio = clamp(t / ascent[ascent.length - 1]!.t, 0, 1)
  const idx = ratio * last
  const i = Math.floor(idx)
  const a = ascent[i]!
  const b = ascent[clamp(i + 1, 0, last)]!
  const f = idx - i
  const altitudeKm = a.altitudeKm + (b.altitudeKm - a.altitudeKm) * f
  const pos: [number, number] = [
    a.pos[0] + (b.pos[0] - a.pos[0]) * f,
    a.pos[1] + (b.pos[1] - a.pos[1]) * f,
  ]
  return {
    id: 'booster',
    pos,
    altitudeKm,
    visibilityRadiusKm: effectiveVisibilityRadius(altitudeKm, atmVis),
  }
}

/** 生成统一时间帧(贯穿上升 + 轨道一圈,含各残骸) */
function buildFrames(
  ascent: AscentFrame[],
  debris: DebrisSolution[],
  orbit: OrbitSolution,
  ascentTimeMin: number,
  leoAltitudeKm: number,
  atmVis: number,
  frameCount: number,
): MissionFrame[] {
  const tAscent = ascentTimeMin
  const tOrbit = orbit.periodMin
  const tTotal = tAscent + tOrbit
  const frames: MissionFrame[] = []

  for (let i = 0; i <= frameCount; i++) {
    const t = (i / frameCount) * tTotal
    const frame: MissionFrame = { t, booster: null, debris: [] }

    // 主体:上升段 或 轨道
    if (t <= tAscent) {
      frame.booster = interpolateAscent(ascent, t, atmVis)
    }
    else {
      const oτ = clamp((t - tAscent) / tOrbit, 0, 1)
      const pos = interpolateTrack(orbit.groundTrack, oτ * (orbit.groundTrack.length - 1))
      frame.booster = {
        id: 'booster',
        pos,
        altitudeKm: leoAltitudeKm,
        visibilityRadiusKm: effectiveVisibilityRadius(leoAltitudeKm, atmVis),
      }
    }

    // 残骸:分离后下落,落地后停止
    for (const d of debris) {
      if (t < d.sepTimeMin)
        continue
      const fallτ = (t - d.sepTimeMin) / d.fallTimeMin
      if (fallτ >= 1)
        continue
      const pos = interpolateTrack(d.path, fallτ * (d.path.length - 1))
      const altitudeKm = d.sepAltitudeKm * (1 - fallτ * fallτ)
      frame.debris.push({
        id: d.id,
        pos,
        altitudeKm,
        visibilityRadiusKm: effectiveVisibilityRadius(altitudeKm, atmVis),
      })
    }

    frames.push(frame)
  }

  return frames
}

/**
 * 解算完整任务:发射上升 → 助推分离落各落区 → 入 LEO → 绕地一圈
 */
export function solveMission(
  launch: MissionPoint,
  debrisLandings: MissionPoint[],
  leoAltitudeKm: number,
  opts: SolveOptions = {},
): MissionSolution | null {
  if (debrisLandings.length === 0)
    return null

  const ascentTimeMin = opts.ascentTimeMin ?? DEFAULT_ASCENT_TIME_MIN
  const atmVis = opts.atmosphericVisibilityKm ?? DEFAULT_ATMOSPHERIC_VISIBILITY_KM
  const frameCount = opts.frameCount ?? DEFAULT_FRAME_COUNT

  const launchLngLat: LngLat = { lng: launch.lng, lat: launch.lat }

  // 最远落点定发射方位
  let farthest = debrisLandings[0]!
  let farthestD = 0
  for (const p of debrisLandings) {
    const d = haversineDistance(launchLngLat, p)
    if (d > farthestD) {
      farthestD = d
      farthest = p
    }
  }
  const bearing = calculateBearing(launchLngLat, farthest)
  const inclinationDeg = inclinationFromBearing(launch.lat, bearing)

  // 入轨点
  const insertRangeKm = insertRangeFor(leoAltitudeKm)
  const insertArr = destinationPoint(launchLngLat, bearing, insertRangeKm)
  const insertPoint: [number, number] = [insertArr[0], insertArr[1]]

  // 上升段
  const ascent = solveAscent(
    launchLngLat,
    { lng: insertPoint[0], lat: insertPoint[1] },
    leoAltitudeKm,
    ascentTimeMin,
  )

  // 残骸
  const debris = debrisLandings.map((landing, idx) =>
    solveDebris(launchLngLat, bearing, landing, leoAltitudeKm, insertRangeKm, ascentTimeMin, idx),
  )

  // 轨道一圈
  const orbit = solveOrbitTrack(insertPoint[0], insertPoint[1], inclinationDeg, leoAltitudeKm, ascentTimeMin)

  const frames = buildFrames(ascent, debris, orbit, ascentTimeMin, leoAltitudeKm, atmVis, frameCount)

  return {
    launch,
    bearing,
    inclinationDeg,
    leoAltitudeKm,
    ascentTimeMin,
    totalTimeMin: ascentTimeMin + orbit.periodMin,
    ascent,
    insertPoint,
    debris,
    orbit,
    frames,
  }
}

/** 时间轴查询:返回 t 对应的统一帧(最近) */
export function sampleMissionFrame(frames: MissionFrame[], t: number): MissionFrame {
  if (frames.length === 0)
    return { t, booster: null, debris: [] }
  const last = frames[frames.length - 1]!
  if (t <= frames[0]!.t)
    return frames[0]!
  if (t >= last.t)
    return last
  const idx = Math.round((t / last.t) * (frames.length - 1))
  return frames[clamp(idx, 0, frames.length - 1)]!
}
