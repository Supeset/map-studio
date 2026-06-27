import type { OrbitSolution } from '~/composables/rocket/useOrbit'
import type { AscentFrame } from '~/composables/rocket/useTrajectory'
import type { OrbitPreset } from '~/constants/orbit-presets'
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
}

/** 完整任务解算结果 */
export interface MissionSolution {
  launch: MissionPoint
  /** 发射方位角 ° */
  bearing: number
  /** 轨道倾角 ° */
  inclinationDeg: number
  /** 轨道预设(入轨类型) */
  orbitPreset: OrbitPreset
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
function insertRangeFor(perigeeKm: number): number {
  return Math.max(800, 600 + perigeeKm * 4)
}

/** 解算单个残骸(分离点 → 落区) */
function solveDebris(
  launch: LngLat,
  bearing: number,
  landing: MissionPoint,
  perigeeKm: number,
  insertRangeKm: number,
  ascentTimeMin: number,
  idx: number,
): DebrisSolution {
  const dist = haversineDistance(launch, landing)
  const vHoriz = insertRangeKm / ascentTimeMin

  // 分离后助推器水平滑行(继承主体水平速度),落点 = 分离点 + 滑行距离
  const glideAt = (s: number): number =>
    vHoriz * clamp(Math.sqrt(ascentAltitude(s / insertRangeKm, perigeeKm)) * 0.3, 2, 8)

  // 反推分离点距离 sSep:dist = sSep + glide(sSep)(扣除滑行 → 分离更早、点更近)
  // f(s)=s+glide(s)-dist 单调增,二分求解
  const lo = 50
  const hi = Math.min(dist, insertRangeKm * 0.95)
  let sSep = lo
  if (lo < hi && lo + glideAt(lo) < dist) {
    let a = lo
    let b = hi
    for (let k = 0; k < 24; k++) {
      const m = (a + b) / 2
      if (m + glideAt(m) < dist)
        a = m
      else
        b = m
    }
    sSep = (a + b) / 2
  }

  const τ = sSep / insertRangeKm
  const sepAltitudeKm = ascentAltitude(τ, perigeeKm)
  const sepTimeMin = τ * ascentTimeMin
  const fallTimeMin = clamp(Math.sqrt(sepAltitudeKm) * 0.3, 2, 8)
  const sepPoint = destinationPoint(launch, bearing, sSep)

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

/** 标量数组浮点索引线性插值(用于轨道高度序列) */
function interpolateAltitudes(alts: number[], idx: number): number {
  const last = alts.length - 1
  const i = Math.floor(idx)
  const a = alts[clamp(i, 0, last)]!
  const b = alts[clamp(i + 1, 0, last)]!
  const f = idx - i
  return a + (b - a) * f
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

/** 生成统一时间帧(贯穿上升 + 轨道一圈) */
function buildFrames(
  ascent: AscentFrame[],
  orbit: OrbitSolution,
  ascentTimeMin: number,
  atmVis: number,
  frameCount: number,
): MissionFrame[] {
  const tAscent = ascentTimeMin
  const tOrbit = orbit.periodMin
  const tTotal = tAscent + tOrbit
  const frames: MissionFrame[] = []
  const trackLast = orbit.groundTrack.length - 1

  for (let i = 0; i <= frameCount; i++) {
    const t = (i / frameCount) * tTotal
    const frame: MissionFrame = { t, booster: null }

    if (t <= tAscent) {
      frame.booster = interpolateAscent(ascent, t, atmVis)
    }
    else {
      const oτ = clamp((t - tAscent) / tOrbit, 0, 1)
      const idx = oτ * trackLast
      const pos = interpolateTrack(orbit.groundTrack, idx)
      const altitudeKm = interpolateAltitudes(orbit.altitudesKm, idx)
      frame.booster = {
        id: 'booster',
        pos,
        altitudeKm,
        visibilityRadiusKm: effectiveVisibilityRadius(altitudeKm, atmVis),
      }
    }

    frames.push(frame)
  }

  return frames
}

/**
 * 解算完整任务:发射上升 → 助推分离落各落区 → 入轨(预设轨道)→ 绕地一圈
 */
export function solveMission(
  launch: MissionPoint,
  debrisLandings: MissionPoint[],
  orbitPreset: OrbitPreset,
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
  // GTO 简化:倾角 = |发射场纬度|(正东射的自然结果);其他轨道按 preset 或方位角推导
  const inclinationDeg = orbitPreset.useLaunchLatitudeAsInclination
    ? Math.abs(launch.lat)
    : (orbitPreset.inclinationDeg ?? inclinationFromBearing(launch.lat, bearing))

  // 入轨点(高度由近地点决定,射程按近地点推导)
  const insertRangeKm = insertRangeFor(orbitPreset.perigeeKm)
  const insertArr = destinationPoint(launchLngLat, bearing, insertRangeKm)
  const insertPoint: [number, number] = [insertArr[0], insertArr[1]]

  // 上升段(0 → 近地点高度)
  const ascent = solveAscent(
    launchLngLat,
    { lng: insertPoint[0], lat: insertPoint[1] },
    orbitPreset.perigeeKm,
    ascentTimeMin,
  )

  // 残骸(分离高度上限 = 近地点高度)
  const debris = debrisLandings.map((landing, idx) =>
    solveDebris(launchLngLat, bearing, landing, orbitPreset.perigeeKm, insertRangeKm, ascentTimeMin, idx),
  )

  // 轨道一圈(圆 / 椭圆统一)
  const orbit = solveOrbitTrack(
    insertPoint[0],
    insertPoint[1],
    inclinationDeg,
    orbitPreset.perigeeKm,
    ascentTimeMin,
    undefined,
    {
      perigeeKm: orbitPreset.perigeeKm,
      apogeeKm: orbitPreset.apogeeKm,
      argPerigeeDeg: orbitPreset.argPerigeeDeg,
      bearingDeg: bearing,
    },
  )

  const frames = buildFrames(ascent, orbit, ascentTimeMin, atmVis, frameCount)

  return {
    launch,
    bearing,
    inclinationDeg,
    orbitPreset,
    ascentTimeMin,
    totalTimeMin: ascentTimeMin + orbit.periodMin,
    ascent,
    insertPoint,
    debris,
    orbit,
    frames,
  }
}

/** 时间轴查询:返回 t 对应的统一帧(相邻帧间线性插值,避免量化跳跃) */
export function sampleMissionFrame(frames: MissionFrame[], t: number): MissionFrame {
  if (frames.length === 0)
    return { t, booster: null }
  const first = frames[0]!
  const last = frames[frames.length - 1]!
  if (t <= first.t)
    return first
  if (t >= last.t)
    return last

  // 浮点索引在相邻帧间线性插值(避免 Math.round 量化导致的红点跳跃卡顿)
  const idx = (t / last.t) * (frames.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  const a = frames[i]!
  const b = frames[i + 1] ?? a

  const lerp = (x: number, y: number): number => x + (y - x) * f
  const interpState = (x: ObjectState, y: ObjectState): ObjectState => ({
    id: x.id,
    pos: [lerp(x.pos[0], y.pos[0]), lerp(x.pos[1], y.pos[1])],
    altitudeKm: lerp(x.altitudeKm, y.altitudeKm),
    visibilityRadiusKm: lerp(x.visibilityRadiusKm, y.visibilityRadiusKm),
  })

  const booster = a.booster && b.booster
    ? interpState(a.booster, b.booster)
    : (a.booster ?? b.booster)

  return { t, booster }
}
