<script setup lang="ts">
defineOptions({
  name: 'IndexPage',
})
</script>

<template>
  <div class="h-full w-full relative">
    <ClientOnly>
      <Map />
    </ClientOnly>
    <TheHeader />
    <TheToolbox />
  </div>
</template>
