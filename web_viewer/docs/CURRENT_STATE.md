# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-23（本轮舞台从 master #78 新开；站点/R2 仍为历史记录，未重新验收）

## 基线

| 项 | 值 |
|---|---|
| master | 10-14 整合合并 PR #48，tag `baseline/2026-10-14`；之后并入 #49（codex R2 上传记录）、#50（release 绑定 + i18n 线）、#52（10-15 翻译）、#54（B036 情人节 2022 上）、#55（舞台原生还原收尾），以及本页所在的 #53（门户原生 ADV 站位、其他语音、事务所 ADV 预览、剧情服装、歌曲中心线）。#53 合入后打 `baseline/2026-10-20`。之后 10-20 再合 #56（门户视觉收敛）、#57（ADV 每帧姿势重置、脸红/汗、摄影工坊原生脸部 flags）、#58（电话/电视/混响走 CRI `bus_phone` / `bus_reverb`），以及 #59（重编译候选工具与原生裸 wait 停顿，不含语料）；之后 #60（门户 UX）、#61（导航命名与响应式导航）、#62（ADV 立绘缩放锚点）、#63（工作树共享语料服务）、#64（完整源码门禁报告）、#65（事务所/手机静态路径），之后合入 #66（ADV原生色彩滤镜）、#67（ADV背景模糊）、#68（ADV原生天气粒子）；10-21 再合 #69（直通 alpha 效果纹理、大雨锚点）、#70（组合剧情页与组合前传落地页）、#71（原生 punch 粒子）、#72（每篇故事唯一归属页、活动剧情落地页）、#73（part 开头原生黑场与效果渐变色）、#74（退役 story_detail 与旧故事文件浏览）、#75（10-21 R2 上传记录、剧情 plan 跟随联接扫描）、#76（舞台 10-20/21 轮：原生粒子接线与顺时针角度、成员站位、舞台分片加载） |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015` |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab`（worktree `.deploy/release-20261015`，6,397 个对象，已上传）。下一批的叠加链最新一项：worktree `.analysis/release-20261015/overlay-20261015.json` |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`：源码 `126567c8`、release `2430ef3d`、data `fda1a54c`（2026-10-15）。部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

10-21 R2 后续批次（#75）：已按用户清单清理 6 个旧 versions 前缀（28,413 对象 / 864,334,155 B），并上传 manifest 7f82de33 的 8,540 个对象，新数据版本 d1486597。实际桶占用 7,688,943,418 B。站点与 read-model 绑定仍为上表值；本批未部署。最新新增批次及下一次 baseline overlay 的使用方式见 [R2 批次记录](GS_ARCHIVE_R2_RELEASE_20261021.md)。 下一次叠加链：seed → 10-04 `uploaded-baseline.json` → overlay-20261021（10-19 清理删掉了 10-04/10-06 批次 manifest，旧链加载不了）。

## 各条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 剧情 / ADV | 无进行中分支（#59 候选工具、#66–#69/#71/#73 原生效果已合入） | 入口：[GS_ARCHIVE_HANDOFF_20261020_STORY.md](GS_ARCHIVE_HANDOFF_20261020_STORY.md)。语料晋升另开分支，门槛是 13 个 RAW 核对文件和 Valentine b 段语音补抽；#58 的 SE `sheet` 总线路由与 #73 的 part 开头黑场都要晋升后才在已发布 compiled 上生效。晋升后才恢复翻译批次。粒子剩樱花（需给共用采样器加 ForceModule，红叶/雪语料未使用）；part 之间原生是 0.5 秒渐黑再停 1 秒，我们是直接切黑 |
| 门户 portal | 无进行中分支（#60–#62、#65、#70、#72、#74 已合入；后续从最新 master 开） | 故事入口一律经 `src/core/StoryOwner.js` 落到归属页，不再新增通用故事页。盲测条目先分到剧情播放器 / 门户视觉 / 舞台三条线再改；商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查（含竖屏 ADV 横向压缩）；正式站发布与 noindex 决定；关于页联系方式待定。启动 JS 预算已由导航改版调整至 210 KiB（215,040 gzip bytes，`379ec5cf`）；后续以当前 build 审计为准 |
| 翻译 i18n | 暂停到剧情语料晋升之后（晋升会新增 1697 个文件的 text_ref）；无进行中分支（B036 已随 #54 合入；`i18n/20261015-translation` 已打 `archive/` tag 删除） | 下一批从新的 `i18n/<日期>-<主题>` 开。草稿 receipt 必须在 LF worktree 生成或复核：CRLF 检出算出的 `edits_sha256` 在 CI 上必红。`config/translation-audit/general-ui.json` 在各 worktree 常有只改元数据的未提交差异，提交前先确认 |
| 舞台 stage | `stage/20261022-particle-gaps`，从 `origin/master` / `aa987f40`（#78）新开，现已普通merge master `6048cb13`（#92）；前轮已随 #76 合入（[前轮记录](STAGE_ROUND_20261020_21.md)） | [倾斜父链](NATIVE_LOCAL_PARENT_PANELS_20261022.md)、[JFHTMK非等比面板](NATIVE_JFHTMK_PANEL_20261022.md)后，已完成[Pavé Étoiles环面面板](NATIVE_PAVETL_TORUS_20261022.md)，120个受控原生粒子位置对照通过。随后已接通[precious love四组Bloom](NATIVE_PCUSLV_BLOOM_20261022.md)的12系统，原生限速108轨迹/3312步、倾斜Local父链36顶点用例通过。已继续接通[強く尊き獣たち电弧](NATIVE_TKTKKT_ELECTRIC_20261023.md)：14发射系统、3禁用发射容器，双渐变864个RGBA32输出及尺寸夹取252例通过。已接通[bnckgy火焰](NATIVE_BNCKGY_FIRE_20261023.md)：36发射器/6禁用容器，1728受控圆锥、2400场景与540尺寸用例通过；Object_layer粒子资源级无consumer缺口0种/0事件/0编排，不代表原机等价。[FLASH LIGHT逐瓣叠色复核](FLASH_LIGHT_FLOOR_RECHECK_20261023.md)确认10-15反编译修正仍有效，地面无需重做；随后修正[Center台词固定嘴型目标](NATIVE_CENTER_MOUTH_TARGET_20261023.md)漏做槽位映射的问题，两首台词现作用到中心3号位，29条命令映射回归通过。随后接通[GO FOR IT!!单人脚光](NATIVE_GOFRIT_FOOT_SOLO_20261023.md)的241条命令，分别写入人物原生材质，保留全员/单人擦除差异；5213服务现PID64608。运动环面、Noise、参考时钟、原片/设备、RNG、mixed/CanvasGroup与内置分支边界保留；[独立Smoke来源与几何](NATIVE_SMOKE_SOURCE_20261023.md)已固定2组/6系统/5条指令及42个原生四边形用例，已完成 moving-edge/有符号速度、side 限速积分与 UV 补证，并接入来源参数 Smoke 预览（partial，2曲5指令；非原机等价）；既有暂停响应和受控冷加载对比仍开放；本轮资源及分片未部署 |

舞台 Smoke 补证（同分支，输入 `91f61d32` / `8290ec28` / `84350bde`）：6系统/120个受控出生位置与单位方向、+1.5/+7/−7原生startSpeed及down两系统的6条无外力轨迹已核对。side四系统确认快速缓存拒绝非0/1端点，改走原生通用曲线，双常量重力→限速→积分16轨迹/320粒子检查点同新增JS运动核对照，最大误差1.06e−5。对照已纳入object-emitter门禁，见[Smoke来源记录](NATIVE_SMOKE_SOURCE_20261023.md)。此段为当时补证边界；随后已接入确定性 Web 场景预览，原机时钟/退休调度及完整场景等价仍开放。

Smoke UV补证（输入 `f5f174a7`）：down两系统的1×12源网格经过原生renderer context与UV writer的32个受控四边形核对，真实frame分配函数保留1024/12小数行高；side无UV且非循环发射。当时未改渲染逻辑；后续已接入场景消费者，原生完整UV更新/发射时钟仍待核对，见同一[Smoke记录](NATIVE_SMOKE_SOURCE_20261023.md)。

舞台本轮按用户要求收口：来源参数 Smoke 预览及桌面/手机冷加载、停止尾烟、换曲和倒退验收已完成；完整结果、PR 描述草稿与延后待办见 [STAGE_PR_CLOSEOUT_20261023.md](STAGE_PR_CLOSEOUT_20261023.md)。不再扩展排查，后续新一轮从合入后的 master 开分支；本轮无 R2 上传或部署。

## 未合入但保留的分支

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，已落后 master 70+ 个提交，`StoryViewer.vue`、`useVoicePlayer.js`、`VoiceLipStore.js`、`AdvUI.vue` 预计冲突。建议在新的 `portal/` 分支上基于 master 重做，不直接合并；未做真机/iOS 验证。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，只需联接 `node_modules`，语料不拷不联接：dev 服务把 worktree `public/` 里没有的 `/assets`、`/data` 文件从主 checkout 的 `public/` 读（`scripts/lib/public-corpus-plugin.mjs`，两边都没有就是 404），源配置读主 checkout 的 `config/archive_sources.local.json`（JS 与 `data_pipeline/archive_paths.py` 同一规则）。旧 worktree 若 `web_viewer/public` 是联接，删 worktree 前先解联接。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177。不设 `SIDEM_READMODEL_CANDIDATE` 时，dev 服务在本地配置的 `readmodel_candidates_root`（本机为 `E:/Web_build/GS_Archive_Domain_Work`）里挑 release 与 `readmodels/bootstrap.inline.json` 相同的候选；找不到会在启动日志里警告，`/_catalog` 请求返回 404。要看别的候选仍可显式设置。
- 本轮舞台分支服务：5213，主 checkout `web_viewer`，候选 `rm-release-20261015`；5212 仍服务旧舞台 worktree。复用前检查实际 HTTP 模块和 bootstrap，不凭端口判断分支。
- 复现 CI：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接；主 checkout 有语料又是 CRLF，会把 CI 红项跑绿。
- 10-19 整理后的旧发布包、任务包、worktree 快照在 `E:/GS_Archive_cold/20261019/`。
