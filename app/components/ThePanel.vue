<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  icon?: string
  initialOpen?: boolean
  extraClass?: string
}>(), {
  initialOpen: true,
  extraClass: '',
})

const isOpen = ref(props.initialOpen)
</script>

<template>
  <div
    class="border border-gray-100 rounded-xl bg-white/95 flex flex-col min-h-0 pointer-events-auto shadow-xl transition-all duration-300 overflow-hidden backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    :class="[
      isOpen ? 'flex-1' : 'shrink-0',
      extraClass,
    ]"
  >
    <!-- Header -->
    <div
      class="p-3 bg-gray-50 flex shrink-0 cursor-pointer items-center justify-between dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800"
      @click="isOpen = !isOpen"
    >
      <div class="flex gap-2 items-center">
        <div v-if="icon" :class="icon" class="text-gray-500" />
        <span class="text-sm text-gray-700 font-bold dark:text-gray-200">{{ title }}</span>
        <slot name="badge" />
      </div>
      <div class="flex gap-1 items-center">
        <!-- Action Buttons Slot -->
        <div class="flex items-center" @click.stop>
          <slot name="actions" />
        </div>

        <!-- Toggle Icon -->
        <div
          class="i-carbon-chevron-down text-gray-400 ml-1 transition-transform duration-300"
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </div>

    <!-- Content Body -->
    <div
      class="bg-gray-50/50 flex-1 min-h-0 relative dark:bg-gray-900/20"
      :class="{ hidden: !isOpen }"
    >
      <div class="inset-0 absolute overflow-x-hidden overflow-y-auto">
        <slot />
      </div>
    </div>
  </div>
</template>
