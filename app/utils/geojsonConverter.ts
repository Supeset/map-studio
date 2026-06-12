/**
 * 将 NOTAM 度分秒坐标文本转为 GeoJSON
 * 支持格式: 193600N 1183100E, N395800E0995300, 193600N1183100E 等
 */
export function txtToGeoJSON(notamText: string, properties: Record<string, any> = {}) {
  const coordRegex = /(?:([NS])\s*(\d{2})(\d{2})(\d{2})|(\d{2})(\d{2})(\d{2})\s*([NS]))\s*-?\s*(?:([EW])\s*(\d{3})(\d{2})(\d{2})|(\d{3})(\d{2})(\d{2})\s*([EW]))/gi

  function dmsToDd(d: string, m: string, s: string, ref: string) {
    let dd = Number.parseInt(d, 10) + Number.parseInt(m, 10) / 60 + Number.parseInt(s, 10) / 3600
    if (ref === 'S' || ref === 'W')
      dd *= -1
    return Number.parseFloat(dd.toFixed(6))
  }

  const coordinates: [number, number][] = []
  let match: RegExpExecArray | null

  while ((match = coordRegex.exec(notamText)) !== null) {
    const lat = match[1]
      ? dmsToDd(match[2]!, match[3]!, match[4]!, match[1])
      : dmsToDd(match[5]!, match[6]!, match[7]!, match[8]!)

    const lon = match[9]
      ? dmsToDd(match[10]!, match[11]!, match[12]!, match[9])
      : dmsToDd(match[13]!, match[14]!, match[15]!, match[16]!)

    coordinates.push([lon, lat])
  }

  if (coordinates.length === 0)
    return null

  const first = coordinates[0]!
  const last = coordinates[coordinates.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1])
    coordinates.push([first[0], first[1]])

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates],
        },
      },
    ],
  }
}

export type ImportFormat = 'geojson' | 'notam'

export const IMPORT_FORMATS: { value: ImportFormat, label: string, placeholder: string }[] = [
  { value: 'geojson', label: 'GeoJSON', placeholder: '粘贴 GeoJSON 文本...' },
  { value: 'notam', label: 'NOTAM 坐标', placeholder: '粘贴 NOTAM 度分秒坐标文本，如 193600N 1183100E ...' },
]

export function convertToGeoJSON(text: string, format: ImportFormat) {
  if (format === 'geojson')
    return text
  if (format === 'notam') {
    const result = txtToGeoJSON(text)
    if (!result)
      return null
    return JSON.stringify(result)
  }
  return text
}
