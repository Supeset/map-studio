import type { Feature, FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map } from 'mapbox-gl'
import type { MissionFrame, MissionSolution } from '~/composables/rocket/useMission'
import mapboxgl from 'mapbox-gl'
import { effectiveVisibilityRadius } from '~/composables/rocket/useTrajectory'
import {
  ROCKET_ASCENT_LAYER,
  ROCKET_BOOSTER_MARKER_LAYER,
  ROCKET_DEBRIS_MARKER_LAYER,
  ROCKET_DEBRIS_PATH_LAYER,
  ROCKET_HEATMAP_LAYER,
  ROCKET_MARKERS_LAYER,
  ROCKET_ORBIT_LAYER,
  ROCKET_VIS_BOOSTER_FILL_LAYER,
  ROCKET_VIS_BOOSTER_OUTLINE_LAYER,
  ROCKET_VIS_DEBRIS_FILL_LAYER,
  ROCKET_VIS_DEBRIS_OUTLINE_LAYER,
  ROCKET_VIS_DYNAMIC_SOURCE,
  ROCKET_VIS_STATIC_SOURCE,
} from '~/constants/rocket'
import { generateCirclePolygon } from '~/utils/geometry'

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 图层添加顺序:底 → 顶 */
const ALL_LAYERS = [
  ROCKET_ASCENT_LAYER,
  ROCKET_ORBIT_LAYER,
  ROCKET_DEBRIS_PATH_LAYER,
  ROCKET_HEATMAP_LAYER,
  ROCKET_VIS_BOOSTER_FILL_LAYER,
  ROCKET_VIS_DEBRIS_FILL_LAYER,
  ROCKET_VIS_BOOSTER_OUTLINE_LAYER,
  ROCKET_VIS_DEBRIS_OUTLINE_LAYER,
  ROCKET_MARKERS_LAYER,
  ROCKET_BOOSTER_MARKER_LAYER,
  ROCKET_DEBRIS_MARKER_LAYER,
]

/**
 * 任务剖面渲染层:纯渲染,无业务状态
 * - 静态层:上升轨迹 / 残骸弹道 / 轨道一圈 / 热力 / 端点标记
 * - 动态层:当前主体 + 各残骸可见圆 / 位置
 */
export function useVisibilityRender(mapInstance: Ref<Map | undefined>) {
  function ensureLayers(map: Map) {
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
    if (!map.getLayer(ROCKET_DEBRIS_PATH_LAYER)) {
      map.addLayer({
        id: ROCKET_DEBRIS_PATH_LAYER,
        type: 'line',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'debris-path'],
        layout: lineLayout,
        paint: { 'line-color': '#a855f7', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.5 },
      })
    }
    if (!map.getLayer(ROCKET_HEATMAP_LAYER)) {
      map.addLayer({
        id: ROCKET_HEATMAP_LAYER,
        type: 'fill',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'heatmap'],
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0,
            'rgba(59, 130, 246, 0)',
            0.25,
            'rgba(56, 189, 248, 0.14)',
            0.5,
            'rgba(250, 204, 21, 0.22)',
            0.75,
            'rgba(249, 115, 22, 0.3)',
            1,
            'rgba(239, 68, 68, 0.4)',
          ],
        },
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
    if (!map.getLayer(ROCKET_VIS_DEBRIS_FILL_LAYER)) {
      map.addLayer({
        id: ROCKET_VIS_DEBRIS_FILL_LAYER,
        type: 'fill',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'vis-debris'],
        paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.08 },
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
    if (!map.getLayer(ROCKET_VIS_DEBRIS_OUTLINE_LAYER)) {
      map.addLayer({
        id: ROCKET_VIS_DEBRIS_OUTLINE_LAYER,
        type: 'line',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'vis-debris'],
        paint: { 'line-color': '#a855f7', 'line-width': 1.2, 'line-opacity': 0.7 },
      })
    }
    if (!map.getLayer(ROCKET_MARKERS_LAYER)) {
      map.addLayer({
        id: ROCKET_MARKERS_LAYER,
        type: 'circle',
        source: ROCKET_VIS_STATIC_SOURCE,
        filter: ['==', ['$type'], 'Point'],
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
    if (!map.getLayer(ROCKET_DEBRIS_MARKER_LAYER)) {
      map.addLayer({
        id: ROCKET_DEBRIS_MARKER_LAYER,
        type: 'circle',
        source: ROCKET_VIS_DYNAMIC_SOURCE,
        filter: ['==', ['get', 'kind'], 'debris'],
        paint: { 'circle-radius': 6, 'circle-color': '#a855f7', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
      })
    }
  }

  function renderMissionStatic(sol: MissionSolution, atmosphericVisibilityKm: number) {
    const map = mapInstance.value
    if (!map)
      return
    ensureLayers(map)

    const features: Feature[] = []

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: sol.ascent.map(f => f.pos) },
      properties: { kind: 'ascent' },
    } as Feature)

    for (const d of sol.debris) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: d.path },
        properties: { kind: 'debris-path' },
      } as Feature)
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: sol.orbit.groundTrack },
      properties: { kind: 'orbit' },
    } as Feature)

    for (const f of sol.ascent) {
      const r = effectiveVisibilityRadius(f.altitudeKm, atmosphericVisibilityKm)
      if (r <= 0)
        continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: generateCirclePolygon({ lng: f.pos[0], lat: f.pos[1] }, r, 32) },
        properties: { kind: 'heatmap', score: Math.min(1, f.altitudeKm / sol.leoAltitudeKm) },
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
        geometry: { type: 'Polygon', coordinates: generateCirclePolygon({ lng: b.pos[0], lat: b.pos[1] }, Math.max(b.visibilityRadiusKm, 0.1), 48) },
        properties: { kind: 'vis-booster' },
      } as Feature)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: b.pos },
        properties: { kind: 'booster', altitudeKm: b.altitudeKm },
      } as Feature)
    }
    for (const d of frame.debris) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: generateCirclePolygon({ lng: d.pos[0], lat: d.pos[1] }, Math.max(d.visibilityRadiusKm, 0.1), 40) },
        properties: { kind: 'vis-debris' },
      } as Feature)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: d.pos },
        properties: { kind: 'debris', altitudeKm: d.altitudeKm },
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
