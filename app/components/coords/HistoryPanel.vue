<script setup lang="ts">
import dayjs from 'dayjs'
import ThePanel from '~/components/ThePanel.vue'

export interface HistoryItem {
  id: number
  input: string
  type: 'WGS84' | 'GCJ02' | 'BD09'
  result: {
    wgs84: [number, number]
    gcj02: [number, number]
    bd09: [number, number]
  }
  timestamp: number
}

defineProps<{
  history: HistoryItem[]
}>()

const emit = defineEmits<{
  (e: 'restore', item: HistoryItem): void
  (e: 'clear'): void
}>()

function formatTime(ts: number) {
  return dayjs(ts).format('MM-DD HH:mm')
}
</script>

<template>
  <ThePanel title="历史记录" icon="i-carbon-time" :initial-open="false">
    <template #actions>
      <button
        v-if="history.length > 0"
        class="text-gray-400 p-1.5 rounded transition hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700"
        title="清空历史"
        @click="emit('clear')"
      >
        <div class="i-carbon-trash-can" />
      </button>
    </template>

    <div v-if="history.length === 0" class="text-sm text-gray-400 p-4 text-center">
      暂无转换记录
    </div>

    <div v-else class="flex flex-col divide-gray-100 divide-y dark:divide-gray-700">
      <div
        v-for="item in history"
        :key="item.id"
        class="p-3 cursor-pointer transition hover:bg-teal-50 dark:hover:bg-teal-900/20"
        @click="emit('restore', item)"
      >
        <div class="mb-1 flex items-start justify-between">
          <div class="flex gap-2 items-center">
            <span
              class="text-[10px] px-1.5 py-0.5 border rounded"
              :class="{
                'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800': item.type === 'WGS84',
                'text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800': item.type === 'GCJ02',
                'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800': item.type === 'BD09',
              }"
            >
              {{ item.type }}
            </span>
            <span class="text-xs text-gray-400">{{ formatTime(item.timestamp) }}</span>
          </div>
        </div>
        <div class="text-sm text-gray-700 font-mono truncate dark:text-gray-300">
          {{ item.input }}
        </div>
      </div>
    </div>
  </ThePanel>
</template>
