# 2026-10-11 测试反馈只读排查交接

## 当前状态与授权边界

用户反馈四项问题，要求先定位检查、使用 Browser 验收，盘清后等待用户决定，暂不修改实现。本次仅调查；本交接文档是随后按用户要求补充的记录。

- 未修改应用代码、主数据、读取模型或线上资源；未构建、启动/重启服务、上传 R2 或部署。
- 第 2 项的重复来源与传播链已确认；第 3、4 项的现状与调整范围已确认。
- 第 1 项已在线复现，但具体根因尚未闭环。不得将本记录解读为四项问题已经解决或全部根因已经确定。
- 后续实现、数据重建与发布，等待用户决定；本文件中的方案均为建议。

## 版本、环境和证据边界

| 项目 | 本轮记录 |
| --- | --- |
| 本地 checkout | `E:\Web_build\SideM_Archived\web_viewer` |
| 输入 HEAD | `309ca736b9ec673dc449c53fc05c3dbf8b66aa4a` |
| 分支 | `codex/portal-architecture-cleanup-20261004` |
| Browser 实测站点 | <https://dbbe684c.gs-archive-preview.pages.dev> |
| 线上源码版本 | 既有部署交接记载为 `7725368d`；本轮未重新向 Cloudflare 查询部署元数据 |
| 浏览器 | Codex In-app Browser，经 `cua_repl` 的 Browser/Playwright 接口操作 |
| 截图尺寸 | 469 × 518；未做桌面宽屏或真机矩阵验收 |

部署背景见 [2026-10-10 测试站交接](GS_ARCHIVE_HANDOFF_20261010_TEST_DEPLOY.md)。本地 HEAD 与线上部署版本分别记录，不混为同一份运行版本。

Browser 初次建 tab 与读取页面曾超时，恢复后完成门户、工具页、北斗首页、换装和台词目录交互。未切换到独立 Playwright 或其他浏览器。页面有实际内容，已访问页面未见框架错误覆盖层；衣装故障时日志接口返回空列表，这只代表未捕获到日志，不能证明加载过程没有异常。

## 1. 北斗「爽秋之花红叶」与突破版人物消失

### Browser 复现

1. 打开 `/?view=home&home_idol=003hok`。
2. 点击「选择首页服装」，选「爽秋之花红叶」。URL 对应 `home_costume=003hok_103_00`。
3. 人物消失，事务所背景、首页台词和导航仍显示。
4. 再选「爽秋之花红叶+」（`003hok_103_01`），同样未显示人物。
5. 切回「基础常服」，人物恢复显示。

本轮确认的是首页 ADV 人物模型故障；未对这两套衣装的多人舞台版本、摄影工作台和全部故事场景进行交互验证。

### 已完成的资源与解析检查

两套模型都在本地衣装字典中，`spine_exists: true`。本地各自包含 `comu.atlas`、`comu.skel`、`comu.png`。

对测试站 `/assets/spines/<模型 ID>/<文件>` 发起只读 GET，结果如下；字节数是本轮读取的响应 body 长度。

| 模型 | atlas | skel | 逻辑 comu.png |
| --- | --- | --- | --- |
| `003hok_103_00` | 200，29,780 B，text/plain | 200，3,699,848 B，application/octet-stream | 200，1,320,356 B，image/webp |
| `003hok_103_01` | 200，29,892 B，text/plain | 200，3,727,676 B，application/octet-stream | 200，1,473,026 B，image/webp |

骨骼响应 SHA-256 与本地对应文件一致：

```text
003hok_103_00 46ee1b670848dfacc858a71fa2b8aa906432df0d17023f6ac98b12632373857e
003hok_103_01 5c111f56761490405519e67097a91ea47772205046c87e8d06316c75f86c844f
```

通过本项目的 Unity wrapper 解码和现用 Spine 3.8 解析器，本地两套骨骼均读入成功：266 bones、263 slots、32 animations，atlas 均识别为单页 `comu.png`。对 `angry` 动画进行 Skeleton 层计算，未出现 worldX/worldY 非有限值。

以上排除了本轮测试资源 404、骨骼传输字节不一致及基本骨骼解析失败；没有验证线上 WebP 解码后的像素与原 PNG 一致，也没有证明完整 Pixi/WebGL 渲染正常。Node 中尝试实例化完整 Spine 时因没有 DOM 而失败，对照常服也同样失败，不能将该环境错误作为衣装根因。

### 下一步定位范围（未执行修复）

- [模型加载管线](../src/core/spineSpawnPipeline.js)：资源读取、贴图解码、Spine 实例创建。
- [PixiStageManager](../src/core/PixiStageManager.js)：`spawnSpine`、异步实例所有权、`_applyDefaultPosition`、遮罩、透明度、容器与最终显示。
- [SpineStage](../src/components/SpineStage.vue)：旧模型移除、新模型创建、位置与可见性应用、失败回退。
- 应收集失败时的具体异常或实例显示状态，再确定修改点。两套红叶模型有较多衣装 clipping attachment，但目前没有证据证明 clipping 是原因。
- 暂无依据重新上传全部素材、降低资源检查或修改衣装字典中的可用标记。

## 2. SSR 首页触摸语音重复

### 已确认的原因

源表抽取保留了不同记录 ID 指向同一 cue 的记录。例如北斗 `003hok_ssr01`：记录 `844` 与 `848` 都指向 `2_4_003_01_00_01`，对应文本、音频与预览相同。

传播链：

1. [card_tables.py](../../data_pipeline/sidem_masterdata/card_tables.py) 的 `extract_card_voice_cues` 抽取 field 91，保留原记录 ID。
2. [cards.py](../../data_pipeline/sidem_masterdata/cards.py) 的 `build_card_index` 按 card_id 分组后逐条 append，没有按 cue 去重。
3. [archiveHomeState.js](../src/data/archiveHomeState.js) 的 `buildArchiveHomeState` 直接 flatMap 卡片语音列表。
4. [checkout_adapter.mjs](../readmodels/lib/checkout_adapter.mjs) 调用同一首页组装逻辑生成读取模型，重复进入发布数据。
5. [ArchiveImmersiveHome.vue](../src/components/archive/ArchiveImmersiveHome.vue) 直接显示列表；相同 cue 还用作目录行 key，应一并消除重复身份。

[archiveSelectors.js](../src/data/archiveSelectors.js) 的 `normalizeCard` 已有 `uniqueBy(card.home_voice_cues, item => item?.cue)`，说明卡片与首页的数据消费边界处理不同。不能只因卡片详情已去重，就认定首页读取模型也已去重。

### Browser 证据与全量本地统计

北斗首页显示 49 句；台词目录筛选 SSR 后，SSR01「潇洒干练的迎接」的 38/39、40/41、42/43、44/45 成对重复，SSR02 则显示 4 条。北斗这一首页列表去掉已确认的重复后应为 45 句。

扫描本地 `public/data/masterdata/card_index.json`，按每张卡的 cue 去重比较：

- 52 张卡各有 8 条记录、4 个唯一 cue，共 208 条额外重复记录。
- 包含全部 49 位偶像的 SSR01。
- 另含 `001tom_ssr02`、`019kur_ssr02`、`042dai_ssr02`，即冬马、九郎、大吾的 SSR02。
- 此 52 张范围是本地全量数据统计；Browser 仅抽查北斗，不宣称逐位线上验收通过。

### 建议方案与回归要求

在面向用户的首页投影中，按稳定 cue 身份去重，并保留源记录的可追溯信息；同时评估是否统一卡片与首页的规范化边界。不要按译文文本去重，不同 cue 可能合法地使用同一句文本。

后续若修正读取模型生成逻辑，需要重新生成并发布对应读取模型，单独替换前端 bundle 未必能消除已发布列表的重复。具体发布范围等待用户决定。

回归至少覆盖：49 位 SSR01、额外三张 SSR02、正常卡不丢语音、目录计数、上一句/下一句、选中状态和卡片详情语音入口。

## 3. LIVE 合并入口与摄影独立图标

### 当前行为

Browser 从门户「工具」进入后，实际显示三张并列卡片：谱面预览、舞台小人、摄影工作台。门户另有「摄影」栏目入口，指向摄影资料目录，和直接进入工作台的路径不同。

主要接线：

- [ArchiveExperiments.vue](../src/components/archive/ArchiveExperiments.vue)：三张工具卡片与 charts/stage/photo 事件。
- [App.vue](../src/App.vue)：`openChartTool`、`openChibiStage`、`openPictureStudio` 等入口。
- [archiveRoute.js](../src/core/archiveRoute.js)：栏目、view 合同、返回路径；当前 chart_lab 属于 experiments，chibi_stage 属于 resources。
- [ArchiveSongDetail.vue](../src/components/archive/ArchiveSongDetail.vue)：歌曲详情已有独立舞台和谱面按钮。

### 用户提出的方向与待决定范围

用户希望按游戏里的 LIVE 组织谱面和舞台，摄影提供独立图标，并将舞台名称确定为「2D舞台」。

建议入口结构：`LIVE → 统一选曲 → 谱面 / 2D舞台`，另提供明确的摄影工作台入口。以下尚未定案：

- LIVE 与现有「歌曲」目录如何关联；门户及手机导航的入口位置。
- 合并是否包含共享播放进度、速度、编成和声部，或先统一选曲与切换路径。
- 摄影资料目录与摄影工作台的并存、跳转和返回行为。

合并牵涉入口、路由与返回恢复，后续需验证歌曲详情入口、深链接、返回选曲、手机导航及切换后的音频/画布生命周期。

## 4. 「舞台小人」统一为「2D舞台」

本轮源码搜索确认的用户可见位置：

| 文件 | 内容 |
| --- | --- |
| [ArchiveExperiments.vue](../src/components/archive/ArchiveExperiments.vue) | 工具标题、图片 alt、由标题生成的打开按钮 |
| [ChibiStageViewer.vue](../src/components/ChibiStageViewer.vue) | 桌面完整标题与手机紧凑标题 |
| [SpineViewer.vue](../src/components/SpineViewer.vue) | 预览区/控制台 aria-label、失败提示；需注意这是 spine_lab 页面，核对语义后处理 |
| [ArchiveSongChartPreview.vue](../src/components/archive/ArchiveSongChartPreview.vue) | 音频说明中的舞台旧称 |
| [ArchiveSongDetail.vue](../src/components/archive/ArchiveSongDetail.vue) | 「Chibi 舞台演出」入口文案 |

建议统一用户可见术语；内部 `chibi_stage` 路由、组件名和资源目录无需为改名机械迁移。社长特别演出的「单人 2D」是否并入统一标题，需要结合 LIVE 结构确定。

## Browser 截图

小型截图保存在本机以下目录，未复制进仓库；跨机器交接时需另外携带。截图不是部署包。

```text
C:\Users\windm\.codex\visualizations\2026\10\11\01a1295d-6dcc-7f02-9c74-1d4121779955\
  hokuto-duplicate-voices.png
  hokuto-default-control.png
```

- `hokuto-duplicate-voices.png`：SSR 筛选后北斗 38/39 两条相同台词；背景中的人物处于红叶衣装不显示状态。
- `hokuto-default-control.png`：切回基础常服后人物恢复。
- 两套红叶衣装消失过程还通过 Browser 截图观察过，但未各自保存独立截图文件。

## 接手顺序和验证约束

1. 先核对最新 HEAD、工作区和测试站版本，保留其他窗口的未跟踪文件。
2. 继续只读定位北斗问题，取得具体失败环节；等待用户决定实现范围。
3. 获准后分批处理语音去重、LIVE/摄影入口和名称，逐批做相关回归与 Browser 验证。
4. 遵守 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)：代码验证用 `npm run build:check`；本交接文档只需内容、链接与 diff 检查，无需应用构建。
5. 发布前分别核对前端、读取模型和资源版本。不得把源码解析成功、HTTP 200 或本地构建通过当作衣装渲染通过。

本轮开始及文档生成前已有以下无关未跟踪内容，均未处理：`../.analysis/`、`../GS_Archive_source_for_repair.zip`、`.claude/`、`docs/GS_ARCHIVE_PREVIEW_WEBP_R2_HANDOFF_DEEPSEEK.md`、`docs/sidem_title_fx_css_rebuild_v9.html`、`public/data/terminal/`、`scripts/render-voice-listening-review.py`。
