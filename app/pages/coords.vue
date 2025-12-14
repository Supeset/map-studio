<script setup lang="ts">
import type { GeoJSONSource } from 'mapbox-gl'
import type { HistoryItem } from '~/components/coords/HistoryPanel.vue'
import gcoord from 'gcoord'
import CoordsConverterPanel from '~/components/coords/ConverterPanel.vue'
import CoordsHistoryPanel from '~/components/coords/HistoryPanel.vue'

defineOptions({
  name: 'CoordsPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

// Mapbox 相关常量
const SOURCE_ID = 'coords-point-source'
const LAYER_ID_POINT = 'coords-point-layer'
const LAYER_ID_HALO = 'coords-point-halo'

// --- State ---
const inputStr = ref('')
const inputSourceType = ref<'WGS84' | 'GCJ02' | 'BD09'>('WGS84')
const result = ref<{
  wgs84: [number, number]
  gcj02: [number, number]
  bd09: [number, number]
} | null>(null)

// 使用 localStorage 持久化历史记录
const history = useLocalStorage<HistoryItem[]>('coords-history', [])

// 解析输入的坐标字符串
const parsedInput = computed(() => {
  if (!inputStr.value)
    return null
  const parts = inputStr.value.split(/[,，\s]+/).filter(Boolean)
  if (parts.length !== 2)
    return null
  const lng = Number.parseFloat(parts[0]!)
  const lat = Number.parseFloat(parts[1]!)
  if (Number.isNaN(lng) || Number.isNaN(lat))
    return null
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
    return null
  return [lng, lat] as [number, number]
})

// 核心转换逻辑
function updateCoords(shouldAddToHistory = true) {
  if (!parsedInput.value) {
    result.value = null
    removeMapLayers()
    return
  }

  const [lng, lat] = parsedInput.value
  const inputCoords = [lng, lat] as [number, number]

  let wgs84: [number, number]
  let gcj02: [number, number]
  let bd09: [number, number]

  if (inputSourceType.value === 'WGS84') {
    wgs84 = inputCoords
    gcj02 = gcoord.transform(inputCoords, gcoord.WGS84, gcoord.GCJ02)
    bd09 = gcoord.transform(inputCoords, gcoord.WGS84, gcoord.BD09)
  }
  else if (inputSourceType.value === 'GCJ02') {
    wgs84 = gcoord.transform(inputCoords, gcoord.GCJ02, gcoord.WGS84)
    gcj02 = inputCoords
    bd09 = gcoord.transform(inputCoords, gcoord.GCJ02, gcoord.BD09)
  }
  else { // BD09
    wgs84 = gcoord.transform(inputCoords, gcoord.BD09, gcoord.WGS84)
    gcj02 = gcoord.transform(inputCoords, gcoord.BD09, gcoord.GCJ02)
    bd09 = inputCoords
  }

  const currentResult = { wgs84, gcj02, bd09 }
  result.value = currentResult

  updateMap(wgs84)

  // 添加到历史记录
  if (shouldAddToHistory) {
    addToHistory(inputStr.value, inputSourceType.value, currentResult)
  }
}

function addToHistory(
  input: string,
  type: 'WGS84' | 'GCJ02' | 'BD09',
  res: { wgs84: [number, number], gcj02: [number, number], bd09: [number, number] },
) {
  // 避免重复：检查最新一条记录
  if (history.value.length > 0) {
    const last = history.value[0]
    // 如果输入完全一样，不添加
    if (last && last.input === input && last.type === type)
      return
  }

  history.value.unshift({
    id: Date.now(),
    input,
    type,
    result: res,
    timestamp: Date.now(),
  })

  // 限制历史记录数量
  if (history.value.length > 20)
    history.value = history.value.slice(0, 20)
}

function restoreHistory(item: HistoryItem) {
  inputStr.value = item.input
  inputSourceType.value = item.type
  // watch 会触发 updateCoords
}

function clearHistory() {
  // eslint-disable-next-line no-alert
  if (confirm('确定清空所有历史记录吗？')) {
    history.value = []
  }
}

// Map Functions (保持不变)
function updateMap(center: [number, number]) {
  if (!mapInstance.value)
    return

  const map = mapInstance.value
  const geojson = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: center } }],
  }

  const source = map.getSource(SOURCE_ID) as GeoJSONSource
  if (source) {
    source.setData(geojson as any)
  }
  else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson as any })
    map.addLayer({
      id: LAYER_ID_HALO,
      type: 'circle',
      source: SOURCE_ID,
      paint: { 'circle-radius': 20, 'circle-color': '#0d9488', 'circle-opacity': 0.2, 'circle-stroke-width': 0 },
    })
    map.addLayer({
      id: LAYER_ID_POINT,
      type: 'circle',
      source: SOURCE_ID,
      paint: { 'circle-radius': 6, 'circle-color': '#0d9488', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
    })
  }

  map.flyTo({ center, zoom: 14, speed: 1.5 })
}

function removeMapLayers() {
  const map = mapInstance.value
  if (!map)
    return
  if (map.getLayer(LAYER_ID_POINT))
    map.removeLayer(LAYER_ID_POINT)
  if (map.getLayer(LAYER_ID_HALO))
    map.removeLayer(LAYER_ID_HALO)
  if (map.getSource(SOURCE_ID))
    map.removeSource(SOURCE_ID)
}

function handleStyleLoad() {
  if (result.value)
    updateCoords(false)
}

// Watchers
// 使用 debounce 避免输入过程中频繁转换和记录
const debouncedUpdate = useDebounceFn(() => {
  updateCoords(true)
}, 800)

watch([inputStr, inputSourceType], () => {
  if (inputStr.value) {
    debouncedUpdate()
  }
  else {
    result.value = null
    removeMapLayers()
  }
})

watch(() => isMapLoaded.value, (loaded) => {
  if (loaded) {
    mapInstance.value?.on('style.load', handleStyleLoad)
    if (parsedInput.value)
      updateCoords(false)
  }
})

onUnmounted(() => {
  mapInstance.value?.off('style.load', handleStyleLoad)
  removeMapLayers()
})
</script>

<template>
  <div class="h-full w-full relative">
    <ClientOnly>
      <Map />
    </ClientOnly>

    <!-- Header -->
    <header class="p-4 flex pointer-events-none items-center left-0 right-0 top-0 justify-between absolute z-10">
      <div class="text-xl text-white font-bold pointer-events-auto" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
        坐标转换
      </div>
      <NuxtLink
        to="/"
        class="text-sm px-3 py-2 rounded-full bg-white/80 pointer-events-auto shadow-lg backdrop-blur-sm dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        返回主页
      </NuxtLink>
    </header>

    <!-- Right Panels Container -->
    <div class="flex flex-col gap-3 h-65vh w-80 pointer-events-none right-4 top-20 absolute z-20">
      <!-- 1. Converter Panel -->
      <CoordsConverterPanel
        v-model:input-str="inputStr"
        v-model:source-type="inputSourceType"
        :result="result"
        :is-valid="!!parsedInput"
      />

      <!-- 2. History Panel -->
      <CoordsHistoryPanel
        :history="history"
        @restore="restoreHistory"
        @clear="clearHistory"
      />
    </div>
  </div>
</template>
