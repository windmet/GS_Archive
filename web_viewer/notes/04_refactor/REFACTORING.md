# SideM Story Viewer 重构记录

> 维护说明：本文是 2026-06-25 前端重构历史记录，不再作为当前开发入口。当前入口见 `DEVELOPMENT.md`，后续待办见 `nextstep.md`。

最后更新：2026-06-25

本文记录当前 `web_viewer` 前端重构成果、运行状态、已知边界和后续建议。当前版本已经可以在本工作区独立启动开发服务，并通过生产构建。

## 当前成果

### 播放器 UI 拆分

- `StoryViewer.vue` 已经把标题页和剧情概要页从主播放流程中拆出。
- 新增 `src/components/TitleUI.vue`，负责章节 / 标题卡展示。
- 新增 `src/components/SynopsisUI.vue`，负责 synopsis 文本展示。
- `StoryViewer.vue` 继续保留播放编排职责：步骤推进、返回、选择分支、语音播放、timeline、语言切换和快捷键。

### 背景与非剧情步骤

- `StoryViewer.vue` 新增 `firstAvailableBg`，会从当前剧情 steps 中找第一张可用背景。
- `SpineStage.vue` 新增 `fallbackBg` 参数。
- 当 `title`、`synopsis` 等步骤没有自己的 `state.bg` 时，舞台会使用 `fallbackBg`，避免标题页 / 概要页黑屏。
- 当从剧情步骤退回到非剧情步骤时，`SpineStage.vue` 会清理角色 Spine、舞台滤镜、背景模糊和背景色叠加，避免上一帧视觉状态残留。

### Pixi / Spine 渲染修复

- `PixiStageManager.js` 的背景加载改为统一走 `_loadTextureFromUrl()`，不再直接依赖 `PIXI.Assets.load()`，规避开发环境中部分资源加载失败的问题。
- 背景 cover 逻辑做了轻微放大和整数像素定位，减少滤镜边缘和半像素偏移带来的视觉瑕疵。
- 新增 camera filter 支持：
  - `gray`
  - `sepia_light`
- 新增背景视觉效果支持：
  - `bg_dof` / 背景模糊
  - `bg_color` / 背景颜色叠加
- 应用新 step 前会先清理旧滤镜，再按当前 step 重新应用，解决回退或跳转时滤镜串场的问题。

### Spine atlas 贴图回退

- `PixiStageManager.js` 现在会先读取 `comu.atlas` 声明的贴图文件名。
- 如果 atlas 声明的贴图不是有效图片，会自动尝试同目录下的 `comu.png`。
- 典型场景：某些 atlas 第一行写的是 `cos.png`，但实际有效贴图是 `comu.png`。现在运行时可以自动回退。
- `_isImageUrl()` 会用响应头检查资源是否真的是图片，避免 Vite 把缺失资源返回成 HTML fallback 后被误当成图片。

### 索引结构兼容

- `App.vue` 新增 `normalizeFileList()`、`groupFileList()` 和 `groupFileCount()`。
- 当前索引读取已经兼容：
  - `files` 为数组；
  - `files` 为字符串；
  - 群聊 / 嵌套分组这类通过 `groups` 包含下级文件的结构。
- 分类、角色、组合、episode 的文件计数和文件列表都改为走统一兼容逻辑。
- 加载 `/data/compiled/index.json` 时会检查 HTTP 状态和 content-type，避免缺失数据被 Vite HTML fallback 伪装成 JSON。

### 语音与口型

- `StoryViewer.vue` 的口型控制会读取真实语音音量。
- 如果当前 step 标记 `lipSync === false`，会跳过口型动画，避免内心独白或画外音错误驱动角色嘴型。

### Vite / 构建兼容

- `package.json` 的 `dev`、`build`、`preview` 脚本都加入 `--configLoader native`，规避当前 Windows worktree 下 esbuild 配置加载问题。
- `vite.config.js` 增加 `optimizeDeps` 配置，并预构建 `@pixi/utils`，修复 Pixi 相关依赖在开发环境可能导致空白页的问题。
- 当前开发端口为 `5173`。
- `npm run build` 已在 2026-06-25 通过。
- 构建时仍会提示 Pixi/Spine 相关 chunk 超过 500 kB，这是当前阶段的预期体积警告，不影响构建成功。

## 当前运行状态

本地开发服务已重新启动：

```text
http://127.0.0.1:5173/
```

常用命令：

```powershell
npm run dev -- --host 127.0.0.1
```

```powershell
npm run build
```

```powershell
npm run preview
```

## 当前端口与资源结构

当前 `vite.config.js` 使用 `5173` 作为开发端口。

本工作区已经存在：

```text
public/
src/
dist/
node_modules/
```

如果后续要保证完全离线或完全独立运行，需要确认以下目录内的数据和素材是完整的：

```text
public/data/compiled/
public/assets/
```

如果资源不完整，浏览器可能出现这些现象：

- 剧情索引或剧情 JSON 加载失败；
- 背景、语音、头像、Spine 贴图缺失；
- Vite 返回 HTML fallback，导致状态码看似 200，但实际内容不是图片、音频或 JSON。

## 当前重构边界

这轮重构以“先稳定跑通最新 UI 和资源加载”为目标，保持边界相对保守：

- `App.vue` 仍负责首页分类导航、索引加载、剧情加载和预加载入口。
- `StoryViewer.vue` 仍负责剧情播放编排和用户交互。
- `SpineStage.vue` 仍是 Vue 与 Pixi 舞台之间的适配层。
- `PixiStageManager.js` 仍是底层 Pixi / Spine 渲染管理器。
- `AssetResolver.js` 仍是静态资源 URL 规则的集中入口。

## 已知问题

- `DEVELOPMENT.md` 在当前工作区存在乱码，后续文档建议统一保存为 UTF-8。
- 部分 Spine atlas 声明的贴图文件名与实际文件不一致；当前运行时已兼容，但素材差异仍建议长期记录。
- Pixi/Spine 包体较大，生产构建会提示 chunk 体积较大；后续可以通过动态加载、manualChunks 或更细粒度拆包优化。
- `StoryViewer.vue`、`PixiStageManager.js` 仍然偏大，后续可以继续按职责拆 composable / service。

## 建议后续拆分

1. 把 `App.vue` 中的索引结构兼容逻辑提到 `src/utils/IndexNormalizer.js`。
2. 把剧情 JSON 加载和预加载流程提到 `src/core/useScenarioLoader.js`。
3. 在当前新版 `StoryViewer.vue` 基础上继续拆分：
   - 语音播放：`useVoicePlayer.js`
   - timeline 执行：`useTimelineRunner.js`
   - 分支 / 历史栈：`useStoryNavigation.js`
4. 继续为图片、音频、JSON 加载增加响应内容检查，避免 HTML fallback 伪装成正常资源。
5. 明确长期资源策略：
   - 独立工作区：把完整 `public/assets` 和 `public/data/compiled` 放入当前项目；
   - 轻量工作区：使用固定静态资源服务或 CDN，而不是依赖另一个前端开发端口。

## 本轮验证

- 已结束旧的 Node 开发进程。
- 已执行 `npm run build`，构建成功。
- 已重新启动开发服务器。
- 已确认 `127.0.0.1:5173` 正在监听。
