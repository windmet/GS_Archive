# 门户架构清扫与实时验收

本轮从 `6d885c34b8bbd848adb36591fba2c22b3d51b0c8` 另起 `codex/portal-architecture-cleanup-20261004`。阅读并核验 `D:/Files/Downloads/GS_Archive_Architecture_Cleanup_6d885c34.zip` 的 18 个文件和 SHA-256 清单；其中的结论作为待验证发现，没有复制其旧源码回生产，也没有执行未经检查的补丁。

本轮处理门户加载、导航取消、目录与详情的所有权、可选译名/正文翻译以及 Chibi 资源和帧循环。保留既有目录、筛选/返回链接、RAW、中文成果、Producer slots/source hash、历史 alias、LegacyDialogueAdapter、原版演出/动作与完整谱面 PNG 合同。没有增加数据库、全站 SSR 或另一套路由。

## 13 项发现的处理与证据

| 项目 | 当前处理 | 验证与边界 |
| --- | --- | --- |
| F01 门户入口加载全馆 | 离线生成全馆 + 49 偶像的有界 scope；入口仅需 portal index 和当前 scope。搜索、抽取完整卡池才另行加载。 | 实际 50 scope 统计与既有目录逐一比对；全馆 41,001 bytes，最大单人 28,147 bytes；生成器强制 64/32 KiB。Browser 全馆和渡边实通过。 |
| F02 取消只保护发布 | 每次导航产生消费者 signal，传入 index/page/detail/Reader/移动端/历史 alias；共享 flight 保留活跃兄弟消费者。 | async-navigation 全套、共享取消/迟到响应测试；Browser 目录往返、快速离开延迟舞台通过。 |
| F03 故事详情拉全目录 | index 提供 32 个 SHA 分片 locator；详情只取匹配 locator 和 leaf；分类 landing 不再先读全部 1,394 行。 | 1,394 个真实 locator 一致；直接详情刷新与 Reader 深链接通过。HTTP 记录可区分 index/locator/leaf 与目录 pages。 |
| F04 静态 legacy/preloader | 入口移除 ArchiveDataRepository；Preloader 改为按需 import，保留播放器 runtimeOwned。 | emitted static closure 的 forbidden、productionLegacyModules、legacyCallSites 均为空；历史 alias 与播放器回归通过。 |
| F05 译名阻挡原始卡片 | 卡片目录及所有卡名 helper 的静态 cards JSON 依赖移除；译名使用独立、版本化、有界 HTTP，可失败回退原名。 | Browser 注入持续 503 后仍有 826 张卡片与可用 N 详情；避免只修 App、却留下卡片组件静态依赖的假通过。 |
| F06 实体缓存污染来源 | 共享原始 bytes；每个消费者重新验证 sourceNames，持有独立来源视图；失效与旧响应有 epoch fence。 | 包内实体回归从 2 PASS/5 FAIL 变为 7 PASS/0 FAIL；源码与注入 fetch 验证，不冒充 Browser 穷举。 |
| F07 翻译无界/串行 | fetch 与 body 共用 deadline；失败不持久缓存；原文模式不取正文/entity overlay；NPC 标签独立于正文，故障可显式重试；读取正文带导航 signal。 | Browser 原文/译文/双语、正文 503、NPC 15s 延迟/12s 超时与重试；真实 draft、缺译电话、QA stale/Producer slots 错误回退通过。 |
| F08 可选特效阻挡 core | 背屏、图片、对象、背景、阴影及粒子细化独立安装；社长单人所需 authored object 仍等待。 | Browser 阴影 503、粒子延迟仍 5/5 ready；普通五人、Solo、社长特别演出均加载。没有为了快而删除原版特效。 |
| F09 阴影晚到泄漏 | actor 独立创建；阴影只挂当前 runtime；卸载后迟到 texture 销毁，失败清空 pending 可重试。 | 实际 SFC 抽取的迟到、替换、销毁、失败再试回归；Browser 可选阴影失败下 actor ready。没有 GPU 内存测量。 |
| F10 动作并发/无去重 | 3 个 worker、motion-major 调度、有界共享 raw bytes；post-await 检查；首个失败取消兄弟任务，不继续剩余队列。 | 35 个 stage timing/protocol 用例与 7 个实际 SFC 所有权/并发用例通过；Browser 首播、换曲、换装、seek 通过。 |
| F11 Vue 与帧循环耦合 | 大索引 shallowRef；精确 frame clock 的 Vue 通知限为 10 Hz；frameValue 保持模板自动解包；关闭自动 Pixi ticker，播放使用单一 owned RAF，暂停手动 render；收敛每帧诊断序列化。 | Browser 发现并修复模板 `.join` 回归；五人/Solo 暂停、继续、键盘 seek 和纯净模式通过；无 FPS/long-task/GPU 改善宣称。 |
| F12 App 无限保留目录 | route-owned 目录/详情使用 shallowRef，离开相关消费者时释放；小型 Home profile 最多 3 份；播放器/Reader 的队列上下文仍保留。 | 目录/移动端/历史 alias 回归，Browser 10 次目录往返、10 次舞台进入退出。DOM 往返不等于 heap/对象 owner 计数。 |
| F13 progress 非入口门禁 | 新增 `verify:entry`，实际约束入口预算、禁入模块、静态 legacy 和全局加载；最终设备/路由门禁维持严格。 | entry 通过；final 仍不能代替尚缺的全路由 parity 与真机证据，未伪造 ledger。 |

## Browser 实际验收

使用 Codex In-app Browser 的 Chromium，独立临时 QA tab；用户原 tab 保留。桌面 1440×900，以及 390×844、320×740、844×390 视口。后面三个是 Browser 视口模拟，非手机或 iPad 真机。

- 全站统计 826/60/1,394/59，16 组合和常驻成员，五首代表全员曲的歌手均为 `315 ALL STARS`；主线仅两章，六个故事分类入口及源数据运营节点均正常。
- 渡边实 17/5/47/3，相关歌曲五项竖列；卡片、歌曲、故事、活动统计进入原有带角色筛选的目录，返回保留视角。全站四个统计也进入原有全量目录。
- 故事直接详情及刷新、Reader 深链接、Reader→Player 同一主线对话单元、原文电话及返回阅读通过。Reader 三种语言模式、实际 draft 显示策略、缺译 fallback、choice、时间字幕、NPC、标题/简介均有样本；未把样本扩写成全语料验收。
- 搜索 `K.now O.nly` 的浮层展开/清空/再次展开，已 ready 的下层矩形不变：width 1226.357666、height 1514.540161、top 23.994251；document width 1440。未拿加载尚未结束的几何作对照。
- 5 次文档刷新、10 次门户→歌曲目录→返回、10 次舞台进入/退出完成。未清 HTTP cache、localStorage、SW/CacheStorage，故不称作 5 次独立冷启动，也不报告中位数/尾部性能。
- Chibi：五人、Solo、社长特别单人、播放/暂停、键盘 seek、换曲、单人换装与全员应用、纯净模式。截图准备状态与 PNG 保存链接可见；IAB download event 未提供保存文件结果，因此 PNG 文件下载不标为通过。全屏、音源编成 handoff 和所有资源阶段的故障未穷举。
- 实际故障：可选卡名 HTTP 503、门户摘要 503 与重试、正文 overlay 503 与重试、NPC 延迟超时与重试、阴影 503、粒子延迟、manifest 延迟期间离开；scope/schema/hash/共享取消/body 取消等补充 Node 回归。

详细翻译样本及 source/overlay hash 见 [translation-surfaces.csv](qa/portal-cleanup-20261005/translation-surfaces.csv)。空白耗时字段表示未测量，不是 0。

## 版本、产物和复验方式

开发期 Browser 使用显式 dirty candidate `21b0b1fe97ff47b16e8cb9958366bc2ec4fed8a09981196350bbb8ca1d4bedf0`，位于 `E:/Web_build/GS_Archive_Domain_Work/portal-cleanup-candidate-20261005`，有 `BUILD_CANDIDATE.json`，没有伪装成正式 build complete。

正式生成器要求已提交且干净的输入。源代码提交后，下一步使用正式生成器生成独立 readmodels 根，验证真实语料并绑定 bootstrap、routes release 和卡片 facets；正式 release 与复验状态将追加到本节。旧候选保留作证据，不复制媒体。

翻译 release `8de730b2e3ad9105307f067ee0e37afb670202c1cec7e61b6e722081097167af`，实际 112 文件生成 manifest；翻译内容与 source hashes 没有修改。当前翻译审计 sourceDigest `fee2638a52122506f9232f6432b500d774b5cef987c31e9312ddbc0c40151b40`，仍明确区分 reviewed/draft/missing/excluded。

`npm run build:check` 编译生产代码，`copyPublicDir:false`，固定 `.analysis/build-check`。最后一次代码编译 2,817 modules；入口 gzip 181,948 bytes（基线 189,721，合同 204,800）。这是静态代码闭包大小，不是 JS heap 或首屏性能指标。readmodels 仅 JSON，总量约 79 MB；没有全量媒体复制到 C:。

本地实时 QA 服务为 `.analysis/ui-audit-20261003/serve-production.mjs --models <已验证根> --port 5208 --evidence E:/Web_build/GS_Archive_Domain_Work/qa-portal-cleanup-20261005 --faults .../faults.json`，从 build-check 读取并钉住 HTML/_app bytes，资源映射到本仓库现有 public 和既有外部资源 resolver。`pinned-code.json` 与 `http-requests.jsonl` 记录代码 hash、release、PID、HTTP bytes/status/hash。HTTP 服务耗时不是前端 ready/FCP/LCP；本地 no-store/MIME 也不是线上发布缓存验收。故障文件最终清空。

运行过的对应回归：

```powershell
npm run verify:architecture-cleanup
npm run verify:archive-async-navigation
npm run verify:portal-navigation
npm run verify:reading
npm run verify:story-localization
npm run verify:story-loading-safety
npm run verify:general-translation-workflow
node scripts/verify-stage-intent.mjs
node scripts/verify-player-communication-ui.mjs
node scripts/verify-chibi-placement-shadows.mjs
npm run verify:chibi-color-layers
npm run verify:chibi-particles
npm run verify:chibi-image-objects
npm run verify:chibi-stage-coordinates
npm run test:source --prefix readmodels
node scripts/verify-portal-projections.mjs <真实 readmodels 根>
node scripts/verify-portal-directory-navigation.mjs <真实 readmodels 根>
npm run build:check
npm run verify:entry
```

源码工具与模型/Browser 结果分开记：source CI 47 项是合成输入测试；portal projections 与 directory parity 是本地真实全部 scope/目录；实体 7 项是包内注入 fetch；stage 所有权 7 项抽取实际 SFC，但不测 GPU/物理设备。

## 尚未验证的边界

当前 Browser API 没有提供导航前 probe 注入、CPU/network throttling、heap snapshot 或 WebKit/真实设备接口；本轮没有 FCP/LCP/longtask、独立冷启动、资源 owner 实页计数、绝对 GPU/PCM/heap 或低性能 Android/iOS 验收。没有宣称提速百分比或零泄漏。

旧 ledger 的完整路由 parity 与设备批准保持未完成，因此最终发布 cutover 仍未通过。只提交/推送此分支，不部署，不将 `reviewed` 改写为 `final`。未穷举的照片/其他通用名称消费者、短信等正文类型和所有 Chibi 故障阶段明确保留未验证。

截图与小型 Browser 记录位于 `C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac`：`cleanup-global.png`、`cleanup-minori.png`、`cleanup-reader-bilingual.png`、`cleanup-player-bilingual.png`、`cleanup-reader-source-fallbacks.png`、`cleanup-reader-real-draft.png`、`cleanup-reader-untranslated-call.png`、`cleanup-player-untranslated-call.png`、`cleanup-stage-five-paused.png`、`cleanup-stage-solo.png`、`cleanup-stage-president.png`、`cleanup-stage-optional-failure.png`、三种小视口截图及几何/往返 JSON。该目录只保存截图/小日志。
