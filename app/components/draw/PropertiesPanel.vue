<script setup lang="ts">
const props = defineProps<{
  featureId: string | null
  featureProps: Record<string, any>
  featureGeometryType: string
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update-property', key: string, value: any): void
  (e: 'remove-property', key: string): void
  (e: 'add-default-styles'): void
}>()

const newPropKey = ref('')
const newPropValue = ref('')

function handleAddProperty() {
  if (!newPropKey.value)
    return
  emit('update-property', newPropKey.value, newPropValue.value)
  newPropKey.value = ''
  newPropValue.value = ''
}

// 当选中的要素改变时，清空输入框
watch(() => props.featureId, () => {
  newPropKey.value = ''
  newPropValue.value = ''
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-x-full opacity-0"
    enter-to-class="transform translate-x-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-x-0 opacity-100"
    leave-to-class="transform translate-x-full opacity-0"
  >
    <div
      v-if="featureId"
      class="border border-gray-100 rounded-xl bg-white/95 flex shrink-0 flex-col max-h-40vh pointer-events-auto shadow-xl overflow-hidden backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    >
      <!-- Panel Header -->
      <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-900/50">
        <div>
          <h3 class="text-gray-800 font-bold dark:text-gray-100">
            属性编辑
          </h3>
          <div class="text-xs text-gray-500 tracking-wider font-mono mt-0.5 uppercase">
            {{ featureGeometryType }}
          </div>
        </div>
        <button
          class="text-red-500 p-1.5 rounded-md transition hover:bg-red-50 dark:hover:bg-red-900/20"
          title="删除要素"
          @click="emit('delete')"
        >
          <div class="i-carbon-trash-can text-lg" />
        </button>
      </div>

      <!-- Panel Body -->
      <div class="p-4 flex-1 overflow-y-auto">
        <!-- Quick Actions -->
        <div class="mb-6">
          <button
            class="text-sm text-teal-700 font-medium px-4 py-2 rounded-lg bg-teal-50 flex gap-2 w-full transition items-center justify-center dark:text-teal-300 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30"
            @click="emit('add-default-styles')"
          >
            <div class="i-carbon-magic-wand" />
            应用默认样式
          </button>
        </div>

        <!-- Properties Table -->
        <div class="space-y-3">
          <div v-if="Object.keys(featureProps).length === 0" class="text-sm text-gray-400 py-4 text-center">
            暂无属性
          </div>

          <div
            v-for="(value, key) in featureProps"
            :key="key"
            class="group p-2 border border-transparent rounded-lg bg-gray-50 transition relative hover:border-gray-200 dark:bg-gray-700/30 dark:hover:border-gray-600"
          >
            <div class="mb-1 flex items-start justify-between">
              <span class="text-xs text-gray-500 font-mono w-32 truncate dark:text-gray-400" :title="String(key)">{{ key }}</span>
              <button
                class="text-gray-400 p-0.5 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                @click="emit('remove-property', String(key))"
              >
                <div class="i-carbon-close text-sm" />
              </button>
            </div>
            <div class="flex gap-2 items-center">
              <input
                v-if="String(key).includes('color') || ['stroke', 'fill'].includes(String(key))"
                type="color"
                :value="value"
                class="rounded border-none bg-transparent h-6 w-6 cursor-pointer"
                @input="(e) => emit('update-property', String(key), (e.target as HTMLInputElement).value)"
              >
              <input
                :value="value"
                class="text-sm text-gray-800 font-medium outline-none border-none bg-transparent flex-1 w-full dark:text-gray-200"
                @change="(e) => emit('update-property', String(key), Number((e.target as HTMLInputElement).value))"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Add Property Footer -->
      <div class="p-3 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
        <div class="text-xs text-gray-400 tracking-wider font-bold mb-2 uppercase">
          新增属性
        </div>
        <div class="mb-2 flex gap-2">
          <input
            v-model="newPropKey"
            placeholder="Key (e.g. stroke)"
            class="text-sm px-2 py-1.5 outline-none border border-gray-300 rounded bg-white flex-1 min-w-0 dark:border-gray-600 focus:border-teal-500 dark:bg-gray-800"
            @keyup.enter="handleAddProperty"
          >
          <input
            v-model="newPropValue"
            placeholder="Value"
            class="text-sm px-2 py-1.5 outline-none border border-gray-300 rounded bg-white flex-1 min-w-0 dark:border-gray-600 focus:border-teal-500 dark:bg-gray-800"
            @keyup.enter="handleAddProperty"
          >
        </div>
        <button
          class="text-sm text-gray-700 py-1.5 rounded bg-gray-200 w-full transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          :disabled="!newPropKey"
          @click="handleAddProperty"
        >
          添加
        </button>
      </div>
    </div>
  </Transition>
</template>
