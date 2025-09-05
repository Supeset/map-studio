<script setup lang="ts">
import { appName } from '~/constants'

const isAboutModalOpen = ref(false)
</script>

<template>
  <header
    pos="absolute top-0 left-0 right-0"
    p="4"
    flex="~"
    items-center
    justify-between
    z-10
  >
    <!-- 左侧：网站标题 -->
    <div
      text="xl white"
      font-bold
      style="text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"
    >
      {{ appName }}
    </div>

    <!-- 右侧：功能按钮组 -->
    <div
      flex="~"

      p="x-3 y-2"
      bg="white/80 dark:gray-800/80"

      rounded-full gap-3 shadow-lg items-center backdrop-blur-sm
    >
      <button class="icon-btn" title="关于" @click="isAboutModalOpen = true">
        <div i-carbon-information />
      </button>

      <DarkToggle />

      <MapStyleSwitcher />
    </div>
  </header>

  <AboutModal v-model="isAboutModalOpen" />
</template>
