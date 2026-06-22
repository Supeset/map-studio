/** 轨道类型 id(用于任务轨迹的入轨轨道选择) */
export type OrbitTypeId = 'leo' | 'iss' | 'sso' | 'polar' | 'gto' | 'molniya'

export interface OrbitPreset {
  id: OrbitTypeId
  /** 中文简称 */
  name: string
  /** 简介(用于 tooltip) */
  description: string
  /** 近地点高度 km */
  perigeeKm: number
  /** 远地点高度 km(圆轨道时 = perigeeKm) */
  apogeeKm: number
  /** 倾角 °(null = 由发射方位自动推导) */
  inclinationDeg: number | null
  /** 若 true,忽略 inclinationDeg 与方位角推导,直接用 |发射场纬度| 作倾角(典型 GTO 简化) */
  useLaunchLatitudeAsInclination?: boolean
  /** 近地点幅角 °(椭圆轨道有意义;圆轨道为 0) */
  argPerigeeDeg: number
  /** 是否椭圆 */
  elliptical: boolean
  /** 默认播放倍率(整圈时长过长时提高) */
  defaultPlaybackRate: number
}

/**
 * 入轨轨道预设
 * - 圆轨道:perigee = apogee,展示一圈星下点
 * - 椭圆轨道:用开普勒方程求解真近点角(远地点慢、近地点快)
 */
export const ORBIT_PRESETS: OrbitPreset[] = [
  {
    id: 'leo',
    name: 'LEO 低轨',
    description: '300–500 km 低地球圆轨道,倾角由发射方位自动推导',
    perigeeKm: 400,
    apogeeKm: 400,
    inclinationDeg: null,
    argPerigeeDeg: 0,
    elliptical: false,
    defaultPlaybackRate: 1,
  },
  {
    id: 'iss',
    name: 'ISS 国际空间站',
    description: '~400 km 近圆轨道,倾角 51.6°',
    perigeeKm: 400,
    apogeeKm: 420,
    inclinationDeg: 51.6,
    argPerigeeDeg: 0,
    elliptical: false,
    defaultPlaybackRate: 1,
  },
  {
    id: 'sso',
    name: 'SSO 太阳同步',
    description: '~600 km 圆轨道,倾角 ~98°(逆行)',
    perigeeKm: 600,
    apogeeKm: 600,
    inclinationDeg: 98,
    argPerigeeDeg: 0,
    elliptical: false,
    defaultPlaybackRate: 1,
  },
  {
    id: 'polar',
    name: '极地轨道',
    description: '~800 km 圆轨道,倾角 90°(飞越南北极)',
    perigeeKm: 800,
    apogeeKm: 800,
    inclinationDeg: 90,
    argPerigeeDeg: 0,
    elliptical: false,
    defaultPlaybackRate: 1,
  },
  {
    id: 'gto',
    name: 'GTO 地球同步转移',
    description: '2000 km 圆轨道近似,倾角 = 发射场纬度',
    perigeeKm: 2000,
    apogeeKm: 2000,
    inclinationDeg: null,
    useLaunchLatitudeAsInclination: true,
    argPerigeeDeg: 0,
    elliptical: false,
    defaultPlaybackRate: 2,
  },
  {
    id: 'molniya',
    name: 'Molniya 闪电',
    description: '500 × 40000 km,倾角 63.4°,ω=270°,周期约 12 小时',
    perigeeKm: 500,
    apogeeKm: 40000,
    inclinationDeg: 63.4,
    argPerigeeDeg: 270,
    elliptical: true,
    defaultPlaybackRate: 4,
  },
]

export const DEFAULT_ORBIT_TYPE_ID: OrbitTypeId = 'leo'

export function findOrbitPreset(id: OrbitTypeId): OrbitPreset {
  return ORBIT_PRESETS.find(p => p.id === id) ?? ORBIT_PRESETS[0]!
}
