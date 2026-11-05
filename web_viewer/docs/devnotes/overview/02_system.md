# 系统总览（骨架）

**论点**：本站以本地数据为先。仓库里只放代码、规则和验证证据，不放客户端原始数据和大体积媒体。离线管道把原始数据加工成生成产物，浏览器只读生成产物。

## 事实

### 技术栈

- 前端用 Vue 3、Vite、PixiJS 7、Spine 3.8。离线部分是 Python（`data_pipeline/`）和 Node 脚本（`scripts/`）。〔`PROJECT_MAP.md` 开头〕
- 仓库里保存代码、Schema、关系规则、验证报告和开发证据，**不放** RAW、Masterdata 原文件和大体积媒体。〔`PROJECT_MAP.md` 开头；`REPO_DATA_GOVERNANCE_20261022.md`〕

### 数据怎么流动

```text
RAW（物理载荷：剧情脚本、图片、音频、模型）
  + Masterdata（语义身份：哪张卡、哪个活动、哪位偶像）
      ↓  data_pipeline/、scripts/（离线生成、审计、发布、回滚）
public/data（compiled 剧情、目录、关系表） + readmodels（按 release 哈希绑定的读模型）
      ↓  src/data 选择器（只读生成产物，不扫描 RAW）
页面 / 播放器 / 舞台
```

- 分工：RAW 提供物理载荷，Masterdata 提供语义身份，整理者导出的文件只用来对照。〔`PROJECT_MAP.md` §3〕
- 组件里不允许猜关系（比如按稀有度或技能名推分类），关系一律经 `archiveSelectors.js` 从生成的索引里组装。〔`PROJECT_MAP.md` §3〕
- 站点和数据的绑定由三个值决定：read-model release、data revision、media epoch。〔`CURRENT_STATE.md` 开发基线〕
- 读模型重构从 9-25 开始，生成器、客户端和装配验证器都放进 `readmodels/`。〔`GS_ARCHITECTURE_REBUILD_START_20260925.md`〕

### 剧情运行时：谁负责什么

| 范围 | 负责的模块 |
|---|---|
| 播放会话、当前 step、Auto / Skip | `src/core/StoryViewer.vue` |
| cue 归一化与调度 | `src/core/story-runtime/useStoryRuntimeCues.js` |
| 逻辑时间（暂停、恢复、倍速） | `StoryClock.js` |
| 场景历史与回退 | `SceneSnapshotStore.js`、`StepSceneState.js` |
| 语音、SE、BGM、环境音 | `StoryAudioSession.js` |
| 渲染 | `PixiStageManager.js` 及各 Manager |

〔`PROJECT_MAP.md` §2〕

### 页面层

- 每篇故事只归属一个页面，入口统一走 `src/core/StoryOwner.js`；通用的故事详情页 10-21 退役。〔PR #72、#74〕
- 阅读器和播放器是两个独立的页面，阅读器在 10-30 改成独立页。〔PR #152〕
- 地址从 `?view=` 查询参数逐步改成静态路径和深链接。〔PR #65；深链接 R1 #121、R2 #123、R4 #139〕

### 规模（写的时候注明是哪天的口径）

- 3,398 个 RAW 剧情逻辑组、4,939 个有效 part；compiled 目录有 10,420 个 JSON，**不等于** 10,420 篇剧情。〔`PROJECT_MAP.md` §4〕
- 10,326 份场景、315,124 个快照、175,600 个 cue。〔`SCENARIO_PIPELINE_BOUNDARIES.md`，最后修改 9-09〕

## 待核

- `PROJECT_MAP.md` §4 的数字是哪天的口径：文件最后修改是 10-23，但这一节很可能是 9 月写的。引用前用 `archive_baseline_report.json` 复核。
- 可以画一张数据流图（文档站用 SVG）；这张图要以 `PROJECT_MAP.md` 为准，不要凭印象画。

## 【站长撰写】

可选：用一两段话讲「为什么不直接把客户端搬上网页」，素材见决策登记册第 1 条。
