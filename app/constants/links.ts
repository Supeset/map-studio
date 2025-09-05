interface ExternalLink {
  name: string
  url: string
  icon: string
}

export const externalLinks: ExternalLink[] = [
  {
    name: '美国地震局',
    url: 'https://earthquake.usgs.gov/earthquakes/map/',
    icon: 'i-carbon-activity',
  },
  {
    name: '太阳方向角',
    url: 'https://hinode.pics/lang/zh-Hans/maps/sun',
    icon: 'i-carbon-sun',
  },
  {
    name: '火烧云分析',
    url: 'https://sunsetbot.top/map/',
    icon: 'i-carbon-cloud',
  },
  {
    name: 'ZoomEarth',
    url: 'https://zoom.earth/',
    icon: 'i-carbon-zoom-in',
  },
  {
    name: 'Windy',
    url: 'https://www.windy.com/',
    icon: 'i-carbon-windy',
  },
  {
    name: '谷歌台风',
    url: 'https://deepmind.google.com/science/weatherlab',
    icon: 'i-carbon-windy',
  },
  {
    name: 'Shp文件下载',
    url: 'https://github.com/Supeset/China-GeoData',
    icon: 'i-carbon-document-download',
  },
  {
    name: '光污染',
    url: 'https://lightpollutionmap.app/',
    icon: 'i-carbon-light',
  },
  {
    name: '骑行路线编辑',
    url: 'https://gpx.studio/',
    icon: 'i-carbon-bicycle',
  },
]
