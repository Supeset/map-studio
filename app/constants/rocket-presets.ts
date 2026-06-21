import { DEFAULT_ATMOSPHERIC_VISIBILITY_KM } from '~/constants/rocket'

/** 弹道形状参数(归一化水平距离 τ ∈ [0,1]) */
export interface TrajectoryProfile {
  /** 起飞段(近垂直爬升)结束位置 τ */
  climbStart: number
  /** 顶点段开始位置 τ */
  apogeeStart: number
  /** 起飞段结束时的归一化高度占比(0~1) */
  liftoffFrac: number
}

export interface RocketPreset {
  id: string
  name: string
  category: 'orbital' | 'suborbital' | 'heavy'
  /** 最大飞行高度 km(顶点) */
  maxAltitudeKm: number
  /** 总飞行时间 min */
  flightTimeMin: number
  /** 弹道形状参数 */
  profile: TrajectoryProfile
  /** 大气能见度 km(影响有效可见半径) */
  atmosphericVisibilityKm: number
}

/** 标准重力转向弹道:近垂直起飞 → 程序转弯 → 顶点缓升 → 抛物下落 */
const STANDARD_PROFILE: TrajectoryProfile = {
  climbStart: 0.08,
  apogeeStart: 0.55,
  liftoffFrac: 0.18,
}

/** 亚轨道弹道:更早达到顶点,下落段更长 */
const SUBORBITAL_PROFILE: TrajectoryProfile = {
  climbStart: 0.05,
  apogeeStart: 0.4,
  liftoffFrac: 0.22,
}

export const ROCKET_PRESETS: RocketPreset[] = [
  {
    id: 'cz-5',
    name: '长征五号',
    category: 'heavy',
    maxAltitudeKm: 200,
    flightTimeMin: 8,
    profile: STANDARD_PROFILE,
    atmosphericVisibilityKm: DEFAULT_ATMOSPHERIC_VISIBILITY_KM,
  },
  {
    id: 'falcon-9',
    name: 'Falcon 9',
    category: 'orbital',
    maxAltitudeKm: 180,
    flightTimeMin: 9,
    profile: STANDARD_PROFILE,
    atmosphericVisibilityKm: DEFAULT_ATMOSPHERIC_VISIBILITY_KM,
  },
  {
    id: 'starship',
    name: 'Starship',
    category: 'heavy',
    maxAltitudeKm: 250,
    flightTimeMin: 10,
    profile: STANDARD_PROFILE,
    atmosphericVisibilityKm: DEFAULT_ATMOSPHERIC_VISIBILITY_KM,
  },
  {
    id: 'suborbital',
    name: '通用亚轨道',
    category: 'suborbital',
    maxAltitudeKm: 120,
    flightTimeMin: 5,
    profile: SUBORBITAL_PROFILE,
    atmosphericVisibilityKm: DEFAULT_ATMOSPHERIC_VISIBILITY_KM,
  },
  {
    id: 'custom',
    name: '自定义',
    category: 'orbital',
    maxAltitudeKm: 200,
    flightTimeMin: 8,
    profile: STANDARD_PROFILE,
    atmosphericVisibilityKm: DEFAULT_ATMOSPHERIC_VISIBILITY_KM,
  },
]

export const DEFAULT_PRESET_ID = 'cz-5'

export function getPreset(id: string): RocketPreset {
  return ROCKET_PRESETS.find(p => p.id === id) ?? ROCKET_PRESETS[0]!
}
