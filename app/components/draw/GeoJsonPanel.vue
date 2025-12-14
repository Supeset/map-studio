<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import ThePanel from '~/components/ThePanel.vue'

const props = defineProps<{
  features: FeatureCollection
  selectedFeatureId: string | null
  selectedFeatureJson: string | null
}>()

const { copy: copyToClipboard, copied: isCopied } = useClipboard()
const { copy: copyShareLink, copied: isShareLinkCopied } = useClipboard()

const displayGeoJson = computed(() => {
  if (props.selectedFeatureId && props.selectedFeatureJson) {
    return props.selectedFeatureJson
  }
  return JSON.stringify(props.features, null, 2)
})

function handleCopyGeoJson() {
  copyToClipboard(displayGeoJson.value)
}

function handleCopyShareLink() {
  const json = JSON.stringify(props.features)
  const dataParam = `data:application/json,${encodeURIComponent(json)}`
  const url = `${window.location.origin}${window.location.pathname}?data=${dataParam}`
  copyShareLink(url)
}
</script>

<template>
  <ThePanel title="GeoJSON 数据" icon="i-carbon-code" :initial-open="false">
    <template #badge>
      <span
        v-if="selectedFeatureId"
        class="text-xs text-teal-600 px-1.5 py-0.5 rounded bg-teal-50 dark:text-teal-400 dark:bg-teal-900/30"
      >
        Selected
      </span>
    </template>

    <template #actions>
      <button
        class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-gray-200 dark:hover:bg-gray-700"
        title="复制分享链接"
        @click="handleCopyShareLink"
      >
        <div :class="isShareLinkCopied ? 'i-carbon-checkmark text-green-500' : 'i-carbon-link'" />
      </button>
      <button
        class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-gray-200 dark:hover:bg-gray-700"
        title="复制 JSON"
        @click="handleCopyGeoJson"
      >
        <div :class="isCopied ? 'i-carbon-checkmark text-green-500' : 'i-carbon-copy'" />
      </button>
    </template>

    <!-- Default Slot: Content -->
    <div class="p-3">
      <pre class="text-[10px] text-gray-600 leading-relaxed font-mono whitespace-pre-wrap break-all dark:text-gray-400">{{ displayGeoJson }}</pre>
    </div>
  </ThePanel>
</template>
