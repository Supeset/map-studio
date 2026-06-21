<script setup lang="ts">
import type mapboxgl from 'mapbox-gl'
import { appName } from '~/constants'

const isAboutModalOpen = ref(false)
const isLocating = ref(false)
// 记录最后一次定位坐标
const lastUserLocation = ref<[number, number] | null>(null)

const mapStore = useMapStore()
const { mapInstance } = storeToRefs(mapStore)

function drawUserLocation(lng: number, lat: number) {
  const map = mapInstance.value
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
  if (!navigator.geolocation || !mapInstance.value)
    return

  isLocating.value = true
  const map = mapInstance.value

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

// 监听地图实例，切换底图后恢复定位点
watch(mapInstance, (map) => {
  if (!map)
    return
  map.on('style.load', () => {
    if (lastUserLocation.value)
      drawUserLocation(lastUserLocation.value[0], lastUserLocation.value[1])
  })
}, { immediate: true })
</script>

<template>
  <header
    class="p-4 flex pointer-events-none items-center left-0 right-0 top-0 justify-between absolute z-30"
  >
    <!-- 左侧：网站标题 -->
    <div
      class="text-xl text-white font-bold pointer-events-auto"
      style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"
    >
      {{ appName }}
    </div>

    <!-- 右侧：全局功能按钮组 -->
    <div class="flex gap-1 pointer-events-auto items-center">
      <!-- 定位按钮 -->
      <button
        class="header-icon-btn"
        title="定位当前位置"
        @click="handleLocate"
      >
        <div class="text-xl" :class="[isLocating ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-location-current']" />
      </button>

      <!-- 地图样式切换 -->
      <MapStyleSwitcher />

      <!-- 暗色模式切换 -->
      <DarkToggle />

      <!-- 关于按钮 -->
      <button
        class="header-icon-btn"
        title="关于"
        @click="isAboutModalOpen = true"
      >
        <div class="i-carbon-information text-xl" />
      </button>
    </div>
  </header>

  <AboutModal v-model="isAboutModalOpen" />
</template>
