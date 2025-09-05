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
  <div ref="switcherRef" class="flex relative">
    <button
      class="icon-btn"
      title="切换地图样式"
      @click="isOpen = !isOpen"
    >
      <div class="i-carbon-map" />
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        pos="absolute top-full right-0"

        bg="white dark:gray-800"

        mt-2 p-2 rounded-lg w-48 shadow-lg z-20
      >
        <div
          v-for="style in mapStyles"
          :key="style.styleUrl"

          flex="~ items-center"
          p-2 rounded gap-2 cursor-pointer
          hover:bg="gray-100 dark:gray-700"
          :class="{ 'text-teal-600': style.styleUrl === activeMapStyle.styleUrl }"
          @click="() => selectStyle(style)"
        >
          <div

            rounded h-8 w-8 bg-cover bg-center
            :style="{ backgroundImage: `url('/styles/${style.styleName}.png')` }"
          />
          <span text-sm>{{ style.label }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>
