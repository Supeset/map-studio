import { EARTH_RADIUS_KM } from '~/constants/rocket'

/** 地球引力参数 km³/s² */
const MU_KM3_S2 = 398600.4418
/** 地球自转角速度 rad/s */
const OMEGA_E_RAD_S = 7.2921150e-5

export interface OrbitSolution {
  /** 轨道倾角 ° */
  inclinationDeg: number
  /** 轨道高度 km */
  altitudeKm: number
  /** 轨道周期 min */
  periodMin: number
  /** 轨道速度 km/s */
  speedKmPerS: number
  /** 入轨点 [lng, lat] */
  insertPoint: [number, number]
  /** 一圈星下点轨迹 [lng, lat][] */
  groundTrack: [number, number][]
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}
/** 经度归一化到 [−180, 180] */
function normLng(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

/**
 * 由发射场纬度与发射方位角推导轨道倾角(沿发射方位延伸)
 * cos i = cos(φ) · sin(A)
 * 正东(A=90°)→ i=φ;正北(A=0°)→ i=90°(极地)
 */
export function inclinationFromBearing(launchLatDeg: number, bearingDeg: number): number {
  const cosI = Math.cos(toRad(launchLatDeg)) * Math.sin(toRad(bearingDeg))
  return toDeg(Math.acos(clamp(cosI, -1, 1)))
}

/** 圆轨道周期 min */
export function orbitPeriodMin(altitudeKm: number): number {
  const a = EARTH_RADIUS_KM + altitudeKm
  const periodSec = 2 * Math.PI * Math.sqrt((a ** 3) / MU_KM3_S2)
  return periodSec / 60
}

/** 圆轨道速度 km/s */
export function orbitSpeedKmPerS(altitudeKm: number): number {
  const a = EARTH_RADIUS_KM + altitudeKm
  return Math.sqrt(MU_KM3_S2 / a)
}

/**
 * 解算一圈星下点轨迹(圆轨道 + 地球自转,忽略 J2)
 * 轨道平面惯性固定,地球自转使星下点逐圈西移,故一圈轨迹不闭合(开口)。
 */
export function solveOrbitTrack(
  insertLng: number,
  insertLat: number,
  inclinationDeg: number,
  altitudeKm: number,
  ascentTimeMin: number,
  sampleCount = 120,
): OrbitSolution {
  const periodMin = orbitPeriodMin(altitudeKm)
  const periodSec = periodMin * 60
  const speedKmPerS = orbitSpeedKmPerS(altitudeKm)

  const i = toRad(inclinationDeg)
  const sinI = Math.sin(i)
  const cosI = Math.cos(i)
  const tIns = ascentTimeMin * 60

  // 入轨点在轨道上的纬度幅角 u0
  const lat0 = toRad(insertLat)
  const sinU0 = clamp(Math.sin(lat0) / sinI, -1, 1)
  const u0 = Math.asin(sinU0)

  // 入轨点惯性经度(地面点随地球东转)+ 升交点经度 Ω 反推
  const lam0Inertial = toRad(insertLng) + OMEGA_E_RAD_S * tIns
  const raan = lam0Inertial - Math.atan2(Math.sin(u0) * cosI, Math.cos(u0))

  const groundTrack: [number, number][] = []
  for (let k = 0; k <= sampleCount; k++) {
    const tau = (k / sampleCount) * periodSec
    const u = u0 + (2 * Math.PI * tau) / periodSec
    const sinU = Math.sin(u)
    const cosU = Math.cos(u)
    const lat = Math.asin(sinI * sinU)
    const lamInertial = raan + Math.atan2(sinU * cosI, cosU)
    const lamGround = lamInertial - OMEGA_E_RAD_S * (tIns + tau)
    groundTrack.push([normLng(toDeg(lamGround)), toDeg(lat)])
  }

  return {
    inclinationDeg,
    altitudeKm,
    periodMin,
    speedKmPerS,
    insertPoint: [insertLng, insertLat],
    groundTrack,
  }
}
