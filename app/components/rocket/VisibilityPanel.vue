<script setup lang="ts">
import type { MissionFrame, MissionSolution } from '~/composables/rocket/useMission'
import type { VisibilityStep, VisPoint } from '~/composables/rocket/useRocketVisibility'
import type { OrbitPreset, OrbitTypeId } from '~/constants/orbit-presets'
import VisibilityProfile from '~/components/rocket/VisibilityProfile.vue'
import VisibilityTimeline from '~/components/rocket/VisibilityTimeline.vue'
import { ORBIT_PRESETS } from '~/constants/orbit-presets'

defineProps<{
  step: VisibilityStep
  selectedLaunchName: string | null
  targets: VisPoint[]
  mission: MissionSolution | null
  currentFrame: MissionFrame | null
  currentTimeMin: number
  totalTimeMin: number
  ascentTimeMin: number
  orbitPeriodMin: number
  inclinationDeg: number
  perigeeKm: number
  apogeeKm: number
  isElliptical: boolean
  isPlaying: boolean
  playbackRate: number
  orbitTypeId: OrbitTypeId
  showLeoSlider: boolean
  leoAltitudeKm: number
  errorMessage: string | null
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'reselect-launch'): void
  (e: 'reselect-targets'): void
  (e: 'clear'): void
  (e: 'export'): void
  (e: 'solve'): void
  (e: 'remove-target', index: number): void
  (e: 'time-change', v: number): void
  (e: 'leo-change', v: number): void
  (e: 'orbit-type-change', v: OrbitTypeId): void
  (e: 'rate-change', v: number): void
  (e: 'toggle-play'): void
  (e: 'seek-insert'): void
}>()

const stepLabels = ['发射点', '落区', '任务轨迹']

function stepIndex(step: VisibilityStep): number {
  if (step === 'idle' || step === 'select-launch')
    return 0
  if (step === 'select-targets')
    return 1
  return 2
}

function onLeoInput(e: Event) {
  emit('leo-change', Number((e.target as HTMLInputElement).value))
}

function presetLabel(p: OrbitPreset): string {
  return p.elliptical ? `${p.name} · ${p.perigeeKm}×${p.apogeeKm}km` : `${p.name} · ${p.perigeeKm}km`
}
</script>

<template>
  <div
    class="max-w-[calc(100vw-2rem)] w-[680px] pointer-events-auto bottom-6 left-1/2 absolute z-50 -translate-x-1/2"
  >
    <div class="px-5 pb-4 pt-3 border border-gray-100 rounded-2xl bg-white/95 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
      <!-- Header -->
      <div class="mb-3 flex items-center justify-between">
        <div class="flex gap-2 items-center">
          <div class="i-carbon-radar text-lg text-orange-500" />
          <span class="text-sm text-gray-700 font-bold dark:text-gray-200">火箭任务轨迹</span>
          <div class="ml-4 flex gap-1.5 items-center">
            <template v-for="(label, idx) in stepLabels" :key="idx">
              <div
                class="text-[10px] font-bold rounded-full flex h-5 w-5 transition-colors items-center justify-center"
                :class="stepIndex(step) >= idx
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
              >
                {{ idx + 1 }}
              </div>
              <span
                class="text-xs mr-2"
                :class="stepIndex(step) >= idx
                  ? 'text-gray-700 font-medium dark:text-gray-200'
                  : 'text-gray-400 dark:text-gray-500'"
              >{{ label }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="errorMessage"
        class="text-xs text-red-600 mb-3 px-3 py-2 border border-red-100 rounded-lg bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:bg-red-900/20"
      >
        {{ errorMessage }}
      </div>

      <!-- idle -->
      <div v-if="step === 'idle'" class="flex gap-3 items-center">
        <div class="text-xs text-gray-500 leading-relaxed flex-1 dark:text-gray-400">
          模拟完整任务:发射上升 → 助推分离落各残骸落区 → 入轨(LEO / 极地 / GTO / Molniya 等)→ 绕地一圈星下点。基于发射方位推导轨道倾角,全程时间轴回放各阶段可见范围。
        </div>
        <button
          class="text-sm text-white px-4 py-1.5 rounded-lg bg-orange-500 flex shrink-0 gap-1.5 transition items-center hover:bg-orange-600"
          @click="emit('start')"
        >
          <div class="i-carbon-play text-base" />
          开始
        </button>
      </div>

      <!-- select-launch -->
      <div v-else-if="step === 'select-launch'" class="flex gap-3 items-center">
        <div class="i-carbon-location text-lg text-teal-500 animate-pulse" />
        <div class="text-sm text-gray-700 font-medium flex-1 dark:text-gray-200">
          请在地图上点击发射场图标
        </div>
        <button
          class="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-gray-100 shrink-0 transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          @click="emit('clear')"
        >
          取消
        </button>
      </div>

      <!-- select-targets -->
      <div v-else-if="step === 'select-targets'" class="space-y-2.5">
        <div class="flex gap-3 items-center">
          <div class="i-carbon-target-point text-lg text-teal-500 animate-pulse" />
          <div class="text-sm text-gray-700 font-medium flex-1 dark:text-gray-200">
            点击地图添加残骸落区(已选 {{ targets.length }} 个)
          </div>
        </div>
        <div v-if="targets.length" class="gap-1.5 grid grid-cols-2">
          <div
            v-for="(t, i) in targets"
            :key="i"
            class="px-2 py-1 border border-gray-200 rounded-md bg-white flex gap-2 items-center dark:border-gray-700 dark:bg-gray-800"
          >
            <span
              class="text-[10px] font-bold rounded-full flex shrink-0 h-5 w-5 items-center justify-center"
              style="background-color: #a855f7; color: white;"
            >{{ i + 1 }}</span>
            <span class="text-[10px] text-gray-500 flex-1 truncate dark:text-gray-400">
              {{ t.lng.toFixed(2) }}, {{ t.lat.toFixed(2) }}
            </span>
            <button
              class="text-xs text-red-400 transition hover:text-red-600"
              @click="emit('remove-target', i)"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 入轨轨道类型选择 -->
        <div class="p-2 border border-blue-100 rounded-lg bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10">
          <div class="mb-1.5 flex gap-1.5 items-center">
            <div class="i-carbon-orbit text-sm text-blue-500" />
            <span class="text-xs text-gray-700 font-medium dark:text-gray-200">入轨轨道类型</span>
            <span class="text-[10px] text-gray-400 dark:text-gray-500">— 选择目标轨道</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="p in ORBIT_PRESETS"
              :key="p.id"
              class="text-[11px] px-2 py-1 border rounded-md transition"
              :class="orbitTypeId === p.id
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:border-blue-600'"
              :title="p.description"
              @click="emit('orbit-type-change', p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <div v-if="showLeoSlider" class="mt-2 flex gap-2 items-center">
            <span class="text-[10px] text-gray-500 dark:text-gray-400">高度</span>
            <input
              type="range"
              :value="leoAltitudeKm"
              min="200"
              max="1200"
              step="50"
              class="accent-blue-500 w-40"
              @input="onLeoInput"
            >
            <span class="text-[10px] text-blue-600 font-mono dark:text-blue-400">{{ leoAltitudeKm }} km</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="text-sm text-white py-1.5 rounded-lg bg-orange-500 flex-1 transition hover:bg-orange-600 disabled:opacity-40"
            :disabled="targets.length === 0"
            @click="emit('solve')"
          >
            解算弹道与轨道
          </button>
          <button
            class="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-gray-100 transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="emit('reselect-launch')"
          >
            重选发射点
          </button>
        </div>
      </div>

      <!-- result -->
      <div v-else-if="step === 'result' && mission" class="space-y-3">
        <!-- 剖面图 -->
        <div class="p-2.5 border border-gray-100 rounded-lg bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
          <VisibilityProfile
            :mission="mission"
            :current-time-min="currentTimeMin"
            :current-frame="currentFrame"
          />
        </div>

        <!-- 统计 -->
        <div class="gap-2 grid grid-cols-4">
          <div class="p-2.5 border border-blue-100 rounded-lg bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
            <div class="text-xs text-blue-600 mb-0.5 dark:text-blue-400">
              轨道倾角
            </div>
            <div class="text-base text-gray-900 font-bold dark:text-white">
              {{ inclinationDeg.toFixed(1) }}<span class="text-xs text-gray-500 font-normal ml-0.5">°</span>
            </div>
          </div>
          <div class="p-2.5 border border-blue-100 rounded-lg bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
            <div class="text-xs text-blue-600 mb-0.5 dark:text-blue-400">
              {{ isElliptical ? '近/远地点' : '轨道高度' }}
            </div>
            <div class="text-base text-gray-900 font-bold dark:text-white">
              <template v-if="isElliptical">
                {{ perigeeKm.toFixed(0) }}<span class="text-xs text-gray-500 font-normal mx-0.5">/</span>{{ apogeeKm.toFixed(0) }}<span class="text-xs text-gray-500 font-normal ml-0.5">km</span>
              </template>
              <template v-else>
                {{ perigeeKm.toFixed(0) }}<span class="text-xs text-gray-500 font-normal ml-0.5">km</span>
              </template>
            </div>
          </div>
          <div class="p-2.5 border border-blue-100 rounded-lg bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20">
            <div class="text-xs text-blue-600 mb-0.5 dark:text-blue-400">
              轨道周期
            </div>
            <div class="text-base text-gray-900 font-bold dark:text-white">
              {{ orbitPeriodMin.toFixed(0) }}<span class="text-xs text-gray-500 font-normal ml-0.5">分</span>
            </div>
          </div>
          <div class="p-2.5 border border-gray-100 rounded-lg bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
            <div class="text-xs text-gray-500 mb-0.5 dark:text-gray-400">
              当前主体高度
            </div>
            <div class="text-base text-gray-900 font-bold dark:text-white">
              {{ (currentFrame?.booster?.altitudeKm ?? 0).toFixed(0) }}<span class="text-xs text-gray-500 font-normal ml-0.5">km</span>
            </div>
          </div>
        </div>

        <!-- 时间轴 -->
        <div class="p-2.5 border border-gray-100 rounded-lg bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
          <VisibilityTimeline
            :current-time-min="currentTimeMin"
            :total-time-min="totalTimeMin"
            :insert-time-min="ascentTimeMin"
            :is-playing="isPlaying"
            :playback-rate="playbackRate"
            @time-change="emit('time-change', $event)"
            @toggle-play="emit('toggle-play')"
            @seek-insert="emit('seek-insert')"
            @rate-change="emit('rate-change', $event)"
          />
        </div>

        <!-- 轨道类型切换 + LEO 高度滑块 + 操作 -->
        <div class="space-y-2">
          <div class="flex flex-wrap gap-1.5 items-center">
            <span class="text-xs text-gray-500 shrink-0 dark:text-gray-400">轨道</span>
            <button
              v-for="p in ORBIT_PRESETS"
              :key="p.id"
              class="text-[11px] px-2 py-0.5 border rounded transition"
              :class="orbitTypeId === p.id
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:border-blue-600'"
              :title="presetLabel(p)"
              @click="emit('orbit-type-change', p.id)"
            >
              {{ p.name }}
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div v-if="showLeoSlider" class="flex gap-2 items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">LEO</span>
              <input
                type="range"
                :value="leoAltitudeKm"
                min="200"
                max="1200"
                step="50"
                class="accent-blue-500 w-28"
                @input="onLeoInput"
              >
              <span class="text-xs text-blue-600 font-mono dark:text-blue-400">{{ leoAltitudeKm }} km</span>
            </div>
            <div v-else class="text-xs text-gray-400 italic dark:text-gray-500">
              {{ mission.orbitPreset.description }}
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                class="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-gray-100 transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                @click="emit('reselect-launch')"
              >
                重选发射点
              </button>
              <button
                class="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-gray-100 transition dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                @click="emit('reselect-targets')"
              >
                重选落区
              </button>
              <button
                class="text-xs text-teal-600 px-3 py-1.5 rounded-lg bg-teal-50 flex gap-1 transition items-center dark:text-teal-400 dark:bg-teal-900/20 hover:bg-teal-100"
                @click="emit('export')"
              >
                <div class="i-carbon-export text-sm" />
                导出
              </button>
              <button
                class="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500 transition hover:bg-red-600"
                @click="emit('clear')"
              >
                清除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
