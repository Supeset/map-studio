<p align="center">
<img src="https://user-images.githubusercontent.com/11247099/140462375-7b7ac4db-35b7-453c-8a05-13d8d20282c4.png" width="600"/>
</p>

<h2 align="center">
<a href="https://github.com/antfu/vitesse">Vitesse</a> for Nuxt 4
</h2><br>

<p align="center">
<br>
<a href="https://vitesse-nuxt3.netlify.app/">🖥 在线预览</a>
<br><br>
<a href="https://stackblitz.com/github/antfu/vitesse-nuxt"><img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt=""></a>
</p>

## 特性

- 💚 [Nuxt 4](https://nuxt.com/) - SSR, ESR, 基于文件的路由, 组件自动导入, 模块等.

- ⚡️ Vite - 即时热更新.

- 🎨 [UnoCSS](https://github.com/unocss/unocss) - 即时按需原子化 CSS 引擎.

- 😃 使用来自任何图标集的纯 CSS 图标, 由 [UnoCSS](https://github.com/unocss/unocss) 提供支持.

- 🔥 `<script setup>` 语法.

- 🍍 [通过 Pinia 进行状态管理](https://github.com/vuejs/pinia), 请参阅 [./app/composables/user.ts](./app/composables/user.ts).

- 📑 [布局系统](./app/layouts).

- 📥 API 自动导入 - 用于 Composition API, VueUse 和自定义组合式函数.

- 🏎 零配置云函数和部署.

- 🦾 TypeScript, 当然.

- 📲 [PWA](https://github.com/vite-pwa/nuxt) 具有离线支持和自动更新行为.

## 插件

### Nuxt 模块

- [VueUse](https://github.com/vueuse/vueuse) - 有用的组合式 API 集合.
- [ColorMode](https://github.com/nuxt-modules/color-mode) - Nuxt 轻松实现具有自动检测功能的深色和浅色模式.
- [UnoCSS](https://github.com/unocss/unocss) - 即时按需原子化 CSS 引擎.
- [Pinia](https://github.com/vuejs/pinia) - 直观、类型安全、轻量且灵活的 Vue Store.
- [VitePWA](https://github.com/vite-pwa/nuxt) - Nuxt 4 的零配置 PWA 插件.
- [DevTools](https://github.com/nuxt/devtools) - 释放 Nuxt 开发人员体验.

## IDE

我们建议使用 [VS Code](https://code.visualstudio.com/) 和 [Volar](https://github.com/johnsoncodehk/volar) 来获得最佳体验 (您可能需要禁用 [Vetur](https://vuejs.github.io/vetur/) 如果您已安装它).

## 变体

- [vitesse](https://github.com/antfu/vitesse) - 自以为是的 Vite 入门模板
- [vitesse-lite](https://github.com/antfu/vitesse-lite) - Vitesse 的轻量级版本
- [vitesse-nuxt-bridge](https://github.com/antfu/vitesse-nuxt-bridge) - Vitesse for Nuxt 2 with Bridge
- [vitesse-webext](https://github.com/antfu/vitesse-webext) - WebExtension Vite 入门模板

## 立即尝试!

### 在线

<a href="https://stackblitz.com/github/antfu/vitesse-nuxt"><img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt=""></a>

### GitHub 模板

[在 GitHub 上从此模板创建存储库](https://github.com/antfu/vitesse-nuxt/generate).

### 克隆到本地

如果您喜欢使用更干净的 git 历史记录手动执行此操作

```bash
npx degit antfu/vitesse-nuxt my-nuxt-app
cd my-nuxt-app
pnpm i # 如果您没有安装 pnpm, 请运行: npm install -g pnpm
```
