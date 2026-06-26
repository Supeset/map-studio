import type { Feature } from 'geojson'

const TYPE_LABELS: Record<string, string> = {
  Point: '点',
  MultiPoint: '多点',
  LineString: '线',
  MultiLineString: '多线',
  Polygon: '面',
  MultiPolygon: '多面',
  GeometryCollection: '几何集合',
}

const TYPE_ICONS: Record<string, string> = {
  Point: 'i-gis-point',
  MultiPoint: 'i-gis-point',
  LineString: 'i-gis-polyline-pt',
  MultiLineString: 'i-gis-polyline-pt',
  Polygon: 'i-gis-polygon-pt',
  MultiPolygon: 'i-gis-polygon-pt',
  GeometryCollection: 'i-gis-layers',
}

const DEFAULT_COLOR = '#3bb2d0'

export function getFeatureTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? '未知'
}

export function getFeatureIcon(type: string): string {
  return TYPE_ICONS[type] ?? 'i-gis-layer'
}

export function getFeatureColor(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, any>
  switch (feature.geometry?.type) {
    case 'Point':
    case 'MultiPoint':
      return props['user_marker-color'] ?? props['marker-color'] ?? DEFAULT_COLOR
    case 'LineString':
    case 'MultiLineString':
      return props.user_stroke ?? props.stroke ?? DEFAULT_COLOR
    case 'Polygon':
    case 'MultiPolygon':
      return props.user_fill ?? props.fill ?? props.user_stroke ?? props.stroke ?? DEFAULT_COLOR
    default:
      return DEFAULT_COLOR
  }
}

export function isFeatureHidden(feature: Feature): boolean {
  const props = (feature.properties ?? {}) as Record<string, any>
  return props.user_hidden === true || props.hidden === true
}

export function getFeatureName(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, any>
  return (
    props.user_name
    ?? props.name
    ?? props.title
    ?? getFeatureTypeLabel(feature.geometry?.type ?? '')
  )
}

function countVertices(coords: any): number {
  if (!Array.isArray(coords))
    return 0
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number')
    return 1
  return coords.reduce((sum: number, c: any) => sum + countVertices(c), 0)
}

export function getFeatureSubtitle(feature: Feature): string {
  const geo = feature.geometry
  if (!geo)
    return ''

  const label = getFeatureTypeLabel(geo.type)

  if (geo.type === 'Point' && 'coordinates' in geo) {
    const [lng, lat] = geo.coordinates as [number, number]
    return `${lng.toFixed(3)}, ${lat.toFixed(3)} · ${label}`
  }

  const count = 'coordinates' in geo ? countVertices(geo.coordinates) : 0
  return `${count} 个顶点 · ${label}`
}
