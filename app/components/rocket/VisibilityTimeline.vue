<script setup lang="ts">
const props = defineProps<{
  currentTimeMin: number
  totalTimeMin: number
  insertTimeMin: number
  isPlaying: boolean
  playbackRate: number
}>()

const emit = defineEmits<{
  (e: 'time-change', v: number): void
  (e: 'toggle-play'): void
  (e: 'seek-insert'): void
  (e: 'rate-change', v: number): void
}>()

const progress = computed(() =>
  props.totalTimeMin > 0 ? (props.currentTimeMin / props.totalTimeMin) * 100 : 0,
)
const insertProgress = computed(() =>
  props.totalTimeMin > 0 ? (props.insertTimeMin / props.totalTimeMin) * 100 : 0,
)

function fmt(min: number): string {
  const totalSec = Math.round(min * 60)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `T+${m}:${String(s).padStart(2, '0')}`
}

function onInput(e: Event) {
  emit('time-change', Number((e.target as HTMLInputElement).value))
}
function onRate(e: Event) {
  emit('rate-change', Number((e.target as HTMLSelectElement).value))
}

const rates = [0.5, 1, 2, 4]
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-xs">
        <span class="text-gray-700 font-mono font-semibold dark:text-orange-400">{{ fmt(currentTimeMin) }}</span>
        <span class="text-gray-400 ml-2">/ {{ fmt(totalTimeMin) }}</span>
      </div>
      <div class="flex gap-1.5 items-center">
        <select
          :value="playbackRate"
          class="text-[11px] px-1.5 py-0.5 border border-gray-200 rounded bg-white dark:text-gray-200 dark:border-gray-600 dark:bg-gray-700"
          @change="onRate"
        >
          <option v-for="r in rates" :key="r" :value="r">
            {{ r }}×
          </option>
        </select>
        <button
          class="text-xs text-blue-600 px-2 py-0.5 rounded transition dark:text-blue-400 hover:text-blue-700"
          title="跳到入轨点"
          @click="emit('seek-insert')"
        >
          入轨
        </button>
      </div>
    </div>

    <div class="flex h-6 items-center relative">
      <div class="rounded-full bg-gray-200 h-1.5 inset-x-0 absolute dark:bg-gray-700" />
      <div class="rounded-full bg-orange-500 h-1.5 absolute" :style="{ width: `${progress}%` }" />
      <!-- 入轨锚点 -->
      <div
        v-if="insertProgress > 0"
        class="bg-blue-500 h-3 w-0.5 absolute -translate-x-1/2"
        :style="{ left: `${insertProgress}%` }"
        title="入轨点"
      />
      <input
        type="range"
        :value="currentTimeMin"
        :min="0"
        :max="totalTimeMin"
        :step="totalTimeMin / 400"
        class="opacity-0 h-6 w-full cursor-pointer relative"
        @input="onInput"
      >
      <div
        class="border-2 border-orange-500 rounded-full bg-white h-3.5 w-3.5 pointer-events-none shadow absolute -translate-x-1/2"
        :style="{ left: `${progress}%` }"
      />
    </div>

    <button
      class="text-sm text-white py-1.5 rounded-lg bg-orange-500 flex gap-1.5 w-full transition items-center justify-center hover:bg-orange-600"
      @click="emit('toggle-play')"
    >
      <div :class="isPlaying ? 'i-carbon-pause-filled' : 'i-carbon-play-filled-alt'" class="text-base" />
      {{ isPlaying ? '暂停' : '播放' }}
    </button>
  </div>
</template>
