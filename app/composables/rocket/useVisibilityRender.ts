import type { Feature, FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map } from 'mapbox-gl'
import type { MissionFrame, MissionSolution } from '~/composables/rocket/useMission'
import mapboxgl from 'mapbox-gl'
import { buildVisibilityEnvelope } from '~/composables/rocket/useTrajectory'
import {
  ROCKET_ASCENT_LAYER,
  ROCKET_BOOSTER_MARKER_LAYER,
  ROCKET_ENVELOPE_15_LAYER,
  ROCKET_ENVELOPE_45_LAYER,
  ROCKET_MARKERS_LAYER,
  ROCKET_ORBIT_LAYER,
  ROCKET_VIS_BOOSTER_FILL_LAYER,
  ROCKET_VIS_BOOSTER_OUTLINE_LAYER,
  ROCKET_VIS_DYNAMIC_SOURCE,
  ROCKET_VIS_STATIC_SOURCE,
} from '~/constants/rocket'
import { generateCirclePolygon, splitOnAntimeridian } from '~/utils/geometry'

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 图层添加顺序:底 → 顶 */
const ALL_LAYERS = [
  ROCKET_ENVELOPE_15_LAYER,
  ROCKET_ENVELOPE_45_LAYER,
  ROCKET_ASCENT_LAYER,
  ROCKET_ORBIT_LAYER,
  ROCKET_VIS_BOOSTER_FILL_LAYER,
  ROCKET_VIS_BOOSTER_OUTLINE_LAYER,
  ROCKET_MARKERS_LAYER,
  ROCKET_BOOSTER_MARKER_LAYER,
]

/**
 * 任务剖面渲染层:纯渲染,无业务状态
 * - 静态层:上升轨迹 / 轨道一圈 / 可见包络 / 端点标记(发射/入轨/落区)
 * - 动态层:当前主体可见圆 / 位置
 */
export function useVisibilityRender(mapInstance: Ref<Map | undefined>) {
  function ensureLayers(map: Map) {
    // 已初始化则跳过(STATIC source 存在即全部图层就绪;style 切换会清 source → 自动重建)
    if (map.getSource(ROCKET_VIS_STATIC_SOURCE))
      return
    if (!map.getSource(ROCKET_VIS_STATIC_SOURCE))
      map.addSource(ROCKET_VIS_STATIC_SOURCE, { type: 'geojson', data: EMPTY_FC })
    if (!map.getSource(ROCKET_VIS_DYNAMIC_SOURCE))
      map.addSource(ROCKET_VIS_DYNAMIC_SOURCE, { type: 'geojson', data: EMPTY_FC })

    const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const

    if (!map.getLayer(ROCKET_ASCENT_LAYER)) {
      map.addLayer({
        id: ROCKET_ASCENT_LAYER,
        type: 'line',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'ascent'],
        layout: lineLayout,
        paint: { 'line-color': '#f97316', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
      })
    }
    if (!map.getLayer(ROCKET_ORBIT_LAYER)) {
      map.addLayer({
        id: ROCKET_ORBIT_LAYER,
        type: 'line',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'orbit'],
        layout: lineLayout,
        paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-opacity': 0.85 },
      })
    }
    if (!map.getLayer(ROCKET_ENVELOPE_15_LAYER)) {
      map.addLayer({
        id: ROCKET_ENVELOPE_15_LAYER,
        type: 'line',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'envelope-15'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#06b6d4', 'line-width': 1.4, 'line-opacity': 0.7, 'line-dasharray': [4, 3] },
      })
    }
    if (!map.getLayer(ROCKET_ENVELOPE_45_LAYER)) {
      map.addLayer({
        id: ROCKET_ENVELOPE_45_LAYER,
        type: 'line',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'envelope-45'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f97316', 'line-width': 1.4, 'line-opacity': 0.7, 'line-dasharray': [4, 3] },
      })
    }
    if (!map.getLayer(ROCKET_VIS_BOOSTER_FILL_LAYER)) {
      map.addLayer({
        id: ROCKET_VIS_BOOSTER_FILL_LAYER,
        type: 'fill',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'vis-booster'],
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.1 },
      })
    }
    if (!map.getLayer(ROCKET_VIS_BOOSTER_OUTLINE_LAYER)) {
      map.addLayer({
        id: ROCKET_VIS_BOOSTER_OUTLINE_LAYER,
        type: 'line',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'vis-booster'],
        paint: { 'line-color': '#f97316', 'line-width': 1.6, 'line-opacity': 0.8 },
      })
    }
    if (!map.getLayer(ROCKET_MARKERS_LAYER)) {
      map.addLayer({
        id: ROCKET_MARKERS_LAYER,
        type: 'circle',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'launch',
            '#10b981',
            'insert',
            '#3b82f6',
            'landing',
            '#a855f7',
            '#0d9488',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }
    if (!map.getLayer(ROCKET_BOOSTER_MARKER_LAYER)) {
      map.addLayer({
        id: ROCKET_BOOSTER_MARKER_LAYER,
        type: 'circle',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'booster'],
        paint: { 'circle-radius': 9, 'circle-color': '#ef4444', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
      })
    }
  }

  function renderMissionStatic(sol: MissionSolution, _atmosphericVisibilityKm: number) {
    const map = mapInstance.value
    if (!map)
      return
    ensureLayers(map)

    const features: Feature[] = []

    // 上升段 / 轨道段:在反子午线(±180°)处切分,避免 Mapbox 画出横穿整图的水平线
    for (const seg of splitOnAntimeridian(sol.ascent.map(f => f.pos))) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { kind: 'ascent' },
      } as Feature)
    }
    for (const seg of splitOnAntimeridian(sol.orbit.groundTrack)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { kind: 'orbit' },
      } as Feature)
    }

    // 可见包络(15° / 45° 仰角):上升段所有可见圆的凸包,描边呈现
    const envelope15 = buildVisibilityEnvelope(sol.ascent, 15)
    if (envelope15) {
      features.push({
        type: 'Feature',
        geometry: envelope15,
        properties: { kind: 'envelope-15' },
      } as Feature)
    }
    const envelope45 = buildVisibilityEnvelope(sol.ascent, 45)
    if (envelope45) {
      features.push({
        type: 'Feature',
        geometry: envelope45,
        properties: { kind: 'envelope-45' },
      } as Feature)
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [sol.launch.lng, sol.launch.lat] },
      properties: { kind: 'launch' },
    } as Feature)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: sol.insertPoint },
      properties: { kind: 'insert' },
    } as Feature)
    sol.debris.forEach((d, idx) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.landing.lng, d.landing.lat] },
        properties: { kind: 'landing', order: idx + 1 },
      } as Feature)
    })

    ;(map.getSource(ROCKET_VIS_STATIC_SOURCE) as GeoJSONSource)?.setData({ type: 'FeatureCollection', features })
  }

  function renderMissionFrame(frame: MissionFrame) {
    const map = mapInstance.value
    if (!map)
      return
    ensureLayers(map)

    const features: Feature[] = []
    if (frame.booster) {
      const b = frame.booster
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: generateCirclePolygon({ lng: b.pos[0], lat: b.pos[1] }, Math.max(b.visibilityRadiusKm, 0.1), 32) },
        properties: { kind: 'vis-booster' },
      } as Feature)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: b.pos },
        properties: { kind: 'booster', altitudeKm: b.altitudeKm },
      } as Feature)
    }

    ;(map.getSource(ROCKET_VIS_DYNAMIC_SOURCE) as GeoJSONSource)?.setData({ type: 'FeatureCollection', features })
  }

  /** 聚焦上升段 + 落区 + 入轨点(轨道一圈太大,不纳入) */
  function fitMission(sol: MissionSolution) {
    const map = mapInstance.value
    if (!map)
      return
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([sol.launch.lng, sol.launch.lat])
    bounds.extend(sol.insertPoint)
    for (const d of sol.debris)
      bounds.extend([d.landing.lng, d.landing.lat])
    for (const f of sol.ascent)
      bounds.extend(f.pos)
    if (!bounds.isEmpty())
      map.fitBounds(bounds, { padding: 80 })
  }

  function clear() {
    const map = mapInstance.value
    if (!map)
      return
    ALL_LAYERS.forEach((id) => {
      if (map.getLayer(id))
        map.removeLayer(id)
    })
    if (map.getSource(ROCKET_VIS_STATIC_SOURCE))
      map.removeSource(ROCKET_VIS_STATIC_SOURCE)
    if (map.getSource(ROCKET_VIS_DYNAMIC_SOURCE))
      map.removeSource(ROCKET_VIS_DYNAMIC_SOURCE)
  }

  return {
    renderMissionStatic,
    renderMissionFrame,
    fitMission,
    clear,
  }
}
