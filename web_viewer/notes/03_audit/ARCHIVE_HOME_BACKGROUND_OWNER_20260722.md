# 资料馆首页 Background Owner 回归与修复

日期：2026-07-22

## 结论

`baf44df` 正确删除了 StoryViewer 的 legacy background writer，但资料馆首页 `ArchiveImmersiveHome` 是直接复用 `SpineStage`、不创建 `useStoryRuntimeCues` 的独立 consumer。其 step 含有 `state.bg`，因此原有 fallback 分支不会执行；Pixi renderer 又以不透明黑色清屏，最终遮住了页面 CSS 背景。

修复采用显式、默认关闭的 `SpineStage.manageBackground` contract：

- `ArchiveImmersiveHome` 显式传入 `manage-background=true`，成为 standalone background owner；
- `SpineStage` 只在该 opt-in 模式下把 `step.state.bg` 或 `fallbackBg` 写入 manager，并去重相同背景；
- `StoryViewer` 不传该属性，继续由 `useStoryRuntimeCues` 的 Background Runtime 唯一持有；
- `applyStepSceneState` 继续禁止 `setBackground/clearBackground`，没有恢复全局双 owner。

## 自动验证

`verify-archive-home.mjs` 新增：

- 所有首页 cue 背景文件存在；
- 首页 consumer 必须显式声明 `manage-background=true`；
- `SpineStage` contract 必须 opt-in，默认 `false`；
- DOM 必须暴露 `data-background-owner`；
- 通用 `applyStepSceneState` 不得重新出现背景 manager 写入。

以下命令通过：

- `npm run verify:home`
- `node scripts/verify-story-runtime-foundation.mjs`
- `npm run verify:routes`
- `npm run build`

## 单标签浏览器验收

桌面首页：

- `bg001_315pro_in_01` 正常绘制，不再黑屏；
- DOM owner 为 `standalone`；
- 冬马切换到翔太后背景持续存在；
- 应用级 console error 为 0。

移动端 `390×844`：

- 正式办公室背景正常绘制；
- owner 仍为 `standalone`；
- `scrollWidth=390`，无横向溢出；
- 应用级 console error 为 0。

验收始终只使用一个浏览器标签页。
