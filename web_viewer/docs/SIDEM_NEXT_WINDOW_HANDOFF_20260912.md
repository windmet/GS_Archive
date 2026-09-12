# 2026-09-12 分支审计与新窗口交接

本文件是当前恢复入口。先核对实际 HEAD/工作区，再读取这里列出的专题文档；旧交接中的历史状态不代表现在。用户本轮要求核对新分支、修正偏移、更新文档并交接，不启动下一整批功能。

## 检出与提交范围

- 仓库：`E:/Web_build/SideM_Archived`；前端目录：`web_viewer`。
- 当前分支：`codex/p1-effect-texture-deps`。审计输入 HEAD：`c0904259fd2df21612f2713e1d8786d97833604c`。
- 已 fetch origin；审计开始时本地与同名远端一致。旧分支 `codex/archive-architecture-refactor` 的 `4bc5d7e` 是比较基线，不要切回去覆盖新工作。
- 新增四提交：`8867549` 特效纹理依赖；`2c9dc36` v9 CSS 标题动画；`9f00784` 通信 UI 依赖；`c090425` 依赖审计补充。
- 用户未跟踪设计稿 `docs/sidem_title_fx_css_rebuild_v9.html` 保留，不属于本次提交。其他 worktree 不处理。
- 本交接所在提交是在上述输入之上的审计修订；用 `git log -1` 确认交接提交，不将输入 HEAD 误当最终 HEAD。

## 当前进度：已经实现与仍未实现

| 主线 | 核对结果 | 下一步 |
| --- | --- | --- |
| 手机门户 / 展示契约 | 既有成果保留，本轮四提交未重做这些模块 | 不重新设计门户；保留真实 315 背景方向 |
| Reader R1–R3 | Reading v2；本轮来源校验仍为 204 份、183 ready、21 unsupported | 保持文本身份/表演主体/视觉存在分离；unknown 的姓名不能泄露 |
| Reader 产品 | 普通 UI 已撤下逐句播放与显式书签；深链、搜索和返回定位保留 | 不能因旧交接恢复书签或旧工具栏 |
| E1 / F | 只读 projector/shadow 与 playback controller 回归通过 | E1 仍 partial，E2 未接管；不继续无边界拆 helper |
| P1 特效 | 映射区分 bg/screen handler，禁用 cameraflare 与未实现特效保留诊断；共享真实纹理 URL | 这是需求发现进展，不是效果渲染全验收 |
| P1 通信 | 共享 URL helper、复用 presentation context、按 step 扫描通信背景/icon/stamp/emoji | 线性历史及原文扫描的覆盖边界仍需补验 |
| P1 atlas | 既有逐页加载及依赖展开回归通过 | 特殊模型、配置/回退及计划到执行器的闭包仍未完成 |
| P1 加载状态 | `src` 尚无 createStoryAssetPlan 消费者；旧 Preloader 仍在使用 | 可信任务状态、失败/取消/重试、入口 ready 尚待接入 |
| 标题动画 | CSS v9 已接入 TitleUI，结束后尝试前进；本轮修复跨步骤残留的前进请求 | 暂停、隐藏、cue settlement 等生命周期验收优先补齐 |
| P2–P5 | 未形成分层执行、局部 buffering、统一 transport/cache 和网络验收闭环 | 保持原路线编号，不将代码存在写成产品交付 |

路线仍以 [Reader/Player 产品契约](READER_PLAYER_NEXT_PHASE_20260909.md) 为准：
**P1 资源计划与可信状态 → P2 Critical/Near/Deferred → P3 局部 buffering → P4 transport/cache → P5 网络验收。**
正式 pre-E 长稳继续后移；日常长时间稳定的用户反馈不能改写为正式长稳通过，也不能反过来用长稳阻塞当前工作。

## 本轮修正与未关闭风险

1. **已修正：标题前进请求跨步骤残留。** `StoryViewer` 的 currentStep watcher 现在清除 `titleAdvancePending`。测试直接执行生产回调，覆盖离开标题后进入另一标题的场景。没有改变 v9 美术表现。
2. **已纠正文档：** 旧交接的书签现状与 P2/P3 合并编号；特效/通信已实现部分补记为当前进展；共享 URL 不再被注释宣称能保证完整发现。
3. **标题暂停仍是源码确认的接入缺口，尚未浏览器复现。** TitleUI 没有暂停输入或 CSS animation-play-state；Viewer 的 overlay/visibility 暂停只接到既有 controller/runtime。需验证菜单、backlog、后台隐藏、手动前进、返回、连续标题和 reduced-motion。不能新设无归属计时器，也不能让动画回调跳过用户暂停。
4. **标题 settlement 风险待复现。** `goNext()` 可能返回 `settled`，完成处理仅记录 `blocked`；若标题同时存在待 settle 的 cue，卡片淡出后可能未前进。先构造生产链路复现，再决定如何由当前 step/generation 拥有重试，避免重复 advance。
5. **通信 parity 的证据有限。** 扫描采用 `historyStack: []` 与 `dialogue.source_text`。verifier 已有不同历史产生不同 context 的 fixture，但整库对比仍沿用同一 resolver/线性输入，不能证明任意分支历史、显示译文标记和全部聊天消息都已覆盖。先从真实 MobileChat/MobileCall 消费输入独立核对；无法确定的需求保持 unresolved，不凭 chara_id 猜完整闭包。
6. **特效 verifier 只验证 URL 请求。** 本轮通过时仍出现 fake texture 引起的 `reading 'x'` 警告；脚本还全局吞掉 unhandledRejection。不可作为真实 PIXI handler 成功渲染的证据。后续改成明确隔离请求探针/渲染验证，并让意外异常失败，不能仅隐藏日志。

## 本轮验证证据（2026-09-12）

已通过：

- `verify:story-asset-plan`
- `verify:effect-texture-parity`（仅请求级，限制见上）
- `verify:communication-assets:source`：204 份，3308 个通信 step，6071 条需求；线性对比 divergence 0；**204 个 plan 仍 open**。其中 communication-without-unit 46、communication-without-character 513。未解析不等于网络丢失。
- `verify:title-transition`：静态契约 + 本轮新增生产导航回调执行测试；不等于浏览器动画验收。
- `verify:reading-sources`：204 份产物校验，183 ready / 21 unsupported。
- `verify:story-projector`、`verify:playback-controller`、`verify:spine-atlas-pages`、`verify:story-runtime-foundation`、`verify:shared-scenario-normalizer`。

源码构建通过：Vite native config、`copyPublicDir:false`，输出 `.analysis/audit-20260912-build`，避免复制本地媒体库。2497 modules；主入口 525.79 kB，保留超过 500 kB 的构建提示，未在本轮扩展为 bundle 优化。
本轮未启动真实浏览器验收、未做真实媒体长稳、未发布站点、未重编译/灌入剧情数据。既有 dist 或旧 localhost 不作为本轮验收证据。

## 新窗口按此执行

1. `git status --short --branch`、fetch、核对 HEAD 和本文件；保留未跟踪 HTML。确认本机服务实际端口/PID，不能沿用历史 5175 的假设。
2. **先收口标题生命周期这一小批。** 阅读 TitleUI/StoryViewer/currentStep 与 pause reason；复现上列风险，复用既有暂停所有权；补行为测试，再用真实桌面/390/320 页面检查动画、overlay、隐藏恢复、连续标题、reduced-motion、console 和溢出。沿用用户 v9 设计，不另起视觉重做。
3. **接着收口 P1 的剩余需求边界。** 独立核对通信消费者与分支历史、修正特效探针证据，列出特殊模型/配置回退未闭合项。只在有真实消费者证据后解除 pending/unresolved。
4. **再接 P1 执行与状态，逐批进入 P2–P5。** 区分 discovered/fetched/decoded/renderable、failed/cancelled；进度不能把失败计成资源 ready。定义取消、迟到响应隔离和重试，再替换旧 Preloader；不要一次性合入整个加载重构。
5. 每个可审阅小批做适当验证、显式路径 commit、推送同名分支；不默认开 PR 或部署。更新本交接或新增有明确入口的新交接，保留未验收事项。

补充约束：Wikiwiki 是用户既有补字参考，尚无本轮批量导入授权需求；缺字工作仍应保留来源和文本边界。Sekai 审计的借鉴继续落实在轻量 Reader、消费者驱动依赖、可信加载和故障可见性上，不为模仿成熟项目扩展无关框架。
