import { acceptHMRUpdate, defineStore } from 'pinia'

export const useUiStore = defineStore('ui', () => {
  const isRightPanelsVisible = ref(true)

  function toggleRightPanels() {
    isRightPanelsVisible.value = !isRightPanelsVisible.value
  }

  return {
    isRightPanelsVisible,
    toggleRightPanels,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
