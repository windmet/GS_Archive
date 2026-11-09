# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-11-10（master `53c3737c`，含 #199；发布快照已按 2026-11-10 的 preview 部署重写；各条线表格仍是 10-30 前后的记录，逐行见下方说明）

## 开发基线

| 项 | 值 |
|---|---|
| master | 代码基线 `53c3737c`（#199）。自上一版基线 `97b1a1ae`（#139）以来合入 #140–#199（按首父线），按主题：门户 / 布局减法 #140–#149、#153、#158–#159、#161、#163、#166、#169–#170、#176、#184–#185、#194、#197–#199；歌曲页与谱面 #150–#151、#156、#190–#193；阅读器 / 播放器 #152、#179–#181、#183、#186；舞台 #160、#177–#178、#187；翻译 #162、#167、#172、#174–#175、#188；发布与数据治理 #155、#157、#164–#165、#168、#195–#196（见 [发布契约](RELEASE_CONTRACT.md)、[加固方案](GS_ARCHIVE_RELEASE_HARDENING_PLAN_20261109.md)）；其他 #143、#154、#171、#173、#182、#189。分类是按分支名归并，细节看各 PR |
| 谱面 | 无进行中分支。透视轨已是单 WebGL 画布（#192），沉浸锁定与纹理重试（#193）、主屏全屏（#194）已合；渲染审计见 [CHART_RENDER_PERFORMANCE_AUDIT_20261109.md](CHART_RENDER_PERFORMANCE_AUDIT_20261109.md)。早先的基线与交接：[谱面开发基线](CHART_DEVELOPMENT_BASELINE_20261024.md)、[Combo 与线路 V9](CHART_COMBO315_AND_ROUTE_AUDIT_V9_20261026.md) |
| 开发消费绑定 | 受跟踪 `readmodels/bootstrap.inline.json`：release `a15e642d20f5003730751d6227d95b5248f908e473e598bcce5c48a10e0cc160`；data revision `d049f4fa79d4740bdef1f6dd53b59e20a41d030697c443ba2a082c58d7d5adee`；media epoch `voice64-gzip-all-20260924`。这是源码/dev 消费值，不代表线上版本（线上见下表） |
| 启动预算 | 单一来源 `readmodels/contracts/startup-policy.json`；当前初始 JS gzip 估计 197,444 B（上限 216,064 B）。旧文档里的 204,800 / 215,040 等数字已过时 |
| 已有阶段 tag | `baseline/2026-10-20`（另保留 `baseline/2026-10-14`）；之后未新增 master 基线 tag（未核实 10-20 之后是否有人另打） |

## 发布快照（2026-11-10）

发布规则的唯一来源是 [RELEASE_CONTRACT.md](RELEASE_CONTRACT.md)（两个环境、四道门、命令序列、例外发布、回滚、R2 规则）；本页只记事实快照。

Pages 项目 `gs-archive-preview` 同时承载 preview 与 production，共用 R2 桶 `sidem-archive-preview`。项目接了 GitHub，但 production 自动部署是关的，只有 `wrangler pages deploy` 上传的部署才会上线；判断线上是哪个版本，看项目的 `canonical_deployment` 加线上回执，不看部署列表里最新的一条。

| 环境 | 值 |
|---|---|
| preview（分支 `gs-architecture-device-test`，`https://preview.gs-archive.com`） | 2026-11-10 部署源码 `53c3737c` → Pages 部署 `109adac3`，用新的 `scripts/prepare-pages-package.mjs --target preview` 打包。read-model release `a15e642d20f5003730751d6227d95b5248f908e473e598bcce5c48a10e0cc160`；data revision `d049f4fa79d4740bdef1f6dd53b59e20a41d030697c443ba2a082c58d7d5adee`；compiled revision `4afb61ee02808965c8149f335b2f246f3afe543423f65fd8b9afa5de2c02fbed`；译文 release `61c373ae`（1665 个包，逐字节比对通过）。`verify-deployed-site` 全 PASS，一条预期 WARN：缺失的 `/_app` chunk 会被 SPA 回退成 200 HTML |
| production（分支 `master`，`https://gs-archive.com` 与 `gs-archive-preview.pages.dev`） | 目前是 2026-11-04 用户授权的例外发布：Pages 部署 `924c79bb`，源码 `ff69dc7b`；`gs-archive.com` 顶级域 CNAME 于 2026-11-09 生效。更早的正式站记录见 [PRODUCTION_RELEASE_20261012.md](PRODUCTION_RELEASE_20261012.md) |

<!-- PRODUCTION-20261110: supervisor fills in after the production deploy -->

R2 现状：桶用量、各 versions 前缀的清单与最近批次的叠加链未在本次核对（未核实）；批次记录见 [R2 批次记录](GS_ARCHIVE_R2_RELEASE_20261021.md)，上传流程见 [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md)，R2 规则见契约第 7 节。部署前后的只读核对见 [RELEASE_PIPELINE_CHECKS_20261109.md](RELEASE_PIPELINE_CHECKS_20261109.md)。

## 各条线

> 本表各行写于 2026-10-30 前后，分支、“未部署”和下一步多数已过时；最新进度以上方 master 摘要、对应 PR 与各线交接文档为准，逐行未重新核实。

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 剧情 / ADV | 无进行中分支（#59 候选工具、#66–#69/#71/#73 原生效果已合入） | 入口：[GS_ARCHIVE_HANDOFF_20261020_STORY.md](GS_ARCHIVE_HANDOFF_20261020_STORY.md)。语料已随 #78 / `64e91828` 晋升，13 个 RAW 文件已核对，Valentine 补抽51条并修复102处错接，见 [晋升记录](STORY_RECOMPILE_PROMOTION_20261021.md)。这些代码/语料已在主干，新增语音与变更产物的后续R2/站点发布仍待办；不得把未部署写成未晋升。翻译批次可按合集目录恢复。粒子剩樱花（需给共用采样器加 ForceModule，红叶/雪语料未使用）；part 之间原生是 0.5 秒渐黑再停 1 秒，我们是直接切黑 |
| 门户 portal | 无进行中分支（节目册 2.0 #106–#119、#125 已合入） | **当前状态只看 [门户进度表](PORTAL_REDESIGN_PROGRESS_20261027.md)**：P0–P5、P6 卡面 / 偶像 / 活动 / 组合 / 卡池骨架、P7 摄影开始方式与单一布局已合入；P6 歌曲 / 图鉴余项、P7 阅读器 / 播放器仍开放。P6 五类详情整页与返回、#101 Escape 已在进度表记录完成；后续优先补 P7 阅读器 / 播放器，真机缺口另列。规格仍按 [节目册 2.0 交接](GS_ARCHIVE_HANDOFF_20261027_PORTAL_REDESIGN.md)。衣装筛选见 [COSTUME_CATEGORY_FILTERS_20261025.md](COSTUME_CATEGORY_FILTERS_20261025.md)；图鉴动态预览仍待办。故事入口一律经 `src/core/StoryOwner.js` 落到归属页，不再新增通用故事页。盲测条目先分到剧情播放器 / 门户视觉 / 舞台三条线再改；商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查（含竖屏 ADV 横向压缩）；正式站发布与 noindex 决定；关于页联系方式待定。启动 JS 预算已由导航改版调整至 210 KiB（215,040 gzip bytes，`379ec5cf`）；后续以当前 build 审计为准 |
| 翻译 i18n | `i18n/20261031-coverage-audit`；Reader 32,760 条有译文，304 个季节标题覆盖 306 段；Chats 12 批 11,534 条已入 draft。从 002 首轮补正 746 条，续验 chat003–012 分别追加修正 81/111/86/176/100/108/131/233/183/150 条，另补正4处称谓与空格，并按用户提示处理最后14条疑点，见[Chats 验收](TRANSLATION_CHATS_ACCEPTANCE_20261031.md)；未部署 | chat002–012 的10,535条已逐句复验；002 修复 21 条错接，006 修复 70 条字面换行错误并新增验收检查，007 统一阿斯兰称谓并纠正增译，008 统一もふもふえん与花音自称并纠正增译，009 修正武／武先生等称谓并按用户定译チャンプ为冠军。011 修复 9 条错接；本线已同步 origin/master `62c5b27b`，构建与翻译绑定复验通过；本轮回填验收范围已闭环，仍保持draft；[原14条待审处理记录](TRANSLATION_CHATS_PENDING_REVIEW_20261101.md)已含chat001的两条并全部处理，犬名沿用阿尔托；[确认术语](../translation/bible/verified/chat-terms-20261101.md)已进入后续导出。Chats missing/stale 0，uncertain 0，不等于 reviewed。其他语音仍走各自回传流程；[历史回填记录](TRANSLATION_CHATS_REVIEW_20261031.md)保留原凭据 |
| 谱面 chart | 无进行中分支（#98 原生投影、#100 自动演示时间线已合入） | 最新交接 [Combo 与线路 V9](CHART_COMBO315_AND_ROUTE_AUDIT_V9_20261026.md)，下一批按其「下一批建议顺序」；另见 [开发基线](CHART_DEVELOPMENT_BASELINE_20261024.md)、[原生证据审计](CHART_ASSUMPTION_AUDIT_20261023.md)。仍开放：输入判定、完整原机粒子 / GPU 等价、共享 hold 循环与 Special 等音效 cue、物理手机验收。谱面界面改版并入门户交接 P3 |
| 舞台 stage | 无进行中分支（#103 舞台衣装归族、#95 粒子/Smoke 已合入） | 舞台面板改版（曲目页、编队页、画面页）并入门户交接 P4。#103 内容：549 个 Live 模型按适用范围→款式→普通/另一款→逐人 ID→当前出演位覆盖分层，个人衣装下拉分组；全员/组合/属性/跨组合套服可按可用成员应用，缺版本者保留原装。设计、来源和验收见 [STAGE_COSTUME_FAMILIES_20261025.md](STAGE_COSTUME_FAMILIES_20261025.md)。已再核对 141 个常服/剧情专用模型只有 comu、无 cos，不加入舞台舞蹈资源；摄影/图鉴 comu 预览留待办。前轮[收口记录](STAGE_PR_CLOSEOUT_20261023.md)的边界（Smoke partial、原机/GPU、RNG、Noise、参考时钟等）继续保留；本轮未部署 |
| 深链接（portal 线的地址层） | 无进行中代码分支；R1–R4按已定方案收束 | R1 #121、R2 #123、集成 #129、谱面 #132、舞台 #136 已合入。P6 #133、摄影开始方式 #134 与布局 #135 已合入；摄影路径 #137 已以 `71012ebf` 合入（源码 `ade7fad1`、CI `40906924145` 成功），工作台 `/studio/edit/`，入口仍 `/studio/`，R3 按 D3 决定收束。用户已确认 D3：图鉴和摄影实体保留目录＋query 抽屉，暂不新增实体路径。见 [摄影路径记录](GS_ARCHIVE_STUDIO_PATH_20261029.md)。R4 #139 已以 `97b1a1ae` 合入（源码 `05706ddd`，CI `40924998207` SUCCESS）：Reader/Player保留query、Reader来源进history、13类Player返回合同强制裁剪，见 [R4记录](GS_ARCHIVE_DEEP_LINKS_R4_20261030.md)；D3目录＋query、D4丙；P7界面、真机、媒体发布和D5域名/索引决定独立；本任务按门禁提交、建 PR、合并，发布独立。 |

舞台 Smoke 补证（同分支，输入 `91f61d32` / `8290ec28` / `84350bde`）：6系统/120个受控出生位置与单位方向、+1.5/+7/−7原生startSpeed及down两系统的6条无外力轨迹已核对。side四系统确认快速缓存拒绝非0/1端点，改走原生通用曲线，双常量重力→限速→积分16轨迹/320粒子检查点同新增JS运动核对照，最大误差1.06e−5。对照已纳入object-emitter门禁，见[Smoke来源记录](NATIVE_SMOKE_SOURCE_20261023.md)。此段为当时补证边界；随后已接入确定性 Web 场景预览，原机时钟/退休调度及完整场景等价仍开放。

Smoke UV补证（输入 `f5f174a7`）：down两系统的1×12源网格经过原生renderer context与UV writer的32个受控四边形核对，真实frame分配函数保留1024/12小数行高；side无UV且非循环发射。当时未改渲染逻辑；后续已接入场景消费者，原生完整UV更新/发射时钟仍待核对，见同一[Smoke记录](NATIVE_SMOKE_SOURCE_20261023.md)。

舞台本轮已随 PR #95 合入，按用户要求收口：来源参数 Smoke 预览及桌面/手机冷加载、停止尾烟、换曲和倒退验收已完成；完整结果、PR 描述草稿与延后待办见 [STAGE_PR_CLOSEOUT_20261023.md](STAGE_PR_CLOSEOUT_20261023.md)。不再扩展排查，后续新一轮从合入后的 master 开分支；本轮无 R2 上传或部署。

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，已落后 master 70+ 个提交，`StoryViewer.vue`、`useVoicePlayer.js`、`VoiceLipStore.js`、`AdvUI.vue` 预计冲突。建议在新的 `portal/` 分支上基于 master 重做，不直接合并；未做真机/iOS 验证。
- `portal/20261027-p6-idol-detail`（`a24c9bfd`）、`portal/20261023-sidebar-split-rows`（`fe36b14f`）：补丁都已在 master（`git cherry` 为 `-`，前者等于 #119 的 `cbac9ec1`），可打 `archive/` tag 后删，由用户执行。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，只需联接 `node_modules`，语料不拷不联接：dev 服务把 worktree `public/` 里没有的 `/assets`、`/data` 文件从主 checkout 的 `public/` 读（`scripts/lib/public-corpus-plugin.mjs`，两边都没有就是 404），源配置读主 checkout 的 `config/archive_sources.local.json`（JS 与 `data_pipeline/archive_paths.py` 同一规则）。旧 worktree 若 `web_viewer/public` 是联接，删 worktree 前先解联接。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177。不设 `SIDEM_READMODEL_CANDIDATE` 时，dev 服务在本地配置的 `readmodel_candidates_root`（本机为 `E:/Web_build/GS_Archive_Domain_Work`）里挑 release 与 `readmodels/bootstrap.inline.json` 相同的候选；找不到会在启动日志里警告，`/_catalog` 请求返回 404。要看别的候选仍可显式设置。
- 谱面验收服务：5231，worktree `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`；bootstrap release `1accd9d0`。复用前仍核对进程和实际 HTTP 模块。
- 最近一轮舞台验收服务记录：5213，主 checkout `web_viewer`，候选 `rm-release-20261015`；5212 仍服务旧舞台 worktree。复用前检查实际 HTTP 模块和 bootstrap，不凭端口判断分支。
- 复现 CI：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接；主 checkout 有语料又是 CRLF，会把 CI 红项跑绿。
- 10-19 整理后的旧发布包、任务包、worktree 快照在 `E:/GS_Archive_cold/20261019/`。


## 深链接主干集成补验（2026-10-29）

在 master `7c7312c1` 上以 `portal/20261029-deep-links-integration` 补 P67–P73：歌曲筛选返回、活动面包屑/后退、组合前传具体章节冷刷新/返回、手机卡片筛选/下一张/返回与筛选 Escape。发现并修复 `openUnitStory()` 未传 storyFile，见 [本轮执行记录](GS_ARCHIVE_DEEP_LINKS_INTEGRATION_20261029.md)。这不是 R3/R4 或 P6 全矩阵验收；其技术前置仍保留。5240 本轮恢复为上述专用工作树 dev，候选 `rm-release-20261022`，复用前仍核对进程。
