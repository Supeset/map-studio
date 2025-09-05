import type { Map } from 'mapbox-gl'
import { acceptHMRUpdate, defineStore } from 'pinia'

interface MapStyle {
  label: string
  styleName: string
  styleUrl: string
}

export const useMapStore = defineStore('map', () => {
  const mapInstance = shallowRef<Map>()
  const isMapLoaded = ref(false)

  const accessToken = 'pk.eyJ1IjoibGFuc2VyaWEiLCJhIjoiY2wxMGo5ZWk3MTF3dTNkcnRwcDMyMXowOSJ9.kxLDvTThtaU0uiBOXanNvA'

  const mapStyles = ref<MapStyle[]>([
    {
      label: '街道',
      styleName: 'Streets',
      styleUrl: 'mapbox://styles/lanseria/clhluh3n100kq01r87c9deet0',
    },
    {
      label: '简白',
      styleName: 'Monochrome',
      styleUrl: 'mapbox://styles/lanseria/cldwdod87000e01pcn2ezak1n',
    },
    {
      label: '卫星',
      styleName: 'Satellite Streets',
      styleUrl: 'mapbox://styles/lanseria/cldecwoux001t01pk90yx1jj3',
    },
    {
      label: '户外',
      styleName: 'Outdoors',
      styleUrl: 'mapbox://styles/lanseria/cljhxduex000701p74upy4dge',
    },
    {
      label: '黑夜',
      styleName: 'Navigation',
      styleUrl: 'mapbox://styles/lanseria/cljno22rw00g401qwgerpdhb7',
    },
    {
      label: '天气',
      styleName: 'Weather',
      styleUrl: 'mapbox://styles/lanseria/cljpa0eny00qx01pm0cxka7xo',
    },
  ])

  const activeMapStyle = ref<MapStyle>(mapStyles.value[0]!)

  function setMapInstance(map: Map) {
    mapInstance.value = map
  }

  function setMapLoaded(isLoaded: boolean) {
    isMapLoaded.value = isLoaded
  }

  function switchMapStyle(style: MapStyle) {
    if (mapInstance.value) {
      activeMapStyle.value = style
      mapInstance.value.setStyle(style.styleUrl)
    }
  }

  return {
    mapInstance,
    isMapLoaded,
    accessToken,
    mapStyles,
    activeMapStyle,
    setMapInstance,
    setMapLoaded,
    switchMapStyle,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useMapStore, import.meta.hot))
