<script setup lang="ts">
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
 * 在地图上更新或创建标记点和方位角线
 */
function updateMapLayers(
  center: { lng: number, lat: number },
  sunriseInfo: { azimuth: number, time: string },
  sunsetInfo: { azimuth: number, time: string },
) {
  const map = mapStore.mapInstance
  if (!map)
    return

  // 根据地图缩放级别动态调整线的长度，使其在视觉上更合理
  const distance = 8000 / (2 ** map.getZoom())

  const sunriseEndPoint = calculateDestinationPoint(center, sunriseInfo.azimuth, distance)
  const sunsetEndPoint = calculateDestinationPoint(center, sunsetInfo.azimuth, distance)

  const geojson: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [center.lng, center.lat] }, properties: { type: 'center' } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunriseEndPoint] }, properties: { type: 'sunrise' } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunsetEndPoint] }, properties: { type: 'sunset' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: sunriseEndPoint }, properties: { type: 'sunrise', text: `日出: ${sunriseInfo.time}\n${sunriseInfo.azimuth.toFixed(2)}°` } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: sunsetEndPoint }, properties: { type: 'sunset', text: `日落: ${sunsetInfo.time}\n${sunsetInfo.azimuth.toFixed(2)}°` } },
    ],
  }

  const source = map.getSource(SOURCE_ID) as GeoJSONSource
  if (source) {
    source.setData(geojson)
  }
  else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
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
          '#0d9488', // 中心点使用主题色
          'sunrise',
          '#f59e0b', // 日出点使用琥珀色
          'sunset',
          '#4f46e5', // 日落点使用靛蓝色
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
          'sunrise',
          '#f59e0b', // 日出线
          'sunset',
          '#4f46e5', // 日落线
          '#000000',
        ],
        'line-width': 2,
        'line-dasharray': [2, 2],
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
      paint: {
        'text-color': '#333333', // 灰色文字 (gray-500)
        'text-halo-color': '#ffffff', // 白色描边
        'text-halo-width': 1,
      },
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
    const sunriseToi = await sun.getRise(location)
    const sunsetToi = await sun.getSet(location)
    const solarNoonToi = await sun.getTransit(location)
    const sunAtSunrise = createSun(sunriseToi)
    const sunAtSunset = createSun(sunsetToi)
    const sunriseCoords = await sunAtSunrise.getApparentTopocentricHorizontalCoordinates(location)
    const sunsetCoords = await sunAtSunset.getApparentTopocentricHorizontalCoordinates(location)

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
