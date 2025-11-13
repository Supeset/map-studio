<script setup lang="ts">
import type Sun from 'astronomy-bundle/sun/Sun'
import type TimeOfInterest from 'astronomy-bundle/time/TimeOfInterest'
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map, MapMouseEvent } from 'mapbox-gl'
import { createLocation } from 'astronomy-bundle/earth'
import { createSun } from 'astronomy-bundle/sun'
import { createTimeOfInterest } from 'astronomy-bundle/time'
import dayjs from 'dayjs'

defineOptions({
  name: 'AstroPage',
})

const mapStore = useMapStore()

const isLoading = ref(false)
const selectedPoint = ref<{ lng: number, lat: number } | null>(null)
const calculationError = ref<string | null>(null)
const astroInfo = ref<{
  sunriseAzimuth: number
  sunsetAzimuth: number
  sunriseTime: string
  sunsetTime: string
  solarNoonTime: string
} | null>(null)

// --- Mapbox Layer Management ---
const SOURCE_ID = 'astro-features'
const POINT_LAYER_ID = 'astro-point-layer'
const LINE_LAYER_ID = 'astro-line-layer'
const LABEL_LAYER_ID = 'astro-label-layer'

/**
 * 根据起点、方位角和距离计算目标点坐标
 */
function calculateDestinationPoint(
  start: { lng: number, lat: number },
  bearing: number,
  distance: number,
): [number, number] {
  const R = 6371 // 地球半径 (km)
  const lat1 = (start.lat * Math.PI) / 180
  const lon1 = (start.lng * Math.PI) / 180
  const bearingRad = (bearing * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance / R)
    + Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad),
  )
  let lon2 = lon1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
    Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2),
  )

  lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI // 归一化到 -180 到 180

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}
/**
 * [精确解法] 计算给定时刻的日出/日落等时线 (Terminator Line)
 * @param targetToi 目标时间点 (日出或日落的TOI对象)
 * @param type 'rise' 或 'set'
 * @returns 经纬度坐标数组
 */
async function calculateTerminatorLine(
  targetToi: TimeOfInterest,
  type: 'rise' | 'set',
): Promise<[number, number][]> {
  const coords: [number, number][] = []
  // 为事件发生的精确时刻创建一个Sun实例，以获取该时刻的太阳坐标
  const sunForCoords = createSun(targetToi)
  const h0 = -0.833 // 日出/日落时太阳上边缘的标准地平高度

  // 获取该时刻太阳的视赤经 (alpha) 和视赤纬 (delta)
  const { rightAscension, declination } = await sunForCoords.getApparentGeocentricEquatorialSphericalCoordinates()
  const delta = declination
  const alpha = rightAscension

  // 获取该时刻的格林尼治视恒星时 (GAST)
  const GAST = targetToi.getGreenwichApparentSiderealTime()

  // 迭代纬度，计算每个纬度上对应的经度
  for (let lat = -85; lat <= 85; lat += 2) {
    const phi = lat

    // 将角度转换为弧度
    const phiRad = (phi * Math.PI) / 180
    const deltaRad = (delta * Math.PI) / 180
    const h0Rad = (h0 * Math.PI) / 180

    // 根据公式计算时角 H 的余弦值: cos(H) = (sin(h0) - sin(φ)sin(δ)) / (cos(φ)cos(δ))
    const cosH = (Math.sin(h0Rad) - Math.sin(phiRad) * Math.sin(deltaRad)) / (Math.cos(phiRad) * Math.cos(deltaRad))

    // 如果cosH超出[-1, 1]范围，说明该纬度处于极昼或极夜，无解
    if (cosH > 1 || cosH < -1)
      continue

    // 计算时角 H (单位: 度)
    let H = (Math.acos(cosH) * 180) / Math.PI

    // 日出时，时角为负 (太阳在子午线以东)
    if (type === 'rise')
      H = -H

    // 地方视恒星时 (LAST) = 视赤经 + 时角
    const LAST = alpha + H

    // 经度 (lon) = 地方视恒星时 - 格林尼治视恒星时
    let lon = LAST - GAST

    // 归一化经度到 -180 到 180
    lon = (lon + 540) % 360 - 180

    coords.push([lon, lat])
  }

  return coords
}

/**
 * 在地图上更新或创建所有天文相关的可视化图层
 */
function updateMapLayers(
  center: { lng: number, lat: number },
  sunriseInfo: { azimuth: number, time: string },
  sunsetInfo: { azimuth: number, time: string },
  terminatorLines: { sunrise: [number, number][], sunset: [number, number][] },
) {
  const map = mapStore.mapInstance
  if (!map)
    return

  // 根据地图缩放级别动态调整方位角线的长度
  const distance = 8000 / (2 ** map.getZoom())

  const sunriseEndPoint = calculateDestinationPoint(center, sunriseInfo.azimuth, distance)
  const sunsetEndPoint = calculateDestinationPoint(center, sunsetInfo.azimuth, distance)

  const features = [
    // --- 方位角相关的 Features ---
    { type: 'Feature', geometry: { type: 'Point', coordinates: [center.lng, center.lat] }, properties: { type: 'center' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunriseEndPoint] }, properties: { type: 'azimuth-sunrise' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunsetEndPoint] }, properties: { type: 'azimuth-sunset' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: sunriseEndPoint }, properties: { type: 'sunrise', text: `日出: ${sunriseInfo.time}\n${sunriseInfo.azimuth.toFixed(2)}°` } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: sunsetEndPoint }, properties: { type: 'sunset', text: `日落: ${sunsetInfo.time}\n${sunsetInfo.azimuth.toFixed(2)}°` } },
  ]

  // --- 等时线相关的 Features ---
  if (terminatorLines.sunrise.length > 1)
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: terminatorLines.sunrise }, properties: { type: 'terminator-sunrise' } })

  if (terminatorLines.sunset.length > 1)
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: terminatorLines.sunset }, properties: { type: 'terminator-sunset' } })

  const geojson: FeatureCollection = { type: 'FeatureCollection', features: features as any }

  const source = map.getSource(SOURCE_ID) as GeoJSONSource
  if (source) {
    source.setData(geojson)
  }
  else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
    // --- 图层定义 ---
    map.addLayer({
      id: POINT_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'type'],
          'center',
          '#0d9488',
          'sunrise',
          '#f59e0b',
          'sunset',
          '#4f46e5',
          '#000000',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': [
          'match',
          ['get', 'type'],
          'azimuth-sunrise',
          '#f59e0b',
          'terminator-sunrise',
          '#f59e0b',
          'azimuth-sunset',
          '#4f46e5',
          'terminator-sunset',
          '#4f46e5',
          '#000000',
        ],
        'line-width': [
          'match',
          ['get', 'type'],
          ['azimuth-sunrise', 'azimuth-sunset'],
          2,
          ['terminator-sunrise', 'terminator-sunset'],
          2.5,
          2,
        ],
        'line-dasharray': [
          'match',
          ['get', 'type'],
          // 将所有线的类型都设置为虚线
          ['azimuth-sunrise', 'azimuth-sunset', 'terminator-sunrise', 'terminator-sunset'],
          ['literal', [2, 2]],
          ['literal', []], // 默认回退（设为实线，尽管所有类型都已覆盖）
        ],
        'line-opacity': [
          'match',
          ['get', 'type'],
          ['terminator-sunrise', 'terminator-sunset'],
          0.75,
          1,
        ],
      },
    })
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'text'],
      layout: {
        'text-field': ['get', 'text'],
        'text-size': 16,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-line-height': 1.2,
      },
      paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    })
  }
}

/**
 * 从地图上移除所有添加的图层和数据源
 */
function removeMapLayers() {
  const map = mapStore.mapInstance
  if (!map)
    return

  [LABEL_LAYER_ID, LINE_LAYER_ID, POINT_LAYER_ID].forEach((id) => {
    if (map.getLayer(id))
      map.removeLayer(id)
  })

  if (map.getSource(SOURCE_ID))
    map.removeSource(SOURCE_ID)
}

// --- Calculation Logic ---
async function calculateAstroInfo(lat: number, lon: number) {
  isLoading.value = true
  astroInfo.value = null
  calculationError.value = null

  try {
    const toi = createTimeOfInterest.fromCurrentTime()
    const location = createLocation(lat, lon)
    const sun = createSun(toi)
    // 修正: 使用 getRiseUpperLimb / getSetUpperLimb 来匹配 h0 = -0.833 的标准
    const sunriseToi = await sun.getRiseUpperLimb(location)
    const sunsetToi = await sun.getSetUpperLimb(location)
    const solarNoonToi = await sun.getTransit(location)
    const sunAtSunrise = createSun(sunriseToi)
    const sunAtSunset = createSun(sunsetToi)
    const sunriseCoords = await sunAtSunrise.getApparentTopocentricHorizontalCoordinates(location)
    const sunsetCoords = await sunAtSunset.getApparentTopocentricHorizontalCoordinates(location)

    // 计算等时线
    const [sunriseLineCoords, sunsetLineCoords] = await Promise.all([
      calculateTerminatorLine(sunriseToi, 'rise'),
      calculateTerminatorLine(sunsetToi, 'set'),
    ])

    astroInfo.value = {
      sunriseAzimuth: sunriseCoords.azimuth,
      sunsetAzimuth: sunsetCoords.azimuth,
      sunriseTime: dayjs(sunriseToi.getDate()).format('HH:mm:ss'),
      sunsetTime: dayjs(sunsetToi.getDate()).format('HH:mm:ss'),
      solarNoonTime: dayjs(solarNoonToi.getDate()).format('HH:mm:ss'),
    }

    // 计算成功后更新地图
    updateMapLayers(
      { lng: lon, lat },
      { azimuth: astroInfo.value.sunriseAzimuth, time: astroInfo.value.sunriseTime },
      { azimuth: astroInfo.value.sunsetAzimuth, time: astroInfo.value.sunsetTime },
      { sunrise: sunriseLineCoords, sunset: sunsetLineCoords },
    )
  }
  catch (e) {
    console.error('天文信息计算失败:', e)
    calculationError.value = '无法计算该位置的信息，可能处于极昼或极夜。'
    astroInfo.value = null
    // 计算失败时清除地图上的标记
    removeMapLayers()
  }
  finally {
    isLoading.value = false
  }
}

async function handleMapClick(event: MapMouseEvent) {
  const { lng, lat } = event.lngLat
  selectedPoint.value = { lng, lat }
  await calculateAstroInfo(lat, lng)
}

// --- Lifecycle Hooks ---
function cleanupMap() {
  const map = mapStore.mapInstance
  if (map) {
    map.off('click', handleMapClick)
    removeMapLayers()
  }
}

watch(() => mapStore.isMapLoaded, (isLoaded) => {
  if (isLoaded && mapStore.mapInstance) {
    const map = mapStore.mapInstance as Map
    map.on('click', handleMapClick)
  }
}, { immediate: true })

onUnmounted(() => {
  cleanupMap()
})
</script>

<template>
  <div class="h-full w-full relative">
    <ClientOnly>
      <Map />
    </ClientOnly>

    <!-- 页面头部 -->
    <header
      pos="absolute top-0 left-0 right-0"
      p="4"
      flex="~"
      items-center
      justify-between
      z-10
    >
      <div
        text="xl white"
        font-bold
        style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"
      >
        天文工具
      </div>
      <NuxtLink
        to="/"
        class="px-3 py-2 rounded-full bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        返回主页
      </NuxtLink>
    </header>

    <!-- 信息面板 -->
    <div
      class="p-4 rounded-lg bg-white/80 w-80 shadow-lg left-4 top-20 absolute z-10 backdrop-blur-sm dark:bg-gray-800/80"
    >
      <h2 class="text-lg font-semibold mb-2">
        太阳信息 (当地时区)
      </h2>
      <div v-if="!selectedPoint" class="text-gray-500">
        请在地图上点击任意位置以获取信息。
      </div>
      <div v-else>
        <div class="text-sm mb-3">
          <p>
            <span class="font-medium w-12 inline-block">经度:</span> {{ selectedPoint.lng.toFixed(4) }}
          </p>
          <p>
            <span class="font-medium w-12 inline-block">纬度:</span> {{ selectedPoint.lat.toFixed(4) }}
          </p>
        </div>
        <div v-if="isLoading" class="p-4 text-center">
          计算中...
        </div>
        <div v-else-if="calculationError" class="text-sm text-red-500">
          {{ calculationError }}
        </div>
        <div v-else-if="astroInfo" class="text-sm space-y-1">
          <p>
            <span class="font-medium w-24 inline-block">日出方位角:</span> {{ astroInfo.sunriseAzimuth.toFixed(2) }}°
          </p>
          <p>
            <span class="font-medium w-24 inline-block">日落方位角:</span> {{ astroInfo.sunsetAzimuth.toFixed(2) }}°
          </p>
          <hr class="my-2 border-gray-300 dark:border-gray-600">
          <p>
            <span class="font-medium w-24 inline-block">日出时间:</span> {{ astroInfo.sunriseTime }}
          </p>
          <p>
            <span class="font-medium w-24 inline-block">太阳凌日:</span> {{ astroInfo.solarNoonTime }}
          </p>
          <p>
            <span class="font-medium w-24 inline-block">日落时间:</span> {{ astroInfo.sunsetTime }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
