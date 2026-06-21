<script setup lang="ts">
const mapStore = useMapStore()
const { mapStyles, activeMapStyle } = storeToRefs(mapStore)

const isOpen = ref(false)
const switcherRef = ref(null)

onClickOutside(switcherRef, () => {
  isOpen.value = false
})

function selectStyle(style: typeof activeMapStyle.value) {
  mapStore.switchMapStyle(style)
  isOpen.value = false
}
</script>

<template>
  <div ref="switcherRef" class="flex items-center justify-center relative">
    <button
      class="header-icon-btn"
      title="切换底图"
      @click="isOpen = !isOpen"
    >
      <div class="i-carbon-layers text-xl" />
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform scale-95 opacity-0 translate-y-2"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 translate-y-2"
    >
      <div
        v-if="isOpen"
        class="mt-2 p-2 border border-gray-100 rounded-lg bg-white/95 w-48 shadow-xl right-0 top-full absolute z-50 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95"
      >
        <div
          v-for="style in mapStyles"
          :key="style.styleUrl"
          class="p-2 rounded flex gap-2 cursor-pointer items-center hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="{ 'text-teal-600': style.styleUrl === activeMapStyle.styleUrl }"
          @click="() => selectStyle(style)"
        >
          <div
            class="rounded h-8 w-8 bg-cover bg-center"
            :style="{ backgroundImage: `url('/styles/${style.styleName}.png')` }"
          />
          <span class="text-sm">{{ style.label }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>
