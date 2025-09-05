<script setup lang="ts">
import { externalLinks } from '~/constants/links'

const isOpen = ref(false)
const fabRef = ref(null)

onClickOutside(fabRef, () => {
  isOpen.value = false
})
</script>

<template>
  <div ref="fabRef" class="bottom-4 left-4 absolute z-10">
    <!-- Links List -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div
        v-if="isOpen"
        class="mb-3 p-2 rounded-lg bg-white/80 w-60 shadow-lg backdrop-blur-sm dark:bg-gray-800/80"
      >
        <h3 class="text-sm text-gray-500 font-semibold px-2 py-1">
          外部工具
        </h3>
        <ul>
          <li v-for="link in externalLinks" :key="link.url">
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-md flex gap-3 items-center hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <div :class="link.icon" class="text-xl" />
              <span class="text-sm">{{ link.name }}</span>
            </a>
          </li>
        </ul>
      </div>
    </Transition>

    <!-- FAB -->
    <button
      class="text-white rounded-full bg-teal-600 flex h-14 w-14 shadow-lg transition-transform duration-200 ease-in-out items-center justify-center hover:bg-teal-700 hover:scale-105"
      title="外部工具链接"
      @click="isOpen = !isOpen"
    >
      <div
        class="i-carbon-apps text-2xl transition-transform duration-300"
        :class="{ 'rotate-45': isOpen }"
      />
    </button>
  </div>
</template>
