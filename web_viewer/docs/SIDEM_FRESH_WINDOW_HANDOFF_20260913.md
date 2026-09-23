# 新窗口唯一交接入口：先收束，再做两个产品修复

> 2026-09-13 后续用户追加：生日 Small Talk 场景错误已单独处理，输入代码 HEAD 为 `016396e`。先读 [生日 RAW 场景审计](BIRTHDAY_SMALL_TALK_RAW_AUDIT_20260913.md)：本批重建 25 组、91 个独立分段；冬马 authoritative Small Talk 与阿斯兰显隐差异仍需独立核实。下方 `bce13c3` 状态表是历史基线，不覆盖这份后续记录。不要重新启动旧窗口。

2026-09-13；本轮核实代码基线 **`bce13c379efc3cf2ebb7bf125723e9b24ae980d3`**，分支 `codex/p1-effect-texture-deps`。本文件之后的文档提交不改变这份代码基线。

## 新窗口规则与本次范围

用户明确：下周工作在**新的窗口**继续，前几个执行窗口上下文过长，不再向它们派发工作、续跑或索取历史摘要作为实施依据。本轮只核对两份审计并更新交接，不启动产品修复，不自动创建/派发执行任务。

新窗口先读本文件，再读 [构建与磁盘政策](BUILD_ACCEPTANCE_POLICY.md)。按需阅读下方代码与专项记录，不从旧长交接头到尾追逐所有“下一步”。本文件的顺序与停止条件覆盖旧文档中的扩展计划；旧文档保留为历史证据，不是待执行队列。

工作目录：`E:/Web_build/SideM_Archived/web_viewer`；Git 根：`E:/Web_build/SideM_Archived`。启动时重新核对 branch、HEAD、status、worktree、5175 的进程归属；5175 是历史验收端口，不是当前进程保证。本轮 worktree list 还存在两个 C 盘 detached worktree 和 community-action 工作树，**不要清理、复用或切换它们**。无关未跟踪文件 `docs/sidem_title_fx_css_rebuild_v9.html` 保留。

两份附件分别审计 `051897e` 与 `bce13c3`。本地确认为后者，`051897e..bce13c3` 有23个提交。第一份中“Song/Chibi还没实施”已被后续代码覆盖；“假零值与代表色头像未做”在最新代码仍成立。没有理由为恢复旧计划而回滚这23个提交。

## 当前状态：DONE / PARTIAL / UNVERIFIED / SUPERSEDED

DONE 只表示该行明确功能已实现、前批记录了范围内本地验收；不是整个阶段或发布已完成。本轮核实源码/本地记录，没有重跑 Browser、完整gate或构建。

| 状态 | 项目 | 当前事实与边界 |
| --- | --- | --- |
| DONE | 轻启动、实体引用、导航Chrome | 已有 IdolReferencePresentation/ArchiveIdolReference、Card owner、跨页引用、ArchiveBackAction/PageChrome、根Portal/picker/settings返回处理；不要重新抽一套组件或 parent 状态 |
| DONE | Welcome 当前布局 | `f8b0b30` 后49人连续自然滚动，桌面3列/平板2列/手机1列，搜索/随机/已选定位；不是每组三个人 |
| SUPERSEDED | Welcome 三人分组/跳组 | `67f97d9` 方案被 `f8b0b30` 取代；此前分页/分组历史不能复活。除本批明确问题外，不继续改选择器布局 |
| DONE | S0轻量时间线拆分 | Song消费者改用 song_timelines manifest＋按编排详情，118份详情；不要再实施“从整份7.88MiB表拆分”这个旧任务 |
| PARTIAL | S1时钟与歌词 | FullMix有媒体时钟适配；ArchiveSongLyrics是展开式脚本歌词，明确时间未校对、无自动滚动/点行seek；**同步歌词尚未完成** |
| DONE | S2明确舞台目标 | Song→Chibi有歌曲/编排目标及返回合同；舞台自身进入后仍会加载完整编舞等运行资源，不等于全舞台已轻量化 |
| PARTIAL | S3编成接续 | 五槽lineup和vocal/backing gain可传入舞台；刷新临时编成回默认等边界见专项记录，不能声称跨刷新保存全部混音会话 |
| DONE | drv999特殊身份 | 社长愚人节独立歌曲＋2D剪影特别演出；不是普通多人编舞，不是三号位Spine，也不是要修复的零duration坏条目 |
| PARTIAL | S4 VFX | 已有覆盖统计/支持与近似说明；历史记录118份中111份引用未复刻粒子，不代表已实现粒子或原片视觉一致 |
| PARTIAL | P3慢资源与语音 | 背景失败阻断、旧帧保留（含自动切步）、旧语音取消/代次、本步语音prepare后playable已实现；不是atomic prepare/commit |
| PARTIAL | P4缓存 | 单Player decoded PCM保留上限12项＋32MiB；跨Player压缩字节16MiB/128项LRU和ETag HEAD核对已实现，不能冻结为最终CDN缓存设计 |
| UNVERIFIED | 环境与发布 | non-zero safe-area实机、完整pause/seek/skip/choice/backlog高延迟矩阵、长音频听感/内存曲线、CDN冷/热请求指标、发布包、远端CI证据 |

审计所引61份M4A ffprobe误差最大约0.77ms、BRAND NEW FIELD参考音频约2.206秒整体偏移，均是专项文档中的前批结果，本轮未重算。容器时长和两份音频同源不证明逐句歌词对齐；`timelineToAudio` 未校对状态必须保留。远端CI状态也未在本轮查询，不将附件所述“没有checks”升级为实时结论。

## 两个仍存在的产品问题：已对照源码

### F1 个人页统计 unknown 被当成0

证据：`src/data/idolPage.js:buildIdolStats` 在 episodes/mobile 缺失时计算出0；`ArchiveIdolDetail.vue` 使用 `stats.stories/chats/phones || 0`。`App.vue` 的 applyArchiveRoute 会为 idol_detail ensure通信数据，但 openPrimaryIdol、openIdol、openUnitMember、openStoryIdol、openCardIdol 等仍有直接 commitView 路径，没有统一的页面进入 readiness。

修复范围：保留通信索引延迟加载，建立统一 idol_detail 进入触发，不要求各关系入口分别补 fetch。统计合同区分未请求/加载中、成功（含真实0）、失败可重试；未知值可用null，但不能只把0改成永久省略号。不要为了计数把所有通信索引塞回 Portal 首屏。页面离开/换人物/重试时，旧结果不得误更新当前页的loading/error状态；共享索引缓存仍由现有repository持有。

验收：冷Light→Portal→Idol，冷Card/Song/Unit/Event→Idol，直接deep link；受控延迟/失败/重试、快速换人/退出、成功真0。北村想楽可作真实非零样本，实际数量从索引核实，不硬编码。等待时无假0，成功后正确统计；返回来源不变。相关单测＋定向Browser（桌面/390px）＋必要的一次build:check后提交。

### F2 共享头像缺少代表色圆框

证据：`IdolReferencePresentation.js:buildIdolReference` 无accentColor；`ArchiveIdolReference.vue` 有icon/活动visual分支但无代表色；Mobile已有accentColor却仍有白色头像边框。

修复范围：从规范profile.color投影并校验颜色，缺失/非法值使用中性样式，Card/Song不要各自硬编码。仅icon-art绘制代表色圆框，event_story_visual保持原视觉比例。通过内圆裁剪/遮罩处理素材外围方框，但裁剪宽度先看真实49人图，不预设统一3px必然合适。失败降级、不同density、深浅颜色、长姓名均保持可读；不得用颜色作为唯一身份信息。Mobile复用同一规则或token，不另起实现。

验收：49人素材视觉扫描（小图联系表即可，不复制资源全库），Card/Song/Unit/Story/Portal的代表样本、Mobile头像、活动立绘及icon fallback；没有切脸/方框残留/布局跳动，键盘focus仍可见。相关回归＋桌面/390px Browser＋必要build:check后提交。

## 新窗口执行顺序和停止条件

### G0：基线复核，不增加架构

在开始F1前只做一次范围明确的现有gate组，输出各命令PASS/FAIL/未执行；失败先定位是否本地资源/环境差异，不以失败为理由自动扩展P3/P4。以下是当前package存在的入口：

```powershell
npm run verify:archive-startup-route
npm run verify:archive-navigation-state
npm run verify:archive-async-navigation
npm run verify:portal-navigation
node scripts/verify-reading-navigation.mjs
node scripts/verify-reading-playback.mjs
npm run verify:song-timelines
npm run verify:song-stage-handoff
npm run verify:media-element-clock
npm run verify:story-loading-safety
npm run build:check
```

story-loading-safety已包含story-audio等子项，不再机械重复同一组；build:check是新窗口代码基线复核的明确步骤，**本次纯文档更新不运行它**。它只生成E盘固定代码产物，不包含public全库，不是发布包。Browser基线只跑所改旅程需要的冒烟，不另开漫无止境的全站探索。

### G1：只做F1，验收、提交、记录；G2：只做F2，验收、提交、记录

每批开始写清问题、改动文件与完成条件；新增发现先记待办，只有阻碍本批验收的缺陷才纳入修复。不顺手继续Welcome布局、P3/P4、S1–S4。两个批次可以按用户在新窗口的授权顺序接续，但不能把它们并入一个持续媒体重构批。

### G3：两个产品问题完成后停止

交付hash、验证结果、残余风险，等待用户选择下一主线：Preview/CDN媒体验收，或Song歌词逐句对齐。**不得自动选择、自动部署、自动继续atomic commit/VFX、自动唤醒旧窗口。** 未经用户进一步指定，也不创建长期自动化或新代理流水线。

## 保留的技术边界

- Frame-hold是逻辑step改变后的保护层；Spine/纹理真正提交前可渲染准备仍未建立。不要继续按choice/skip/mouth逐个扩充遮罩并把它称为P3完成。
- 当前语音gate有prepared voice消费，但旧帧捕获按PCM缓存判定。PCM命中、lip JSON迟到仍是明确未覆盖项。prepareVoice包含口型路径不等于等待画面问题自动消失。
- CompressedVoiceCache首次GET仍保留cache-bust；复用前no-store HEAD比较ETag。不能凭本地命中就移除Date.now或承诺CDN降延迟；后续需独立版本URL/头/指标方案。
- 语音缓存预算限制保留缓存，不是限制所有当前播放/解码/纹理总内存。不能用32MiB＋16MiB相加宣称Player总内存上限48MiB。
- 不因审计中的PARTIAL重做已落地模块；先查代码和已有测试，再提出最小下一步。

## 按需参考与使用提示

- [展示/Chrome/Song路线与逐批记录](PRESENTATION_CHROME_SONG_ROADMAP_20260913.md)：查已完成代码与S0–S4证据；开头旧路线已被本文的下一步顺序覆盖。
- [Reader/Player技术边界](READER_PLAYER_NEXT_PHASE_20260909.md)：P3/P4设计参考，目前不授权继续实施。
- [旧长交接](SIDEM_NEXT_WINDOW_HANDOFF_20260912.md)：只按具体关键词查历史验收，尤其文末prepared voice边界；不全量恢复旧工作队列。
- [构建与磁盘政策](BUILD_ACCEPTANCE_POLICY.md)：禁止C盘/Codex QA全量build副本；docs-only不构建；显式stage、commit/push，保留无关文件。

给新窗口的启动文字：

> 请先阅读 `E:/Web_build/SideM_Archived/web_viewer/docs/SIDEM_FRESH_WINDOW_HANDOFF_20260913.md` 和构建政策，再核对当前分支/HEAD/工作区。不要联络前几个执行窗口，不恢复旧待办。按G0复核基线后，先完成F1个人统计readiness，再分批完成F2代表色头像；两项验收提交后停止，下一主线由我决定。Welcome保持49人自然滚动，不复活三人分组，不自动扩展P3/P4或S1–S4。
