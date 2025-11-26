<script setup lang="ts">
import { appName } from '~/constants'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function closeModal() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="bg-black/50 flex items-center inset-0 justify-center fixed z-50"
      @click.self="closeModal"
    >
      <div
        class="mx-4 p-6 rounded-lg bg-white max-w-md w-full shadow-xl dark:bg-gray-800"
      >
        <h2 class="text-2xl font-bold mb-4">
          关于 {{ appName }}
        </h2>
        <p class="text-gray-600 dark:text-gray-300">
          这是一个基于 Nuxt 模板构建的地图查看网站，
          使用了 Mapbox GL JS 来实现交互式地图体验。
        </p>
        <div class="mt-6 text-right">
          <button class="btn" @click="closeModal">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
