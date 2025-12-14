<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

const props = defineProps<{
  features: FeatureCollection
  selectedFeatureId: string | null
  selectedFeatureJson: string | null
}>()

const isOpen = ref(false)
const { copy: copyToClipboard, copied: isCopied } = useClipboard()
const { copy: copyShareLink, copied: isShareLinkCopied } = useClipboard()

const displayGeoJson = computed(() => {
  // 如果选中了要素，只显示该要素的 JSON
  if (props.selectedFeatureId && props.selectedFeatureJson) {
    return props.selectedFeatureJson
  }
  // 否则显示全部数据的 FeatureCollection
  return JSON.stringify(props.features, null, 2)
})

function handleCopyGeoJson() {
  copyToClipboard(displayGeoJson.value)
}

function handleCopyShareLink() {
  // 分享时始终分享全部数据，使用压缩格式
  const json = JSON.stringify(props.features)
  // 构造 data URL 格式，兼容 geojson.io
  const dataParam = `data:application/json,${encodeURIComponent(json)}`
  const url = `${window.location.origin}${window.location.pathname}?data=${dataParam}`
  copyShareLink(url)
}
</script>

<template>
  <div
    class="border border-gray-100 rounded-xl bg-white/95 flex flex-col min-h-0 pointer-events-auto shadow-xl transition-all duration-300 overflow-hidden backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    :class="isOpen ? 'flex-1' : 'shrink-0'"
  >
    <div
      class="p-3 bg-gray-50 flex cursor-pointer items-center justify-between dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800"
      @click="isOpen = !isOpen"
    >
      <div class="flex gap-2 items-center">
        <div class="i-carbon-code text-gray-500" />
        <span class="text-sm text-gray-700 font-bold dark:text-gray-200">GeoJSON 数据</span>
        <span v-if="selectedFeatureId" class="text-xs text-teal-600 px-1.5 py-0.5 rounded bg-teal-50 dark:text-teal-400 dark:bg-teal-900/30">Selected</span>
      </div>
      <div class="flex gap-1 items-center">
        <button
          class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          title="复制分享链接"
          @click.stop="handleCopyShareLink"
        >
          <div :class="isShareLinkCopied ? 'i-carbon-checkmark text-green-500' : 'i-carbon-link'" />
        </button>
        <button
          class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          title="复制 JSON"
          @click.stop="handleCopyGeoJson"
        >
          <div :class="isCopied ? 'i-carbon-checkmark text-green-500' : 'i-carbon-copy'" />
        </button>
        <div
          class="i-carbon-chevron-down text-gray-400 transition-transform duration-300"
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </div>
    <div class="bg-gray-50/50 flex-1 min-h-0 relative dark:bg-gray-900/20">
      <div class="p-3 inset-0 absolute overflow-auto">
        <pre class="text-[10px] text-gray-600 leading-relaxed font-mono whitespace-pre-wrap break-all dark:text-gray-400">{{ displayGeoJson }}</pre>
      </div>
    </div>
  </div>
</template>
