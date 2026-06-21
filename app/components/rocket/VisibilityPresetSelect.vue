<script setup lang="ts">
import { ROCKET_PRESETS } from '~/constants/rocket-presets'

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'change', v: string): void }>()

function onChange(e: Event) {
  emit('change', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    :value="modelValue"
    class="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white dark:text-gray-200 dark:border-gray-600 dark:bg-gray-700"
    @change="onChange"
  >
    <option v-for="p in ROCKET_PRESETS" :key="p.id" :value="p.id">
      {{ p.name }}
    </option>
  </select>
</template>
