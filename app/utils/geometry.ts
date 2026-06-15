export interface LngLat {
  lng: number
  lat: number
}

export type LngLatPair = [number, number]

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function haversineDistance(p1: LngLat, p2: LngLat): number {
  const lat1 = toRad(p1.lat)
  const lat2 = toRad(p2.lat)
  const dLat = toRad(p2.lat - p1.lat)
  const dLng = toRad(p2.lng - p1.lng)

  const a
    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function calculateBearing(p1: LngLat, p2: LngLat): number {
  const lat1 = toRad(p1.lat)
  const lat2 = toRad(p2.lat)
  const dLng = toRad(p2.lng - p1.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x
    = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function destinationPoint(
  start: LngLat,
  bearing: number,
  distanceKm: number,
): LngLatPair {
  const R = EARTH_RADIUS_KM
  const lat1 = toRad(start.lat)
  const lng1 = toRad(start.lng)
  const bearingRad = toRad(bearing)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceKm / R)
    + Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearingRad),
  )
  let lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceKm / R) * Math.cos(lat1),
    Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2),
  )

  lng2 = ((lng2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI

  return [toDeg(lng2), toDeg(lat2)]
}

export function interpolateGreatCircle(p1: LngLat, p2: LngLat, t: number): LngLat {
  if (t <= 0)
    return { lng: p1.lng, lat: p1.lat }
  if (t >= 1)
    return { lng: p2.lng, lat: p2.lat }

  const distance = haversineDistance(p1, p2)
  if (distance === 0)
    return { lng: p1.lng, lat: p1.lat }
  const bearing = calculateBearing(p1, p2)
  const [lng, lat] = destinationPoint(p1, bearing, distance * t)
  return { lng, lat }
}

/**
 * 面积加权多边形质心（球面近似）
 * @param rings Polygon coordinates: [outerRing, hole1, hole2, ...]
 */
export function polygonCentroid(rings: number[][][]): LngLat {
  const outer = rings[0]
  if (!outer || outer.length < 3) {
    // 退化情况：取顶点平均
    let sumLng = 0
    let sumLat = 0
    const n = outer?.length || 1
    outer?.forEach((coord) => {
      const [lng, lat] = coord as [number, number]
      sumLng += lng
      sumLat += lat
    })
    return { lng: sumLng / n, lat: sumLat / n }
  }

  // 球面 → 局部切面笛卡尔（参考点取多边形边界中点）
  let sumLat = 0
  let sumLng = 0
  for (const p of outer) {
    const [lng, lat] = p as [number, number]
    sumLat += lat
    sumLng += lng
  }
  const refLat = sumLat / outer.length
  const refLng = sumLng / outer.length
  const cosRef = Math.cos(toRad(refLat))

  const proj: { x: number, y: number }[] = []
  for (const p of outer) {
    const [lng, lat] = p as [number, number]
    proj.push({
      x: (lng - refLng) * cosRef,
      y: lat - refLat,
    })
  }

  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < proj.length - 1; i++) {
    const p0 = proj[i]
    const p1 = proj[i + 1]
    if (!p0 || !p1)
      continue
    const cross = p0.x * p1.y - p1.x * p0.y
    area += cross
    cx += (p0.x + p1.x) * cross
    cy += (p0.y + p1.y) * cross
  }
  area *= 0.5

  if (Math.abs(area) < 1e-12) {
    return { lng: refLng, lat: refLat }
  }

  cx = cx / (6 * area)
  cy = cy / (6 * area)

  return {
    lng: cx / cosRef + refLng,
    lat: cy + refLat,
  }
}

/**
 * 以 center 为圆心生成圆形 Polygon 的坐标（球面，跨日期线鲁棒）
 */
export function generateCirclePolygon(
  center: LngLat,
  radiusKm: number,
  segments = 48,
): LngLatPair[][] {
  const ring: LngLatPair[] = []
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 360) / segments
    ring.push(destinationPoint(center, angle, radiusKm))
  }
  return [ring]
}
