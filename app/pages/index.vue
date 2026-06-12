<script setup lang="ts">
import AstroInfoPanel from '~/components/astro/InfoPanel.vue'
import DrawGeoJsonPanel from '~/components/draw/GeoJsonPanel.vue'
import DrawPropertiesPanel from '~/components/draw/PropertiesPanel.vue'
import DrawToolbar from '~/components/draw/Toolbar.vue'
import LandingListPanel from '~/components/rocket/LandingListPanel.vue'
import RocketListPanel from '~/components/rocket/ListPanel.vue'

defineOptions({
  name: 'IndexPage',
})

const mapStore = useMapStore()
const { mapInstance, isMapLoaded } = storeToRefs(mapStore)

const {
  isActive: isAstroActive,
  isPinned: isAstroPinned,
  isLoading: isAstroLoading,
  selectedPoint: astroSelectedPoint,
  calculationError: astroCalcError,
  astroInfo,
  activate: activateAstro,
  deactivate: deactivateAstro,
  clearResult: clearAstroResult,
} = useAstroTool(mapInstance, isMapLoaded)

const { visible: isRocketVisible, padsData, landingData, handleSelectPad, handleSelectLanding, toggleVisibility: toggleRocket } = useRocketTool(mapInstance, isMapLoaded)

const {
  savedFeatures,
  selectedFeatureId,
  selectedFeatureProps,
  currentMode,
  selectedTypeLabel,
  selectedFeatureJson,
  setDrawMode,
  deleteSelected,
  updateFeatureProperty,
  removeProperty,
  addDefaultStyles,
  importGeoJson,
} = useDrawTool(mapInstance, isMapLoaded)

function handleImportGeoJson(text: string) {
  return importGeoJson(text)
}

function handleToggleAstro() {
  if (isAstroActive.value) {
    deactivateAstro()
  }
  else {
    currentMode.value = 'simple_select'
    activateAstro()
  }
}

function handleDrawModeChange(mode: string) {
  if (isAstroActive.value)
    deactivateAstro()
  setDrawMode(mode)
}

function handleAstroClose() {
  clearAstroResult()
}

function handleAstroTogglePin() {
  isAstroPinned.value = !isAstroPinned.value
}
</script>

<template>
  <div class="h-full w-full relative overflow-hidden">
    <ClientOnly>
      <Map />
    </ClientOnly>
    <TheHeader />

    <!-- 绘图提示 -->
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
        class="flex pointer-events-none left-0 right-0 top-16 justify-center absolute z-40"
      >
        <div class="text-sm text-white/90 tracking-wide font-medium px-6 py-2 border border-white/10 rounded-full bg-black/60 shadow-lg backdrop-blur-md">
          双击地图结束绘制
        </div>
      </div>
    </Transition>

    <!-- 左侧绘图工具栏 -->
    <DrawToolbar
      :model-value="currentMode"
      :is-astro-active="isAstroActive"
      :is-rocket-active="isRocketVisible"
      @update:model-value="handleDrawModeChange"
      @toggle-astro="handleToggleAstro"
      @toggle-rocket="toggleRocket"
    />

    <!-- 右侧面板容器 -->
    <div class="flex flex-col gap-3 w-80 pointer-events-none bottom-4 right-4 top-4 absolute z-20">
      <div class="pr-1 flex flex-col gap-3 h-full pointer-events-auto overflow-y-auto">
        <!-- 火箭面板 -->
        <template v-if="isRocketVisible">
          <RocketListPanel
            :pads="padsData"
            @select="handleSelectPad"
          />
          <LandingListPanel
            :sites="landingData"
            @select="handleSelectLanding"
          />
        </template>

        <!-- 绘图属性面板 -->
        <DrawPropertiesPanel
          :feature-id="selectedFeatureId"
          :feature-props="selectedFeatureProps"
          :feature-geometry-type="selectedTypeLabel"
          @delete="deleteSelected"
          @update-property="updateFeatureProperty"
          @remove-property="removeProperty"
          @add-default-styles="addDefaultStyles"
        />

        <!-- GeoJSON 数据面板 -->
        <DrawGeoJsonPanel
          :features="savedFeatures"
          :selected-feature-id="selectedFeatureId"
          :selected-feature-json="selectedFeatureJson"
          @import="handleImportGeoJson"
        />
      </div>
    </div>

    <!-- 天文信息底部卡片 -->
    <AstroInfoPanel
      :selected-point="astroSelectedPoint"
      :is-loading="isAstroLoading"
      :calculation-error="astroCalcError"
      :astro-info="astroInfo"
      :is-pinned="isAstroPinned"
      @close="handleAstroClose"
      @toggle-pin="handleAstroTogglePin"
    />
  </div>
</template>

<style>
/* 隐藏 Mapbox Draw 的默认控件 */
.mapboxgl-ctrl-group.mapboxgl-ctrl {
  display: none !important;
}

/* 火箭 popup 样式 */
.rocket-popup .mapboxgl-popup-content {
  padding: 0;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  background-color: white;
  color: #1f2937;
}

html.dark .rocket-popup .mapboxgl-popup-content {
  background-color: #1f2937;
  color: #f3f4f6;
  border: 1px solid #374151;
}

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
</style>
