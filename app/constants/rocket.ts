// ============ 发射场 ============
export const PADS_SOURCE_ID = 'pads-source'
export const PADS_CLUSTER_ID = 'pads-clusters'
export const PADS_COUNT_ID = 'pads-cluster-count'
export const PADS_POINT_ID = 'pads-point'
export const PADS_LABEL_ID = 'pads-label'

// ============ 回收场 ============
export const LANDING_SOURCE_ID = 'landing-source'
export const LANDING_CLUSTER_ID = 'landing-clusters'
export const LANDING_COUNT_ID = 'landing-cluster-count'
export const LANDING_POINT_ID = 'landing-point'
export const LANDING_LABEL_ID = 'landing-label'

// ============ 任务剖面 · 静态层(上升 / 残骸弹道 / 轨道一圈 / 热力 / 端点标记) ============
export const ROCKET_VIS_STATIC_SOURCE = 'rocket-vis-static-source'
export const ROCKET_ASCENT_LAYER = 'rocket-ascent-trajectory'
export const ROCKET_ORBIT_LAYER = 'rocket-orbit-track'
export const ROCKET_DEBRIS_PATH_LAYER = 'rocket-debris-path'
export const ROCKET_HEATMAP_LAYER = 'rocket-heatmap'
export const ROCKET_MARKERS_LAYER = 'rocket-markers'

// ============ 任务剖面 · 动态层(当前主体 + 残骸可见圆 / 位置) ============
export const ROCKET_VIS_DYNAMIC_SOURCE = 'rocket-vis-dynamic-source'
export const ROCKET_VIS_BOOSTER_FILL_LAYER = 'rocket-vis-booster-fill'
export const ROCKET_VIS_BOOSTER_OUTLINE_LAYER = 'rocket-vis-booster-outline'
export const ROCKET_VIS_DEBRIS_FILL_LAYER = 'rocket-vis-debris-fill'
export const ROCKET_VIS_DEBRIS_OUTLINE_LAYER = 'rocket-vis-debris-outline'
export const ROCKET_BOOSTER_MARKER_LAYER = 'rocket-booster-marker'
export const ROCKET_DEBRIS_MARKER_LAYER = 'rocket-debris-marker'

// ============ 几何常量 ============
/** 对数高度曲线参数:k 越大,爬升段前期斜率越大 */
export const ROCKET_LOG_K = 9
export const EARTH_RADIUS_KM = 6371
export const ATMOSPHERIC_REFRACTION_K = 7 / 6
/** 有效地球半径(考虑大气折射) */
export const EARTH_EFFECTIVE_RADIUS_KM = EARTH_RADIUS_KM * ATMOSPHERIC_REFRACTION_K

/** 默认大气能见度 km(晴朗天气) */
export const DEFAULT_ATMOSPHERIC_VISIBILITY_KM = 20

/** 时间轴采样数 */
export const ROCKET_FRAME_COUNT = 60
/** 长距离(跨洲际)采样数 */
export const ROCKET_FRAME_COUNT_LONG = 90
export const ROCKET_LONG_DISTANCE_THRESHOLD_KM = 2000
