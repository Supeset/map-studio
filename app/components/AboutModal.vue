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
      pos="fixed inset-0"
      bg="black/50"
      flex="~ items-center justify-center"
      z-50
      @click.self="closeModal"
    >
      <div
        p-6
        bg="white dark:gray-800"
        rounded-lg
        shadow-xl
        w="!full max-w-sm"
      >
        <h2 text="2xl" font-bold mb-4>
          关于 {{ appName }}
        </h2>
        <p text="gray-600 dark:gray-300">
          这是一个基于 Nuxt 模板构建的地图查看网站，
          使用了 Mapbox GL JS 来实现交互式地图体验。
        </p>
        <div mt-6 text-right>
          <button btn @click="closeModal">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
