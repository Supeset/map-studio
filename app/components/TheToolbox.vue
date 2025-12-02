<script setup lang="ts">
import { externalLinks, internalTools } from '~/constants/links'

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
        class="mb-3 p-2 rounded-lg bg-white/90 w-80 shadow-xl backdrop-blur-md dark:bg-gray-800/90"
      >
        <!-- 内部工具 -->
        <template v-if="internalTools.length > 0">
          <h3 class="text-xs text-gray-400 tracking-wider font-bold mb-1 px-2 py-1 uppercase">
            内部工具
          </h3>
          <div class="mb-2 px-1 gap-2 grid grid-cols-3">
            <NuxtLink
              v-for="link in internalTools"
              :key="link.to"
              :to="link.to"
              class="text-teal-700 px-1 py-3 rounded-xl bg-teal-50 flex flex-col transition-all items-center justify-center dark:text-teal-300 dark:bg-teal-900/20 hover:bg-teal-100 active:scale-95 hover:scale-105 dark:hover:bg-teal-900/40"
              @click="isOpen = false"
            >
              <div :class="link.icon" class="text-2xl mb-1.5" />
              <span class="text-xs font-bold">{{ link.name }}</span>
            </NuxtLink>
          </div>
        </template>

        <!-- 外部链接 -->
        <template v-if="externalLinks.length > 0">
          <div class="my-1 pt-1 border-t border-gray-100 dark:border-gray-700" />
          <h3 class="text-xs text-gray-400 tracking-wider font-bold mb-1 px-2 py-1 uppercase">
            外部链接
          </h3>
          <div class="gap-1 grid grid-cols-3">
            <a
              v-for="link in externalLinks"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="group p-2 text-center rounded-lg flex flex-col transition-colors items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50"
            >
              <div :class="link.icon" class="text-xl text-gray-500 mb-1 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
              <span class="text-xs text-gray-600 leading-tight dark:text-gray-400">{{ link.name }}</span>
            </a>
          </div>
        </template>
      </div>
    </Transition>

    <!-- FAB -->
    <button
      class="text-white rounded-full bg-teal-600 flex h-14 w-14 shadow-lg transition-transform duration-200 ease-in-out items-center justify-center hover:bg-teal-700 hover:scale-105"
      title="工具箱"
      @click="isOpen = !isOpen"
    >
      <div
        class="i-carbon-apps text-2xl transition-transform duration-300"
        :class="{ 'rotate-45': isOpen }"
      />
    </button>
  </div>
</template>
