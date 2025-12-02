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
  </header>

  <AboutModal v-model="isAboutModalOpen" />
</template>
