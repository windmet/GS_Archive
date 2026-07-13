# AGENT_START_HERE

本项目是本地 SideM 剧情浏览器，前端基于 Vue + Vite + PixiJS + Spine。当前工程已经进入稳定排查期，不再处于大规模探索阶段。

## 一、优先阅读顺序

每次开始任务前，请按顺序阅读：

1. `docs/PROJECT_MAP.md`
2. `docs/SMOKE_CASES.md`
3. `docs/SMOKE_EXPECTATIONS.md`
4. `docs/DO_NOT_REOPEN.md`
5. 用户本次明确点名的文件

除非用户明确要求，不要全仓库扫描。

## 二、默认禁止扫描目录

不要默认读取、搜索或分析以下目录：

* `node_modules/`
* `dist/`
* `_archive/`
* `_migration_backup*/`
* `_encoding_review/`
* `_archived_volume_lipsync/`
* `external_raw/`
* `raw/`
* `public/raw/`
* 大体积 `.unity3d`
* `.acb`
* `.awb`
* `.usm`
* 大量未索引 scenario 原始目录

这些目录只在用户明确要求"查 raw 资产 / 查历史备份 / 查音频视频包 / 查 Unity 包"时读取。

## 三、当前工程分层

### `src/components/`

Vue 组件层。
`SpineStage.vue` 是舞台容器和 step 编排入口，不应继续堆积底层 Pixi 或资源解析细节。

### `src/core/`

运行时核心层。
包括 Pixi 舞台、背景、镜头、Spine 管理、step scene 应用、动画/过渡等。

### `src/utils/`

资源索引、字典、坐标解析、文本处理等工具层。

### `tools/`

离线抽取、审计、生成索引、资源分析脚本。
不要把 tools 逻辑搬进前端运行时。

### `docs/`

给人和 agent 看的工程说明、决策记录、smoke 样例、排查边界。

## 四、当前稳定原则

1. 不要把已经解决的问题当成未解决问题重新展开。
2. 不要因为某个文件超过 1000 行就机械建议大重构。
3. 优先给出小步、可回滚、可 smoke test 的修改。
4. 涉及资源路径时，优先查 manifest / index / store，不要直接扫 raw 全目录。
5. 涉及舞台显示时，优先使用 `docs/SMOKE_CASES.md` 里的固定样例。
6. 涉及历史结论时，先看 `docs/DO_NOT_REOPEN.md`。

## 五、SpineStage.vue 当前定位

`SpineStage.vue` 当前是舞台编排层，允许保留以下职责：

* 创建和销毁 `PixiStageManager`
* 监听 `props.step`
* 监听 `props.fallbackBg`
* 调用 `applyStepSceneState`
* 同步当前 step 的角色显示
* 暴露轻量 debug 面板
* 调用已有 core/utils 模块

不建议在 `SpineStage.vue` 中继续新增：

* 新的资源扫描逻辑
* 新的 raw 文件路径猜测
* 新的 Unity 包解析逻辑
* 大量临时实验参数
* 与 smoke case 无关的历史 debug 逻辑

## 六、回答格式要求

每次给建议时，请分为：

1. 当前判断
2. 是否需要改代码
3. 涉及文件
4. 最小修改范围
5. smoke 验证方式
6. 风险与回滚方式

不要只给笼统架构建议。
