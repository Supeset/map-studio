<script setup lang="ts">
import ThePanel from '~/components/ThePanel.vue'

// 定义数据类型
export interface EnrichedPad {
  record_id: string
  latitude: number
  longitude: number
  name: string
  location_name_en: string
  country: string
  launch_center: string
  coordinates: string
}

const props = defineProps<{
  pads: EnrichedPad[]
}>()

const emit = defineEmits<{
  (e: 'select', pad: EnrichedPad): void
}>()

// 分组逻辑
const groupedPads = computed(() => {
  const groups: Record<string, EnrichedPad[]> = {}
  if (!props.pads)
    return groups

  props.pads.forEach((pad) => {
    const country = pad.country || '未知区域'
    if (!groups[country]) {
      groups[country] = []
    }
    groups[country].push(pad)
  })
  return groups
})

// 控制每个分组的展开状态
const openGroups = ref<Record<string, boolean>>({})

// 初始化时默认展开所有分组，或者根据数量决定
watch(() => groupedPads.value, (groups) => {
  Object.keys(groups).forEach((country) => {
    // 默认全部展开，或者可以设置为 false
    if (openGroups.value[country] === undefined) {
      openGroups.value[country] = false
    }
  })
}, { immediate: true })

function toggleGroup(country: string) {
  openGroups.value[country] = !openGroups.value[country]
}
</script>

<template>
  <ThePanel title="全球发射场" icon="i-carbon-rocket" :initial-open="true">
    <div v-if="!pads || pads.length === 0" class="text-sm text-gray-400 p-4 text-center">
      加载中...
    </div>

    <div v-else class="flex flex-col">
      <div
        v-for="(list, country) in groupedPads"
        :key="country"
        class="border-b border-gray-100 dark:border-gray-700 last:border-none"
      >
        <!-- Group Header -->
        <div
          class="px-4 py-3 flex cursor-pointer transition-colors items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="toggleGroup(String(country))"
        >
          <div class="flex gap-2 items-center">
            <span class="text-sm text-gray-700 font-bold dark:text-gray-200">{{ country }}</span>
            <span class="text-xs text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{{ list.length }}</span>
          </div>
          <div
            class="i-carbon-chevron-down text-gray-400 transition-transform duration-200"
            :class="{ '-rotate-90': !openGroups[country] }"
          />
        </div>

        <!-- Group List -->
        <div v-show="openGroups[country]" class="bg-gray-50/50 dark:bg-gray-900/20">
          <div
            v-for="pad in list"
            :key="pad.record_id"
            class="px-4 py-2 pl-8 border-l-2 border-transparent cursor-pointer transition-all hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10"
            @click="emit('select', pad)"
          >
            <div class="text-sm text-gray-800 font-medium mb-0.5 dark:text-gray-200">
              {{ pad.name }}
            </div>
            <div class="text-xs text-gray-500 truncate dark:text-gray-400">
              {{ pad.launch_center }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </ThePanel>
</template>
