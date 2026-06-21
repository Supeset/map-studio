import { appDescription } from './app/constants/index'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/eslint',
  ],

  ssr: false,

  imports: {
    // Nuxt 默认只扫描 composables/ 顶层,显式纳入子目录
    dirs: ['~/composables/rocket'],
  },

  devtools: {
    enabled: false,
  },
  app: {
    head: {
      link: [
        { rel: 'icon', href: '/512.png', sizes: 'any' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: 'white' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#222222' },
      ],
    },
  },

  css: [
    'mapbox-gl/dist/mapbox-gl.css',
    '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css',
  ],

  colorMode: {
    classSuffix: '',
  },

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: '2024-08-14',

  nitro: {
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
  },
  vite: {
    optimizeDeps: {
      include: [
        '@mapbox/mapbox-gl-draw',
        'astronomy-bundle/earth', // CJS
        'astronomy-bundle/sun', // CJS
        'astronomy-bundle/time', // CJS
        'dayjs', // CJS
        'gcoord',
        'mapbox-gl', // CJS
      ],
    },
  },
  eslint: {
    config: {
      standalone: false,
      nuxt: {
        sortConfigKeys: true,
      },
    },
  },

})
