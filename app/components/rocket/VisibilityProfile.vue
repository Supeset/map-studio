<script setup lang="ts">
import type { MissionFrame, MissionSolution } from '~/composables/rocket/useMission'

const props = defineProps<{
  mission: MissionSolution
  currentTimeMin: number
  currentFrame: MissionFrame | null
}>()

const SVG_LEFT = 44
const SVG_RIGHT = 580
const SVG_TOP = 28
const SVG_BOTTOM = 108
const MID_Y = (SVG_TOP + SVG_BOTTOM) / 2

const totalT = computed(() => props.mission.totalTimeMin)
const ascentT = computed(() => props.mission.ascentTimeMin)
const leoH = computed(() => Math.max(props.mission.orbit.apogeeKm, 1))

function xOf(t: number): number {
  return SVG_LEFT + (t / (totalT.value || 1)) * (SVG_RIGHT - SVG_LEFT)
}
function yOf(norm: number): number {
  return SVG_BOTTOM - norm * (SVG_BOTTOM - SVG_TOP)
}

// 主体高度曲线:上升帧 + 入轨后恒高(轨道)
const heightPath = computed(() => {
  const pts: string[] = []
  props.mission.ascent.forEach((f, i) => {
    pts.push(`${i === 0 ? 'M' : 'L'}${xOf(f.t).toFixed(1)},${yOf(f.altitudeKm / leoH.value).toFixed(1)}`)
  })
  pts.push(`L${xOf(totalT.value).toFixed(1)},${yOf(1).toFixed(1)}`)
  return pts.join(' ')
})
const heightFillPath = computed(() =>
  `${heightPath.value} L${SVG_RIGHT},${SVG_BOTTOM} L${SVG_LEFT},${SVG_BOTTOM} Z`,
)

// 入轨点位置(上升/轨道分界)
const insertX = computed(() => xOf(ascentT.value))

const currentX = computed(() => xOf(props.currentTimeMin))
const boosterY = computed(() =>
  yOf((props.currentFrame?.booster?.altitudeKm ?? 0) / leoH.value),
)
</script>

<template>
  <svg viewBox="0 0 600 124" class="w-full" preserveAspectRatio="xMidYMid meet">
    <!-- 网格 -->
    <g stroke="#e5e7eb" stroke-width="0.5" class="dark:stroke-gray-700">
      <line :x1="SVG_LEFT" :y1="SVG_TOP" :x2="SVG_RIGHT" :y2="SVG_TOP" />
      <line :x1="SVG_LEFT" :y1="MID_Y" :x2="SVG_RIGHT" :y2="MID_Y" stroke-dasharray="2,2" />
      <line :x1="SVG_LEFT" :y1="SVG_BOTTOM" :x2="SVG_RIGHT" :y2="SVG_BOTTOM" stroke="#9ca3af" />
    </g>

    <!-- 入轨分界线(上升 | 轨道) -->
    <line :x1="insertX" :y1="SVG_TOP" :x2="insertX" :y2="SVG_BOTTOM" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="3,2" stroke-opacity="0.5" />

    <!-- 高度填充 + 曲线 -->
    <path :d="heightFillPath" fill="#f97316" fill-opacity="0.1" />
    <path :d="heightPath" stroke="#f97316" stroke-width="2" fill="none" />

    <!-- 入轨点标记 -->
    <circle :cx="insertX" :cy="SVG_TOP + 2" r="3" fill="#3b82f6" stroke="#fff" stroke-width="1" />
    <text :x="insertX" :y="SVG_TOP - 2" text-anchor="middle" fill="#3b82f6" font-size="9" class="dark:fill-blue-400">
      入轨
    </text>

    <!-- 当前时刻竖线 + 主体点 -->
    <line :x1="currentX" :y1="SVG_TOP" :x2="currentX" :y2="SVG_BOTTOM" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" stroke-opacity="0.7" />
    <circle :cx="currentX" :cy="boosterY" r="4" fill="#ef4444" stroke="#fff" stroke-width="1.5" />
    <!-- 轴标签 -->
    <text :x="SVG_LEFT" :y="SVG_BOTTOM + 12" fill="#6b7280" font-size="9">T+0</text>
    <text :x="SVG_RIGHT" :y="SVG_BOTTOM + 12" text-anchor="end" fill="#9ca3af" font-size="9">时间 min</text>
    <text :x="SVG_LEFT - 4" :y="SVG_TOP + 4" text-anchor="end" fill="#9ca3af" font-size="9">LEO</text>
    <text :x="SVG_LEFT - 4" :y="SVG_BOTTOM" text-anchor="end" fill="#9ca3af" font-size="9">0</text>

    <!-- 图例 -->
    <g font-size="9">
      <rect :x="SVG_LEFT + 8" :y="6" width="10" height="2" fill="#f97316" />
      <text :x="SVG_LEFT + 22" :y="10" fill="#f97316" class="dark:fill-orange-400">主体高度</text>
      <rect :x="SVG_LEFT + 150" :y="5" width="8" height="4" fill="#3b82f6" />
      <text :x="SVG_LEFT + 162" :y="10" fill="#3b82f6">入轨分界</text>
    </g>
  </svg>
</template>
