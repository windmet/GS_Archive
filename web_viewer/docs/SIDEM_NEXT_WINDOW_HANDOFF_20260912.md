# 2026-09-12 分支审计与新窗口交接

本文件是当前恢复入口。先核对实际 HEAD/工作区，再读取这里列出的专题文档；旧交接中的历史状态不代表现在。用户本轮要求核对新分支、修正偏移、更新文档并交接，不启动下一整批功能。

**后续执行更新（同日）：** 用户已要求继续；标题生命周期修复与本轮验收见文末。上述“不启动下一整批功能”属于前次审计范围，不是当前停止指令。接下来进入 P1 需求边界核对，原生后台事件及系统 reduced-motion 补验仍单列保留。

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
| 标题动画 | 保留 CSS v9；已接入共享暂停、步骤归属与 generation 内的 cue 结算续进，完成行为回归与 Browser 交互检查 | 原生后台事件、系统 reduced-motion 设置仍需补验；模拟路径已通过，详见文末 |
| P2–P5 | 未形成分层执行、局部 buffering、统一 transport/cache 和网络验收闭环 | 保持原路线编号，不将代码存在写成产品交付 |

路线仍以 [Reader/Player 产品契约](READER_PLAYER_NEXT_PHASE_20260909.md) 为准：
**P1 资源计划与可信状态 → P2 Critical/Near/Deferred → P3 局部 buffering → P4 transport/cache → P5 网络验收。**
正式 pre-E 长稳继续后移；日常长时间稳定的用户反馈不能改写为正式长稳通过，也不能反过来用长稳阻塞当前工作。

## 本轮修正与未关闭风险

1. **已修正：标题前进请求跨步骤残留。** `StoryViewer` 的 currentStep watcher 现在清除 `titleAdvancePending`。测试直接执行生产回调，覆盖离开标题后进入另一标题的场景。没有改变 v9 美术表现。
2. **已纠正文档：** 旧交接的书签现状与 P2/P3 合并编号；特效/通信已实现部分补记为当前进展；共享 URL 不再被注释宣称能保证完整发现。
3. **标题暂停缺口已复现并修复。** 菜单暂停时原有七个 CSS 动画仍运行至 2760ms；模拟 visibility 暂停时旧代码会继续进入对白。现由同一 runtimePauseReasons 驱动 TitleUI 的整组 CSS 暂停，隐藏界面保留同一组件实例。Browser 菜单、backlog、界面隐藏恢复及模拟 visibility 检查通过，原生环境限制见文末。
4. **标题 settlement 卡住已复现并修复。** 给真实标题步骤附加 30 秒 screen.fade cue，旧代码在显式结算后停留于淡出标题。现由运行代次内的结算完成回调唤醒当前步骤的续进请求；导航、销毁和旧标题事件不能推进下一标题。生产构建的同一边界 fixture 已进入后续对白。
5. **通信 parity 的证据有限。** 扫描采用 `historyStack: []` 与 `dialogue.source_text`。verifier 已有不同历史产生不同 context 的 fixture，但整库对比仍沿用同一 resolver/线性输入，不能证明任意分支历史、显示译文标记和全部聊天消息都已覆盖。先从真实 MobileChat/MobileCall 消费输入独立核对；无法确定的需求保持 unresolved，不凭 chara_id 猜完整闭包。
6. **特效 verifier 的异常吞噬已修正，真实渲染仍待验收。** 继续执行时改用合法的内存 PIXI.Texture，分别检查请求、Sprite/TilingSprite 初始化数量、一次 tick 和销毁后的 ticker/frame 清理；无全局 unhandledRejection 吞噬，warn/error 保持输出且使校验失败。注入对象创建失败、未处理 rejection 均以 exit 1 失败。该证据是合成纹理下的 CPU 对象生命周期，不是实际 PNG 解码或 GPU 渲染。

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
2. **标题生命周期代码与本轮可执行验收已完成，保留两项环境补验。** 见文末；不要重新实现暂停或引入标题计时器。后续有支持原生后台事件/系统 reduced-motion 的浏览器环境时补验，不将模拟检查改写为原生事件已验证。沿用用户 v9 设计。
3. **接着收口 P1 的剩余需求边界。** 独立核对通信消费者与分支历史、修正特效探针证据，列出特殊模型/配置回退未闭合项。只在有真实消费者证据后解除 pending/unresolved。
4. **再接 P1 执行与状态，逐批进入 P2–P5。** 区分 discovered/fetched/decoded/renderable、failed/cancelled；进度不能把失败计成资源 ready。定义取消、迟到响应隔离和重试，再替换旧 Preloader；不要一次性合入整个加载重构。
5. 每个可审阅小批做适当验证、显式路径 commit、推送同名分支；不默认开 PR 或部署。更新本交接或新增有明确入口的新交接，保留未验收事项。

补充约束：Wikiwiki 是用户既有补字参考，尚无本轮批量导入授权需求；缺字工作仍应保留来源和文本边界。Sekai 审计的借鉴继续落实在轻量 Reader、消费者驱动依赖、可信加载和故障可见性上，不为模仿成熟项目扩展无关框架。

## 继续执行：标题生命周期修复与验收（2026-09-12）

输入 HEAD：`61a8449`。仍在 `codex/p1-effect-texture-deps`；未跟踪 v9 HTML 保留。

实现：

- TitleUI 接收暂停状态，根动画及所有子动画一起暂停；start/complete/cancel 携带所属 step。
- Viewer 复用 reactive runtimePauseReasons；挂载时读取初始 document.hidden。界面隐藏时保留标题实例，以 visibility 隐藏并暂停，恢复不重播开场。
- 标题完成请求绑定 step，并等待真实 cue settlement Promise 完成；暂停中不推进。Runtime 回调校验 generation；导航/销毁清除请求，旧卡片取消或完成事件不影响新卡片。
- 没有增加定时器，没有修改 v9 关键帧、美术尺寸、剧情文本或数据产物。

验证入口与证据：

| 范围 | 结果 / 边界 |
| --- | --- |
| `verify:title-transition` | 执行生产 Viewer 回调及真实 Runtime scheduler/handle，覆盖暂停、结算期间暂停、重复完成、overlay 竞态、连续标题归属、手动 next、销毁和 frame 清理 |
| `verify:playback-controller`、`verify:story-runtime-foundation` | 通过 |
| Vite native 构建 | 2497 modules；copyPublicDir:false，仓库外 build-final；保留主入口 >500 kB 提示 |
| Browser 入口 | `mcp__cua_repl` 内置 Browser 可用，用户纠正后改用它；无需另装 Browser。早期复现用过已有 Playwright/Edge，不代表后续浏览器入口缺失 |
| 真实页面 | `http://127.0.0.1:5175/?scenario=episodes/1_4_001_00_a.json&start_step=5`；1280×800、390×844、320×740 |
| 页面 / 布局 | 标题与后续对白均可见，无框架错误遮罩；document scrollWidth 分别等于 1280、390、320。截图已在本次任务显示 |
| 交互 | 菜单 / backlog 停留超过原 2.76s 后标题仍在；关闭恢复。320px 隐藏/显示 UI 后继续同一标题。模拟 visibility 暂停时 step index=4、clock=2.0169 保持不变，恢复后继续；手动 next 从标题进入 2/23 过渡再到 3/23 对白，返回按钮可在标题期间离开到首页 |
| 生产构建 fixture | 仓库外本地服务 5181，使用真实组件与真实 episode 的内存副本；30 秒 cue 结算后进入 3/23 对白；连续两个标题后进入 3/23 对白，无跳过 |
| reduced-motion | 仓库外服务模拟 matchMedia 并启用对应 CSS 媒体分支；标题保持静态（无 play class），手动下一段有效。不是 Windows 系统设置验收 |
| Console | 标题检查未见页面异常；后续角色出现时有两条来自 Spine.update / Spine.tint 的 warn 调用栈，保留记录，不宣称全静默 |

环境补验：Browser 的 visibility.set(false) 及切换内置标签未提供已确认的 document.hidden=true（诊断仍 visible），所以本轮证明的是生产 visibility 处理入口的模拟路径；真实 OS 后台/恢复事件和系统 reduced-motion 偏好仍未验收。没有做真实音频长稳或发布。

临时 fixture/server/build 位于 `C:/Users/windm/.codex/qa/sidem-title-20260912/`，不提交测试媒体或截图。下批仍先核对通信消费者/分支历史、特效探针异常，再接 P1 执行状态；不可据标题修复宣称 P1 完成。

## P1 特效校验修订（标题批之后）

- `verify:effect-texture-parity`：通过；覆盖两种 domain 的现有探针、disabled/unmapped 行为、真实 PIXI 对象创建与清理，无假纹理警告。
- `verify:story-asset-plan`：通过。
- 负向验证：注入 Sprite 添加失败时，雨效果对象数量断言失败（exit 1）；注入未处理 rejection 时进程失败（exit 1）。不再把异常当作成功的请求证据。
- 本批只修改校验与交接文档，不改变 renderer、资源映射或产品视觉。真实图片和 GPU 验收继续单列。
- 通信消费者独立阅读已发现下一批需处理的具体差异：MobileChatScene 的显式 step.stamp；只有整条文本恰为 stamp marker 才走 stamp，混合文本中的相同 marker 在 MobileMessageBubble 走 emoji URL；显示译文与 choiceTexts 也参与实际消息图片请求。旧 corpus 对比复用同一 helper，不能独立证明上述覆盖。
