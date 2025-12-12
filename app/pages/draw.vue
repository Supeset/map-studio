<script setup lang="ts">
import type { Feature } from 'geojson'
import type { IControl } from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'

defineOptions({
  name: 'DrawPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

// --- Constants & Config ---
const STORAGE_KEY = 'map-studio-draw-data'

// 自定义 Mapbox Draw 样式，使其支持 user_ 前缀的属性 (SimpleStyle Spec)
// Mapbox Draw 默认将 feature.properties 映射为 user_属性名
const drawStyles = [
  // 1. Polygon Fill (Inactive)
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    paint: {
      'fill-color': ['coalesce', ['get', 'user_fill'], '#3bb2d0'],
      'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.1],
      'fill-outline-color': ['coalesce', ['get', 'user_stroke'], '#3bb2d0'],
    },
  },
  // 2. Polygon Fill (Active)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': ['coalesce', ['get', 'user_fill'], '#fbb03b'],
      'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.1],
      'fill-outline-color': ['coalesce', ['get', 'user_stroke'], '#fbb03b'],
    },
  },
  // 3. Line/Stroke (Inactive)
  {
    id: 'gl-draw-line-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#3bb2d0'],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 4. Line/Stroke (Active)
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#fbb03b'],
      'line-dasharray': [0.2, 2],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 5. Point (Inactive) - using Circle for better performance than Symbol
  {
    id: 'gl-draw-point-inactive',
    type: 'circle',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: {
      'circle-radius': ['coalesce', ['get', 'user_marker-size-value'], 5],
      'circle-color': ['coalesce', ['get', 'user_marker-color'], '#3bb2d0'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
  // 6. Point (Active)
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': ['coalesce', ['get', 'user_marker-size-value'], 7],
      'circle-color': ['coalesce', ['get', 'user_marker-color'], '#fbb03b'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
  // Polygon Midpoints (standard)
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#fbb03b',
    },
  },
]

// --- State ---
const drawInstance = shallowRef<MapboxDraw | null>(null)
// 使用 useLocalStorage 持久化 GeoJSON
const savedFeatures = useLocalStorage(STORAGE_KEY, {
  type: 'FeatureCollection',
  features: [],
} as any)

const selectedFeatureId = ref<string | null>(null)
const selectedFeatureProps = ref<Record<string, any>>({})
const currentMode = ref<string>('simple_select')
const isPanelOpen = ref(true)

// 表单新增属性
const newPropKey = ref('')
const newPropValue = ref('')

// --- Methods ---

function initDraw() {
  if (!mapInstance.value || drawInstance.value)
    return

  const draw = new MapboxDraw({
    displayControlsDefault: false, // 隐藏默认控件，使用自定义UI
    userProperties: true, // 关键：启用 properties 映射到样式
    styles: drawStyles as any,
    modes: MapboxDraw.modes, // 使用默认模式
  })

  mapInstance.value.addControl(draw as unknown as IControl, 'top-left')
  drawInstance.value = draw

  // 加载保存的数据
  if (savedFeatures.value && savedFeatures.value.features.length > 0) {
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
    isPanelOpen.value = true
  }
  else {
    selectedFeatureId.value = null
    selectedFeatureProps.value = {}
  }
}

// 切换绘图模式
function setDrawMode(mode: 'draw_point' | 'draw_line_string' | 'draw_polygon' | 'simple_select') {
  if (!drawInstance.value)
    return
  drawInstance.value.changeMode(mode)
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

function addProperty() {
  if (!newPropKey.value)
    return
  updateFeatureProperty(newPropKey.value, newPropValue.value)
  newPropKey.value = ''
  newPropValue.value = ''
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
  if (loaded)
    initDraw()
}, { immediate: true })

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
</script>

<template>
  <div class="h-full w-full relative">
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

    <!-- Toolbar -->
    <div class="flex flex-col gap-2 items-start left-4 top-20 absolute z-20">
      <div class="p-2 rounded-lg bg-white/90 flex flex-col gap-2 shadow-xl backdrop-blur-sm dark:bg-gray-800/90">
        <button
          class="group p-2 rounded transition relative hover:bg-teal-50 dark:hover:bg-gray-700"
          :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': currentMode === 'simple_select' }"
          title="选择工具"
          @click="setDrawMode('simple_select')"
        >
          <div class="i-carbon-cursor-1 text-xl" />
        </button>
        <div class="mx-1 bg-gray-200 h-px dark:bg-gray-700" />
        <button
          class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
          :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': currentMode === 'draw_point' }"
          title="绘制点 (圆)"
          @click="setDrawMode('draw_point')"
        >
          <div class="i-gis-point text-xl" />
        </button>
        <button
          class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
          :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': currentMode === 'draw_line_string' }"
          title="绘制线"
          @click="setDrawMode('draw_line_string')"
        >
          <div class="i-gis-polyline-pt text-xl" />
        </button>
        <button
          class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
          :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': currentMode === 'draw_polygon' }"
          title="绘制面 (矩形/多边形)"
          @click="setDrawMode('draw_polygon')"
        >
          <div class="i-gis-polygon-pt text-xl" />
        </button>
      </div>

      <!-- Helper Text -->
      <span class="text-xs text-white/90 p-2 rounded bg-black/40 backdrop-blur-sm">
        双击<br>结束<br>绘制
      </span>
    </div>

    <!-- Properties Panel -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0"
    >
      <div
        v-if="selectedFeatureId"
        class="border border-gray-100 rounded-xl bg-white/95 flex flex-col h-60vh w-80 shadow-2xl right-4 top-20 absolute z-30 overflow-hidden backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
      >
        <!-- Panel Header -->
        <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-900/50">
          <div>
            <h3 class="text-gray-800 font-bold dark:text-gray-100">
              属性编辑
            </h3>
            <div class="text-xs text-gray-500 tracking-wider font-mono mt-0.5 uppercase">
              {{ selectedTypeLabel }}
            </div>
          </div>
          <button
            class="text-red-500 p-1.5 rounded-md transition hover:bg-red-50 dark:hover:bg-red-900/20"
            title="删除要素"
            @click="deleteSelected"
          >
            <div class="i-carbon-trash-can text-lg" />
          </button>
        </div>

        <!-- Panel Body -->
        <div class="p-4 flex-1 overflow-y-auto">
          <!-- Quick Actions -->
          <div class="mb-6">
            <button
              class="text-sm text-teal-700 font-medium px-4 py-2 rounded-lg bg-teal-50 flex gap-2 w-full transition items-center justify-center dark:text-teal-300 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30"
              @click="addDefaultStyles"
            >
              <div class="i-carbon-magic-wand" />
              应用默认样式
            </button>
          </div>

          <!-- Properties Table -->
          <div class="space-y-3">
            <div v-if="Object.keys(selectedFeatureProps).length === 0" class="text-sm text-gray-400 py-4 text-center">
              暂无属性
            </div>

            <div
              v-for="(value, key) in selectedFeatureProps"
              :key="key"
              class="group p-2 border border-transparent rounded-lg bg-gray-50 transition relative hover:border-gray-200 dark:bg-gray-700/30 dark:hover:border-gray-600"
            >
              <div class="mb-1 flex items-start justify-between">
                <span class="text-xs text-gray-500 font-mono w-32 truncate dark:text-gray-400" :title="key">{{ key }}</span>
                <button
                  class="text-gray-400 p-0.5 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  @click="removeProperty(String(key))"
                >
                  <div class="i-carbon-close text-sm" />
                </button>
              </div>
              <div class="flex gap-2 items-center">
                <input
                  v-if="key.toString().includes('color')"
                  type="color"
                  :value="value"
                  class="rounded border-none bg-transparent h-6 w-6 cursor-pointer"
                  @input="(e) => updateFeatureProperty(String(key), (e.target as HTMLInputElement).value)"
                >
                <input
                  :value="value"
                  class="text-sm text-gray-800 font-medium outline-none border-none bg-transparent flex-1 w-full dark:text-gray-200"
                  @change="(e) => updateFeatureProperty(String(key), (e.target as HTMLInputElement).value)"
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Add Property Footer -->
        <div class="p-3 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
          <div class="text-xs text-gray-400 tracking-wider font-bold mb-2 uppercase">
            新增属性
          </div>
          <div class="mb-2 flex gap-2">
            <input
              v-model="newPropKey"
              placeholder="Key (e.g. stroke)"
              class="text-sm px-2 py-1.5 outline-none border border-gray-300 rounded bg-white flex-1 min-w-0 dark:border-gray-600 focus:border-teal-500 dark:bg-gray-800"
              @keyup.enter="addProperty"
            >
            <input
              v-model="newPropValue"
              placeholder="Value"
              class="text-sm px-2 py-1.5 outline-none border border-gray-300 rounded bg-white flex-1 min-w-0 dark:border-gray-600 focus:border-teal-500 dark:bg-gray-800"
              @keyup.enter="addProperty"
            >
          </div>
          <button
            class="text-sm text-gray-700 py-1.5 rounded bg-gray-200 w-full transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            :disabled="!newPropKey"
            @click="addProperty"
          >
            添加
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
/* 隐藏 Mapbox Draw 的默认控件，因为我们使用了自定义按钮 */
.mapboxgl-ctrl-group.mapboxgl-ctrl {
  display: none !important;
}
</style>
