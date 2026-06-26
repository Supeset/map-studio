<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import ThePanel from '~/components/ThePanel.vue'
import { type ImportFormat, IMPORT_FORMATS, convertToGeoJSON } from '~/utils/geojsonConverter'

const props = defineProps<{
  features: FeatureCollection
  selectedFeatureId: string | null
  selectedFeatureJson: string | null
}>()

const emit = defineEmits<{
  (e: 'import', text: string): { success: boolean, message: string } | undefined
}>()

const { copy: copyToClipboard, copied: isCopied } = useClipboard()
const { copy: copyShareLink, copied: isShareLinkCopied } = useClipboard()

const importFormat = ref<ImportFormat>('geojson')
const currentPlaceholder = computed(() =>
  IMPORT_FORMATS.find(f => f.value === importFormat.value)?.placeholder ?? '粘贴文本...',
)

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

const importText = ref('')
const isImportOpen = ref(false)
const importMessage = ref<{ text: string, success: boolean } | null>(null)

function showImportMessage(text: string, success: boolean) {
  importMessage.value = { text, success }
  setTimeout(() => importMessage.value = null, 3000)
}

function submitImport(text: string, format: ImportFormat) {
  const converted = convertToGeoJSON(text, format)
  if (!converted) {
    showImportMessage('无法解析数据，请检查格式', false)
    return
  }

  const result = emit('import', converted)
  if (result) {
    showImportMessage(result.message, result.success)
    if (result.success)
      importText.value = ''
  }
}

function handleImport() {
  const text = importText.value.trim()
  if (!text) return
  submitImport(text, importFormat.value)
}

function handlePaste() {
  navigator.clipboard.readText().then((text) => {
    importText.value = text
  }).catch(() => {})
}

// 从文件导入（.geojson / .json / .txt）
const { open: openImportFile, onChange: onImportFileChange } = useFileDialog({
  accept: '.geojson,.json,application/json,text/plain,.txt',
})

onImportFileChange((files) => {
  const file = files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '')
    const ext = file.name.split('.').pop()?.toLowerCase()
    // txt 视为 NOTAM 坐标文本，其余一律按 GeoJSON 解析
    submitImport(text, ext === 'txt' ? 'notam' : 'geojson')
  }
  reader.onerror = () => showImportMessage('读取文件失败', false)
  reader.readAsText(file)
})
</script>

<template>
  <ThePanel title="GeoJSON 数据" icon="i-carbon-code" :initial-open="true">
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
        title="导入 GeoJSON 文件"
        @click="openImportFile"
      >
        <div class="i-carbon-upload text-sm" />
      </button>
      <button
        class="text-gray-400 p-1.5 rounded transition hover:text-teal-600 hover:bg-gray-200 dark:hover:bg-gray-700"
        title="粘贴导入 GeoJSON"
        @click="isImportOpen = !isImportOpen"
      >
        <div class="i-carbon-document-import text-sm" />
      </button>
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

    <!-- 导入区域 -->
    <div v-if="isImportOpen" class="p-3 border-b border-gray-100 dark:border-gray-700">
      <div class="flex gap-2 mb-2">
        <button
          v-for="fmt in IMPORT_FORMATS"
          :key="fmt.value"
          class="text-xs px-2.5 py-1 rounded-md transition"
          :class="importFormat === fmt.value
            ? 'text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/30'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="importFormat = fmt.value"
        >
          {{ fmt.label }}
        </button>
      </div>
      <textarea
        v-model="importText"
        class="w-full h-32 text-xs text-gray-700 p-2 border border-gray-200 rounded-lg font-mono resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600"
        :placeholder="currentPlaceholder"
        @keydown.ctrl.enter="handleImport"
      />
      <div class="flex gap-2 mt-2 items-center">
        <button
          class="text-xs text-white px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 transition disabled:opacity-40"
          :disabled="!importText.trim()"
          @click="handleImport"
        >
          导入
        </button>
        <button
          class="text-xs text-gray-500 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100 transition dark:border-gray-600 dark:hover:bg-gray-700"
          @click="handlePaste"
        >
          从剪贴板粘贴
        </button>
        <span class="text-[10px] text-gray-400 ml-auto">Ctrl+Enter 导入</span>
      </div>
      <div
        v-if="importMessage"
        class="text-xs mt-2 px-2 py-1 rounded"
        :class="importMessage.success ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'"
      >
        {{ importMessage.text }}
      </div>
    </div>

    <!-- Default Slot: Content -->
    <div class="p-3">
      <pre class="text-[10px] text-gray-600 leading-relaxed font-mono whitespace-pre-wrap break-all dark:text-gray-400">{{ displayGeoJson }}</pre>
    </div>
  </ThePanel>
</template>
