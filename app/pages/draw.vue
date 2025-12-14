<script setup lang="ts">
import type { Feature, FeatureCollection } from 'geojson'
import type { IControl } from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import mapboxgl from 'mapbox-gl'
// 引入拆分的组件
import DrawGeoJsonPanel from '~/components/draw/GeoJsonPanel.vue'

import DrawPropertiesPanel from '~/components/draw/PropertiesPanel.vue'
import DrawToolbar from '~/components/draw/Toolbar.vue'
import { DRAW_STORAGE_KEY, drawStyles } from '~/constants/draw'

defineOptions({
  name: 'DrawPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

// --- State ---
const drawInstance = shallowRef<MapboxDraw | null>(null)
// 使用 useLocalStorage 持久化 GeoJSON
const savedFeatures = useLocalStorage(DRAW_STORAGE_KEY, {
  type: 'FeatureCollection',
  features: [],
} as FeatureCollection)

const selectedFeatureId = ref<string | null>(null)
const selectedFeatureProps = ref<Record<string, any>>({})
const currentMode = ref<string>('simple_select')

// --- Methods ---

function initDraw() {
  if (!mapInstance.value || drawInstance.value)
    return

  const draw = new MapboxDraw({
    displayControlsDefault: false, // 隐藏默认控件，使用自定义UI
    userProperties: true, // 关键：启用 properties 映射到样式
    styles: drawStyles as any,
    modes: MapboxDraw.modes as any, // 使用默认模式
  })

  mapInstance.value.addControl(draw as unknown as IControl, 'top-left')
  drawInstance.value = draw

  // --- 处理 URL 参数中的 GeoJSON 数据 ---
  const route = useRoute()
  const urlData = route.query.data as string
  let isLoadedFromUrl = false

  if (urlData) {
    try {
      let jsonStr = urlData
      // 兼容 geojson.io 的 data:application/json, 前缀格式
      const prefix = 'data:application/json,'
      if (jsonStr.startsWith(prefix)) {
        jsonStr = jsonStr.slice(prefix.length)
      }

      // 尝试解析，如果包含 URL 编码字符则先解码
      let parsed
      try {
        parsed = JSON.parse(jsonStr)
      }
      catch {
        parsed = JSON.parse(decodeURIComponent(jsonStr))
      }

      // 归一化为 FeatureCollection
      let collection: FeatureCollection | null = null

      if (parsed.type === 'FeatureCollection') {
        collection = parsed
      }
      else if (parsed.type === 'Feature') {
        collection = { type: 'FeatureCollection', features: [parsed] }
      }
      else if (parsed.coordinates || parsed.geometries) {
        // 简单的 Geometry 或 GeometryCollection 支持
        collection = {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: parsed, properties: {} } as Feature],
        }
      }

      if (collection && collection.features.length > 0) {
        // 更新本地存储并设置到 Draw 实例
        savedFeatures.value = collection
        draw.set(collection)
        isLoadedFromUrl = true

        // 自动缩放地图至数据范围
        const bounds = new mapboxgl.LngLatBounds()
        const extendBounds = (coords: any) => {
          if (Array.isArray(coords)) {
            // 判断是否为坐标点 [lng, lat]
            if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
              bounds.extend(coords as [number, number])
            }
            else {
              coords.forEach(c => extendBounds(c))
            }
          }
        }

        collection.features.forEach((f) => {
          if (f.geometry && 'coordinates' in f.geometry) {
            extendBounds(f.geometry.coordinates)
          }
        })

        if (!bounds.isEmpty()) {
          mapInstance.value.fitBounds(bounds, { padding: 100, maxZoom: 15 })
        }
      }
    }
    catch (e) {
      console.error('Failed to load GeoJSON from URL:', e)
    }
  }

  // 如果没有从 URL 加载数据，则加载本地保存的数据
  if (!isLoadedFromUrl && savedFeatures.value && savedFeatures.value.features.length > 0) {
    draw.set(savedFeatures.value)
  }

  // 事件监听
  const map = mapInstance.value
  map.on('draw.create', updateStorage)
  map.on('draw.delete', updateStorage)
  map.on('draw.update', updateStorage)
  map.on('draw.selectionchange', handleSelectionChange)
  // 监听模式切换以高亮按钮
  map.on('draw.modechange', (e: any) => {
    currentMode.value = e.mode
  })
}

function updateStorage() {
  if (!drawInstance.value)
    return
  const data = drawInstance.value.getAll()
  savedFeatures.value = data
}

function handleSelectionChange(e: any) {
  if (e.features.length > 0) {
    const feature = e.features[0] as Feature
    selectedFeatureId.value = feature.id as string
    // 复制属性以便编辑
    selectedFeatureProps.value = { ...feature.properties }
  }
  else {
    selectedFeatureId.value = null
    selectedFeatureProps.value = {}
  }
}

// 切换绘图模式
function setDrawMode(mode: string) {
  if (!drawInstance.value)
    return
  // 使用 as any 规避类型定义重载不匹配的问题
  drawInstance.value.changeMode(mode as any)
  currentMode.value = mode
}

// 删除当前选中
function deleteSelected() {
  if (!drawInstance.value || !selectedFeatureId.value)
    return
  drawInstance.value.delete([selectedFeatureId.value])
  updateStorage()
  selectedFeatureId.value = null
}

// 属性管理
function updateFeatureProperty(key: string, value: any) {
  if (!drawInstance.value || !selectedFeatureId.value)
    return

  // 更新 Draw 内部状态
  drawInstance.value.setFeatureProperty(selectedFeatureId.value, key, value)
  // 更新本地响应式对象
  selectedFeatureProps.value[key] = value
  updateStorage()
}

function removeProperty(key: string) {
  if (!drawInstance.value || !selectedFeatureId.value)
    return
  // Mapbox Draw 无法直接删除 property key，只能设为 null 或 undefined?
  // 实际上 setFeatureProperty 设为 undefined 并不总是移除 key。
  // 更彻底的方法是获取 feature，删除 key，重新 set。
  const feature = drawInstance.value.get(selectedFeatureId.value)
  if (feature && feature.properties) {
    delete feature.properties[key]
    drawInstance.value.add(feature)
    const newProps = { ...feature.properties }
    selectedFeatureProps.value = newProps
    updateStorage()
  }
}

// 一键添加默认样式
function addDefaultStyles() {
  if (!drawInstance.value || !selectedFeatureId.value)
    return
  const feature = drawInstance.value.get(selectedFeatureId.value)
  if (!feature)
    return

  const type = feature.geometry.type
  const updates: Record<string, any> = {}

  if (type === 'Point') {
    updates['marker-color'] = '#ef4444'
    updates['marker-size-value'] = 8 // 自定义属性，匹配上面样式配置
  }
  else if (type === 'LineString') {
    updates.stroke = '#f59e0b'
    updates['stroke-width'] = 4
    updates['stroke-opacity'] = 0.8
  }
  else if (type === 'Polygon') {
    updates.fill = '#3b82f6'
    updates['fill-opacity'] = 0.4
    updates.stroke = '#2563eb'
    updates['stroke-width'] = 2
  }

  // 批量更新
  Object.entries(updates).forEach(([k, v]) => {
    updateFeatureProperty(k, v)
  })
}

// 生命周期
watch(() => isMapLoaded.value, (loaded) => {
  if (loaded) {
    initDraw()
  }
  else {
    // 路由切换导致旧地图卸载时，重置 drawInstance
    drawInstance.value = null
  }
})

onMounted(() => {
  if (isMapLoaded.value)
    initDraw()
})

onUnmounted(() => {
  if (mapInstance.value && drawInstance.value) {
    const map = mapInstance.value
    map.off('draw.create', updateStorage)
    map.off('draw.delete', updateStorage)
    map.off('draw.update', updateStorage)
    map.off('draw.selectionchange', handleSelectionChange)
    map.removeControl(drawInstance.value as unknown as IControl)
  }
})

// 计算当前选中要素的类型文本
const selectedTypeLabel = computed(() => {
  if (!selectedFeatureId.value || !drawInstance.value)
    return ''
  const feat = drawInstance.value.get(selectedFeatureId.value)
  return feat?.geometry.type || 'Unknown'
})

const selectedFeatureJson = computed(() => {
  if (selectedFeatureId.value && drawInstance.value) {
    const feat = drawInstance.value.get(selectedFeatureId.value)
    return JSON.stringify(feat, null, 2)
  }
  return null
})
</script>

<template>
  <div class="h-full w-full relative overflow-hidden">
    <ClientOnly>
      <Map />
    </ClientOnly>

    <!-- Header -->
    <header class="p-4 flex pointer-events-none items-center left-0 right-0 top-0 justify-between absolute z-10">
      <div class="text-xl text-white font-bold pointer-events-auto" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
        绘图工坊
      </div>
      <NuxtLink
        to="/"
        class="text-sm px-3 py-2 rounded-full bg-white/80 pointer-events-auto shadow-lg backdrop-blur-sm dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        返回主页
      </NuxtLink>
    </header>

    <!-- Drawing Hint (Top Center) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-4 opacity-0"
    >
      <div
        v-if="currentMode !== 'simple_select'"
        class="flex pointer-events-none left-0 right-0 top-24 justify-center absolute z-40"
      >
        <div class="text-sm text-white/90 tracking-wide font-medium px-6 py-2 border border-white/10 rounded-full bg-black/60 shadow-lg backdrop-blur-md">
          双击地图结束绘制
        </div>
      </div>
    </Transition>

    <!-- Toolbar -->
    <DrawToolbar
      :model-value="currentMode"
      @update:model-value="setDrawMode"
    />

    <!-- Right Side Panels Container -->
    <div class="flex flex-col gap-3 h-65vh w-80 pointer-events-none right-4 top-20 absolute z-30">
      <!-- 1. Properties Panel -->
      <DrawPropertiesPanel
        :feature-id="selectedFeatureId"
        :feature-props="selectedFeatureProps"
        :feature-geometry-type="selectedTypeLabel"
        @delete="deleteSelected"
        @update-property="updateFeatureProperty"
        @remove-property="removeProperty"
        @add-default-styles="addDefaultStyles"
      />

      <!-- 2. GeoJSON Viewer Panel -->
      <DrawGeoJsonPanel
        :features="savedFeatures"
        :selected-feature-id="selectedFeatureId"
        :selected-feature-json="selectedFeatureJson"
      />
    </div>
  </div>
</template>

<style>
/* 隐藏 Mapbox Draw 的默认控件，因为我们使用了自定义按钮 */
.mapboxgl-ctrl-group.mapboxgl-ctrl {
  display: none !important;
}
</style>
