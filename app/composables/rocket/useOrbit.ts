import { EARTH_RADIUS_KM } from '~/constants/rocket'

/** 地球引力参数 km³/s² */
const MU_KM3_S2 = 398600.4418
/** 地球自转角速度 rad/s */
const OMEGA_E_RAD_S = 7.2921150e-5

export interface OrbitSolution {
  /** 轨道倾角 ° */
  inclinationDeg: number
  /** 平均高度 km(展示用,圆=高度,椭圆=(近+远)/2) */
  altitudeKm: number
  /** 近地点高度 km */
  perigeeKm: number
  /** 远地点高度 km */
  apogeeKm: number
  /** 偏心率 */
  eccentricity: number
  /** 半长轴 km */
  semiMajorAxisKm: number
  /** 近地点幅角 ° */
  argPerigeeDeg: number
  /** 轨道周期 min */
  periodMin: number
  /** 入轨点速度 km/s(近地点速度,圆轨道=轨道速度) */
  speedKmPerS: number
  /** 入轨点 [lng, lat] */
  insertPoint: [number, number]
  /** 一圈星下点轨迹 [lng, lat][] */
  groundTrack: [number, number][]
  /** 与 groundTrack 同长的高度序列 km(椭圆轨道随时刻变化) */
  altitudesKm: number[]
  /** 是否椭圆轨道 */
  elliptical: boolean
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
 * 牛顿迭代解开普勒方程 E - e·sin(E) = M
 * 平均运动 n = 2π/T(M 随时间线性变化),由 E 求真近点角 ν
 */
function solveKepler(M: number, e: number, tol = 1e-9): number {
  // 规范化 M 到 [-π, π]
  const m = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1)
  for (let i = 0; i < 40; i++) {
    const f = E - e * Math.sin(E) - m
    const fp = 1 - e * Math.cos(E)
    const dE = f / fp
    E -= dE
    if (Math.abs(dE) < tol)
      return E
  }
  return E
}

/** 偏近点角 E → 真近点角 ν */
function trueAnomalyFromE(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )
}

/**
 * 解算一圈星下点轨迹(圆 + 椭圆统一,考虑地球自转,忽略 J2)
 * 轨道平面惯性固定,地球自转使星下点逐圈西移,一圈不闭合(开口)。
 *
 * 入轨点被视为轨道上的一个点;若为椭圆,其位置由 argPerigee 共同决定
 * (入轨点纬度幅角 u0 由 insertLat 反推,ν0 = u0 − ω)。
 */
export function solveOrbitTrack(
  insertLng: number,
  insertLat: number,
  inclinationDeg: number,
  altitudeKm: number,
  ascentTimeMin: number,
  sampleCount = 120,
  options?: {
    perigeeKm?: number
    apogeeKm?: number
    argPerigeeDeg?: number
    /** 发射方位角 °(用于判断入轨点是升段 / 降段,避免星下点反向) */
    bearingDeg?: number
  },
): OrbitSolution {
  const hPer = options?.perigeeKm ?? altitudeKm
  const hApo = options?.apogeeKm ?? altitudeKm
  const argPerDeg = options?.argPerigeeDeg ?? 0

  const rPer = EARTH_RADIUS_KM + hPer
  const rApo = EARTH_RADIUS_KM + hApo
  const a = (rPer + rApo) / 2
  const e = (rApo - rPer) / (rApo + rPer)
  const isElliptical = e > 1e-6

  const periodSec = 2 * Math.PI * Math.sqrt((a ** 3) / MU_KM3_S2)
  const n = (2 * Math.PI) / periodSec
  // 近地点速度(v = √(μ(2/r_per - 1/a)))
  const vPerigee = Math.sqrt(MU_KM3_S2 * (2 / rPer - 1 / a))

  const i = toRad(inclinationDeg)
  const sinI = Math.sin(i)
  const cosI = Math.cos(i)
  const tIns = ascentTimeMin * 60
  const argPer = toRad(argPerDeg)

  // 入轨点在轨道上的纬度幅角 u0:asin 给主值 ∈ [-π/2, π/2](升段,向北飞)
  // 根据发射方位角判断实际是升段还是降段:
  //   cos(bearing) < 0(向南飞)→ 降段,u0 ∈ (π/2, π)→ 取 π − asin
  const lat0 = toRad(insertLat)
  const sinU0 = clamp(Math.sin(lat0) / sinI, -1, 1)
  const u0Principal = Math.asin(sinU0)
  const bearingDeg = options?.bearingDeg
  const isSouthbound = bearingDeg !== undefined && Math.cos(toRad(bearingDeg)) < 0
  const u0 = isSouthbound ? Math.PI - u0Principal : u0Principal

  // 升交点经度 Ω(由入轨点惯性经度反推)
  const lam0Inertial = toRad(insertLng) + OMEGA_E_RAD_S * tIns
  const raan = lam0Inertial - Math.atan2(Math.sin(u0) * cosI, Math.cos(u0))

  // 入轨点的真近点角 ν0(相对近地点)
  const nu0 = u0 - argPer
  // ν0 → E0 → M0(标准椭圆轨道反推公式)
  const E0 = 2 * Math.atan2(
    Math.sqrt(1 - e) * Math.sin(nu0 / 2),
    Math.sqrt(1 + e) * Math.cos(nu0 / 2),
  )
  const M0 = E0 - e * Math.sin(E0)

  const groundTrack: [number, number][] = []
  const altitudesKm: number[] = []

  for (let k = 0; k <= sampleCount; k++) {
    const tau = (k / sampleCount) * periodSec
    // 平均近点角 M(τ) = M0 + n·τ
    const M = M0 + n * tau
    const E = solveKepler(M, e)
    const nu = trueAnomalyFromE(E, e)
    const r = a * (1 - e * Math.cos(E))
    const h = r - EARTH_RADIUS_KM
    const u = argPer + nu
    const sinU = Math.sin(u)
    const cosU = Math.cos(u)
    const lat = Math.asin(sinI * sinU)
    const lamInertial = raan + Math.atan2(sinU * cosI, cosU)
    const lamGround = lamInertial - OMEGA_E_RAD_S * (tIns + tau)
    groundTrack.push([normLng(toDeg(lamGround)), toDeg(lat)])
    altitudesKm.push(h)
  }

  return {
    inclinationDeg,
    altitudeKm: (hPer + hApo) / 2,
    perigeeKm: hPer,
    apogeeKm: hApo,
    eccentricity: e,
    semiMajorAxisKm: a,
    argPerigeeDeg: argPerDeg,
    periodMin: periodSec / 60,
    speedKmPerS: vPerigee,
    insertPoint: [insertLng, insertLat],
    groundTrack,
    altitudesKm,
    elliptical: isElliptical,
  }
}
