export const DRAW_STORAGE_KEY = 'map-studio-draw-data'

// 隐藏过滤：properties.user_hidden === true 的要素不渲染
// 必须用 legacy filter 语法（属性名作为字面量），不能用 ['get', 'user_hidden']——
// 否则会与同 filter 中已有的 legacy 子表达式（['==','active','false'] 等）混用，
// mapbox-gl 会按 expression 解析整个 filter，使原有的 active/mode 判断失效，所有要素都不渲染
const HIDDEN_FILTER = ['!=', 'user_hidden', true] as const

// 自定义 Mapbox Draw 样式，使其支持 user_ 前缀的属性 (SimpleStyle Spec)
// Mapbox Draw 默认将 feature.properties 映射为 user_属性名
export const drawStyles = [
  // 1. Polygon Fill (Inactive)
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], HIDDEN_FILTER],
    paint: {
      'fill-color': ['coalesce', ['get', 'user_fill'], '#3bb2d0'],
      'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.4],
      'fill-outline-color': ['coalesce', ['get', 'user_stroke'], '#3bb2d0'],
    },
  },
  // 2. Polygon Fill (Active)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon'], HIDDEN_FILTER],
    paint: {
      'fill-color': ['coalesce', ['get', 'user_fill'], '#fbb03b'],
      'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.4],
      'fill-outline-color': ['coalesce', ['get', 'user_stroke'], '#fbb03b'],
    },
  },

  // 3. Polygon Stroke (Inactive)
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], HIDDEN_FILTER],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#3bb2d0'],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 4. Polygon Stroke (Active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon'], HIDDEN_FILTER],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#fbb03b'],
      'line-dasharray': [0.2, 2],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 5. Line/Stroke (Inactive)
  {
    id: 'gl-draw-line-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static'], HIDDEN_FILTER],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#3bb2d0'],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 6. Line/Stroke (Active)
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString'], HIDDEN_FILTER],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'user_stroke'], '#fbb03b'],
      'line-dasharray': [0.2, 2],
      'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
      'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
    },
  },
  // 7. Point (Inactive) - using Circle for better performance than Symbol
  {
    id: 'gl-draw-point-inactive',
    type: 'circle',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['!=', 'mode', 'static'], HIDDEN_FILTER],
    paint: {
      'circle-radius': ['coalesce', ['get', 'user_marker-size-value'], 5],
      'circle-color': ['coalesce', ['get', 'user_marker-color'], '#3bb2d0'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
  // 8. Point (Active)
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], HIDDEN_FILTER],
    paint: {
      'circle-radius': ['coalesce', ['get', 'user_marker-size-value'], 7],
      'circle-color': ['coalesce', ['get', 'user_marker-color'], '#fbb03b'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
  // Polygon Midpoints (standard)
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#fbb03b',
    },
  },
]
