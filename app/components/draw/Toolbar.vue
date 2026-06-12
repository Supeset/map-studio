<script setup lang="ts">
defineProps<{
  modelValue: string
  isAstroActive: boolean
  isRocketActive: boolean
}>()

defineEmits<{
  (e: 'update:model-value', mode: string): void
  (e: 'toggle-astro'): void
  (e: 'toggle-rocket'): void
}>()
</script>

<template>
  <div class="flex flex-col gap-2 items-start left-4 top-20 absolute z-20">
    <div class="p-2 rounded-lg bg-white/90 flex flex-col gap-2 shadow-xl backdrop-blur-sm dark:bg-gray-800/90">
      <button
        class="group p-2 rounded transition relative hover:bg-teal-50 dark:hover:bg-gray-700"
        :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': modelValue === 'simple_select' }"
        title="选择工具"
        @click="$emit('update:model-value', 'simple_select')"
      >
        <div class="i-carbon-cursor-1 text-xl" />
      </button>
      <div class="mx-1 bg-gray-200 h-px dark:bg-gray-700" />
      <button
        class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
        :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': modelValue === 'draw_point' }"
        title="绘制点 (圆)"
        @click="$emit('update:model-value', 'draw_point')"
      >
        <div class="i-gis-point text-xl" />
      </button>
      <button
        class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
        :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': modelValue === 'draw_line_string' }"
        title="绘制线"
        @click="$emit('update:model-value', 'draw_line_string')"
      >
        <div class="i-gis-polyline-pt text-xl" />
      </button>
      <button
        class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
        :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': modelValue === 'draw_polygon' }"
        title="绘制面 (矩形/多边形)"
        @click="$emit('update:model-value', 'draw_polygon')"
      >
        <div class="i-gis-polygon-pt text-xl" />
      </button>
      <div class="mx-1 bg-gray-200 h-px dark:bg-gray-700" />
      <button
        class="p-2 rounded transition hover:bg-teal-50 dark:hover:bg-gray-700"
        :class="{ 'text-teal-600 bg-teal-50 dark:bg-gray-700': isRocketActive }"
        title="火箭发射场/回收场"
        @click="$emit('toggle-rocket')"
      >
        <div class="i-carbon-rocket text-xl" />
      </button>
      <button
        class="p-2 rounded transition hover:bg-orange-50 dark:hover:bg-gray-700"
        :class="{ 'text-orange-500 bg-orange-50 dark:bg-gray-700': isAstroActive }"
        title="天文工具"
        @click="$emit('toggle-astro')"
      >
        <div class="i-carbon-sunrise text-xl" />
      </button>
    </div>
  </div>
</template>
