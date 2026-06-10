# Map Studio 万物分享

Map Studio 是一个基于 **Nuxt** 构建的现代 Web 地图工具箱。它集成了多种实用的地理信息工具，旨在提供流畅、美观且高效的地图交互体验。

[![Netlify Status](https://api.netlify.com/api/v1/badges/39f7dd8b-2720-4080-849a-79f3644f47ba/deploy-status)](https://app.netlify.com/projects/map-studio/deploys)

## ✨ 主要功能

### 🛠️ 绘图工坊 (Draw)

类似 geojson.io 的轻量级 GeoJSON 编辑器。

- **在线绘制**：支持绘制点、线、面（多边形），并可自定义颜色、透明度等属性。
- **URL 分享**：支持将绘制的 GeoJSON 数据压缩并嵌入 URL，实现**一键复制分享**给他人，打开链接即可还原地图视野与数据。
- **数据管理**：提供 GeoJSON 源码查看与复制功能。

### 📍 坐标转换 (Coords)

针对中国地图环境的专业坐标转换工具。

- **多系支持**：支持 **WGS84 (GPS)**、**GCJ02 (火星坐标)**、**BD09 (百度坐标)** 之间的相互转换。
- **智能解析**：支持 Spotlight 风格的搜索框，智能识别输入的经纬度格式。
- **可视化**：在地图上直观展示坐标点位置，区分核心点与光晕效果。

### ☀️ 天文工具 (Astro)

基于地理位置的实时天文信息计算。

- **日出日落**：计算并展示精确的日出、日落时间及方位角。
- **晨昏线**：在地图上绘制实时的昼夜分界线（Terminator Line）。
- **太阳轨迹**：可视化太阳在地图上的照射方向。

### 🚀 火箭发射点 (Rocket)

全球火箭发射场可视化。

- **聚合显示**：海量数据点聚合渲染，点击簇可自动缩放。
- **详细信息**：点击发射点可查看发射场名称、位置及维基百科链接。

## 🎨 UI 与体验

- **响应式设计**：完美适配桌面端与移动端。
- **深色模式**：内置明亮/暗黑模式切换，地图底图随之自动切换。
- **底图切换**：支持 Mapbox 多种风格底图（街道、卫星、户外、黑夜等）。
- **工具箱**：集成了常用外部地图工具链接（如 Windy, ZoomEarth, 强光污染地图等）。

## 🛠 技术栈

- **核心框架**: [Nuxt](https://nuxt.com/) (Vue + TypeScript)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式方案**: [UnoCSS](https://unocss.dev/) (Atomic CSS)
- **地图引擎**: [Mapbox GL JS](https://www.mapbox.com/mapbox-gl-js)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **工具库**:
  - `@mapbox/mapbox-gl-draw`: 绘图控件
  - `gcoord`: 坐标系转换
  - `astronomy-bundle`: 天文算法
  - `@vueuse/core`: Vue 组合式 API 工具集

## 🚀 快速开始

### 1. 环境准备

确保你的本地环境已安装 [Node.js](https://nodejs.org/) 和 [pnpm](https://pnpm.io/)。

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置 Mapbox Token

项目中的 Mapbox Access Token 目前配置在 `app/composables/map.ts` 中。
为了正常加载地图，请确保 Token 有效，或替换为你自己的 Token。

```typescript
// app/composables/map.ts
const accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 即可查看效果。

### 5. 构建生产版本

```bash
pnpm build
# 预览构建产物
pnpm preview
```

## 📂 目录结构

```text
app/
├── components/      # Vue 组件 (UI, 地图控件等)
├── composables/     # 组合式函数 (Map Store, 状态逻辑)
├── constants/       # 常量定义 (链接, 应用配置)
├── layouts/         # 页面布局
├── pages/           # 页面路由 (Nuxt 自动路由)
│   ├── astro.vue    # 天文页
│   ├── coords.vue   # 坐标转换页
│   ├── draw.vue     # 绘图工坊页
│   ├── index.vue    # 首页
│   └── rocket.vue   # 火箭发射点页
└── app.vue          # 应用入口
```

## 📄 License

MIT License
