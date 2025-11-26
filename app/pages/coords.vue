<script setup lang="ts">
import type { GeoJSONSource, Map } from 'mapbox-gl'
import gcoord from 'gcoord'

defineOptions({
  name: 'CoordsPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

// 状态
const inputStr = ref('')
const inputSourceType = ref<'WGS84' | 'GCJ02' | 'BD09'>('WGS84')
const result = ref<{
  wgs84: [number, number]
  gcj02: [number, number]
  bd09: [number, number]
} | null>(null)

// Mapbox 相关常量
const SOURCE_ID = 'coords-point-source'
const LAYER_ID_POINT = 'coords-point-layer'
const LAYER_ID_HALO = 'coords-point-halo'

// 解析输入的坐标字符串
const parsedInput = computed(() => {
  if (!inputStr.value)
    return null
  // 支持中文或英文逗号，支持空格
  const parts = inputStr.value.split(/[,，\s]+/).filter(Boolean)
  if (parts.length !== 2)
    return null
  const lng = Number.parseFloat(parts[0]!)
  const lat = Number.parseFloat(parts[1]!)
  if (Number.isNaN(lng) || Number.isNaN(lat))
    return null
  // 简单的范围校验
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
    return null
  return [lng, lat] as [number, number]
})

// 核心转换逻辑
function updateCoords() {
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

  // 根据当前选择的输入源格式进行转换
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

  result.value = { wgs84, gcj02, bd09 }

  // 更新地图显示（始终显示 WGS84 坐标，因为 Mapbox 使用 WGS84）
  updateMap(wgs84)
}

// 更新地图上的点
function updateMap(center: [number, number]) {
  if (!mapInstance.value)
    return

  const map = mapInstance.value
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: center,
        },
      },
    ],
  }

  const source = map.getSource(SOURCE_ID) as GeoJSONSource
  if (source) {
    source.setData(geojson as any)
  }
  else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson as any })
    // 光晕效果
    map.addLayer({
      id: LAYER_ID_HALO,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': 20,
        'circle-color': '#0d9488',
        'circle-opacity': 0.2,
        'circle-stroke-width': 0,
      },
    })
    // 核心点
    map.addLayer({
      id: LAYER_ID_POINT,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': 6,
        'circle-color': '#0d9488',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  // Fly to target
  map.flyTo({
    center,
    zoom: 14,
    speed: 1.5,
  })
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

// 复制到剪贴板
const { copy, copied } = useClipboard()
function copyCoords(coords: [number, number]) {
  copy(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`)
}

// 监听变化
watch([inputStr, inputSourceType], () => {
  // 防抖处理输入
  updateCoords()
})

// 监听地图加载状态（针对直接刷新页面的情况）
watch(() => isMapLoaded.value, (loaded) => {
  if (loaded && parsedInput.value)
    updateCoords()
})

onUnmounted(() => {
  removeMapLayers()
})

// 设置输入类型
function setSourceType(type: 'WGS84' | 'GCJ02' | 'BD09') {
  inputSourceType.value = type
  // 类型改变时立即重新计算
  updateCoords()
}
</script>

<template>
  <div class="h-full w-full relative">
    <ClientOnly>
      <Map />
    </ClientOnly>

    <!-- Header -->
    <header class="p-4 flex items-center left-0 right-0 top-0 justify-between absolute z-10">
      <div class="text-xl text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
        坐标转换
      </div>
      <NuxtLink
        to="/"
        class="text-sm px-3 py-2 rounded-full bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        返回主页
      </NuxtLink>
    </header>

    <!-- Spotlight Search Box -->
    <div class="px-4 pt-[15vh] flex pointer-events-none items-start inset-0 justify-center absolute z-20">
      <div class="rounded-xl bg-white/90 max-w-2xl w-full pointer-events-auto shadow-2xl transition-all overflow-hidden backdrop-blur-md dark:bg-gray-800/90">
        <!-- Input Area -->
        <div class="p-4 border-b border-gray-200 flex items-center dark:border-gray-700">
          <div class="i-carbon-search text-2xl text-gray-400 mr-3" />
          <input
            v-model="inputStr"
            type="text"
            placeholder="输入坐标 (经度, 纬度) 例如: 121.47, 31.23"
            class="text-xl text-gray-800 outline-none border-none bg-transparent flex-1 dark:text-gray-100 placeholder-gray-400"
            autofocus
          >
          <button
            v-if="inputStr"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="inputStr = ''"
          >
            <div class="i-carbon-close text-xl" />
          </button>
        </div>

        <!-- Source Selector Buttons -->
        <div class="px-4 py-3 bg-gray-50 flex gap-2 overflow-x-auto dark:bg-gray-900/50">
          <span class="text-xs text-gray-500 tracking-wider mr-2 flex-shrink-0 uppercase self-center">输入源视为:</span>
          <button
            v-for="type in ['WGS84', 'GCJ02', 'BD09'] as const"
            :key="type"
            class="text-xs px-3 py-1 border rounded-full transition-colors"
            :class="inputSourceType === type
              ? 'bg-teal-600 border-teal-600 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-teal-500'"
            @click="setSourceType(type)"
          >
            {{ type }}
          </button>
        </div>

        <!-- Results Area -->
        <div v-if="result" class="p-4 gap-4 grid md:grid-cols-3">
          <!-- WGS84 Result -->
          <div class="p-3 border border-green-100 rounded-lg bg-green-50 dark:border-green-900/30 dark:bg-green-900/20">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs text-green-700 font-bold dark:text-green-400">WGS84 (GPS)</span>
              <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.wgs84)">
                <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
              </button>
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.wgs84[0].toFixed(6) }}
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.wgs84[1].toFixed(6) }}
            </div>
          </div>

          <!-- GCJ02 Result -->
          <div class="p-3 border border-orange-100 rounded-lg bg-orange-50 dark:border-orange-900/30 dark:bg-orange-900/20">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs text-orange-700 font-bold dark:text-orange-400">GCJ02 (火星)</span>
              <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.gcj02)">
                <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
              </button>
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.gcj02[0].toFixed(6) }}
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.gcj02[1].toFixed(6) }}
            </div>
          </div>

          <!-- BD09 Result -->
          <div class="p-3 border border-blue-100 rounded-lg bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs text-blue-700 font-bold dark:text-blue-400">BD09 (百度)</span>
              <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.bd09)">
                <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
              </button>
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.bd09[0].toFixed(6) }}
            </div>
            <div class="text-sm text-gray-800 font-mono truncate dark:text-gray-200">
              {{ result.bd09[1].toFixed(6) }}
            </div>
          </div>
        </div>
        <div v-else-if="inputStr && !parsedInput" class="text-sm text-red-500 p-4 text-center bg-red-50 dark:bg-red-900/10">
          无法解析坐标格式，请使用 "经度, 纬度" 格式。
        </div>
        <div v-else class="text-sm text-gray-400 p-8 text-center dark:text-gray-500">
          输入坐标以查看地图位置及转换结果
        </div>
      </div>
    </div>
  </div>
</template>
