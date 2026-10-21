# 当前状态（新任务从这里开始）

每次 PR 合入 master 时更新。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)；带日期的 HANDOFF / BATCH / AUDIT 文档是历史证据，以本页为准。

更新：2026-10-21（舞台粒子接线与旋转方向修复，已同步 master #60–#68；站点/R2 仍为历史记录，未重新验收）

## 基线

| 项 | 值 |
|---|---|
| master | 10-14 整合合并 PR #48，tag `baseline/2026-10-14`；之后并入 #49（codex R2 上传记录）、#50（release 绑定 + i18n 线）、#52（10-15 翻译）、#54（B036 情人节 2022 上）、#55（舞台原生还原收尾），以及本页所在的 #53（门户原生 ADV 站位、其他语音、事务所 ADV 预览、剧情服装、歌曲中心线）。#53 合入后打 `baseline/2026-10-20`。之后 10-20 再合 #56（门户视觉收敛）、#57（ADV 每帧姿势重置、脸红/汗、摄影工坊原生脸部 flags）、#58（电话/电视/混响走 CRI `bus_phone` / `bus_reverb`），以及 #59（重编译候选工具与原生裸 wait 停顿，不含语料）；之后 #60（门户 UX）、#61（导航命名与响应式导航）、#62（ADV 立绘缩放锚点）、#63（工作树共享语料服务）、#64（完整源码门禁报告）、#65（事务所/手机静态路径），之后合入 #66（ADV原生色彩滤镜）、#67（ADV背景模糊）、#68（ADV原生天气粒子），当前头 `2e115f68` |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；候选目录 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015` |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab`（worktree `.deploy/release-20261015`，6,397 个对象，已上传）。下一批的叠加链最新一项：worktree `.analysis/release-20261015/overlay-20261015.json` |
| media epoch | `voice64-gzip-all-20260924` |
| 正式站 | `gs-archive-preview.pages.dev`，仍是 10-12 的 `?view=` 版本（源码 `612f7519` 一线）。发布需用户授权 |
| 测试站 | `preview.gs-archive.com` / `gs-architecture-device-test.gs-archive-preview.pages.dev`：源码 `126567c8`、release `2430ef3d`、data `fda1a54c`（2026-10-15）。部署记录见 [GS_ARCHIVE_TEST_DEPLOY_20261014.md](GS_ARCHIVE_TEST_DEPLOY_20261014.md) |

## 各条线

| 线 | 当前分支 | 下一步 |
|---|---|---|
| 剧情 / ADV | PR #59 已合入 `master`（重编译候选工具 + 原生裸 wait 停顿，不含语料） | 入口：[GS_ARCHIVE_HANDOFF_20261020_STORY.md](GS_ARCHIVE_HANDOFF_20261020_STORY.md)。语料晋升另开分支，门槛是 13 个 RAW 核对文件和 Valentine b 段语音补抽；晋升后才恢复翻译批次 |
| 门户 portal | #60 / #61 / #62 / #65 已合入 `master`，后续分支从最新 master 开 | 盲测条目先分到剧情播放器 / 门户视觉 / 舞台三条线再改；商店/兑换所从 wiki 整理；30 个无缩略图服装；真机检查（含竖屏 ADV 横向压缩）；正式站发布与 noindex 决定。启动 JS 预算已由 master 的导航改版调整至 210 KiB（215,040 gzip bytes，`379ec5cf`）；后续以当前 build 审计为准 |
| 翻译 i18n | 暂停到剧情语料晋升之后（晋升会新增 1697 个文件的 text_ref）；无进行中分支（B036 已随 #54 合入；`i18n/20261015-translation` 已打 `archive/` tag 删除） | 下一批从新的 `i18n/<日期>-<主题>` 开。草稿 receipt 必须在 LF worktree 生成或复核：CRLF 检出算出的 `edits_sha256` 在 CI 上必红。`config/translation-audit/general-ui.json` 在各 worktree 常有只改元数据的未提交差异，提交前先确认 |
| 舞台 stage | `stage/20261020-native-followup`，从 `e6cd9641` 新开，已同步 `origin/master` / `2e115f68`（#60–#68）；旧代已随 #55 合入 | 当前入口：[10-20 检查与修复路线](STAGE_FOLLOWUP_20261020.md)。新悬灯Sprite、Time Before Time与[公共RGBA混合](NATIVE_ADDITIVE_RGBA_20261020.md)已修并验证；下一项加载策略见 [STAGE_LOAD_STRATEGY_20261020.md](STAGE_LOAD_STRATEGY_20261020.md)，同时继续缺家族及 Sprite 参考时钟、mixed/内置分支边界。原片对照、21种无consumer粒子、旧悬灯9份partial仍开放 |

舞台线同日加载进度：[编舞目录与逐编排分片](STAGE_CHOREOGRAPHY_SHARDS_20261020.md)已接入当前舞台；118份来源/轨道等价、156项门禁通过。新分片为本地派生资源，后续发布必须纳入目录引用的全部118片；本轮没有部署。其他全局大索引与加载预算仍待推进。

舞台线随后已接入 [效果/Stagelight成对分片](STAGE_EFFECT_SHARDS_20261020.md)，实际舞台不读这两份全局大文件；发布还需新清单引用的119份效果文件。默认DRIVE索引序列降至6.26MB，emitter/Penlight、并行开播和真实预算仍开放。

舞台线已继续接入 [Penlight与emitter按需分片](STAGE_CONSUMER_SHARDS_20261020.md)：118份应援棒轨道、80份原生模型按歌曲引用读取，并修复缓存refinement早到与切歌代次归属。固定索引序列DRIVE降至1.79MB、HND降至2.96MB；请求18→19/21。158项源码门禁、build:check与桌面/手机尺寸Browser通过；后续发布另需199份派生文件，本轮未部署。真实开播预算与原片/设备对照仍开放。

舞台初次加载已完成 [独立输入并行](STAGE_INITIAL_PARALLEL_20261020.md)：时钟/音乐、编舞/效果同时读取，Penlight与对象索引不再挡住音频初始化。保留人物构建与初始seek屏障，Browser播放/刷新/返回通过；尚未宣称冷加载时间收益，可晚到分层及真实预算继续开放。

舞台线已同步master #56–#59（`4d31a402`），合并记录见 [晚间同步](STAGE_MASTER_SYNC_EVENING_20261020.md)。[分片发布闭包门禁](STAGE_SHARD_PACKAGING_GATE_20261020.md)已覆盖3个目录和436份分片；旧分片保留在盘上但从新inventory排除，增量打包在创建输出前复核。冷加载/生产HTTP与GPU检查仍开放，本轮未部署。

[舞台冷加载测量入口](STAGE_COLD_LOAD_MEASUREMENT_20261020.md)已支持4首代表曲、固定full/lite、场景就绪合同及就绪前CDP字节；失败与混构建样本不进中位数。源级回归与实际DOM正反例通过，尚未运行受控冷缓存新旧对比，没有新的耗时收益结论。

[RED HOT BEAT!! 左右烟雾](NATIVE_REHOBE_SMOKE_20261020.md)已按原编舞接入现有 Noise 预览链路：20 秒烟雾可见，停止/倒回/切歌已验，仍保留 `noise_preview`。emitter 为 82 组 / 724 系统 / 95 纹理，consumer 分片为 201 片，三目录闭包 438 片；无 consumer 粒子 32→30，partial 资源 11→13。本批未部署。

[Sprite 透明度公共诊断](NATIVE_OBJECT_SPRITE_FADE_AUDIT_20261020.md)已锁定 46 组 / 423 个 renderer 的 RAW 初值与原生 DOFade 链，确认首次从零淡入和初始 alpha 永久相乘两类消费者差异；544 次相邻命令重叠需保留旧 tween 语义。10-21 已补 [7 组受控原生 ARM64 回放](NATIVE_OBJECT_SPRITE_TWEEN_REPLAY_20261021.md)，确认首次 getter 捕获、旧 tween 续写、活动数组压缩和原生退场完成回调。消费者实现与验证见下方续批；原始 Conductor/设备帧历史仍未测。

10-21 [Sprite 消费者续批](NATIVE_OBJECT_SPRITE_CONSUMER_20261021.md)已落实每个 renderer 的透明度、active 与存活 tween，覆盖上述 46 组；原生样本扩到 9 组（含零时长）并追加 3 条 RAW 参考轨道，首次 show / 初始 alpha 限制的隔离反例均归零。161/161 源码门禁、build:check、实际 SFC 接线回归及桌面/手机尺寸 Browser 通过。播放与 seek 共用明确的 Web 60 Hz 参考帧，保留 preview 边界；原设备帧历史、mixed/CanvasGroup、APK built-in 分支和原片对照仍开放。未部署。

## 未合入但保留的分支

10-21 [mtples / pfofos烟雾续批](NATIVE_SMOKE_FOLLOWUP_20261021.md)接入四组、八个Noise预览系统，旧82组模型与95份纹理描述不变；无consumer粒子30→26，缺口事件413→369。真实32个show/restart窗口、RAW像素、发布依赖闭包及两首歌Browser通过，保留noise_preview和火焰等缺口。未部署。

10-21 [樱花续批](NATIVE_SAKURA_FOLLOWUP_20261021.md)接入ksktfg与itowks三路共四组、16个Noise预览系统；旧86组模型与97份纹理描述不变。无consumer粒子26→22，缺口事件369→336、编排16→11。来源绑定、55个真实预览窗口、RAW像素、450文件分片闭包及桌面/手机Browser通过；保留noise_preview，原片/设备与其余22种缺口继续开放。未部署。

10-21 [寿命速度曲线积分](NATIVE_VELOCITY_CURVES_20261021.md)核对原生Velocity worker并新增8个RAW系统/32采样点证据，消费者按Web 60Hz网格积分局部单曲线，保留坐标/Noise组合边界。ossshd目标提取14系统/deferred0，但尚未晋升；资源显示、生命周期及分片接线继续下一批，无consumer仍22。现有Inner Dignity常量速度烟雾桌面/手机回归通过，未部署。

10-21 [OUR SONG云雾面板](NATIVE_OSSSHD_PANEL_20261021.md)接入14个无省略系统及两份面板蒙版，绑定前批速度曲线证据；负2秒启动、长寿命循环、回拖/冷定位和桌面/手机Browser通过。旧90组模型/101份纹理描述不变，无consumer22→21；共享粒子旋转问题随后完成[方向修复](NATIVE_PARTICLE_ROTATION_FIX_20261021.md)。未部署。

10-21 [粒子方向修复](NATIVE_PARTICLE_ROTATION_FIX_20261021.md)按原生顶点证据修正普通2D/3D、Floor/Whole_screen/Bloom角度，并取消已合入master的ADV数据负值补偿。原生角点1/9→9/9、168项源码门禁、build:check和舞台/独立ADV消费者Browser通过；保留3D复杂父链、原片/设备及参考时钟边界。未部署。

10-21 [父链渲染基](NATIVE_BILLBOARD_PARENT_BASIS_20261021.md)补齐3D局部父矩阵，统一2D/3D的Local全矩阵及View带符号尺度；原生层级/context/顶点重放扩至61例，包含全部16个准入3D系统的真实父链。168项门禁、build:check及泡泡舞台桌面/手机Browser通过；任意非平面父链、透视及动态/原生时钟仍开放。未部署。

10-21 [原曲成员载入链路复核](NATIVE_ORIGINAL_LINEUP_AUDIT_20261021.md)之后已完成[固定曲消费者接入](NATIVE_ORIGINAL_LINEUP_CONSUMER_20261021.md)：13首显式序优先，41首组合默认序来自表2字段37，纠正24首编号回退并修复`yknkmh`隐藏槽。随后已核实[所选Unit的独立原生选组排序](NATIVE_SELECTED_UNIT_LINEUP_20261021.md)，48个编排按16组合字段37排序，纠正30个编排。舞台专用索引v2直接消费，冻结read-model未改；164项源码检查、build:check及2/3/5人实际Browser通过。原片/设备对照、原生库存卡及完整编队交互仍不在验收范围。未部署。

10-21 舞台同步 master #60–#65 的后验收见 [同步记录](STAGE_MASTER_SYNC_20261021.md)：合并 `4dccabbd`，163/163 源码回归及 build:check 通过，5213 实际舞台与手机尺寸目标检查完成；未部署。

- `claude/player-voice-preload-20261013`（`c3491a7c`）：剧情语音预取、语音等待上限、晚到唇形补挂。功能完整但没有进 master，已落后 master 70+ 个提交，`StoryViewer.vue`、`useVoicePlayer.js`、`VoiceLipStore.js`、`AdvUI.vue` 预计冲突。建议在新的 `portal/` 分支上基于 master 重做，不直接合并；未做真机/iOS 验证。

被取代的旧分支和实验都已打 tag 后删除：`experiment/*` 是不合入的实验，`archive/*` 是旧分支的最后状态。用 `git tag -l 'archive/*' 'experiment/*'` 查看。

## 本机环境

10-21 舞台随后[同步master #69–#70](STAGE_MASTER70_SYNC_20261021.md)至`af58d6eb`。ADV冲突从APK重建，保留新锚点/纹理和RAW顺时针角度；168/168源码门禁、build:check及舞台/独立ADV消费者Browser通过，未部署。

10-21 [剩余粒子清单复核](NATIVE_REMAINING_PARTICLES_20261021.md)修复离线报告遗漏native/Bloom/内置消费者的误报；当前仍21种/335事件/10编排。六组面板已回查RAW，mainha两组9系统可沿Noise预览继续，尚未晋升；另四组有非平面父链或shape拒绝，不能直接登记完成。

- 主 checkout `E:/Web_build/SideM_Archived`，保存完整语料（public/assets）和 `.deploy` 历史批次。
- 领域 worktree 在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，只需联接 `node_modules`，语料不拷不联接：dev 服务把 worktree `public/` 里没有的 `/assets`、`/data` 文件从主 checkout 的 `public/` 读（`scripts/lib/public-corpus-plugin.mjs`，两边都没有就是 404），源配置读主 checkout 的 `config/archive_sources.local.json`（JS 与 `data_pipeline/archive_paths.py` 同一规则）。旧 worktree 若 `web_viewer/public` 是联接，删 worktree 前先解联接。资产清单要加 `--follow-junctions`；`build:check` 在这里重写的 `config/resource-audit.json` 不要提交。
- 本地验收服务：5177。不设 `SIDEM_READMODEL_CANDIDATE` 时，dev 服务在本地配置的 `readmodel_candidates_root`（本机为 `E:/Web_build/GS_Archive_Domain_Work`）里挑 release 与 `readmodels/bootstrap.inline.json` 相同的候选；找不到会在启动日志里警告，`/_catalog` 请求返回 404。要看别的候选仍可显式设置。
- 本轮舞台分支服务：5213，主 checkout `web_viewer`，候选 `rm-release-20261015`；5212 仍服务旧舞台 worktree。复用前检查实际 HTTP 模块和 bootstrap，不凭端口判断分支。
- 复现 CI：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接；主 checkout 有语料又是 CRLF，会把 CI 红项跑绿。
- 10-19 整理后的旧发布包、任务包、worktree 快照在 `E:/GS_Archive_cold/20261019/`。
