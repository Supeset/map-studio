<script setup lang="ts">
import ThePanel from '~/components/ThePanel.vue'

interface ResultType {
  wgs84: [number, number]
  gcj02: [number, number]
  bd09: [number, number]
}

defineProps<{
  inputStr: string
  sourceType: 'WGS84' | 'GCJ02' | 'BD09'
  result: ResultType | null
  isValid: boolean // 用于判断是否格式错误
}>()

const emit = defineEmits<{
  (e: 'update:inputStr', value: string): void
  (e: 'update:sourceType', value: 'WGS84' | 'GCJ02' | 'BD09'): void
}>()

const { copy, copied } = useClipboard()

function copyCoords(coords: [number, number]) {
  copy(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`)
}

function handleInput(e: Event) {
  emit('update:inputStr', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <ThePanel title="坐标输入" icon="i-carbon-location" :initial-open="true">
    <div class="p-4 flex flex-col gap-4">
      <!-- Input -->
      <div class="p-2 border border-gray-200 rounded-lg bg-white flex items-center dark:border-gray-700 dark:bg-gray-800">
        <div class="i-carbon-search text-xl text-gray-400 mr-2 shrink-0" />
        <input
          :value="inputStr"
          type="text"
          placeholder="121.47, 31.23"
          class="text-base text-gray-800 outline-none border-none bg-transparent min-w-0 w-full dark:text-gray-100 placeholder-gray-400"
          @input="handleInput"
        >
        <button
          v-if="inputStr"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          @click="emit('update:inputStr', '')"
        >
          <div class="i-carbon-close text-lg" />
        </button>
      </div>

      <!-- Type Selector -->
      <div>
        <div class="text-xs text-gray-400 tracking-wider font-bold mb-2 uppercase">
          当前坐标类型
        </div>
        <div class="flex gap-2">
          <button
            v-for="type in ['WGS84', 'GCJ02', 'BD09'] as const"
            :key="type"
            class="text-xs px-3 py-1.5 border rounded-md flex-1 transition-colors"
            :class="sourceType === type
              ? 'bg-teal-600 border-teal-600 text-white'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-teal-500'"
            @click="emit('update:sourceType', type)"
          >
            {{ type }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div v-if="result" class="flex flex-col gap-3">
        <div class="my-1 border-t border-gray-100 dark:border-gray-700" />

        <!-- WGS84 -->
        <div class="p-2.5 border border-green-100 rounded-lg bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs text-green-700 font-bold dark:text-green-400">WGS84 (GPS)</span>
            <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.wgs84)">
              <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
            </button>
          </div>
          <div class="text-sm text-gray-800 font-mono dark:text-gray-200">
            {{ result.wgs84[0].toFixed(6) }}, {{ result.wgs84[1].toFixed(6) }}
          </div>
        </div>

        <!-- GCJ02 -->
        <div class="p-2.5 border border-orange-100 rounded-lg bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-900/10">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs text-orange-700 font-bold dark:text-orange-400">GCJ02 (火星)</span>
            <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.gcj02)">
              <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
            </button>
          </div>
          <div class="text-sm text-gray-800 font-mono dark:text-gray-200">
            {{ result.gcj02[0].toFixed(6) }}, {{ result.gcj02[1].toFixed(6) }}
          </div>
        </div>

        <!-- BD09 -->
        <div class="p-2.5 border border-blue-100 rounded-lg bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/10">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs text-blue-700 font-bold dark:text-blue-400">BD09 (百度)</span>
            <button class="text-xs icon-btn" title="复制" @click="copyCoords(result.bd09)">
              <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
            </button>
          </div>
          <div class="text-sm text-gray-800 font-mono dark:text-gray-200">
            {{ result.bd09[0].toFixed(6) }}, {{ result.bd09[1].toFixed(6) }}
          </div>
        </div>
      </div>

      <div v-else-if="inputStr && !isValid" class="text-xs text-red-500 text-center">
        格式错误，请使用 "经度, 纬度"
      </div>
    </div>
  </ThePanel>
</template>
