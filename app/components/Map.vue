<script setup lang="ts">
import mapboxgl from 'mapbox-gl'

const mapStore = useMapStore()
const mapContainer = ref<HTMLDivElement | null>(null)

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
  </div>
</template>

<style>
.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-bottom-right {
  display: none !important;
}
</style>
