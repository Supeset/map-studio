import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map } from 'mapbox-gl'
import type { LandingSite } from '~/components/rocket/LandingListPanel.vue'
import type { EnrichedPad } from '~/components/rocket/ListPanel.vue'
import mapboxgl from 'mapbox-gl'

export function useRocketTool(mapInstance: Ref<Map | undefined>, isMapLoaded: Ref<boolean>) {
  const PADS_SOURCE_ID = 'pads-source'
  const PADS_CLUSTER_ID = 'pads-clusters'
  const PADS_COUNT_ID = 'pads-cluster-count'
  const PADS_POINT_ID = 'pads-point'
  const PADS_LABEL_ID = 'pads-label'

  const LANDING_SOURCE_ID = 'landing-source'
  const LANDING_CLUSTER_ID = 'landing-clusters'
  const LANDING_COUNT_ID = 'landing-cluster-count'
  const LANDING_POINT_ID = 'landing-point'
  const LANDING_LABEL_ID = 'landing-label'

  const { data: rawPads } = useFetch<EnrichedPad[]>('/rocket/enriched_locations.json')
  const padsData = computed(() => rawPads.value || [])

  const { data: rawLanding } = useFetch<LandingSite[]>('/rocket/landing_sites.json')

  const landingData = computed(() => {
    if (!rawLanding.value)
      return []
    return rawLanding.value.map((site) => {
      let { latitude, longitude } = site
      if (Math.abs(latitude) > 90) {
        const temp = latitude
        latitude = longitude
        longitude = temp
      }
      return { ...site, latitude, longitude }
    })
  })

  const padsGeoJSON = computed<FeatureCollection | null>(() => {
    if (!padsData.value.length)
      return null
    return {
      type: 'FeatureCollection',
      features: padsData.value.map(pad => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pad.longitude, pad.latitude] },
        properties: { ...pad, type: 'launch' },
      })),
    }
  })

  const landingGeoJSON = computed<FeatureCollection | null>(() => {
    if (!landingData.value.length)
      return null
    return {
      type: 'FeatureCollection',
      features: landingData.value.map(site => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
        properties: { ...site, type: 'landing' },
      })),
    }
  })

  let currentPopup: mapboxgl.Popup | null = null

  function showPopup(properties: any, coordinates: [number, number], type: 'launch' | 'landing') {
    const map = mapInstance.value
    if (!map)
      return

    if (currentPopup)
      currentPopup.remove()

    const center = map.getCenter()
    let lng = coordinates[0]
    if (center) {
      while (Math.abs(center.lng - lng) > 180) {
        lng += center.lng > lng ? 360 : -360
      }
    }

    let html = ''
    if (type === 'launch') {
      const pad = properties as EnrichedPad
      html = `
        <div class="p-3 min-w-[240px]">
          <h3 class="font-bold text-base mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            ${pad.name}
            <span class="text-xs font-normal px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-100 dark:border-teal-800">发射场</span>
          </h3>
          <div class="text-xs text-gray-500 mb-2">${pad.country}</div>
          <div class="space-y-1 text-sm">
            <p class="text-teal-700 font-medium dark:text-teal-400">${pad.launch_center}</p>
            <p class="text-gray-500 text-xs dark:text-gray-400">${pad.location_name_en}</p>
            <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center text-xs text-gray-400 font-mono">
              <div class="i-carbon-location mr-1"></div>
              ${Number(pad.latitude).toFixed(4)}, ${Number(pad.longitude).toFixed(4)}
            </div>
          </div>
        </div>
      `
    }
    else {
      const site = properties as LandingSite
      html = `
        <div class="p-3 min-w-[240px]">
          <h3 class="font-bold text-base mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            ${site.name}
            <span class="text-xs font-normal px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-100 dark:border-purple-800">回收场</span>
          </h3>
          <div class="text-xs text-gray-500 mb-2">${site.country}</div>
          <div class="space-y-1 text-sm">
            <p class="text-purple-700 font-medium dark:text-purple-400">${site.decription}</p>
            <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center text-xs text-gray-400 font-mono">
              <div class="i-carbon-location mr-1"></div>
              ${Number(site.latitude).toFixed(4)}, ${Number(site.longitude).toFixed(4)}
            </div>
          </div>
        </div>
      `
    }

    currentPopup = new mapboxgl.Popup({
      closeButton: false,
      maxWidth: '320px',
      className: 'rocket-popup',
      offset: 15,
    })
      .setLngLat([lng, coordinates[1]])
      .setHTML(html)
      .addTo(map)
  }

  function handleSelectPad(pad: EnrichedPad) {
    const map = mapInstance.value
    if (!map)
      return
    map.flyTo({ center: [pad.longitude, pad.latitude], zoom: 12, speed: 1.5 })
    showPopup(pad, [pad.longitude, pad.latitude], 'launch')
  }

  function handleSelectLanding(site: LandingSite) {
    const map = mapInstance.value
    if (!map)
      return
    map.flyTo({ center: [site.longitude, site.latitude], zoom: 12, speed: 1.5 })
    showPopup(site, [site.longitude, site.latitude], 'landing')
  }

  function addClusterLayers(
    map: Map,
    sourceId: string,
    layerIds: { cluster: string, count: string, point: string, label: string },
    color: string,
    labelField: string,
  ) {
    if (!map.getLayer(layerIds.cluster)) {
      map.addLayer({
        id: layerIds.cluster,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': color,
          'circle-opacity': 0.6,
          'circle-radius': ['step', ['get', 'point_count'], 15, 5, 20, 10, 25],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })
    }

    if (!map.getLayer(layerIds.count)) {
      map.addLayer({
        id: layerIds.count,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Din Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })
    }

    if (!map.getLayer(layerIds.point)) {
      map.addLayer({
        id: layerIds.point,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': color,
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })
    }

    if (!map.getLayer(layerIds.label)) {
      map.addLayer({
        id: layerIds.label,
        type: 'symbol',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        minzoom: 5,
        layout: {
          'text-field': ['get', labelField],
          'text-font': ['Din Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 1.2,
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })
    }
  }

  function setupEvents() {
    const map = mapInstance.value
    if (!map)
      return

    const handleClusterClick = (e: any, sourceId: string) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [e.features[0].layer.id] })
      const clusterId = features[0]!.properties?.cluster_id
      const source = map.getSource(sourceId) as GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err)
          return
        map.easeTo({
          center: (features[0]!.geometry as any).coordinates,
          zoom: zoom ?? 14,
        })
      })
    }

    map.on('click', PADS_CLUSTER_ID, e => handleClusterClick(e, PADS_SOURCE_ID))
    map.on('click', LANDING_CLUSTER_ID, e => handleClusterClick(e, LANDING_SOURCE_ID))

    map.on('click', PADS_POINT_ID, (e) => {
      if (!e.features?.[0])
        return
      const coords = (e.features[0].geometry as any).coordinates.slice()
      const props = e.features[0].properties
      showPopup(props, coords, 'launch')
    })

    map.on('click', LANDING_POINT_ID, (e) => {
      if (!e.features?.[0])
        return
      const coords = (e.features[0].geometry as any).coordinates.slice()
      const props = e.features[0].properties
      showPopup(props, coords, 'landing')
    })

    const interactiveLayers = [PADS_CLUSTER_ID, PADS_POINT_ID, LANDING_CLUSTER_ID, LANDING_POINT_ID]
    interactiveLayers.forEach((layer) => {
      map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer')
      map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '')
    })
  }

  function initLayers() {
    const map = mapInstance.value
    if (!map)
      return

    if (padsGeoJSON.value && !map.getSource(PADS_SOURCE_ID)) {
      map.addSource(PADS_SOURCE_ID, {
        type: 'geojson',
        data: padsGeoJSON.value,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
      })
      addClusterLayers(
        map,
        PADS_SOURCE_ID,
        { cluster: PADS_CLUSTER_ID, count: PADS_COUNT_ID, point: PADS_POINT_ID, label: PADS_LABEL_ID },
        '#0d9488',
        'name',
      )
    }

    if (landingGeoJSON.value && !map.getSource(LANDING_SOURCE_ID)) {
      map.addSource(LANDING_SOURCE_ID, {
        type: 'geojson',
        data: landingGeoJSON.value,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
      })
      addClusterLayers(
        map,
        LANDING_SOURCE_ID,
        { cluster: LANDING_CLUSTER_ID, count: LANDING_COUNT_ID, point: LANDING_POINT_ID, label: LANDING_LABEL_ID },
        '#9333ea',
        'name',
      )
    }

    setupEvents()
  }

  function handleStyleLoad() {
    initLayers()
  }

  function removeLayers() {
    const map = mapInstance.value
    if (!map)
      return

    if (currentPopup)
      currentPopup.remove()

    const layersToRemove = [
      PADS_COUNT_ID,
      PADS_CLUSTER_ID,
      PADS_LABEL_ID,
      PADS_POINT_ID,
      LANDING_COUNT_ID,
      LANDING_CLUSTER_ID,
      LANDING_LABEL_ID,
      LANDING_POINT_ID,
    ]
    layersToRemove.forEach(id => map.getLayer(id) && map.removeLayer(id))

    if (map.getSource(PADS_SOURCE_ID))
      map.removeSource(PADS_SOURCE_ID)
    if (map.getSource(LANDING_SOURCE_ID))
      map.removeSource(LANDING_SOURCE_ID)
  }

  watch(isMapLoaded, (loaded) => {
    if (loaded && mapInstance.value) {
      initLayers()
      mapInstance.value.on('style.load', handleStyleLoad)
    }
  }, { immediate: true })

  onUnmounted(() => {
    if (mapInstance.value) {
      mapInstance.value.off('style.load', handleStyleLoad)
    }
    removeLayers()
  })

  return {
    padsData,
    landingData,
    handleSelectPad,
    handleSelectLanding,
  }
}
