# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-20 晚（master 与门户/剧情线；舞台行由舞台线维护，站点/R2 仍为历史记录，未重新验收）

## 基线

| 项 | 值 |
|---|---|
| master | 10-14 整合合并 PR #48，tag `baseline/2026-10-14`；之后并入 #49（codex R2 上传记录）、#50（release 绑定 + i18n 线）、#52（10-15 翻译）、#54（B036 情人节 2022 上）、#55（舞台原生还原收尾），以及本页所在的 #53（门户原生 ADV 站位、其他语音、事务所 ADV 预览、剧情服装、歌曲中心线）。#53 合入后打 `baseline/2026-10-20`。之后 10-20 再合 #56（门户视觉收敛）、#57（ADV 每帧姿势重置、脸红/汗、摄影工坊原生脸部 flags）、#58（电话/电视/混响走 CRI `bus_phone` / `bus_reverb`），头 `dd1035dc` |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015` |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab`（worktree `.deploy/release-20261015`，6,397 个对象，已上传）。下一批的叠加链最新一项：worktree `.analysis/release-20261015/overlay-20261015.json` |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`：源码 `126567c8`、release `2430ef3d`、data `fda1a54c`（2026-10-15）。部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

10-21 R2 后续批次：已按用户清单清理 6 个旧 versions 前缀（28,413 对象 / 864,334,155 B），并上传 manifest 7f82de33 的 8,540 个对象，新数据版本 d1486597。实际桶占用 7,688,943,418 B。站点与 read-model 绑定仍为上表值；本批未部署。最新新增批次及下一次 baseline overlay 的使用方式见 [R2 批次记录](GS_ARCHIVE_R2_RELEASE_20261021.md)。

## 各条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 剧情 / ADV | `portal/20261020-story-recompile`（PR #59：重编译候选工具 + 原生裸 wait 停顿，不含语料） | 入口：[GS_ARCHIVE_HANDOFF_20261020_STORY.md](GS_ARCHIVE_HANDOFF_20261020_STORY.md)。合 master 后可先合 #59；语料晋升另开分支，门槛是 13 个 RAW 核对文件和 Valentine b 段语音补抽；晋升后才恢复翻译批次 |
| 门户 portal | 无进行中分支（#56/#57/#58 已合入；UX 盲测已完成，结果待按线分拣） | 盲测条目先分到剧情播放器 / 门户视觉 / 舞台三条线再改；商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查（含竖屏 ADV 横向压缩）；正式站发布与 noindex 决定。启动 JS 预算只剩约 0.1 KB（204,677 / 204,800 gzip），下一个进启动 chunk 的功能要先拆分或由用户决定放宽 |
| 翻译 i18n | 暂停到剧情语料晋升之后（晋升会新增 1697 个文件的 text_ref）；无进行中分支（B036 已随 #54 合入；`i18n/20261015-translation` 已打 `archive/` tag 删除） | 下一批从新的 `i18n/<日期>-<主题>` 开。草稿 receipt 必须在 LF worktree 生成或复核：CRLF 检出算出的 `edits_sha256` 在 CI 上必红。`config/translation-audit/general-ui.json` 在各 worktree 常有只改元数据的未提交差异，提交前先确认 |
| 舞台 stage | 无进行中分支（10-14 轮已随 #55 合入） | 下一轮以加载策略为主、MV 消费检查为辅，起点见 [STAGE_LOAD_STRATEGY_20261020.md](STAGE_LOAD_STRATEGY_20261020.md)。未完成项在 [STAGE_LAYER_AUDIT_TODO_20261014.md](STAGE_LAYER_AUDIT_TODO_20261014.md)：Time Before Time、Change to Chance 接线未完成，32 个粒子资源无消费者 |

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，已落后 master 70+ 个提交，`StoryViewer.vue`、`useVoicePlayer.js`、`VoiceLipStore.js`、`AdvUI.vue` 预计冲突。建议在新的 `portal/` 分支上基于 master 重做，不直接合并；未做真机/iOS 验证。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，只需联接 `node_modules`，语料不拷不联接：dev 服务把 worktree `public/` 里没有的 `/assets`、`/data` 文件从主 checkout 的 `public/` 读（`scripts/lib/public-corpus-plugin.mjs`，两边都没有就是 404），源配置读主 checkout 的 `config/archive_sources.local.json`（JS 与 `data_pipeline/archive_paths.py` 同一规则）。旧 worktree 若 `web_viewer/public` 是联接，删 worktree 前先解联接。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177。不设 `SIDEM_READMODEL_CANDIDATE` 时，dev 服务在本地配置的 `readmodel_candidates_root`（本机为 `E:/Web_build/GS_Archive_Domain_Work`）里挑 release 与 `readmodels/bootstrap.inline.json` 相同的候选；找不到会在启动日志里警告，`/_catalog` 请求返回 404。要看别的候选仍可显式设置。
- 复现 CI：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接；主 checkout 有语料又是 CRLF，会把 CI 红项跑绿。
- 10-19 整理后的旧发布包、任务包、worktree 快照在 `E:/GS_Archive_cold/20261019/`。
