<script setup lang="ts">
defineProps<{
  showEquator: boolean
  showTropics: boolean
  showSubsolar: boolean
  subsolarLat: number | null
}>()

defineEmits<{
  (e: 'toggle', group: 'equator' | 'tropics' | 'subsolar'): void
}>()

function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
}
</script>

<template>
  <div class="flex left-1/2 top-16 justify-center absolute z-40 -translate-x-1/2">
    <div class="px-3 py-2 border border-white/10 rounded-full bg-black/60 flex gap-1.5 shadow-lg items-center backdrop-blur-md">
      <div class="i-carbon-globe text-base text-white/80" />
      <span class="text-xs text-white/70 font-medium">天文标注</span>
      <button
        class="text-xs px-2.5 py-1 border rounded-full flex gap-1.5 transition items-center"
        :class="showEquator
          ? 'border-red-400/60 bg-red-400/15 text-red-200'
          : 'border-white/15 text-white/40'"
        title="赤道 (0°)"
        @click="$emit('toggle', 'equator')"
      >
        <span class="rounded-full h-2 w-2" :class="showEquator ? 'bg-red-400' : 'bg-white/30'" />
        赤道
      </button>
      <button
        class="text-xs px-2.5 py-1 border rounded-full flex gap-1.5 transition items-center"
        :class="showTropics
          ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
          : 'border-white/15 text-white/40'"
        title="南北回归线 (±23.44°)"
        @click="$emit('toggle', 'tropics')"
      >
        <span class="rounded-full h-2 w-2" :class="showTropics ? 'bg-sky-400' : 'bg-white/30'" />
        回归线
      </button>
      <button
        class="text-xs px-2.5 py-1 border rounded-full flex gap-1.5 transition items-center"
        :class="showSubsolar
          ? 'border-yellow-400/60 bg-yellow-400/15 text-yellow-200'
          : 'border-white/15 text-white/40'"
        title="当前太阳直射纬线"
        @click="$emit('toggle', 'subsolar')"
      >
        <span class="rounded-full h-2 w-2" :class="showSubsolar ? 'bg-yellow-400' : 'bg-white/30'" />
        太阳直射线
        <span v-if="subsolarLat !== null" class="font-mono opacity-80">{{ formatLatitude(subsolarLat) }}</span>
      </button>
    </div>
  </div>
</template>
