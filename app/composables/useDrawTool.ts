import type { Feature, FeatureCollection } from 'geojson'
import type { IControl, Map } from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import mapboxgl from 'mapbox-gl'
import { DRAW_STORAGE_KEY, drawStyles } from '~/constants/draw'

function extendBoundsWithCoords(bounds: mapboxgl.LngLatBounds, coords: any) {
  if (Array.isArray(coords)) {
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      bounds.extend(coords as [number, number])
    }
    else {
      coords.forEach(c => extendBoundsWithCoords(bounds, c))
    }
  }
}

function getFeatureBounds(feature: Feature): mapboxgl.LngLatBounds | null {
  if (!feature.geometry || !('coordinates' in feature.geometry))
    return null
  const bounds = new mapboxgl.LngLatBounds()
  extendBoundsWithCoords(bounds, (feature.geometry as any).coordinates)
  return bounds.isEmpty() ? null : bounds
}

export function useDrawTool(mapInstance: Ref<Map | undefined>, isMapLoaded: Ref<boolean>) {
  const drawInstance = shallowRef<MapboxDraw | null>(null)
  const savedFeatures = useLocalStorage(DRAW_STORAGE_KEY, {
    type: 'FeatureCollection',
    features: [],
  } as FeatureCollection)

  const selectedFeatureId = ref<string | null>(null)
  const selectedFeatureProps = ref<Record<string, any>>({})
  const currentMode = ref<string>('simple_select')

  function initDraw() {
    if (!mapInstance.value || drawInstance.value)
      return

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      userProperties: true,
      styles: drawStyles as any,
      modes: MapboxDraw.modes as any,
    })

    mapInstance.value.addControl(draw as unknown as IControl, 'top-left')
    drawInstance.value = draw

    const route = useRoute()
    const urlData = route.query.data as string
    let isLoadedFromUrl = false

    if (urlData) {
      try {
        let jsonStr = urlData
        const prefix = 'data:application/json,'
        if (jsonStr.startsWith(prefix)) {
          jsonStr = jsonStr.slice(prefix.length)
        }

        let parsed
        try {
          parsed = JSON.parse(jsonStr)
        }
        catch {
          parsed = JSON.parse(decodeURIComponent(jsonStr))
        }

        let collection: FeatureCollection | null = null

        if (parsed.type === 'FeatureCollection') {
          collection = parsed
        }
        else if (parsed.type === 'Feature') {
          collection = { type: 'FeatureCollection', features: [parsed] }
        }
        else if (parsed.coordinates || parsed.geometries) {
          collection = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: parsed, properties: {} } as Feature],
          }
        }

        if (collection && collection.features.length > 0) {
          savedFeatures.value = collection
          draw.set(collection)
          isLoadedFromUrl = true

          const bounds = new mapboxgl.LngLatBounds()
          collection.features.forEach((f: Feature) => {
            if (f.geometry && 'coordinates' in f.geometry)
              extendBoundsWithCoords(bounds, f.geometry.coordinates)
          })

          if (!bounds.isEmpty())
            mapInstance.value.fitBounds(bounds, { padding: 100, maxZoom: 15 })
        }
      }
      catch (e) {
        console.error('Failed to load GeoJSON from URL:', e)
      }
    }

    if (!isLoadedFromUrl && savedFeatures.value && savedFeatures.value.features.length > 0) {
      draw.set(savedFeatures.value)
    }

    const map = mapInstance.value
    map.on('draw.create', updateStorage)
    map.on('draw.delete', updateStorage)
    map.on('draw.update', updateStorage)
    map.on('draw.selectionchange', handleSelectionChange)
    map.on('draw.modechange', (e: any) => {
      currentMode.value = e.mode
    })
  }

  function updateStorage() {
    if (!drawInstance.value)
      return
    const data = drawInstance.value.getAll()
    savedFeatures.value = data
  }

  function handleSelectionChange(e: any) {
    if (e.features.length > 0) {
      const feature = e.features[0] as Feature
      selectedFeatureId.value = feature.id as string
      selectedFeatureProps.value = { ...feature.properties }
    }
    else {
      selectedFeatureId.value = null
      selectedFeatureProps.value = {}
    }
  }

  function setDrawMode(mode: string) {
    if (!drawInstance.value)
      return
    drawInstance.value.changeMode(mode as any)
    currentMode.value = mode
  }

  function deleteSelected() {
    if (!drawInstance.value || !selectedFeatureId.value)
      return
    drawInstance.value.delete([selectedFeatureId.value])
    updateStorage()
    selectedFeatureId.value = null
  }

  function deleteFeature(id: string) {
    if (!drawInstance.value)
      return
    drawInstance.value.delete([id])
    updateStorage()
    if (selectedFeatureId.value === id) {
      selectedFeatureId.value = null
      selectedFeatureProps.value = {}
    }
  }

  function clearAll() {
    if (!drawInstance.value)
      return
    drawInstance.value.deleteAll()
    updateStorage()
    selectedFeatureId.value = null
    selectedFeatureProps.value = {}
  }

  function selectFeature(id: string) {
    if (!drawInstance.value)
      return
    drawInstance.value.changeMode('simple_select', { featureIds: [id] })
  }

  function focusFeature(id: string) {
    if (!mapInstance.value || !drawInstance.value)
      return
    const feat = drawInstance.value.get(id) as Feature | undefined
    if (!feat)
      return
    const bounds = getFeatureBounds(feat)
    if (!bounds)
      return
    if (feat.geometry?.type === 'Point') {
      mapInstance.value.flyTo({ center: bounds.getCenter(), zoom: 15 })
    }
    else {
      mapInstance.value.fitBounds(bounds, { padding: 100, maxZoom: 15 })
    }
  }

  function updateFeatureProperty(key: string, value: any) {
    if (!drawInstance.value || !selectedFeatureId.value)
      return
    drawInstance.value.setFeatureProperty(selectedFeatureId.value, key, value)
    selectedFeatureProps.value[key] = value
    updateStorage()
  }

  function removeProperty(key: string) {
    if (!drawInstance.value || !selectedFeatureId.value)
      return
    const feature = drawInstance.value.get(selectedFeatureId.value)
    if (feature && feature.properties) {
      delete feature.properties[key]
      drawInstance.value.add(feature)
      const newProps = { ...feature.properties }
      selectedFeatureProps.value = newProps
      updateStorage()
    }
  }

  function addDefaultStyles() {
    if (!drawInstance.value || !selectedFeatureId.value)
      return
    const feature = drawInstance.value.get(selectedFeatureId.value)
    if (!feature)
      return

    const type = feature.geometry.type
    const updates: Record<string, any> = {}

    if (type === 'Point') {
      updates['marker-color'] = '#ef4444'
      updates['marker-size-value'] = 8
    }
    else if (type === 'LineString') {
      updates.stroke = '#f59e0b'
      updates['stroke-width'] = 4
      updates['stroke-opacity'] = 0.8
    }
    else if (type === 'Polygon') {
      updates.fill = '#3b82f6'
      updates['fill-opacity'] = 0.4
      updates.stroke = '#2563eb'
      updates['stroke-width'] = 2
    }

    Object.entries(updates).forEach(([k, v]) => {
      updateFeatureProperty(k, v)
    })
  }

  const selectedTypeLabel = computed(() => {
    if (!selectedFeatureId.value || !drawInstance.value)
      return ''
    const feat = drawInstance.value.get(selectedFeatureId.value)
    return feat?.geometry.type || 'Unknown'
  })

  const selectedFeatureJson = computed(() => {
    if (selectedFeatureId.value && drawInstance.value) {
      const feat = drawInstance.value.get(selectedFeatureId.value)
      return JSON.stringify(feat, null, 2)
    }
    return null
  })

  function importGeoJson(text: string): { success: boolean, message: string } {
    if (!drawInstance.value) {
      return { success: false, message: '绘图工具未初始化' }
    }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    }
    catch {
      return { success: false, message: 'JSON 格式无效' }
    }

    let collection: FeatureCollection | null = null

    if (parsed.type === 'FeatureCollection') {
      collection = parsed
    }
    else if (parsed.type === 'Feature') {
      collection = { type: 'FeatureCollection', features: [parsed] }
    }
    else if (parsed.coordinates || parsed.geometries) {
      collection = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: parsed, properties: {} } as Feature],
      }
    }
    else {
      return { success: false, message: '无法识别的 GeoJSON 格式' }
    }

    if (!collection || !collection.features || collection.features.length === 0) {
      return { success: false, message: '没有有效的要素' }
    }

    const existing = drawInstance.value.getAll()
    const merged: FeatureCollection = {
      type: 'FeatureCollection',
      features: [...existing.features, ...collection.features],
    }
    drawInstance.value.set(merged)
    updateStorage()

    if (mapInstance.value) {
      const bounds = new mapboxgl.LngLatBounds()
      collection.features.forEach((f: Feature) => {
        if (f.geometry && 'coordinates' in f.geometry)
          extendBoundsWithCoords(bounds, f.geometry.coordinates)
      })
      if (!bounds.isEmpty())
        mapInstance.value.fitBounds(bounds, { padding: 100, maxZoom: 15 })
    }

    return { success: true, message: `成功导入 ${collection.features.length} 个要素` }
  }

  watch(isMapLoaded, (loaded) => {
    if (loaded) {
      initDraw()
    }
    else {
      drawInstance.value = null
    }
  })

  onUnmounted(() => {
    if (mapInstance.value && drawInstance.value) {
      const map = mapInstance.value
      map.off('draw.create', updateStorage)
      map.off('draw.delete', updateStorage)
      map.off('draw.update', updateStorage)
      map.off('draw.selectionchange', handleSelectionChange)
      map.removeControl(drawInstance.value as unknown as IControl)
    }
  })

  return {
    drawInstance,
    savedFeatures,
    selectedFeatureId,
    selectedFeatureProps,
    currentMode,
    selectedTypeLabel,
    selectedFeatureJson,
    setDrawMode,
    deleteSelected,
    deleteFeature,
    clearAll,
    selectFeature,
    focusFeature,
    updateFeatureProperty,
    removeProperty,
    addDefaultStyles,
    importGeoJson,
  }
}
