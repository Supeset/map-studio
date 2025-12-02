<script setup lang="ts">
import mapboxgl from 'mapbox-gl'

const mapStore = useMapStore()
const mapContainer = ref<HTMLDivElement | null>(null)
const isAboutModalOpen = ref(false)
const isLocating = ref(false)
// 记录最后一次定位坐标
const lastUserLocation = ref<[number, number] | null>(null)

function initializeMap() {
  if (!mapContainer.value)
    return

  mapboxgl.accessToken = mapStore.accessToken
  const map = new mapboxgl.Map({
    container: mapContainer.value,
    style: mapStore.activeMapStyle.styleUrl,
    center: [108.84, 31.06],
    zoom: 3.5,
    attributionControl: false, // 隐藏默认的 attribution，或者调整位置以免遮挡
  })

  // 添加 attribution 但折叠它，避免与右下角按钮冲突
  map.addControl(new mapboxgl.AttributionControl({
    compact: true,
  }), 'bottom-left')

  map.on('load', () => {
    mapStore.setMapInstance(map)
    mapStore.setMapLoaded(true)
  })

  // 监听样式切换事件，恢复定位点
  map.on('style.load', () => {
    if (lastUserLocation.value) {
      drawUserLocation(lastUserLocation.value[0], lastUserLocation.value[1])
    }
  })
}

function drawUserLocation(lng: number, lat: number) {
  const map = mapStore.mapInstance
  if (!map)
    return

  const userLocationSourceId = 'user-location-source'
  const userLocationLayerId = 'user-location-layer'
  const userLocationHaloId = 'user-location-halo'

  if (map.getSource(userLocationSourceId)) {
    // 如果 Source 还在（通常切换样式会被清除，但也可能未清除），更新数据
    (map.getSource(userLocationSourceId) as mapboxgl.GeoJSONSource).setData({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    })
  }
  else {
    // 重新添加 Source 和 Layer
    map.addSource(userLocationSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {},
      },
    })

    // 蓝色光晕
    map.addLayer({
      id: userLocationHaloId,
      type: 'circle',
      source: userLocationSourceId,
      paint: {
        'circle-radius': 20,
        'circle-color': '#3b82f6', // blue-500
        'circle-opacity': 0.3,
        'circle-stroke-width': 0,
      },
    })

    // 蓝色中心点
    map.addLayer({
      id: userLocationLayerId,
      type: 'circle',
      source: userLocationSourceId,
      paint: {
        'circle-radius': 8,
        'circle-color': '#2563eb', // blue-600
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
}

// 定位功能
function handleLocate() {
  if (!navigator.geolocation || !mapStore.mapInstance)
    return

  isLocating.value = true
  const map = mapStore.mapInstance

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { longitude, latitude } = position.coords
      isLocating.value = false
      lastUserLocation.value = [longitude, latitude]

      // 飞到目标位置
      map.flyTo({
        center: [longitude, latitude],
        zoom: 14,
        speed: 1.2,
      })

      drawUserLocation(longitude, latitude)
    },
    (error) => {
      console.error('Locate failed:', error)
      isLocating.value = false
      // eslint-disable-next-line no-alert
      alert('无法获取您的位置，请检查权限设置。')
    },
    { enableHighAccuracy: true },
  )
}

onMounted(() => {
  initializeMap()
})

onUnmounted(() => {
  mapStore.mapInstance?.remove()
  mapStore.setMapInstance(undefined as any)
  mapStore.setMapLoaded(false)
})
</script>

<template>
  <div class="h-full w-full relative">
    <div ref="mapContainer" class="inset-0 absolute" />

    <!-- 左下角工具箱 -->
    <TheToolbox />

    <!-- 右下角功能按钮组 -->
    <div class="flex flex-col gap-3 pointer-events-none items-end bottom-8 right-4 absolute z-20">
      <!-- 内部按钮启用 pointer-events -->
      <div class="flex flex-col gap-3 pointer-events-auto">
        <!-- 定位按钮 -->
        <button
          class="text-gray-600 rounded-full bg-white flex h-10 w-10 shadow-md transition items-center justify-center dark:text-gray-200 hover:text-blue-600 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="定位当前位置"
          @click="handleLocate"
        >
          <div :class="isLocating ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-location-current'" class="text-xl" />
        </button>

        <!-- 地图样式切换 -->
        <MapStyleSwitcher />

        <!-- 暗色模式切换 -->
        <div
          class="rounded-full bg-white flex h-10 w-10 shadow-md transition items-center justify-center hover:text-yellow-500 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <DarkToggle />
        </div>

        <!-- 关于按钮 -->
        <button
          class="text-gray-600 rounded-full bg-white flex h-10 w-10 shadow-md transition items-center justify-center dark:text-gray-200 hover:text-teal-600 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="关于"
          @click="isAboutModalOpen = true"
        >
          <div class="i-carbon-information text-xl" />
        </button>
      </div>
    </div>

    <AboutModal v-model="isAboutModalOpen" />
  </div>
</template>

<style>
.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-bottom-right {
  display: none !important;
}
</style>
