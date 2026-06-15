export const PADS_SOURCE_ID = 'pads-source'
export const PADS_CLUSTER_ID = 'pads-clusters'
export const PADS_COUNT_ID = 'pads-cluster-count'
export const PADS_POINT_ID = 'pads-point'
export const PADS_LABEL_ID = 'pads-label'

export const LANDING_SOURCE_ID = 'landing-source'
export const LANDING_CLUSTER_ID = 'landing-clusters'
export const LANDING_COUNT_ID = 'landing-cluster-count'
export const LANDING_POINT_ID = 'landing-point'
export const LANDING_LABEL_ID = 'landing-label'

// 可见性计算相关图层
export const VISIBILITY_SOURCE_ID = 'rocket-visibility-source'
export const VISIBILITY_FILL_LAYER_ID = 'rocket-visibility-fill'
export const VISIBILITY_OUTLINE_LAYER_ID = 'rocket-visibility-outline'
export const VISIBILITY_TRAJECTORY_LAYER_ID = 'rocket-visibility-trajectory'
export const VISIBILITY_MARKERS_LAYER_ID = 'rocket-visibility-markers'

// 大型运载火箭的默认飞行参数
export const ROCKET_MAX_HEIGHT_KM = 250
export const ROCKET_TOTAL_TIME_MIN = 8
export const ROCKET_SAMPLE_COUNT = 50
export const ROCKET_SAMPLE_COUNT_LONG = 80
export const ROCKET_LONG_DISTANCE_THRESHOLD_KM = 2000

// 对数高度曲线参数：h(τ) = H_max · (1 - log(1 + k·(1-τ)) / log(1 + k))
// k 越大，前期（发射点附近）高度增长越慢
export const ROCKET_LOG_K = 9

// 几何可见性参数：R_eff = k · R
export const EARTH_RADIUS_KM = 6371
export const ATMOSPHERIC_REFRACTION_K = 7 / 6
export const EARTH_EFFECTIVE_RADIUS_KM = EARTH_RADIUS_KM * ATMOSPHERIC_REFRACTION_K
