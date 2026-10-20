# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-20（Git 基线与舞台线；站点、R2 和其他线仍为下列历史记录，未重新验收）

## 基线

| 项 | 值 |
|---|---|
| master | 2026-10-20 fetch 核实 `5aab5644`，tag `baseline/2026-10-20`；已合入 #51 发布记录、#52/#54 翻译、#55 舞台，以及 #53 门户原生 ADV 站位、其他语音、事务所 ADV 预览、剧情服装、歌曲中心线。历史基线 tag `baseline/2026-10-14` |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015` |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab`（worktree `.deploy/release-20261015`，6,397 个对象，已上传）。下一批的叠加链最新一项：worktree `.analysis/release-20261015/overlay-20261015.json` |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`：源码 `126567c8`、release `2430ef3d`、data `fda1a54c`（2026-10-15）。部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

## 各条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 门户 portal | `portal/20261015-native-adv-placement`（PR #53，合入后删除，同时删已包含在内的 `portal/20261015-song-voice-slot`） | 商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查（含竖屏 ADV 横向压缩）；正式站发布与 noindex 决定。启动 JS 预算只剩约 0.1 KB（204,677 / 204,800 gzip），下一个进启动 chunk 的功能要先拆分或由用户决定放宽 |
| 翻译 i18n | 无进行中分支（B036 已随 #54 合入；`i18n/20261015-translation` 已打 `archive/` tag 删除） | 下一批从新的 `i18n/<日期>-<主题>` 开。草稿 receipt 必须在 LF worktree 生成或复核：CRLF 检出算出的 `edits_sha256` 在 CI 上必红。`config/translation-audit/general-ui.json` 在各 worktree 常有只改元数据的未提交差异，提交前先确认 |
| 舞台 stage | `stage/20261020-native-followup`，从 `e6cd9641` 新开，本轮同步 `origin/master` / `5aab5644`；旧代已随 #55 合入 | 当前入口：[10-20 检查与修复路线](STAGE_FOLLOWUP_20261020.md)。新悬灯Sprite、Time Before Time与[公共RGBA混合](NATIVE_ADDITIVE_RGBA_20261020.md)已修并验证；下一项加载策略见 [STAGE_LOAD_STRATEGY_20261020.md](STAGE_LOAD_STRATEGY_20261020.md)，同时继续缺家族、Sprite淡入公共语义检查。原片对照、32种无consumer粒子、旧悬灯9份partial仍开放 |

舞台线同日加载进度：[编舞目录与逐编排分片](STAGE_CHOREOGRAPHY_SHARDS_20261020.md)已接入当前舞台；118份来源/轨道等价、156项门禁通过。新分片为本地派生资源，后续发布必须纳入目录引用的全部118片；本轮没有部署。其他全局大索引与加载预算仍待推进。

舞台线随后已接入 [效果/Stagelight成对分片](STAGE_EFFECT_SHARDS_20261020.md)，实际舞台不读这两份全局大文件；发布还需新清单引用的119份效果文件。默认DRIVE索引序列降至6.26MB，emitter/Penlight、并行开播和真实预算仍开放。

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，已落后 master 70+ 个提交，`StoryViewer.vue`、`useVoicePlayer.js`、`VoiceLipStore.js`、`AdvUI.vue` 预计冲突。建议在新的 `portal/` 分支上基于 master 重做，不直接合并；未做真机/iOS 验证。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，用目录联接引用主 checkout 的语料（`web_viewer/public` 常是联接，删 worktree 前先解联接）。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177，`SIDEM_READMODEL_CANDIDATE=<候选目录>`。
- 本轮舞台分支服务：5213，主 checkout `web_viewer`，候选 `rm-release-20261015`；5212 仍服务旧舞台 worktree。复用前检查实际 HTTP 模块和 bootstrap，不凭端口判断分支。
- 复现 CI：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接；主 checkout 有语料又是 CRLF，会把 CI 红项跑绿。
- 10-19 整理后的旧发布包、任务包、worktree 快照在 `E:/GS_Archive_cold/20261019/`。
