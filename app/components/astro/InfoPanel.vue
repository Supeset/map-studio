<script setup lang="ts">
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
  isPinned: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'toggle-pin'): void
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="selectedPoint && (isLoading || calculationError || astroInfo)"
      class="max-w-[calc(100vw-2rem)] w-[420px] pointer-events-auto bottom-6 left-1/2 absolute z-50 -translate-x-1/2"
    >
      <div class="px-5 pb-4 pt-3 border border-gray-100 rounded-2xl bg-white/95 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
          <div class="flex gap-2 items-center">
            <div class="i-carbon-sunrise text-lg text-orange-400" />
            <span class="text-sm text-gray-700 font-bold dark:text-gray-200">太阳信息</span>
            <span class="text-xs text-gray-400 font-mono">
              {{ selectedPoint.lng.toFixed(4) }}, {{ selectedPoint.lat.toFixed(4) }}
            </span>
          </div>
          <button
            class="text-gray-400 p-1 rounded-md transition hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            :class="{ 'text-orange-500 hover:text-orange-600': isPinned }"
            :title="isPinned ? '取消固定' : '固定'"
            @click="$emit('toggle-pin')"
          >
            <div :class="isPinned ? 'i-carbon-pin-filled' : 'i-carbon-pin'" class="text-base" />
          </button>
          <button
            class="text-gray-400 p-1 rounded-md transition hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            title="关闭"
            @click="$emit('close')"
          >
            <div class="i-carbon-close text-base" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="text-sm text-teal-600 py-4 text-center">
          <div class="i-carbon-circle-dash text-2xl mb-2 inline-block animate-spin" />
          <div>正在计算天文数据...</div>
        </div>

        <!-- Error -->
        <div v-else-if="calculationError" class="text-sm text-red-500 p-3 border border-red-100 rounded-lg bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div class="font-bold mb-1 flex gap-2 items-center">
            <div class="i-carbon-warning-alt" />
            计算失败
          </div>
          {{ calculationError }}
        </div>

        <!-- Data -->
        <div v-else-if="astroInfo" class="gap-2 grid grid-cols-3">
          <!-- Sunrise -->
          <div class="p-2.5 text-center border border-orange-100 rounded-lg dark:border-orange-900/30">
            <div class="text-xs text-orange-600 tracking-wider font-bold uppercase dark:text-orange-400">
              日出
            </div>
            <div class="text-lg text-gray-800 font-bold font-mono mt-1 dark:text-gray-100">
              {{ astroInfo.sunriseTime }}
            </div>
            <div class="text-xs text-gray-500 font-medium mt-0.5">
              {{ astroInfo.sunriseAzimuth.toFixed(1) }}°
            </div>
          </div>

          <!-- Solar Noon -->
          <div class="p-2.5 text-center border border-yellow-100 rounded-lg dark:border-yellow-900/30">
            <div class="text-xs text-yellow-600 tracking-wider font-bold uppercase dark:text-yellow-400">
              中天
            </div>
            <div class="text-lg text-gray-800 font-bold font-mono mt-1 dark:text-gray-100">
              {{ astroInfo.solarNoonTime }}
            </div>
            <div class="text-xs text-gray-500 font-medium mt-0.5">
              最高点
            </div>
          </div>

          <!-- Sunset -->
          <div class="p-2.5 text-center border border-indigo-100 rounded-lg dark:border-indigo-900/30">
            <div class="text-xs text-indigo-600 tracking-wider font-bold uppercase dark:text-indigo-400">
              日落
            </div>
            <div class="text-lg text-gray-800 font-bold font-mono mt-1 dark:text-gray-100">
              {{ astroInfo.sunsetTime }}
            </div>
            <div class="text-xs text-gray-500 font-medium mt-0.5">
              {{ astroInfo.sunsetAzimuth.toFixed(1) }}°
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
