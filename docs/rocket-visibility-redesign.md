# 火箭可见区域 · 重新设计

> 模块: `app/composables/useRocketVisibility.ts` + `app/components/rocket/VisibilityPanel.vue`
> 目标: 对现有「火箭可见区域」功能做**全面重构**,围绕四条主轴——**精简两步交互、物理弹道方程、时间维度动画、热力可见包络**——重做整个模块。
> 文档定位: 方案设计与技术实现并重,可直接据此落地。

---

## 一、现状与痛点

### 1.1 现有实现概览

| 维度 | 现状 | 文件 |
| --- | --- | --- |
| 算法 | 几何可见性 `d = √(2·R_eff·h)`(地球曲率 + 7/6 大气折射);高度用分段对数插值 | `useRocketVisibility.ts` |
| 交互 | 四步状态机:`idle → select-pad → select-polygon → result` | `VisibilityPanel.vue` |
| 输入 | 发射场图标点击 + 用户绘制的「落区面」多边形(支持多选) | `index.vue` |
| 参数 | 全局最大可见半径(200–3000 km)+ 每个落区独立飞行高度(0–500 km) | `VisibilityPanel.vue` |
| 渲染 | 离散可见圆(沿主轨迹采样)+ 单条大圆轨迹线 + 发射点/落区标记点 | `renderLayers()` |
| 时间 | 飞行时间恒为常量 `ROCKET_TOTAL_TIME_MIN = 8`,不可调、无动画 | `constants/rocket.ts` |

### 1.2 痛点诊断

1. **交互繁琐且反直觉**。四步流程中,要求用户先「绘制落区面」再逐个设置每个面的飞行高度,认知负担高;落区面与「火箭飞到哪」之间缺乏物理对应关系。
2. **缺少时间维度**。火箭飞行是一个动态过程,地面可见范围随火箭位置/高度实时变化;现有方案只在一条静态主轨迹上撒离散圆,无法回答「T+3:24 时哪些区域可见」。
3. **高度模型过于简化**。对数插值是经验拟合,没有速度/过载/动压,无法体现「垂直起飞 → 程序转弯 → 重力转向 → 顶点缓升 → 落下」的真实弹道形状。
4. **可见性模型粗糙**。只算了几何可见距离,忽略了大气能见度上限、观测者仰角(仰角越低越难被肉眼发现)、地形遮挡。
5. **可视化信息密度低**。离散圆 + 0.04 透明度填充,「能不能看到、看得多清楚」无法区分,结果图缺乏层次。

---

## 二、设计目标(四主轴)

```
┌──────────────────────────────────────────────────────────┐
│                    火箭可见区域 v2                          │
├──────────────────────────────────────────────────────────┤
│  ① 精简两步交互   发射点 → 落点,预设驱动,零绘制              │
│  ② 物理弹道方程   重力转向 + 阻力,输出 v / a / q 曲线        │
│  ③ 时间维度动画   时间轴拖拽,可见区域随飞行实时演变           │
│  ④ 热力可见包络   连续 capsule 包络 + 可见性热力梯度          │
└──────────────────────────────────────────────────────────┘
```

- **① 交互**: 从「四步 + 绘制落区面」压缩为「发射点 → 落点」两步,火箭型号用预设选择,落点可来自回收场数据 / 发射场数据 / 任意点击 / 坐标输入。
- **② 弹道**: 提供两层模型——L1 经验参数化(默认,毫秒级)、L2 质点运动方程积分(可选,专业模式)。
- **③ 动画**: 预计算整条弹道的离散采样,时间轴驱动当前时刻,地图上的「火箭位置点 + 可见圆」随之移动与膨胀/收缩。
- **④ 可视化**: 用连续的 **capsule 包络**(轨迹两端圆 + 外公切线)替代离散圆;在包络内叠加 **可见性热力梯度**(近且高仰角 = 清晰,远且低仰角 = 模糊)。

---

## 三、产品概念与交互

### 3.1 新交互流程(两步 + 预设)

```
┌─ 步骤 1:发射点 ──────────────────────────────────────────┐
│  点击地图发射场图标  /  从「全球发射场」列表选择  /          │
│  输入经纬度                                                │
│                                                          │
│  选中后高亮,自动进入步骤 2                                 │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ 步骤 2:落点 + 预设 ────────────────────────────────────┐
│  落点:点击回收场图标 / 列表选择 / 地图任意点击 / 坐标输入    │
│  预设:[▾ CZ-5]  → 自动填入 Hmax / T / 弹道类型             │
│                                                          │
│  ▶ 立即生成:弹道轨迹 + 可见包络 + 时间轴                   │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ 结果态:时间轴 + 参数微调 ───────────────────────────────┐
│  ⏱ 时间轴 0:00 ────●────── 8:00   ▶播放  ⏸暂停           │
│  高级: Hmax / T / 大气能见度 / 阻力系数 滑块                │
│  操作: 重选发射点 · 重选落点 · 导出 GeoJSON · 清除          │
└──────────────────────────────────────────────────────────┘
```

> **关键取舍**: 取消「绘制落区面 + 每面设高度」。落区面在新模型里语义模糊(一个面如何对应一条弹道的一个时刻?)。改为**单主落点**驱动整条弹道;若需多级火箭的助推器落点,作为增强项「落点序列」单独提供(见 §9)。

### 3.2 时间轴 UX

```
T+0:00 ────────●────────────────── T+8:00     速度 ─────╮
          ▲ 当前 T+3:24                              顶点 │ 高度 180 km │
         高度 180 km · 速度 1.2 km/s              ▼     │ 可见半径 480 km│
                                                        ────────────╯
  [▶ 播放]  [⏸]  速度 0.5× 1× 2×   [跳到顶点]  [跳到入轨]
```

- 时间轴直接绑定当前飞行时刻 `t`,拖动即更新地图(火箭位置、高度、可见圆、热力)。
- 顶点(apogee)、落点、发射时刻作为可点击的刻度锚点。
- 播放用 `requestAnimationFrame` 驱动,支持 0.5× / 1× / 2× 倍速。

### 3.3 火箭预设

把火箭性能参数化,用户选型号即得一组默认值,降低手动调参门槛:

```ts
// app/constants/rocket-presets.ts
export interface RocketPreset {
  id: string
  name: string                // CZ-5 / Falcon-9 / Starship
  category: 'orbital' | 'suborbital' | 'heavy'
  /** 最大飞行高度 km(顶点) */
  maxAltitudeKm: number
  /** 总飞行时间 min */
  flightTimeMin: number
  /** 弹道形状:垂直起飞占比、顶点缓升系数等 */
  profile: TrajectoryProfile
  /** 简化比冲/推重比,供 L2 运动方程使用 */
  thrustToWeight?: number
  /** 大气能见度上限 km(默认 20,雾天可调小) */
  atmosphericVisibilityKm?: number
}
```

内置若干型号(`CZ-5`、`Falcon-9`、`Starship`、`通用亚轨道`),也保留「自定义」档位手动填参数。

---

## 四、物理与算法

### 4.1 弹道模型(L1 经验参数化 · 默认)

火箭弹道沿大圆平面展开,水平距离 `s ∈ [0, L]`,高度 `h(s)` 用**三段曲线**拟合真实形状,取代现有的单条对数曲线:

```
高度 h
  ↑
  │            ╭─────── 顶点段(平缓)
  │          ╱
  │        ╱  爬升段(陡峭,程序转弯)
  │      ╱
  │    ╱
  │  ╱  起飞段(近垂直)
  │╱
  └──────────────────────────────→ 水平距离 s
  0     s1        s2             L(落点)
```

- **起飞段** `[0, s1]`: 近垂直爬升,高度线性陡升。
- **爬升段** `[s1, s2]`: 重力转向,凹形对数曲线。
- **顶点/下降段** `[s2, L]`: 抛物线下落至落点高度。

```ts
// 伪代码:三段高度函数
function altitudeAt(s: number, p: TrajectoryProfile, L: number, Hmax: number): number {
  const s1 = L * p.climbStart   // 例 0.08
  const s2 = L * p.apogeeStart  // 例 0.55
  if (s <= s1) return Hmax * p.liftoffFrac * (s / s1)
  if (s <= s2) {
    const τ = (s - s1) / (s2 - s1)
    const k = ROCKET_LOG_K
    return Hmax * (p.liftoffFrac + (1 - p.liftoffFrac) * Math.log(1 + k * τ) / Math.log(1 + k))
  }
  // 下降段:抛物线,从 Hmax 落到 0(或落点残存高度)
  const τ = (s - s2) / (L - s2)
  return Hmax * (1 - τ * τ)
}
```

水平位置沿发射点→落点的大圆均匀展开(必要时按程序段微调,使顶点出现在 `s2`)。

### 4.2 弹道模型(L2 质点运动方程 · 专业模式,可选)

2D 质点弹道,在「高度-水平距离」平面数值积分,输出真实曲线与派生量:

```
状态向量 X = [s, h, vs, vh]   (水平距、高度、水平速、垂直速)

控制律(重力转向 Gravity Turn):
  攻角 → 速度方向逐步对齐当地水平

微分方程:
  ṡ = vs
  ḣ = vh
  v̇s = (T·cos θ - D·cos γ) / m        θ: 推力方向角
  v̇h = (T·sin θ - D·sin γ) / m - g(h) γ: 速度方向角
  D  = ½ ρ(h) v² Cd A                  大气密度 ρ(h) 指数衰减
  ṁ = -T / (Isp · g0)                  质量随推进剂消耗下降
```

积分用 RK4,步长 ~1 s。输出每个时刻的 `v / |a|(过载) / q(动压)`,供剖面图与数据卡展示。

> L2 工作量明显大于 L1。建议**先交付 L1 + 时间动画 + 热力包络**,L2 作为后续迭代。两者共用同一套时间采样接口,切换无侵入。

### 4.3 可见性模型

把现有单一几何公式升级为「几何可见 ∩ 大气能见度 ∩ 仰角加权」:

| 因子 | 公式 | 说明 |
| --- | --- | --- |
| 几何可见距离 | `d_geo = √(2·R_eff·h)`,`R_eff = 7/6·R⊕` | 沿用现有,改名为「几何上限」 |
| 大气能见度上限 | `d_atm = min(d_geo, V_atm · k)` | `V_atm` 气象能见度,`k` 经验系数 |
| 有效可见半径 | `d_eff = min(d_geo, d_atm)` | 实际绘制用 |
| 观测者仰角 | `e = atan((h - d²/(2R_eff)) / d)` | 地面观测者看火箭的仰角 |
| 可见清晰度评分 | `score = clamp(e / e_max, 0, 1) · decay(d)` | 驱动热力梯度颜色 |

```ts
// 观测者仰角:地面点 P 到飞行中火箭的仰角(球面近似)
function elevationAngle(rocketH_km: number, groundDist_km: number): number {
  if (groundDist_km <= 0) return Math.PI / 2
  const R = EARTH_EFFECTIVE_RADIUS_KM
  // 视线高度修正(地球曲率遮挡部分高度)
  const hidden = (groundDist_km * groundDist_km) / (2 * R)
  const visibleH = Math.max(rocketH_km - hidden, 0)
  return Math.atan2(visibleH, groundDist_km)
}
```

### 4.4 热力可见包络

**核心洞察**: 轨迹是一条直线/大圆,可见圆沿轨迹扫描——其外轮廓就是经典的 **capsule(胶囊形)**:两端各一个圆 + 两条外公切线。这让我们可以**解析地**得到连续包络,无需 union 布尔运算。

```
        ╭────────── 最大可见圆(顶点处) ──────────╮
       ╱ ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲ ╲
      ╱ │  外公切线                         切线 │  ╲
     ●━━┷━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┷━━●
   发射点  ←─────── 轨迹大圆 ───────────────────→  落点
```

包络内的**热力梯度**用一条垂直于轨迹的「剖面」计算:对轨迹两侧每个偏移距离 `r`,取该剖面线上火箭能被看到的**最大仰角**,映射为颜色(高仰角=暖色清晰,低仰角=冷色模糊)。

实现两种渲染路径(见 §6):

- **轻量(默认)**: 包络用单个 capsule 多边形描边 + 内部用若干同心环带(ring band)分色模拟梯度。
- **精细(可选)**: 沿轨迹生成正交网格采样点,每点算 `score`,用 `fill` 图层 + property 驱动 `fill-color` 的 `interpolate` 表达式渲染连续热力。

---

## 五、数据结构

### 5.1 核心类型

```ts
// app/composables/useRocketVisibility.ts(重构后)

/** 时间轴上的一个采样帧 */
export interface TrajectoryFrame {
  /** 飞行时间 min */
  t: number
  /** 归一化进度 τ = t / T,∈ [0, 1] */
  τ: number
  /** 地面位置 [lng, lat] */
  pos: [number, number]
  /** 高度 km */
  altitudeKm: number
  /** 水平速度 km/s(L2 才有,L1 可省略) */
  speedKmPerS?: number
  /** 过载 g、动压 kPa(L2) */
  gForce?: number
  dynamicPressureKPa?: number
  /** 该帧有效可见半径 km */
  visibilityRadiusKm: number
}

/** 弹道解算结果 */
export interface TrajectorySolution {
  preset: RocketPreset
  launch: LngLat
  target: LngLat
  /** 大圆距离 km */
  rangeKm: number
  /** 方位角 ° */
  bearing: number
  /** 顶点帧索引 */
  apogeeIndex: number
  /** 采样帧序列(等时间) */
  frames: TrajectoryFrame[]
  /** 可见包络 capsule 多边形 */
  envelope: Polygon
  /** 沿轨迹的热力采样(用于精细渲染) */
  heatmap?: HeatCell[]
}

export interface VisibilityStep = 'idle' | 'select-launch' | 'select-target' | 'result'
```

### 5.2 状态机演进

| 旧 | 新 | 变化 |
| --- | --- | --- |
| `idle` | `idle` | 入口 |
| `select-pad` | `select-launch` | 选发射点(不变本质) |
| `select-polygon` | `select-target` | **绘制落区面 → 选落点**(核心简化) |
| `result` | `result` | 新增时间轴 `currentTimeMin` 子状态 |

新增可调状态:`currentTimeMin`(时间轴游标)、`playbackRate`、`isPlaying`、`activePresetId`、`atmosphericVisibilityKm`。

---

## 六、地图渲染方案

### 6.1 图层分层(重构)

| 图层 ID | 类型 | 用途 | 时机 |
| --- | --- | --- | --- |
| `rocket-envelope-fill` | fill | capsule 包络淡填充 | 常驻 |
| `rocket-envelope-outline` | line | 包络轮廓 | 常驻 |
| `rocket-heatmap` | fill | 热力梯度(精细模式) | 常驻 |
| `rocket-trajectory` | line | 大圆轨迹(虚线) | 常驻 |
| `rocket-rocket-marker` | circle+symbol | **当前时刻火箭位置**(随时间轴动) | 动画驱动 |
| `rocket-visibility-now` | fill+line | **当前时刻可见圆**(随时间轴动) | 动画驱动 |
| `rocket-markers` | circle | 发射点 / 落点标记 | 常驻 |

> 新增「当前时刻」图层是时间动画的核心:拖动时间轴时,只更新这两个图层的几何(单圆 + 单点),性能远优于重算整条包络。

### 6.2 热力梯度(mapbox 表达式)

```js
// 精细模式:每个网格 cell 带 score ∈ [0,1] 属性,插值出颜色
'fill-color': [
  'interpolate', ['linear'], ['get', 'score'],
  0.0, 'rgba(148, 163, 184, 0.0)',   // 远/低仰角:透明灰
  0.3, 'rgba(56, 189, 248, 0.25)',   // 蓝
  0.6, 'rgba(250, 204, 21, 0.45)',   // 黄
  0.85, 'rgba(249, 115, 22, 0.65)',  // 橙
  1.0, 'rgba(239, 68, 68, 0.8)',     // 近/高仰角:红(最清晰)
]
```

### 6.3 时间动画驱动

```ts
// 预计算(进入 result 态时一次性算好整条弹道)
const solution = solveTrajectory(launch, target, preset)  // frames[] 已含每帧可见半径

// 动画:只更新「当前帧」图层的几何
function renderFrameAt(t: number) {
  const frame = sampleFrameAt(solution.frames, t)
  visibilityNowSource.setData(circleFeature(frame.pos, frame.visibilityRadiusKm))
  rocketMarkerSource.setData(pointFeature(frame.pos, { altitude: frame.altitudeKm, t }))
}

// 播放循环
const { pause, resume } = useRafFn(() => {
  currentTimeMin.value += playbackRate.value * (deltaMs / 60000)
  if (currentTimeMin.value >= totalT) currentTimeMin.value = 0
  renderFrameAt(currentTimeMin.value)
})
```

用 VueUse 的 `useRafFn` 管理动画循环,`currentTimeMin` 是响应式游标,拖动滑块时也走 `renderFrameAt`。

---

## 七、组件与文件拆分

### 7.1 composable 职责拆分

现有 `useRocketVisibility.ts` 单文件承担了「状态机 + 算法 + 渲染 + 动画」,膨胀到 567 行。重构为三个职责清晰的模块:

```
app/composables/rocket/
├── useTrajectory.ts        # 纯算法:弹道解算(L1/L2)、可见半径、仰角、热力采样
├── useVisibilityRender.ts  # 纯渲染:图层增删、热力表达式、capsule 包络几何
└── useRocketVisibility.ts  # 编排:状态机、事件绑定、时间轴、动画、对外 API
```

- `useTrajectory.ts`: 输入 `(launch, target, preset)` → 输出 `TrajectorySolution`,**无 map 依赖**,可单测。
- `useVisibilityRender.ts`: 输入 `TrajectorySolution` + `currentFrame` → 增删/更新图层,**无业务状态**。
- `useRocketVisibility.ts`: 组合上两者 + 状态机 + 时间轴,对外暴露与 `index.vue` 相同形态的 API(平滑迁移)。

### 7.2 组件拆分

现有 `VisibilityPanel.vue` 420 行,把 SVG 剖面图、滑块、状态卡全揉在一起。拆为:

```
app/components/rocket/
├── VisibilityPanel.vue      # 容器:步骤指示 + 状态分发(瘦身后)
├── VisibilityProfile.vue    # SVG 飞行剖面图(高度/速度/过载曲线)—— 独立
├── VisibilityTimeline.vue   # 时间轴 + 播放控件 —— 独立(新增)
└── VisibilityPresetSelect.vue # 火箭型号预设下拉 —— 独立(新增)
```

### 7.3 常量演进

`constants/rocket.ts` 保留几何常量(`EARTH_*`),新增 `constants/rocket-presets.ts` 存预设;`ROCKET_LOG_K`、`ROCKET_SAMPLE_COUNT*` 迁入 `TrajectoryProfile`。

---

## 八、实现步骤(分阶段)

### 阶段 0 · 准备(0.5d)

- [ ] 新建 `app/composables/rocket/` 目录与三个文件骨架
- [ ] 新建 `constants/rocket-presets.ts`,内置 4 个型号预设
- [ ] 拆出 `VisibilityProfile.vue` / `VisibilityTimeline.vue` / `VisibilityPresetSelect.vue`,先做静态占位

### 阶段 1 · 算法层(1.5d)— 最高优先

- [ ] `useTrajectory.ts`:实现 L1 三段高度模型 + 大圆轨迹采样
- [ ] 可见半径升级(几何 ∩ 大气能见度)+ 仰角函数
- [ ] capsule 包络几何解析计算(两端圆 + 外公切线)
- [ ] 热力采样网格生成
- [ ] **单测**:顶点位置、包络宽度、可见半径单调性

### 阶段 2 · 渲染层(1d)

- [ ] `useVisibilityRender.ts`:按 §6.1 增删图层
- [ ] 热力 `interpolate` 表达式接入
- [ ] capsule 包络 fill + outline

### 阶段 3 · 交互与状态机(1d)

- [ ] `useRocketVisibility.ts`:四步 → 两步状态机
- [ ] 落点选择(回收场/发射场/点击/坐标输入)
- [ ] 预设驱动自动解算
- [ ] `index.vue` 接线(对外 API 保持兼容)

### 阶段 4 · 时间动画(1d)

- [ ] `VisibilityTimeline.vue` 滑块 + 播放控件
- [ ] `useRafFn` 驱动 + `renderFrameAt`
- [ ] 顶点/落点锚点跳转、倍速

### 阶段 5 · 打磨(0.5d)

- [ ] 暗色模式适配热力配色
- [ ] 导出 GeoJSON(包络 + 轨迹 + 当前可见圆)
- [ ] 移除旧的「落区面 + 每面高度」代码路径

### 阶段 6(可选)· L2 物理弹道(2d)

- [ ] RK4 积分 + 重力转向控制律
- [ ] 大气密度模型、质量消耗
- [ ] 速度/过载/动压曲线接入剖面图

---

## 九、与现有代码的关系 / 迁移

| 现有 | 处置 |
| --- | --- |
| `useRocketVisibility.ts` 状态机 | 重写为两步,保留对外返回的 `step / selectedPad / result / errorMessage` 形态,`index.vue` 改动最小 |
| `selectedPolygonIds` / `landingHeights` / `setLandingHeight` | **删除**(落区面概念移除) |
| `maxVisibilityRadiusKm` 全局滑块 | 改为派生量(由 `preset.maxAltitudeKm` 决定),保留高级模式可覆盖 |
| `interpolateHeight` / `heightAt` / `radiusAt` / `visibilityRadius` | 迁入 `useTrajectory.ts`,升级为三段模型;`visibilityRadius` 保留为几何上限工具函数 |
| `VisibilityPanel.vue` 的 SVG 剖面 | 迁入 `VisibilityProfile.vue`,新增速度/过载曲线 |
| `renderLayers` / `clearResultLayers` | 迁入 `useVisibilityRender.ts`,图层 ID 全部更名(加 `rocket-` 前缀) |
| `constants/rocket.ts` 的 `VISIBILITY_*` 常量 | 更名为 `rocket-envelope-*` / `rocket-trajectory` 等 |
| 落区面绘制(`MapboxDraw` 多边形) | **不再需要**;落点改为点击/列表/坐标。`useRocketVisibility` 不再依赖 `drawInstance` 的 polygon 选择(绘图工具本身保留) |

> 迁移期间可保留旧 `VisibilityPanel.vue` 为 `VisibilityPanel.legacy.vue` 一版,便于对照回滚。

---

## 十、风险与取舍

1. **capsule 包络的前提是「轨迹为直线/大圆」**。若未来 L2 弹道产生明显弯曲,包络需改用 turf `union` 或扫描线法——届时再切换,接口(`TrajectorySolution.envelope`)不变。
2. **L2 物理模型参数难标定**。无真实遥测数据时,过载/动压仅作定性展示,UI 上标注「估算」。先交付 L1。
3. **热力精细模式性能**。网格采样过密会拖慢首帧;建议默认 60–120 个 cell,提供「精细/轻量」开关。
4. **去掉落区面可能损失「NOTAM 落区」语义**。若该功能本意是辅助 NOTAM 落区规划,应保留「落点序列」增强项:一条弹道 + 多个分级落点,每个落点独立可见圆,时间轴上依次点亮。
5. **Mapbox 2D 无 terrain**。地形遮挡暂不计入可见性(现有亦如此);若需,后续接 `queryTerrainElevation` 做 DEM 遮挡判断。

---

## 附录 A · capsule 包络解析公式

设轨迹两端点为 `P0`(发射)、`P1`(落点),最大可见半径 `R`(顶点处,也是 capsule 的「半径」)。则包络为:

- 两端圆:`circle(P0, R)`、`circle(P1, R)`
- 两条外公切线:沿 `bearing(P0→P1)` 方向,左/右各偏移 `R` 的两条平行线段

→ 一个标准 capsule 多边形。半径沿轨迹并非恒定(顶点最大、两端较小),故**精确包络**取所有采样帧圆的并集外轮廓;**轻量近似**直接用顶点半径做 capsule(略大于真实,偏保守,适合 NOTAM 规划语境)。
