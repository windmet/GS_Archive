# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-14

## 基线

| 项 | 值 |
|---|---|
| master | 2026-10-14 整合合并（PR 见 `git log --merges master -1`），tag `baseline/2026-10-14` |
| read-model release | `1770c925ee62f877594c81b62bafc774642af7123308b502067efd0d7ed00838`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261014` |
| R2 data revision | `f1a9b99712d0740cf6184ee67c7e4f706b4821fef81f08fdad6629b4347ffbb4`（`.deploy/release-20261014`，7,088 个对象） |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`，部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

## 两条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 门户 portal | `portal/20261014-portal-polish` | 商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查；正式站发布与 noindex 决定 |
| 舞台 stage | `stage/20261014-native-fidelity` | 见 [STAGE_GAP_AUDIT_20261014.md](STAGE_GAP_AUDIT_20261014.md)：指令→消费者矩阵、Penlight、新悬灯色相/BeatShow、旧悬灯白名单、tempo 基准 |

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，等用户决定是并入 portal 线还是放弃。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，用目录联接引用主 checkout 的语料。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177，`SIDEM_READMODEL_CANDIDATE=<候选目录>`。
