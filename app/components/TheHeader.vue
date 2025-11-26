<script setup lang="ts">
import { appName } from '~/constants'

const isAboutModalOpen = ref(false)
</script>

<template>
  <header
    class="p-4 flex items-center left-0 right-0 top-0 justify-between absolute z-10"
  >
    <!-- 左侧：网站标题 -->
    <div
      class="text-xl text-white font-bold"
      style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"
    >
      {{ appName }}
    </div>

    <!-- 右侧：功能按钮组 -->
    <div
      class="px-3 py-2 rounded-full bg-white/80 flex gap-3 shadow-lg items-center backdrop-blur-sm dark:bg-gray-800/80"
    >
      <button class="icon-btn" title="关于" @click="isAboutModalOpen = true">
        <div class="i-carbon-information" />
      </button>

      <DarkToggle />

      <MapStyleSwitcher />
    </div>
  </header>

  <AboutModal v-model="isAboutModalOpen" />
</template>
