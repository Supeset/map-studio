<script setup lang="ts">
import type { Feature } from 'geojson'
import ThePanel from '~/components/ThePanel.vue'
import { getFeatureColor, getFeatureIcon, getFeatureName, getFeatureSubtitle, isFeatureHidden } from '~/utils/featureMeta'

defineProps<{
  features: Feature[]
  selectedFeatureId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'focus', id: string): void
  (e: 'delete', id: string): void
  (e: 'toggle-visibility', id: string): void
  (e: 'clear-all'): void
}>()

const isConfirmingClear = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function handleClearClick() {
  // 二次点击确认
  if (isConfirmingClear.value) {
    if (confirmTimer)
      clearTimeout(confirmTimer)
    confirmTimer = null
    isConfirmingClear.value = false
    emit('clear-all')
    return
  }

  isConfirmingClear.value = true
  confirmTimer = setTimeout(() => {
    isConfirmingClear.value = false
    confirmTimer = null
  }, 3000)
}

onUnmounted(() => {
  if (confirmTimer)
    clearTimeout(confirmTimer)
})
</script>

<template>
  <ThePanel title="图形列表" icon="i-carbon-list" :initial-open="true">
    <template #badge>
      <span class="text-xs text-gray-500 px-1.5 py-0.5 rounded-full bg-gray-100 dark:text-gray-400 dark:bg-gray-700">
        {{ features.length }}
      </span>
    </template>

    <template #actions>
      <span
        v-if="isConfirmingClear"
        class="text-xs text-red-500 font-medium mr-1 animate-pulse"
      >
        再次点击确认
      </span>
      <button
        class="p-1.5 rounded transition"
        :class="isConfirmingClear
          ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
          : 'text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700'"
        :disabled="!features.length"
        :title="isConfirmingClear ? '再次点击确认清空' : '一键清空'"
        @click="handleClearClick"
      >
        <div class="i-carbon-trash-can text-sm" />
      </button>
    </template>

    <!-- 空状态 -->
    <div v-if="!features.length" class="text-sm text-gray-400 leading-relaxed p-6 text-center">
      还没有图形
      <br>
      点击左侧工具栏绘制，或从下方导入 GeoJSON
    </div>

    <!-- 列表 -->
    <div v-else class="flex flex-col">
      <div
        v-for="feature in features"
        :key="feature.id"
        class="group px-3 py-2.5 border-l-2 border-transparent flex gap-3 cursor-pointer transition-all"
        :class="[
          feature.id === selectedFeatureId
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
            : 'hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-900/10',
          isFeatureHidden(feature) ? 'opacity-50' : '',
        ]"
        @click="emit('select', String(feature.id))"
      >
        <!-- 类型图标（颜色反映要素样式） -->
        <div
          class="flex shrink-0 w-6 items-center justify-center"
          :style="{ color: getFeatureColor(feature) }"
        >
          <div :class="getFeatureIcon(feature.geometry?.type ?? '')" class="text-lg" />
        </div>

        <!-- 名称 + 副信息 -->
        <div class="flex-1 min-w-0">
          <div class="text-sm text-gray-800 font-medium truncate dark:text-gray-200">
            {{ getFeatureName(feature) }}
          </div>
          <div class="text-xs text-gray-400 font-mono mt-0.5 truncate dark:text-gray-500">
            {{ getFeatureSubtitle(feature) }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex shrink-0 gap-0.5 items-center" @click.stop>
          <button
            class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900/30"
            :class="feature.id === selectedFeatureId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            title="定位到此图形"
            @click="emit('focus', String(feature.id))"
          >
            <div class="i-carbon-target-point text-sm" />
          </button>
          <button
            class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900/30"
            :class="isFeatureHidden(feature) || feature.id === selectedFeatureId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            :title="isFeatureHidden(feature) ? '显示图形' : '隐藏图形'"
            @click="emit('toggle-visibility', String(feature.id))"
          >
            <div :class="isFeatureHidden(feature) ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-sm" />
          </button>
          <button
            class="text-gray-400 p-1.5 rounded transition hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="删除"
            @click="emit('delete', String(feature.id))"
          >
            <div class="i-carbon-trash-can text-sm" />
          </button>
        </div>
      </div>
    </div>
  </ThePanel>
</template>
