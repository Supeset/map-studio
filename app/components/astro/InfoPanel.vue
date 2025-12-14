<script setup lang="ts">
import ThePanel from '~/components/ThePanel.vue'

interface AstroInfo {
  sunriseAzimuth: number
  sunsetAzimuth: number
  sunriseTime: string
  sunsetTime: string
  solarNoonTime: string
}

defineProps<{
  selectedPoint: { lng: number, lat: number } | null
  isLoading: boolean
  calculationError: string | null
  astroInfo: AstroInfo | null
}>()
</script>

<template>
  <ThePanel title="太阳信息 (当地时区)" icon="i-carbon-sun" :initial-open="true">
    <div class="p-4">
      <div v-if="!selectedPoint" class="text-sm text-gray-500 py-2 text-center">
        请在地图上点击任意位置以获取信息
      </div>
      <div v-else>
        <!-- 坐标信息 -->
        <div class="text-xs text-gray-600 mb-4 p-2 border border-gray-100 rounded bg-gray-50 flex justify-between dark:text-gray-400 dark:border-gray-700 dark:bg-gray-800">
          <span>Lng: <span class="text-gray-900 font-mono dark:text-gray-200">{{ selectedPoint.lng.toFixed(4) }}</span></span>
          <span>Lat: <span class="text-gray-900 font-mono dark:text-gray-200">{{ selectedPoint.lat.toFixed(4) }}</span></span>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoading" class="text-sm text-teal-600 py-8 text-center">
          <div class="i-carbon-circle-dash text-2xl mb-2 inline-block animate-spin" />
          <div>正在计算天文数据...</div>
        </div>

        <!-- 错误信息 -->
        <div v-else-if="calculationError" class="text-sm text-red-500 p-3 border border-red-100 rounded bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div class="font-bold mb-1 flex gap-2 items-center">
            <div class="i-carbon-warning-alt" />
            计算失败
          </div>
          {{ calculationError }}
        </div>

        <!-- 数据展示 -->
        <div v-else-if="astroInfo" class="space-y-3">
          <!-- 日出 -->
          <div class="p-3 border border-orange-100 rounded-lg from-orange-50 to-amber-50 bg-gradient-to-br dark:border-orange-900/30 dark:from-orange-900/20 dark:to-amber-900/10">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs text-orange-600 tracking-wider font-bold uppercase dark:text-orange-400">日出 Sunrise</span>
              <div class="i-carbon-sunrise text-xl text-orange-400" />
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-2xl text-gray-800 font-bold font-mono dark:text-gray-100">{{ astroInfo.sunriseTime }}</span>
              <span class="text-xs text-gray-500 font-medium">方位 {{ astroInfo.sunriseAzimuth.toFixed(1) }}°</span>
            </div>
          </div>

          <!-- 太阳凌日 -->
          <div class="p-3 border border-yellow-100 rounded-lg from-yellow-50 to-yellow-50/50 bg-gradient-to-br dark:border-yellow-900/30 dark:from-yellow-900/20 dark:to-yellow-900/10">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs text-yellow-600 tracking-wider font-bold uppercase dark:text-yellow-400">中天 Solar Noon</span>
              <div class="i-carbon-sun text-xl text-yellow-400" />
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-2xl text-gray-800 font-bold font-mono dark:text-gray-100">{{ astroInfo.solarNoonTime }}</span>
              <span class="text-xs text-gray-500 font-medium">最高点</span>
            </div>
          </div>

          <!-- 日落 -->
          <div class="p-3 border border-indigo-100 rounded-lg from-indigo-50 to-blue-50 bg-gradient-to-br dark:border-indigo-900/30 dark:from-indigo-900/20 dark:to-blue-900/10">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs text-indigo-600 tracking-wider font-bold uppercase dark:text-indigo-400">日落 Sunset</span>
              <div class="i-carbon-sunset text-xl text-indigo-400" />
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-2xl text-gray-800 font-bold font-mono dark:text-gray-100">{{ astroInfo.sunsetTime }}</span>
              <span class="text-xs text-gray-500 font-medium">方位 {{ astroInfo.sunsetAzimuth.toFixed(1) }}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ThePanel>
</template>
