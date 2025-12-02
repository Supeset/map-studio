<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource } from 'mapbox-gl'
import mapboxgl from 'mapbox-gl'

defineOptions({
  name: 'RocketPadsPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

// 数据结构定义
interface Pad {
  id: number
  location_name: string
  name: string
  latitude: number
  longitude: number
  wiki_url: string
  agency: number
}

interface PadsData {
  pads: Pad[]
  statuses: any[]
}

// Mapbox 常量
const SOURCE_ID = 'pads-source'
const CLUSTER_LAYER_ID = 'clusters'
const CLUSTER_COUNT_ID = 'cluster-count'
const UNCLUSTERED_POINT_ID = 'unclustered-point'
const UNCLUSTERED_LABEL_ID = 'unclustered-label'

// 获取数据
const { data: padsData } = await useFetch<PadsData>('/rocket/pads.json')

// 将数据转换为 GeoJSON
const padsGeoJSON = computed<FeatureCollection | null>(() => {
  if (!padsData.value?.pads)
    return null

  return {
    type: 'FeatureCollection',
    features: padsData.value.pads.map(pad => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pad.longitude, pad.latitude],
      },
      properties: {
        id: pad.id,
        name: pad.name,
        location: pad.location_name,
        wiki: pad.wiki_url,
      },
    })),
  }
})

// 初始化地图图层
function initLayers() {
  const map = mapInstance.value
  if (!map || !padsGeoJSON.value)
    return

  // 如果 Source 不存在则添加
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: padsGeoJSON.value,
      cluster: true,
      clusterMaxZoom: 14, // 超过这个缩放级别将不再聚合
      clusterRadius: 50, // 聚合半径
    })
  }

  // 1. 聚合圆圈图层
  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        // 使用 step 表达式根据点数显示不同颜色
        // < 10: 蓝色, 10-30: 黄色, >= 30: 粉色
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',
          10,
          '#f1f075',
          30,
          '#f28cb1',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          15, // count < 10, r=15
          10,
          20, // 10 <= count < 30, r=20
          30,
          25, // count >= 30, r=25
        ],
      },
    })
  }

  // 2. 聚合数量文字图层
  if (!map.getLayer(CLUSTER_COUNT_ID)) {
    map.addLayer({
      id: CLUSTER_COUNT_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
    })
  }

  // 3. 未聚合的单个点图层
  if (!map.getLayer(UNCLUSTERED_POINT_ID)) {
    map.addLayer({
      id: UNCLUSTERED_POINT_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#0d9488', // Teal-600
        'circle-radius': 6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })
  }

  // 4. 未聚合点的名称标签
  if (!map.getLayer(UNCLUSTERED_LABEL_ID)) {
    map.addLayer({
      id: UNCLUSTERED_LABEL_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      minzoom: 5, // 避免在缩放级别过小时文字过于密集
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'text-offset': [0, 1.2], // 向下偏移，避开圆点
        'text-anchor': 'top',
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'], // 自动调整位置以避免碰撞
        'text-radial-offset': 1.2,
      },
      paint: {
        'text-color': '#333333',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })
  }

  // 绑定事件
  setupEvents()
}

function setupEvents() {
  const map = mapInstance.value
  if (!map)
    return

  // 点击聚合簇：放大
  map.on('click', CLUSTER_LAYER_ID, (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: [CLUSTER_LAYER_ID],
    })
    const clusterId = features[0]!.properties?.cluster_id
    const source = map.getSource(SOURCE_ID) as GeoJSONSource

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err)
        return

      map.easeTo({
        center: (features[0]!.geometry as any).coordinates,
        zoom: zoom ?? 14,
      })
    })
  })

  // 点击单个点：显示 Popup
  map.on('click', UNCLUSTERED_POINT_ID, (e) => {
    if (!e.features || !e.features[0])
      return

    const coordinates = (e.features[0].geometry as any).coordinates.slice()
    const { name, location, wiki } = e.features[0].properties as any

    // 确保 popup 显示在视野内（处理跨越 180 度经线的情况）
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
    }

    let html = `<div class="p-2 min-w-[200px]">`
    html += `<h3 class="font-bold text-base mb-1 text-gray-900 dark:text-gray-100">${name}</h3>`
    html += `<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${location}</p>`
    if (wiki) {
      html += `<a href="${wiki}" target="_blank" class="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
        查看 Wiki <span class="i-carbon-launch inline-block"></span>
      </a>`
    }
    html += `</div>`

    new mapboxgl.Popup({ closeButton: false, maxWidth: '300px', className: 'rocket-popup' })
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(map)
  })

  // 鼠标样式
  map.on('mouseenter', CLUSTER_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', CLUSTER_LAYER_ID, () => {
    map.getCanvas().style.cursor = ''
  })
  map.on('mouseenter', UNCLUSTERED_POINT_ID, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', UNCLUSTERED_POINT_ID, () => {
    map.getCanvas().style.cursor = ''
  })
}

function removeLayers() {
  const map = mapInstance.value
  if (!map)
    return

  if (map.getLayer(CLUSTER_COUNT_ID))
    map.removeLayer(CLUSTER_COUNT_ID)
  if (map.getLayer(CLUSTER_LAYER_ID))
    map.removeLayer(CLUSTER_LAYER_ID)
  if (map.getLayer(UNCLUSTERED_LABEL_ID))
    map.removeLayer(UNCLUSTERED_LABEL_ID)
  if (map.getLayer(UNCLUSTERED_POINT_ID))
    map.removeLayer(UNCLUSTERED_POINT_ID)
  if (map.getSource(SOURCE_ID))
    map.removeSource(SOURCE_ID)

  // 清除事件监听 (Mapbox GL JS 在 removeLayer 时不会自动清除全局 map 上的事件，
  // 但由于我们依赖组件销毁，通常 Mapbox 实例本身会被重用或销毁。
  // 严谨起见，这里简化处理，因为 layer 不存在了，事件触发也没影响)
}

// 监听地图加载完成
watch(() => isMapLoaded.value, (loaded) => {
  if (loaded)
    initLayers()
}, { immediate: true })

onUnmounted(() => {
  removeLayers()
})
</script>

<template>
  <div class="h-full w-full relative">
    <ClientOnly>
      <Map />
    </ClientOnly>

    <!-- Header -->
    <header class="p-4 flex items-center left-0 right-0 top-0 justify-between absolute z-10">
      <div class="text-xl text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
        火箭发射点
      </div>
      <NuxtLink
        to="/"
        class="text-sm px-3 py-2 rounded-full bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        返回主页
      </NuxtLink>
    </header>

    <!-- Legend/Info -->
    <div class="text-xs p-3 rounded-lg bg-white/90 pointer-events-none shadow-lg bottom-8 left-4 absolute z-10 backdrop-blur space-y-2 dark:bg-gray-800/90">
      <div class="font-bold mb-1">
        图例
      </div>
      <div class="flex gap-2 items-center">
        <span class="rounded-full bg-teal-600 h-3 w-3 ring-2 ring-white" />
        <span>单个发射点</span>
      </div>
      <div class="flex gap-2 items-center">
        <span class="rounded-full bg-[#51bbd6] opacity-80 h-4 w-4" />
        <span>&lt; 10 个聚合</span>
      </div>
      <div class="flex gap-2 items-center">
        <span class="rounded-full bg-[#f1f075] opacity-80 h-4 w-4" />
        <span>10 - 30 个聚合</span>
      </div>
      <div class="flex gap-2 items-center">
        <span class="rounded-full bg-[#f28cb1] opacity-80 h-4 w-4" />
        <span>&gt; 30 个聚合</span>
      </div>
    </div>
  </div>
</template>

<style>
/* 默认（浅色）模式 */
.rocket-popup .mapboxgl-popup-content {
  padding: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  background-color: white;
  color: #1f2937;
}

/* 深色模式适配 */
html.dark .rocket-popup .mapboxgl-popup-content {
  background-color: #1f2937; /* gray-800 */
  color: #f3f4f6; /* gray-100 */
  border: 1px solid #374151; /* gray-700 */
}

/* 适配 Popup 的小三角 (Tip) 颜色 */
/* 当 Popup 在上方时，Tip 指向下方，需要修改 border-top-color */
html.dark .rocket-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
  border-top-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
  border-bottom-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
  border-right-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
  border-left-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip {
  border-bottom-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
  border-bottom-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip {
  border-top-color: #1f2937;
}
html.dark .rocket-popup.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
  border-top-color: #1f2937;
}
</style>
