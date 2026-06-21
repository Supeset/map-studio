import type { Feature, FeatureCollection } from 'geojson'
import type { Map, MapMouseEvent } from 'mapbox-gl'
import type { EnrichedPad } from '~/components/rocket/ListPanel.vue'
import type { MissionFrame, MissionSolution } from '~/composables/rocket/useMission'
import { sampleMissionFrame, solveMission } from '~/composables/rocket/useMission'
import { useVisibilityRender } from '~/composables/rocket/useVisibilityRender'
import { DEFAULT_ATMOSPHERIC_VISIBILITY_KM, PADS_POINT_ID } from '~/constants/rocket'

export type VisibilityStep = 'idle' | 'select-launch' | 'select-targets' | 'result'

export interface VisPoint {
  lng: number
  lat: number
  name: string
}

interface RocketVisibilityOptions {
  padsData: Ref<EnrichedPad[]>
  isActive: Ref<boolean>
}

const DEFAULT_LEO_ALTITUDE_KM = 400

export function useRocketVisibility(
  mapInstance: Ref<Map | undefined>,
  isMapLoaded: Ref<boolean>,
  options: RocketVisibilityOptions,
) {
  const { renderMissionStatic, renderMissionFrame, fitMission, clear: clearRender } = useVisibilityRender(mapInstance)
  const atmVis = DEFAULT_ATMOSPHERIC_VISIBILITY_KM

  const step = ref<VisibilityStep>('idle')
  const selectedLaunch = ref<VisPoint | null>(null)
  const selectedTargets = ref<VisPoint[]>([])
  const mission = ref<MissionSolution | null>(null)
  const errorMessage = ref<string | null>(null)

  const leoAltitudeKm = ref(DEFAULT_LEO_ALTITUDE_KM)
  const currentTimeMin = ref(0)
  const isPlaying = ref(false)
  const playbackRate = ref(1)

  const totalTimeMin = computed(() => mission.value?.totalTimeMin ?? 0)
  const ascentTimeMin = computed(() => mission.value?.ascentTimeMin ?? 0)
  const orbitPeriodMin = computed(() => mission.value?.orbit.periodMin ?? 0)
  const inclinationDeg = computed(() => mission.value?.inclinationDeg ?? 0)
  const currentFrame = computed<MissionFrame | null>(() =>
    mission.value ? sampleMissionFrame(mission.value.frames, currentTimeMin.value) : null,
  )

  function solve() {
    if (!selectedLaunch.value || selectedTargets.value.length === 0) {
      errorMessage.value = '请选择发射点与至少一个落区'
      return
    }
    const sol = solveMission(selectedLaunch.value, selectedTargets.value, leoAltitudeKm.value, {
      atmosphericVisibilityKm: atmVis,
    })
    if (!sol) {
      errorMessage.value = '无法解算任务(落区距离异常)'
      return
    }
    errorMessage.value = null
    mission.value = sol
    currentTimeMin.value = 0
    isPlaying.value = false
    step.value = 'result'
    renderMissionStatic(sol, atmVis)
    renderMissionFrame(sampleMissionFrame(sol.frames, 0))
    fitMission(sol)
  }

  function setLaunch(point: VisPoint) {
    selectedLaunch.value = point
    errorMessage.value = null
    enterSelectTargetsMode()
  }

  function removeTarget(index: number) {
    selectedTargets.value = selectedTargets.value
      .filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, name: `落区 ${i + 1}` }))
  }

  function handleLaunchClick(e: MapMouseEvent & { features?: any[] }) {
    if (!e.features?.[0])
      return
    const props = e.features[0].properties || {}
    const pad = options.padsData.value.find(p => p.record_id === props.record_id)
    setLaunch(
      pad
        ? { lng: pad.longitude, lat: pad.latitude, name: pad.name }
        : { lng: Number(props.longitude), lat: Number(props.latitude), name: props.name ?? '发射点' },
    )
  }

  function handleTargetClick(e: MapMouseEvent) {
    if (step.value !== 'select-targets')
      return
    const map = mapInstance.value
    if (!map)
      return
    const features = map.queryRenderedFeatures(e.point)
    if (features.some(f => f.properties?.cluster))
      return
    const idx = selectedTargets.value.length + 1
    selectedTargets.value = [...selectedTargets.value, { lng: e.lngLat.lng, lat: e.lngLat.lat, name: `落区 ${idx}` }]
  }

  function unbindAll() {
    const map = mapInstance.value
    if (!map)
      return
    map.off('click', PADS_POINT_ID, handleLaunchClick as any)
    map.off('click', handleTargetClick)
  }

  function enterSelectLaunchMode() {
    if (!options.isActive.value)
      return
    const map = mapInstance.value
    if (!map)
      return
    unbindAll()
    clearRender()
    selectedLaunch.value = null
    selectedTargets.value = []
    mission.value = null
    errorMessage.value = null
    step.value = 'select-launch'
    map.on('click', PADS_POINT_ID, handleLaunchClick as any)
  }

  function enterSelectTargetsMode() {
    if (!options.isActive.value)
      return
    const map = mapInstance.value
    if (!map)
      return
    unbindAll()
    clearRender()
    selectedTargets.value = []
    mission.value = null
    errorMessage.value = null
    step.value = 'select-targets'
    map.on('click', handleTargetClick)
  }

  // ===== 时间轴 / 动画 =====
  const { pause: stopRaf, resume: startRaf } = useRafFn(({ delta }) => {
    if (!isPlaying.value || !mission.value)
      return
    currentTimeMin.value += (delta / 60000) * playbackRate.value
    if (currentTimeMin.value >= totalTimeMin.value) {
      currentTimeMin.value = totalTimeMin.value
      isPlaying.value = false
    }
  }, { immediate: false })

  watch(isPlaying, playing => playing ? startRaf() : stopRaf())

  function play() {
    if (!mission.value)
      return
    if (currentTimeMin.value >= totalTimeMin.value)
      currentTimeMin.value = 0
    isPlaying.value = true
  }

  function pause() {
    isPlaying.value = false
  }

  function togglePlay() {
    if (isPlaying.value)
      pause()
    else
      play()
  }

  function setTime(t: number) {
    currentTimeMin.value = Math.max(0, Math.min(totalTimeMin.value, t))
  }

  function seekInsert() {
    if (ascentTimeMin.value > 0)
      setTime(ascentTimeMin.value)
  }

  function setLeoAltitude(km: number) {
    leoAltitudeKm.value = Math.max(200, Math.min(1200, Math.round(km)))
    if (step.value === 'result' && selectedLaunch.value && selectedTargets.value.length)
      solve()
  }

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
  }

  watch(currentTimeMin, (t) => {
    if (mission.value)
      renderMissionFrame(sampleMissionFrame(mission.value.frames, t))
  })

  function exportGeoJSON(): FeatureCollection {
    const m = mission.value
    if (!m)
      return { type: 'FeatureCollection', features: [] }
    const features: Feature[] = [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: m.ascent.map(f => f.pos) },
        properties: { kind: 'ascent' },
      } as Feature,
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: m.orbit.groundTrack },
        properties: { kind: 'orbit', inclinationDeg: m.inclinationDeg, periodMin: m.orbit.periodMin },
      } as Feature,
    ]
    for (const d of m.debris) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: d.path },
        properties: { kind: 'debris-path', landing: d.landing.name },
      } as Feature)
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.launch.lng, m.launch.lat] },
      properties: { kind: 'launch', name: m.launch.name },
    } as Feature)
    return { type: 'FeatureCollection', features }
  }

  function clear() {
    stopRaf()
    unbindAll()
    clearRender()
    step.value = 'idle'
    selectedLaunch.value = null
    selectedTargets.value = []
    mission.value = null
    currentTimeMin.value = 0
    isPlaying.value = false
    errorMessage.value = null
  }

  function handleStyleLoad() {
    if (mission.value) {
      renderMissionStatic(mission.value, atmVis)
      renderMissionFrame(sampleMissionFrame(mission.value.frames, currentTimeMin.value))
    }
  }

  watch(() => options.isActive.value, (active) => {
    if (!active)
      clear()
  })

  watch(isMapLoaded, (loaded) => {
    if (loaded && mapInstance.value)
      mapInstance.value.on('style.load', handleStyleLoad)
  }, { immediate: true })

  onUnmounted(() => {
    const map = mapInstance.value
    if (map) {
      unbindAll()
      map.off('style.load', handleStyleLoad)
    }
    clearRender()
  })

  return {
    step,
    selectedLaunch,
    selectedTargets,
    mission,
    currentFrame,
    currentTimeMin,
    totalTimeMin,
    ascentTimeMin,
    orbitPeriodMin,
    inclinationDeg,
    isPlaying,
    playbackRate,
    leoAltitudeKm,
    errorMessage,
    enterSelectLaunchMode,
    enterSelectTargetsMode,
    removeTarget,
    solve,
    setLeoAltitude,
    setTime,
    togglePlay,
    seekInsert,
    setPlaybackRate,
    exportGeoJSON,
    clear,
  }
}
