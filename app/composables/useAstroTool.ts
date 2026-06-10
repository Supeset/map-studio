import type TimeOfInterest from 'astronomy-bundle/time/TimeOfInterest'
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map, MapMouseEvent } from 'mapbox-gl'
import { createLocation } from 'astronomy-bundle/earth'
import { createSun } from 'astronomy-bundle/sun'
import { createTimeOfInterest } from 'astronomy-bundle/time'
import dayjs from 'dayjs'

export function useAstroTool(mapInstance: Ref<Map | undefined>, isMapLoaded: Ref<boolean>) {
  const isActive = ref(false)
  const isPinned = ref(false)
  const isLoading = ref(false)
  const selectedPoint = ref<{ lng: number, lat: number } | null>(null)
  const calculationError = ref<string | null>(null)
  const astroInfo = ref<{
    sunriseAzimuth: number
    sunsetAzimuth: number
    sunriseTime: string
    sunsetTime: string
    solarNoonTime: string
  } | null>(null)

  const SOURCE_ID = 'astro-features'
  const POINT_LAYER_ID = 'astro-point-layer'
  const LINE_LAYER_ID = 'astro-line-layer'
  const LABEL_LAYER_ID = 'astro-label-layer'

  function calculateDestinationPoint(
    start: { lng: number, lat: number },
    bearing: number,
    distance: number,
  ): [number, number] {
    const R = 6371
    const lat1 = (start.lat * Math.PI) / 180
    const lon1 = (start.lng * Math.PI) / 180
    const bearingRad = (bearing * Math.PI) / 180

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / R)
      + Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad),
    )
    let lon2 = lon1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2),
    )

    lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI

    return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
  }

  async function calculateTerminatorLine(
    targetToi: TimeOfInterest,
    type: 'rise' | 'set',
    forcePoint?: { lng: number, lat: number },
  ): Promise<[number, number][]> {
    const coords: [number, number][] = []
    const sunForCoords = createSun(targetToi)
    const h0 = -0.833

    const { rightAscension, declination } = await sunForCoords.getApparentGeocentricEquatorialSphericalCoordinates()
    const delta = declination
    const alpha = rightAscension

    const GAST = targetToi.getGreenwichApparentSiderealTime()

    for (let lat = -85; lat <= 85; lat += 2) {
      const phi = lat
      const phiRad = (phi * Math.PI) / 180
      const deltaRad = (delta * Math.PI) / 180
      const h0Rad = (h0 * Math.PI) / 180

      const cosH = (Math.sin(h0Rad) - Math.sin(phiRad) * Math.sin(deltaRad)) / (Math.cos(phiRad) * Math.cos(deltaRad))

      if (cosH > 1 || cosH < -1)
        continue

      let H = (Math.acos(cosH) * 180) / Math.PI

      if (type === 'rise')
        H = -H

      const LAST = alpha + H
      let lon = LAST - GAST
      lon = (lon + 540) % 360 - 180

      coords.push([lon, lat])
    }

    if (forcePoint) {
      coords.push([forcePoint.lng, forcePoint.lat])
      coords.sort((a, b) => a[1] - b[1])
    }

    return coords
  }

  function updateMapLayers(
    center: { lng: number, lat: number },
    sunriseInfo: { azimuth: number, time: string },
    sunsetInfo: { azimuth: number, time: string },
    terminatorLines: { sunrise: [number, number][], sunset: [number, number][] },
  ) {
    const map = mapInstance.value
    if (!map)
      return

    const distance = 8000 / (2 ** map.getZoom())

    const sunriseEndPoint = calculateDestinationPoint(center, sunriseInfo.azimuth, distance)
    const sunsetEndPoint = calculateDestinationPoint(center, sunsetInfo.azimuth, distance)

    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [center.lng, center.lat] }, properties: { type: 'center' } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunriseEndPoint] }, properties: { type: 'azimuth-sunrise' } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[center.lng, center.lat], sunsetEndPoint] }, properties: { type: 'azimuth-sunset' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: sunriseEndPoint }, properties: { type: 'sunrise', text: `日出: ${sunriseInfo.time}\n${sunriseInfo.azimuth.toFixed(2)}°` } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: sunsetEndPoint }, properties: { type: 'sunset', text: `日落: ${sunsetInfo.time}\n${sunsetInfo.azimuth.toFixed(2)}°` } },
    ]

    if (terminatorLines.sunrise.length > 1)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: terminatorLines.sunrise }, properties: { type: 'terminator-sunrise' } })

    if (terminatorLines.sunset.length > 1)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: terminatorLines.sunset }, properties: { type: 'terminator-sunset' } })

    const geojson: FeatureCollection = { type: 'FeatureCollection', features: features as any }

    const source = map.getSource(SOURCE_ID) as GeoJSONSource
    if (source) {
      source.setData(geojson)
    }
    else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'type'],
            'center',
            '#0d9488',
            'sunrise',
            '#f59e0b',
            'sunset',
            '#4f46e5',
            '#000000',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'azimuth-sunrise',
            '#f59e0b',
            'terminator-sunrise',
            '#f59e0b',
            'azimuth-sunset',
            '#4f46e5',
            'terminator-sunset',
            '#4f46e5',
            '#000000',
          ],
          'line-width': [
            'match',
            ['get', 'type'],
            ['azimuth-sunrise', 'azimuth-sunset'],
            2,
            ['terminator-sunrise', 'terminator-sunset'],
            2.5,
            2,
          ],
          'line-dasharray': [
            'match',
            ['get', 'type'],
            ['azimuth-sunrise', 'azimuth-sunset', 'terminator-sunrise', 'terminator-sunset'],
            ['literal', [2, 2]],
            ['literal', []],
          ],
          'line-opacity': [
            'match',
            ['get', 'type'],
            ['terminator-sunrise', 'terminator-sunset'],
            0.75,
            1,
          ],
        },
      })
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'text'],
        layout: {
          'text-field': ['get', 'text'],
          'text-size': 16,
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-line-height': 1.2,
        },
        paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
      })
    }
  }

  function removeMapLayers() {
    const map = mapInstance.value
    if (!map) {
      return
    }

    ;[LABEL_LAYER_ID, LINE_LAYER_ID, POINT_LAYER_ID].forEach((id) => {
      if (map.getLayer(id))
        map.removeLayer(id)
    })

    if (map.getSource(SOURCE_ID))
      map.removeSource(SOURCE_ID)
  }

  async function calculateAstroInfo(lat: number, lon: number) {
    isLoading.value = true
    astroInfo.value = null
    calculationError.value = null

    try {
      const toi = createTimeOfInterest.fromCurrentTime()
      const location = createLocation(lat, lon)
      const sun = createSun(toi)
      const sunriseToi = await sun.getRiseUpperLimb(location)
      const sunsetToi = await sun.getSetUpperLimb(location)
      const solarNoonToi = await sun.getTransit(location)
      const sunAtSunrise = createSun(sunriseToi)
      const sunAtSunset = createSun(sunsetToi)
      const sunriseCoords = await sunAtSunrise.getApparentTopocentricHorizontalCoordinates(location)
      const sunsetCoords = await sunAtSunset.getApparentTopocentricHorizontalCoordinates(location)

      const currentPoint = { lng: lon, lat }
      const [sunriseLineCoords, sunsetLineCoords] = await Promise.all([
        calculateTerminatorLine(sunriseToi, 'rise', currentPoint),
        calculateTerminatorLine(sunsetToi, 'set', currentPoint),
      ])

      astroInfo.value = {
        sunriseAzimuth: sunriseCoords.azimuth,
        sunsetAzimuth: sunsetCoords.azimuth,
        sunriseTime: dayjs(sunriseToi.getDate()).format('HH:mm:ss'),
        sunsetTime: dayjs(sunsetToi.getDate()).format('HH:mm:ss'),
        solarNoonTime: dayjs(solarNoonToi.getDate()).format('HH:mm:ss'),
      }

      updateMapLayers(
        { lng: lon, lat },
        { azimuth: astroInfo.value.sunriseAzimuth, time: astroInfo.value.sunriseTime },
        { azimuth: astroInfo.value.sunsetAzimuth, time: astroInfo.value.sunsetTime },
        { sunrise: sunriseLineCoords, sunset: sunsetLineCoords },
      )
    }
    catch (e) {
      console.error('天文信息计算失败:', e)
      calculationError.value = '无法计算该位置的信息，可能处于极昼或极夜。'
      astroInfo.value = null
      removeMapLayers()
    }
    finally {
      isLoading.value = false
    }
  }

  async function handleMapClick(event: MapMouseEvent) {
    const { lng, lat } = event.lngLat
    selectedPoint.value = { lng, lat }
    await calculateAstroInfo(lat, lng)
  }

  function handleStyleLoad() {
    if (selectedPoint.value)
      calculateAstroInfo(selectedPoint.value.lat, selectedPoint.value.lng)
  }

  function bindEvents() {
    const map = mapInstance.value
    if (!map)
      return
    map.on('click', handleMapClick)
    map.on('style.load', handleStyleLoad)
  }

  function unbindEvents() {
    const map = mapInstance.value
    if (!map)
      return
    map.off('click', handleMapClick)
    map.off('style.load', handleStyleLoad)
  }

  function activate() {
    isActive.value = true
    if (isMapLoaded.value)
      bindEvents()
  }

  function deactivate() {
    isActive.value = false
    unbindEvents()
    if (!isPinned.value)
      clearResult()
  }

  function clearResult() {
    selectedPoint.value = null
    astroInfo.value = null
    calculationError.value = null
    isPinned.value = false
    removeMapLayers()
  }

  watch(isMapLoaded, (loaded) => {
    if (loaded && isActive.value)
      bindEvents()
  })

  onUnmounted(() => {
    unbindEvents()
    removeMapLayers()
  })

  return {
    isActive,
    isPinned,
    isLoading,
    selectedPoint,
    calculationError,
    astroInfo,
    activate,
    deactivate,
    clearResult,
  }
}
