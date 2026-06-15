<script setup lang="ts">
import { interpolateHeight } from '~/composables/useRocketVisibility'
import type { VisibilityResult, VisibilityStep } from '~/composables/useRocketVisibility'

const props = defineProps<{
  step: VisibilityStep
  selectedPadName: string | null
  selectedPolygonIds: string[]
  result: VisibilityResult | null
  errorMessage: string | null
  maxVisibilityRadiusKm: number
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'reselect-pad'): void
  (e: 'reselect-polygon'): void
  (e: 'clear'): void
  (e: 'update:maxVisibilityRadiusKm', v: number): void
  (e: 'update:landingHeight', payload: { id: string, heightKm: number }): void
}>()

const stepLabels = ['发射点', '落区面', '可见区域']

function stepIndex(step: VisibilityStep): number {
  if (step === 'idle' || step === 'select-pad')
    return 0
  if (step === 'select-polygon')
    return 1
  return 2
}

// SVG 飞行剖面图（横轴：飞行水平距离 km，纵轴：归一化值）
const SVG_LEFT = 44
const SVG_RIGHT = 580
const SVG_TOP = 28
const SVG_BOTTOM = 108
const SAMPLE_COUNT = 80

// 单条主轨迹的最大距离（来自 result，没选落区时用参考值）
const maxDistForChart = computed(() => {
  const d = props.result?.totalTrajectoryLengthKm
  return d && d > 0 ? d * 1.05 : 1000
})

// 用于插值高度的关键点：(0,0) + 所有落区按距离升序
const keyPoints = computed<{ dist: number, h: number }[]>(() => {
  const ls = props.result?.landings ?? []
  return [{ dist: 0, h: 0 }, ...ls.map(l => ({ dist: l.distanceKm, h: l.heightKm }))]
})

// 所有落区中的最大高度（用于归一化纵轴）
const chartMaxHeight = computed(() => {
  const ls = props.result?.landings ?? []
  if (ls.length === 0)
    return 250 // 默认参考值
  return Math.max(...ls.map(l => l.heightKm), 1)
})

function xOf(distanceKm: number): number {
  const max = maxDistForChart.value || 1
  return SVG_LEFT + (distanceKm / max) * (SVG_RIGHT - SVG_LEFT)
}

function yOf(norm: number): number {
  return SVG_BOTTOM - norm * (SVG_BOTTOM - SVG_TOP)
}

// 高度曲线（沿主轨迹距离采样，分段对数插值）
const heightPath = computed(() => {
  const kps = keyPoints.value
  const points: string[] = []
  const total = maxDistForChart.value
  const hMax = chartMaxHeight.value
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const τ = i / SAMPLE_COUNT
    const dist = total * τ
    const h = kps.length > 1 ? interpolateHeight(kps, dist) : 0
    const x = xOf(dist)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(h / hMax).toFixed(1)}`)
  }
  return points.join(' ')
})

const heightFillPath = computed(() => {
  const last = xOf(maxDistForChart.value)
  return `${heightPath.value} L${last.toFixed(1)},${SVG_BOTTOM} L${SVG_LEFT},${SVG_BOTTOM} Z`
})

// 可见半径曲线（d 与 √(h/hMax) 成正比，峰值 = maxVisibilityRadiusKm）
const radiusPath = computed(() => {
  const kps = keyPoints.value
  const points: string[] = []
  const total = maxDistForChart.value
  const hMax = chartMaxHeight.value
  const dMax = props.maxVisibilityRadiusKm
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const τ = i / SAMPLE_COUNT
    const dist = total * τ
    const h = kps.length > 1 ? interpolateHeight(kps, dist) : 0
    const d = dMax * Math.sqrt(Math.max(h / hMax, 0))
    const dNorm = dMax > 0 ? d / dMax : 0
    const x = xOf(dist)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(dNorm).toFixed(1)}`)
  }
  return points.join(' ')
})

// 落区在曲线上的标记
interface LandingMarker {
  id: string
  index: number
  distanceKm: number
  heightKm: number
  visibilityRadiusKm: number
  x: number
  yH: number
  yD: number
}

const landingMarkers = computed<LandingMarker[]>(() => {
  const hMax = chartMaxHeight.value
  const dMax = props.maxVisibilityRadiusKm
  return (props.result?.landings ?? []).map(l => ({
    id: l.id,
    index: l.index,
    distanceKm: l.distanceKm,
    heightKm: l.heightKm,
    visibilityRadiusKm: l.visibilityRadiusKm,
    x: xOf(l.distanceKm),
    yH: yOf(hMax > 0 ? l.heightKm / hMax : 0),
    yD: yOf(dMax > 0 ? l.visibilityRadiusKm / dMax : 0),
  }))
})

function onRadiusInput(e: Event) {
  emit('update:maxVisibilityRadiusKm', Number((e.target as HTMLInputElement).value))
}

function onLandingHeightInput(id: string, e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isNaN(v))
    emit('update:landingHeight', { id, heightKm: v })
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      class="w-[680px] max-w-[calc(100vw-2rem)] pointer-events-auto bottom-6 left-1/2 absolute z-50 -translate-x-1/2"
    >
      <div class="px-5 pb-4 pt-3 border border-gray-100 rounded-2xl bg-white/95 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <!-- Header -->
        <div class="mb-3 flex justify-between items-center">
          <div class="flex gap-2 items-center">
            <div class="i-carbon-radar text-lg text-orange-500" />
            <span class="text-sm text-gray-700 font-bold dark:text-gray-200">火箭可见区域</span>
            <!-- 步骤指示器 -->
            <div class="flex gap-1.5 ml-4 items-center">
              <template v-for="(label, idx) in stepLabels" :key="idx">
                <div
                  class="rounded-full h-5 w-5 flex text-[10px] font-bold items-center justify-center transition-colors"
                  :class="[
                    stepIndex(step) >= idx
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                  ]"
                >
                  {{ idx + 1 }}
                </div>
                <span
                  class="text-xs mr-2"
                  :class="stepIndex(step) >= idx
                    ? 'text-gray-700 dark:text-gray-200 font-medium'
                    : 'text-gray-400 dark:text-gray-500'"
                >{{ label }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- 飞行剖面示意图 + 参数滑块 -->
        <div class="bg-gray-50 dark:bg-gray-900/30 mb-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
          <svg viewBox="0 0 600 124" class="w-full" preserveAspectRatio="xMidYMid meet">
            <!-- 水平网格 -->
            <g stroke="#e5e7eb" stroke-width="0.5" class="dark:stroke-gray-700">
              <line :x1="SVG_LEFT" :y1="SVG_TOP" :x2="SVG_RIGHT" :y2="SVG_TOP" />
              <line :x1="SVG_LEFT" :y1="(SVG_TOP + SVG_BOTTOM) / 2" :x2="SVG_RIGHT" :y2="(SVG_TOP + SVG_BOTTOM) / 2" stroke-dasharray="2,2" />
              <line :x1="SVG_LEFT" :y1="SVG_BOTTOM" :x2="SVG_RIGHT" :y2="SVG_BOTTOM" stroke="#9ca3af" />
            </g>

            <!-- 高度填充与曲线 -->
            <path :d="heightFillPath" fill="#f97316" fill-opacity="0.1" />
            <path :d="heightPath" stroke="#f97316" stroke-width="2" fill="none" />

            <!-- 可见半径曲线 -->
            <path :d="radiusPath" stroke="#a855f7" stroke-width="1.6" fill="none" stroke-dasharray="3,2" stroke-opacity="0.85" />

            <!-- 落区标记（按距离递增编号） -->
            <template v-for="m in landingMarkers" :key="`l-${m.index}`">
              <!-- 高度曲线上的落点 -->
              <circle :cx="m.x" :cy="m.yH" r="3.5" fill="#f97316" stroke="#fff" stroke-width="1.2" />
              <text :x="m.x" :y="m.yH - 6" text-anchor="middle" fill="#ea580c" font-size="9" class="dark:fill-orange-400" font-weight="bold">
                #{{ m.index }}
              </text>
              <!-- 半径曲线上的落点（小一些） -->
              <circle :cx="m.x" :cy="m.yD" r="2.5" fill="#a855f7" stroke="#fff" stroke-width="1" />
              <!-- 距离轴上的标注 -->
              <text :x="m.x" :y="SVG_BOTTOM + 12" text-anchor="middle" fill="#6b7280" font-size="9">
                {{ m.distanceKm.toFixed(0) }}
              </text>
              <!-- 落点高度数值（在标记右侧） -->
              <text :x="m.x + 5" :y="m.yH + 2" text-anchor="start" fill="#9a3412" font-size="8.5" class="dark:fill-orange-300" font-weight="500">
                h={{ m.heightKm.toFixed(0) }} d={{ m.visibilityRadiusKm.toFixed(0) }}
              </text>
            </template>

            <!-- 轴标签 -->
            <text :x="SVG_LEFT" :y="SVG_BOTTOM + 12" fill="#6b7280" font-size="10">发射点</text>
            <text :x="SVG_LEFT - 4" :y="SVG_TOP + 4" text-anchor="end" fill="#9ca3af" font-size="9">峰</text>
            <text :x="SVG_LEFT - 4" :y="SVG_BOTTOM" text-anchor="end" fill="#9ca3af" font-size="9">0</text>
            <text :x="SVG_RIGHT + 2" :y="SVG_BOTTOM + 12" text-anchor="end" fill="#9ca3af" font-size="9">距离 km</text>

            <!-- 图例 -->
            <g font-size="10">
              <rect :x="SVG_LEFT + 10" :y="6" width="10" height="2" fill="#f97316" />
              <text :x="SVG_LEFT + 24" :y="10" fill="#f97316" class="dark:fill-orange-400">飞行高度</text>
              <rect :x="SVG_LEFT + 100" :y="6" width="10" height="2" fill="#a855f7" />
              <text :x="SVG_LEFT + 114" :y="10" fill="#a855f7" class="dark:fill-purple-400">可见半径</text>
            </g>
          </svg>

          <!-- 滑块 + 落区高度设置 -->
          <div class="mt-2 space-y-2">
            <div>
              <label class="text-[11px] text-gray-500 dark:text-gray-400 flex justify-between mb-1">
                <span>最大可见半径（全局）</span>
                <span class="font-mono text-purple-600 dark:text-purple-400">{{ maxVisibilityRadiusKm }} km</span>
              </label>
              <input
                type="range"
                :value="maxVisibilityRadiusKm"
                min="200"
                max="3000"
                step="50"
                class="w-full accent-purple-500"
                @input="onRadiusInput"
              >
            </div>

            <!-- 每个落区的高度（按距离排序） -->
            <div v-if="landingMarkers.length > 0">
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
                落区飞行高度（按距离递增）
              </div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div
                  v-for="m in landingMarkers"
                  :key="m.id"
                  class="flex items-center gap-2 bg-white dark:bg-gray-800 px-2 py-1 border border-gray-200 rounded-md dark:border-gray-700"
                >
                  <span
                    class="rounded-full h-5 w-5 flex text-[10px] font-bold items-center justify-center shrink-0"
                    style="background-color: #f97316; color: white;"
                  >
                    {{ m.index }}
                  </span>
                  <span class="text-[10px] text-gray-500 dark:text-gray-400 flex-1 truncate">
                    {{ m.distanceKm.toFixed(0) }} km
                  </span>
                  <input
                    type="number"
                    :value="m.heightKm"
                    min="0"
                    max="500"
                    step="5"
                    class="w-14 px-1 py-0.5 text-xs text-right border border-gray-200 rounded dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    @input="onLandingHeightInput(m.id, $event)"
                  >
                  <span class="text-[10px] text-gray-400">km</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="errorMessage"
          class="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 mb-3 rounded-lg border border-red-100 dark:border-red-900/40"
        >
          {{ errorMessage }}
        </div>

        <!-- idle: 开始计算 -->
        <div v-if="step === 'idle'" class="flex gap-3 items-center">
          <div class="flex-1 text-xs text-gray-500 leading-relaxed dark:text-gray-400">
            模拟大型运载火箭从发射场沿大圆路径飞向落区面，按几何可见性估算地面可见范围（地球曲率 + 大气折射）。
          </div>
          <button
            class="text-sm text-white bg-orange-500 hover:bg-orange-600 px-4 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0"
            @click="emit('start')"
          >
            <div class="i-carbon-play text-base" />
            开始计算
          </button>
        </div>

        <!-- select-pad -->
        <div v-else-if="step === 'select-pad'" class="flex gap-3 items-center">
          <div class="i-carbon-location text-lg text-teal-500 animate-pulse" />
          <div class="flex-1 text-sm text-gray-700 font-medium dark:text-gray-200">
            请在地图上点击发射场图标
          </div>
          <button
            class="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition shrink-0"
            @click="emit('clear')"
          >
            取消
          </button>
        </div>

        <!-- select-polygon -->
        <div v-else-if="step === 'select-polygon'" class="flex gap-3 items-center">
          <div class="i-carbon-shape-extract text-lg text-teal-500 animate-pulse" />
          <div class="flex-1">
            <div class="text-sm text-gray-700 font-medium dark:text-gray-200">
              请绘制或选择落区面（按住 Shift 可多选）
            </div>
            <div class="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
              发射点：<span class="text-teal-700 dark:text-teal-400 font-medium">{{ selectedPadName }}</span>
              <span v-if="selectedPolygonIds.length">
                · 已选 <span class="text-orange-600 dark:text-orange-400 font-medium">{{ selectedPolygonIds.length }}</span> 个落区
              </span>
            </div>
          </div>
          <button
            class="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition shrink-0"
            @click="emit('reselect-pad')"
          >
            重选发射点
          </button>
        </div>

        <!-- result -->
        <div v-else-if="step === 'result'" class="space-y-3">
          <div class="grid grid-cols-4 gap-2">
            <div class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-900/40">
              <div class="text-xs text-orange-600 dark:text-orange-400 mb-0.5">
                落区数
              </div>
              <div class="text-base text-gray-900 font-bold dark:text-white">
                {{ result?.landingCount }}<span class="ml-0.5 text-xs font-normal text-gray-500">个</span>
              </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-900/40">
              <div class="text-xs text-orange-600 dark:text-orange-400 mb-0.5">
                最大高度
              </div>
              <div class="text-base text-gray-900 font-bold dark:text-white">
                {{ result?.maxHeightKm.toFixed(0) }}<span class="ml-0.5 text-xs font-normal text-gray-500">km</span>
              </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-900/40">
              <div class="text-xs text-orange-600 dark:text-orange-400 mb-0.5">
                最大可见半径
              </div>
              <div class="text-base text-gray-900 font-bold dark:text-white">
                {{ result?.maxVisibilityRadiusKm.toFixed(0) }}<span class="ml-0.5 text-xs font-normal text-gray-500">km</span>
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                主轨迹长度
              </div>
              <div class="text-sm text-gray-900 font-semibold dark:text-white">
                {{ result?.totalTrajectoryLengthKm.toFixed(0) }}<span class="ml-0.5 text-xs font-normal text-gray-500">km</span>
              </div>
            </div>
          </div>

          <div class="flex gap-2 justify-between items-center">
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              发射点：<span class="text-teal-700 dark:text-teal-400 font-medium">{{ selectedPadName }}</span>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                class="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition"
                @click="emit('reselect-pad')"
              >
                重选发射点
              </button>
              <button
                class="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition"
                @click="emit('reselect-polygon')"
              >
                重选落区
              </button>
              <button
                class="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition"
                @click="emit('clear')"
              >
                清除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
