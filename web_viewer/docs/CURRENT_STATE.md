# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-20（Git 基线与舞台线；站点、R2 和其他线仍为下列历史记录，未重新验收）

## 基线

| 项 | 值 |
|---|---|
| master | 2026-10-20 fetch 核实 `e6cd9641`，已合入 #51 发布记录、#52/#54 翻译与 #55 舞台；历史基线 tag `baseline/2026-10-14` |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015` |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab`（worktree `.deploy/release-20261015`，6,397 个对象，已上传）。下一批的叠加链最新一项：worktree `.analysis/release-20261015/overlay-20261015.json` |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`：源码 `126567c8`、release `2430ef3d`、data `fda1a54c`（2026-10-15）。部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

## 各条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 门户 portal | `portal/20261014-portal-polish`（需先 merge origin/master） | 商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查；正式站发布与 noindex 决定 |
| 翻译 i18n | `i18n/20261015-translation` | 新开的翻译线。`config/translation-audit/general-ui.json` 在各 worktree 常有只改元数据的未提交差异，提交前先确认 |
| 舞台 stage | `stage/20261020-native-followup`，从最新 `origin/master` / `e6cd9641` 新开；旧代已随 #55 合入 | 当前入口：[10-20 检查与修复路线](STAGE_FOLLOWUP_20261020.md)。新悬灯Sprite、Time Before Time与[公共RGBA混合](NATIVE_ADDITIVE_RGBA_20261020.md)已修并验证；下一项缺家族、Sprite淡入公共语义。原片对照、32种无consumer粒子、旧悬灯9份partial仍开放 |

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，等用户决定是并入 portal 线还是放弃。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，用目录联接引用主 checkout 的语料。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177，`SIDEM_READMODEL_CANDIDATE=<候选目录>`。
- 本轮舞台分支服务：5213，主 checkout `web_viewer`，候选 `rm-release-20261015`；5212 仍服务旧舞台 worktree。复用前检查实际 HTTP 模块和 bootstrap，不凭端口判断分支。
