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
  })

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
  <div ref="mapContainer" class="inset-0 absolute" />
</template>

<style>
.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-bottom-right {
  display: none !important;
}
</style>
