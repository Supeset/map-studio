# 火箭任务轨迹与轨道(完整任务剖面)

> 在 `rocket-visibility-redesign.md` 的单弹道基础上,升级为**完整航天任务剖面**:发射上升 → 助推器分离落到各残骸落区 → 上面级入 LEO → 绕地球一圈星下点轨迹。引入轨道力学(圆轨道 + 地球自转,忽略 J2,符合「大致估算」定位)。

## 一、任务剖面(四阶段 + 时间轴)

```
   上升段 Ascent          轨道段 Orbit(LEO 一圈)
发射●────上升弹道────○入轨 ═══════════════════╗
    △分离                 ╲                    ╚══(绕回,经度西移)
    │助                   上面级(主体)
    │推       残骸弹道       ↓
    │器    ╱   ╲   ╲      星下点轨迹
   落区① 落区② 落区③
```

| 阶段 | 对象 | 时间区间 | 高度 |
| --- | --- | --- | --- |
| 上升 Ascent | 火箭主体 | `[0, T_ascent]` | 0 → LEO 高度 |
| 残骸 Debris | 各助推器(分离后) | `[t_sep_i, t_sep_i + T_debris_i]` | 分离高度 → 0 |
| 入轨 Insertion | 主体(上升终点) | `T_ascent` | LEO 高度(水平) |
| 轨道 Orbit | 主体 | `[T_ascent, T_ascent + T_orbit]` | LEO 高度(恒定) |

## 二、输入与参数推导

**输入**:发射场(点击)+ 多个残骸落点(依次点击)+ LEO 高度 `h`(滑块,默认 400 km)。

**推导**:

1. **发射方位角 `A`** = 发射点 → 最远落点的方位角(`calculateBearing`)。最远落点最接近入轨主方向。
2. **轨道倾角 `i`**(沿发射方位延伸):
   ```
   cos i = cos(φ_launch) · sin A        (φ_launch 发射场纬度)
   ```
   正东(A=90°)→ i=φ_launch;正北(A=0°)→ i=90°(极地)。满足 i ≥ φ_launch。
3. **入轨点**:沿方位 `A`、距发射场 `D_insert` 处。`D_insert` 由 LEO 高度经验映射(高度越高射程越远,默认 800–2500 km,可调)。
4. **上升弹道**:发射 → 入轨点,高度 0 → `h`,终点水平(入轨)。复用三段高度模型,顶点 = 入轨点。
5. **残骸弹道 i**:分离点 = 上升段上距发射场 `D_sep_i` 处(`D_sep_i` 由落区距离反推:近落区早分离),从分离高度抛物下落到落区。
6. **轨道周期**:`T_orbit = 2π·√(a³/μ)`,`a = R⊕ + h`,`μ = 398600.4418 km³/s²`。
7. **上升时间** `T_ascent`:经验(如 9 min,或按 `D_insert` 比例)。

## 三、轨道星下点轨迹算法(圆轨道 + 地球自转)

> 一圈内火箭的地面投影。轨道平面惯性固定,地球自转使星下点逐圈西移(~22.5°/圈 for LEO),故一圈轨迹**不闭合**(开口)。

**轨道系 → 惯性系旋转**(升交点经度 `Ω`,倾角 `i`,纬度幅角 `u`):
```
X = a (cos u · cosΩ − sin u · cos i · sinΩ)
Y = a (cos u · sinΩ + sin u · cos i · cosΩ)
Z = a · sin u · sin i
→ lat = asin(Z/a) = asin(sin i · sin u)
→ λ_inertial − Ω = atan2(sin u · cos i, cos u)
```

**由入轨点反推 `Ω` 与初始 `u₀`**:
```
sin u₀ = sin(lat₀) / sin i          → u₀ = asin(...)
Ω = λ₀_inertial − atan2(sin u₀ · cos i, cos u₀)
```

**一圈星下点**(从入轨点起,τ ∈ [0, T_orbit]):
```
u(τ) = u₀ + 2π·τ / T_orbit
lat(τ) = asin(sin i · sin u)
λ_inertial(τ) = Ω + atan2(sin u · cos i, cos u)
λ_ground(τ)   = λ_inertial(τ) − ω_e · (t_ins + τ)     // 减地球自转(西移)
λ_ground 归一化到 [−180, 180]
```
其中 `ω_e = 7.2921e-5 rad/s`,`t_ins = T_ascent`(秒)。

## 四、时间轴编排(多对象)

全程 `T_total = T_ascent + T_orbit`。游标 `t` 同时驱动**所有对象**:

- **主体**:t < T_ascent → 上升段(进度 t/T_ascent);t ≥ T_ascent → 轨道(进度 (t−T_ascent)/T_orbit,绕一圈后停在终点)。
- **残骸 i**:分离时刻 `t_sep_i = (D_sep_i / D_insert) · T_ascent`;t > t_sep_i 时按 `(t−t_sep_i)/T_debris_i` 在分离弹道下落;t ≥ 落地时刻停在落区。

任一时刻 `t`,**所有「活着」的对象**(主体 + 已分离未落地的残骸)各自有一个可见圆,同时渲染。时间轴顶部标注:分离点、入轨点、顶点、一圈终点。

## 五、数据结构

```ts
// 上升段帧(主体)
interface AscentFrame { t, pos, altitudeKm, speedKmPerS? }

// 残骸 i 的解算结果
interface DebrisSolution {
  id: string
  landing: VisPoint                  // 落区
  sepPoint: [lng, lat]               // 分离点
  sepAltitudeKm: number
  sepTimeMin: number                 // t_sep_i
  fallTimeMin: number                // T_debris_i
  path: [lng, lat][]                 // 分离点→落区星下点
}

// 轨道一圈星下点
interface OrbitSolution {
  inclinationDeg: number
  altitudeKm: number
  periodMin: number
  insertPoint: [lng, lat]
  groundTrack: [lng, lat][]          // 一圈星下点
}

interface MissionSolution {
  launch, bearing, inclinationDeg
  ascent: AscentFrame[]              // 含入轨点(末帧)
  debris: DebrisSolution[]
  orbit: OrbitSolution
  // 统一时间帧:每个 t 各对象状态
  totalFrames: MissionFrame[]
}

interface MissionFrame {
  t: number
  booster?: { pos, altitudeKm, visibilityRadiusKm }   // 主体(上升/轨道)
  debris: { id, pos, altitudeKm, visibilityRadiusKm }[] // 各残骸(仅活动)
}
```

## 六、渲染分层

| 层 | 内容 | 时机 |
| --- | --- | --- |
| 静态:上升轨迹 | 发射→入轨点大圆(虚线) | 解算后 |
| 静态:残骸弹道 | 每条分离→落区(细虚线) | 解算后 |
| 静态:轨道一圈 | 星下点轨迹(醒目线,标注起止) | 解算后 |
| 静态:热力包络 | 沿上升段 + 轨道的可见圆叠加 | 解算后 |
| 静态:落点标记 | 发射点 + 各落区(编号) | 解算后 |
| 动态:可见圆 | 当前时刻主体 + 各活动残骸的可见圆 | 时间轴驱动 |
| 动态:位置标记 | 当前时刻主体 + 残骸位置 | 时间轴驱动 |

## 七、实现步骤

1. `useOrbit.ts`:倾角 / 周期 / 升交点反推 / 一圈星下点(纯函数)。
2. `useMission.ts`:上升段 + 多残骸 + 轨道组合解算,产出 `MissionSolution` + `MissionFrame[]`。
3. `useTrajectory.ts`:上升弹道支持「终点高度 = LEO 高度、终点水平」。
4. `useVisibilityRender.ts`:多对象动态层 + 轨道/残骸静态轨迹。
5. `useRocketVisibility.ts`:多落点输入、LEO 高度、多阶段时间编排。
6. `VisibilityPanel/Timeline/Profile`:落点列表、LEO 滑块、倾角展示、多对象剖面。

## 八、假设与取舍

- **圆轨道 + 忽略 J2**:星下点逐圈西移仅由地球自转近似,实际 J2 会引起进动;「大致估算」可接受。
- **入轨射程 `D_insert` 经验映射**:无真实弹道数据,用高度→射程经验表,UI 暴露为高级可调。
- **分离点由落区距离反推**:近落区早分离、低高度;模型简化,非真实分级。
- **最远落点定方位**:多落点中取最远者作主飞行方向;若落点分散,可后续改用质心或手动指定主目标。
