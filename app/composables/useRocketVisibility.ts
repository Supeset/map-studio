import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { GeoJSONSource, Map, MapMouseEvent } from 'mapbox-gl'
import type MapboxDraw from '@mapbox/mapbox-gl-draw'
import type { EnrichedPad } from '~/components/rocket/ListPanel.vue'
import mapboxgl from 'mapbox-gl'
import {
  EARTH_EFFECTIVE_RADIUS_KM,
  PADS_POINT_ID,
  ROCKET_LOG_K,
  ROCKET_LONG_DISTANCE_THRESHOLD_KM,
  ROCKET_MAX_HEIGHT_KM,
  ROCKET_SAMPLE_COUNT,
  ROCKET_SAMPLE_COUNT_LONG,
  ROCKET_TOTAL_TIME_MIN,
  VISIBILITY_FILL_LAYER_ID,
  VISIBILITY_MARKERS_LAYER_ID,
  VISIBILITY_OUTLINE_LAYER_ID,
  VISIBILITY_SOURCE_ID,
  VISIBILITY_TRAJECTORY_LAYER_ID,
} from '~/constants/rocket'
import {
  calculateBearing,
  destinationPoint,
  generateCirclePolygon,
  haversineDistance,
  polygonCentroid,
} from '~/utils/geometry'

export type VisibilityStep = 'idle' | 'select-pad' | 'select-polygon' | 'result'

export interface LandingInfo {
  /** 落区要素 ID（Mapbox Draw polygon id） */
  id: string
  /** 落区序号（按距离排序，从 1 开始） */
  index: number
  /** 距发射点的水平距离 km */
  distanceKm: number
  /** 在主轨迹上的归一化位置 τ = distanceKm / maxDist */
  τ: number
  /** 该落区对应的飞行高度 km（用户可调） */
  heightKm: number
  /** 该落区对应的可见半径 km */
  visibilityRadiusKm: number
}

export interface VisibilityResult {
  maxHeightKm: number
  maxVisibilityRadiusKm: number
  totalTrajectoryLengthKm: number
  flightTimeMin: number
  landingCount: number
  /** 按距离排序后的落区信息 */
  landings: LandingInfo[]
}

export function visibilityRadius(h_km: number): number {
  if (h_km <= 0)
    return 0
  return Math.sqrt(2 * EARTH_EFFECTIVE_RADIUS_KM * h_km)
}

/**
 * 对数高度模型：发射点（τ=0, h=0）→ 落点（τ=1, h=hMax）
 * 凸形对数曲线：前期慢（发射点附近高度低），后期快（接近落点高度最高）
 */
export function heightAt(τ: number, hMax: number): number {
  if (τ <= 0)
    return 0
  if (τ >= 1)
    return hMax
  return hMax * (1 - Math.log(1 + ROCKET_LOG_K * (1 - τ)) / Math.log(1 + ROCKET_LOG_K))
}

/**
 * 可见半径沿轨迹：d 与 √h 成正比，峰值在落点处等于 dMax
 */
export function radiusAt(τ: number, hMax: number, dMax: number): number {
  if (hMax <= 0)
    return 0
  const h = heightAt(τ, hMax)
  return dMax * Math.sqrt(Math.max(h / hMax, 0))
}

/**
 * 分段对数插值：根据 keyPoints（按 dist 升序），在指定 dist 处插值出高度
 * 每段用凹形对数曲线过渡（前期斜率大、后期斜率小），符合火箭起飞急速爬升、到顶点放缓的物理特征
 */
export function interpolateHeight(keyPoints: { dist: number, h: number }[], dist: number): number {
  if (keyPoints.length === 0)
    return 0
  if (dist <= keyPoints[0]!.dist)
    return keyPoints[0]!.h
  const last = keyPoints[keyPoints.length - 1]!
  if (dist >= last.dist)
    return last.h

  for (let i = 0; i < keyPoints.length - 1; i++) {
    const p0 = keyPoints[i]!
    const p1 = keyPoints[i + 1]!
    if (dist >= p0.dist && dist <= p1.dist) {
      const segLen = p1.dist - p0.dist
      const τ = segLen > 0 ? (dist - p0.dist) / segLen : 1
      const logT = Math.log(1 + ROCKET_LOG_K * τ) / Math.log(1 + ROCKET_LOG_K)
      return p0.h + (p1.h - p0.h) * logT
    }
  }
  return last.h
}

const DEFAULT_LANDING_HEIGHT_KM = 100

interface RocketVisibilityOptions {
  drawInstance: Ref<MapboxDraw | null>
  setDrawMode: (mode: string) => void
  padsData: Ref<EnrichedPad[]>
  isActive: Ref<boolean>
}

export function useRocketVisibility(
  mapInstance: Ref<Map | undefined>,
  isMapLoaded: Ref<boolean>,
  options: RocketVisibilityOptions,
) {
  const step = ref<VisibilityStep>('idle')
  const selectedPad = ref<EnrichedPad | null>(null)
  const selectedPolygonIds = ref<string[]>([])
  const result = ref<VisibilityResult | null>(null)
  const errorMessage = ref<string | null>(null)

  // 用户可调参数
  const maxVisibilityRadiusKm = ref(Math.round(visibilityRadius(ROCKET_MAX_HEIGHT_KM)))
  /** 每个落区（polyId）的飞行高度 km，用户可调 */
  const landingHeights = ref<Record<string, number>>({})

  function setLandingHeight(id: string, heightKm: number) {
    const clamped = Math.max(0, Math.min(500, Math.round(heightKm)))
    landingHeights.value = { ...landingHeights.value, [id]: clamped }
  }

  const canCalculate = computed(
    () => !!selectedPad.value && selectedPolygonIds.value.length > 0,
  )

  function handlePadClick(e: MapMouseEvent & { features?: any[] }) {
    if (!e.features?.[0])
      return
    const props = e.features[0].properties || {}
    const pad = options.padsData.value.find(p => p.record_id === props.record_id)
    if (pad) {
      selectedPad.value = pad
    }
    else {
      selectedPad.value = {
        record_id: props.record_id ?? '',
        latitude: Number(props.latitude),
        longitude: Number(props.longitude),
        name: props.name ?? '未知发射场',
        location_name_en: props.location_name_en ?? '',
        country: props.country ?? '',
        launch_center: props.launch_center ?? '',
        coordinates: props.coordinates ?? '',
      }
    }

    const map = mapInstance.value
    if (map)
      map.off('click', PADS_POINT_ID, handlePadClick as any)

    enterSelectPolygonMode()
  }

  function handleSelectionChange(e: any) {
    errorMessage.value = null
    const features: Feature[] = e.features || []
    if (features.length === 0) {
      selectedPolygonIds.value = []
      landingHeights.value = {}
      clearResultLayers()
      result.value = null
      return
    }

    const polygons = features.filter(f => f.geometry?.type === 'Polygon')
    if (polygons.length === 0) {
      errorMessage.value = '请选择一个或多个面要素（多边形），不支持点或线'
      return
    }

    if (polygons.length < features.length) {
      errorMessage.value = `已忽略 ${features.length - polygons.length} 个非面要素，仅使用 ${polygons.length} 个多边形作为落区`
    }

    const newIds = polygons.map(f => String(f.id))

    // 为新加入的落区初始化默认高度（按编号递增：80, 160, 240...）
    const nextHeights = { ...landingHeights.value }
    newIds.forEach((id, idx) => {
      if (!(id in nextHeights))
        nextHeights[id] = DEFAULT_LANDING_HEIGHT_KM * (idx + 1)
    })
    // 清理失效落区
    Object.keys(nextHeights).forEach((id) => {
      if (!newIds.includes(id))
        delete nextHeights[id]
    })
    landingHeights.value = nextHeights

    selectedPolygonIds.value = newIds
    calculate()
  }

  function enterSelectPadMode() {
    if (!options.isActive.value)
      return
    const map = mapInstance.value
    if (!map)
      return

    // 防御性 off，避免重复绑定
    map.off('click', PADS_POINT_ID, handlePadClick as any)
    map.off('draw.selectionchange', handleSelectionChange)

    clearResultLayers()
    selectedPad.value = null
    selectedPolygonIds.value = []
    landingHeights.value = {}
    result.value = null
    errorMessage.value = null
    step.value = 'select-pad'

    map.on('click', PADS_POINT_ID, handlePadClick as any)
  }

  function enterSelectPolygonMode() {
    if (!options.isActive.value)
      return
    const map = mapInstance.value
    if (!map)
      return

    map.off('draw.selectionchange', handleSelectionChange)

    clearResultLayers()
    selectedPolygonIds.value = []
    landingHeights.value = {}
    result.value = null
    errorMessage.value = null
    step.value = 'select-polygon'

    // 切换到选择模式，便于用户点击已绘制的面
    options.setDrawMode('simple_select')

    map.on('draw.selectionchange', handleSelectionChange)
  }

  function calculate() {
    const map = mapInstance.value
    const draw = options.drawInstance.value
    if (!map || !draw || !selectedPad.value || selectedPolygonIds.value.length === 0)
      return

    const launch: { lng: number, lat: number } = {
      lng: selectedPad.value.longitude,
      lat: selectedPad.value.latitude,
    }

    // 1. 计算每个落区的距离 + 用户设置的高度，按距离从近到远排序
    const landingsRaw = selectedPolygonIds.value
      .map((polyId) => {
        const feat = draw.get(polyId)
        if (!feat || feat.geometry?.type !== 'Polygon')
          return null
        const polygon = feat.geometry as Polygon
        const centroid = polygonCentroid(polygon.coordinates)
        const dist = haversineDistance(launch, centroid)
        const h = landingHeights.value[polyId] ?? DEFAULT_LANDING_HEIGHT_KM
        return { id: polyId, centroid, dist, h }
      })
      .filter((x): x is { id: string, centroid: { lng: number, lat: number }, dist: number, h: number } => !!x)
      .sort((a, b) => a.dist - b.dist)

    if (landingsRaw.length === 0) {
      errorMessage.value = '落区面已失效，请重新选择'
      return
    }

    const maxDist = landingsRaw[landingsRaw.length - 1]!.dist
    const farthest = landingsRaw[landingsRaw.length - 1]!
    const bearing = calculateBearing(launch, farthest.centroid)

    // 用于分段插值的关键点：(0, 0) → (D1, H1) → ... → (DN, HN)
    const keyPoints = [
      { dist: 0, h: 0 },
      ...landingsRaw.map(l => ({ dist: l.dist, h: l.h })),
    ]
    const maxH = Math.max(...landingsRaw.map(l => l.h), 1)

    // 2. 单条主轨迹（发射点 → 最远落区）按距离采样，高度用分段插值
    const N
      = maxDist > ROCKET_LONG_DISTANCE_THRESHOLD_KM
        ? ROCKET_SAMPLE_COUNT_LONG
        : ROCKET_SAMPLE_COUNT

    const samples: { pos: [number, number], h: number, d: number }[] = []
    let maxD = 0
    for (let i = 0; i <= N; i++) {
      const τ = i / N
      const dist = maxDist * τ
      const h = interpolateHeight(keyPoints, dist)
      const d = maxVisibilityRadiusKm.value * Math.sqrt(Math.max(h / maxH, 0))
      const pos = destinationPoint(launch, bearing, dist)
      samples.push({ pos, h, d })
      if (d > maxD)
        maxD = d
    }

    // 3. 每个落区的信息（高度来自用户设置）
    const landings: LandingInfo[] = landingsRaw.map((l, idx) => {
      const τ = maxDist > 0 ? l.dist / maxDist : 1
      const d = maxVisibilityRadiusKm.value * Math.sqrt(Math.max(l.h / maxH, 0))
      return {
        id: l.id,
        index: idx + 1,
        distanceKm: l.dist,
        τ,
        heightKm: l.h,
        visibilityRadiusKm: d,
      }
    })

    // 4. 沿主轨迹的可见圆
    const visibilityFeatures: Feature[] = samples
      .filter(s => s.d > 0)
      .map(s => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: generateCirclePolygon({ lng: s.pos[0], lat: s.pos[1] }, s.d, 48),
        } as Polygon,
        properties: { kind: 'visibility' },
      }))

    // 5. 主轨迹线
    const trajectoryFeature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: samples.map(s => s.pos),
      },
      properties: { kind: 'trajectory' },
    }

    // 6. 标记点：发射点 + 每个落区中心
    const markerFeatures: Feature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [launch.lng, launch.lat] },
        properties: { kind: 'launch', label: selectedPad.value.name },
      },
      ...landingsRaw.map((l, idx): Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [l.centroid.lng, l.centroid.lat] },
        properties: { kind: 'landing', label: `落区 ${idx + 1}`, order: idx + 1 },
      })),
    ]

    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [...visibilityFeatures, trajectoryFeature, ...markerFeatures],
    }

    renderLayers(collection)

    result.value = {
      maxHeightKm: maxH,
      maxVisibilityRadiusKm: maxD,
      totalTrajectoryLengthKm: maxDist,
      flightTimeMin: ROCKET_TOTAL_TIME_MIN,
      landingCount: landings.length,
      landings,
    }

    step.value = 'result'

    // 自动聚焦整个可见区域
    const bounds = new mapboxgl.LngLatBounds()
    visibilityFeatures.forEach((f) => {
      if (f.geometry?.type === 'Polygon') {
        const ring = f.geometry.coordinates[0]
        if (ring) {
          ring.forEach((coord) => {
            const [lng, lat] = coord as [number, number]
            bounds.extend([lng, lat])
          })
        }
      }
    })
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80 })
    }
  }

  function renderLayers(data: FeatureCollection) {
    const map = mapInstance.value
    if (!map)
      return

    const source = map.getSource(VISIBILITY_SOURCE_ID) as GeoJSONSource | undefined
    if (source) {
      source.setData(data)
      return
    }

    map.addSource(VISIBILITY_SOURCE_ID, { type: 'geojson', data })

    // 极淡填充，仅作背景指示
    map.addLayer({
      id: VISIBILITY_FILL_LAYER_ID,
      type: 'fill',
      source: VISIBILITY_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'visibility'],
      paint: {
        'fill-color': '#f97316',
        'fill-opacity': 0.04,
      },
    })

    // 描边：每个圆形可见区的轮廓
    map.addLayer({
      id: VISIBILITY_OUTLINE_LAYER_ID,
      type: 'line',
      source: VISIBILITY_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'visibility'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#f97316',
        'line-width': 0.6,
        'line-opacity': 0.45,
      },
    })

    map.addLayer({
      id: VISIBILITY_TRAJECTORY_LAYER_ID,
      type: 'line',
      source: VISIBILITY_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'trajectory'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#ea580c',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9,
      },
    })

    map.addLayer({
      id: VISIBILITY_MARKERS_LAYER_ID,
      type: 'circle',
      source: VISIBILITY_SOURCE_ID,
      filter: ['==', ['$type'], 'Point'],
      paint: {
        'circle-radius': 7,
        'circle-color': [
          'match',
          ['get', 'kind'],
          'launch',
          '#10b981',
          'landing',
          '#a855f7',
          '#0d9488',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  function clearResultLayers() {
    const map = mapInstance.value
    if (!map)
      return

    ;[
      VISIBILITY_FILL_LAYER_ID,
      VISIBILITY_OUTLINE_LAYER_ID,
      VISIBILITY_TRAJECTORY_LAYER_ID,
      VISIBILITY_MARKERS_LAYER_ID,
    ].forEach((id) => {
      if (map.getLayer(id))
        map.removeLayer(id)
    })

    if (map.getSource(VISIBILITY_SOURCE_ID))
      map.removeSource(VISIBILITY_SOURCE_ID)
  }

  function clear() {
    const map = mapInstance.value
    if (map) {
      map.off('click', PADS_POINT_ID, handlePadClick as any)
      map.off('draw.selectionchange', handleSelectionChange)
    }
    clearResultLayers()
    step.value = 'idle'
    selectedPad.value = null
    selectedPolygonIds.value = []
    result.value = null
    errorMessage.value = null
  }

  function handleStyleLoad() {
    if (step.value === 'result' && selectedPad.value && selectedPolygonIds.value.length > 0)
      calculate()
  }

  // 当火箭工具关闭时，清理所有状态
  watch(
    () => options.isActive.value,
    (active) => {
      if (!active)
        clear()
    },
  )

  // 参数变化时自动重算
  watch([maxVisibilityRadiusKm, landingHeights], () => {
    if (step.value === 'result' && selectedPad.value && selectedPolygonIds.value.length > 0)
      calculate()
  })

  watch(isMapLoaded, (loaded) => {
    if (loaded && mapInstance.value)
      mapInstance.value.on('style.load', handleStyleLoad)
  }, { immediate: true })

  onUnmounted(() => {
    const map = mapInstance.value
    if (map) {
      map.off('click', PADS_POINT_ID, handlePadClick as any)
      map.off('draw.selectionchange', handleSelectionChange)
      map.off('style.load', handleStyleLoad)
    }
    clearResultLayers()
  })

  return {
    step,
    selectedPad,
    selectedPolygonIds,
    result,
    errorMessage,
    canCalculate,
    maxVisibilityRadiusKm,
    landingHeights,
    setLandingHeight,
    enterSelectPadMode,
    enterSelectPolygonMode,
    calculate,
    clear,
  }
}
