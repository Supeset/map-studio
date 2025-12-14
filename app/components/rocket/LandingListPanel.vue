<script setup lang="ts">
import ThePanel from '~/components/ThePanel.vue'

// 定义数据类型
export interface LandingSite {
  record_id: string
  latitude: number
  longitude: number
  name: string
  decription: string // 保持与数据源一致的拼写
  country: string
}

const props = defineProps<{
  sites: LandingSite[]
}>()

const emit = defineEmits<{
  (e: 'select', site: LandingSite): void
}>()

// 分组逻辑
const groupedSites = computed(() => {
  const groups: Record<string, LandingSite[]> = {}
  if (!props.sites)
    return groups

  props.sites.forEach((site) => {
    const country = site.country || '未知区域'
    if (!groups[country]) {
      groups[country] = []
    }
    groups[country].push(site)
  })
  return groups
})

// 控制每个分组的展开状态
const openGroups = ref<Record<string, boolean>>({})

// 初始化时默认展开所有分组
watch(() => groupedSites.value, (groups) => {
  Object.keys(groups).forEach((country) => {
    if (openGroups.value[country] === undefined) {
      openGroups.value[country] = true // 默认展开
    }
  })
}, { immediate: true })

function toggleGroup(country: string) {
  openGroups.value[country] = !openGroups.value[country]
}
</script>

<template>
  <ThePanel title="火箭回收场" icon="i-carbon-arrival" :initial-open="true">
    <div v-if="!sites || sites.length === 0" class="text-sm text-gray-400 p-4 text-center">
      暂无数据或加载中...
    </div>

    <div v-else class="flex flex-col">
      <div
        v-for="(list, country) in groupedSites"
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
            v-for="site in list"
            :key="site.record_id"
            class="px-4 py-2 pl-8 border-l-2 border-transparent cursor-pointer transition-all hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10"
            @click="emit('select', site)"
          >
            <div class="text-sm text-gray-800 font-medium mb-0.5 dark:text-gray-200">
              {{ site.name }}
            </div>
            <div class="text-xs text-gray-500 truncate dark:text-gray-400">
              {{ site.decription }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </ThePanel>
</template>
