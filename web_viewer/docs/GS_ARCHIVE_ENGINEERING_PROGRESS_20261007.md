# 工程续作记录（2026-10-07）

接续 [工程交接](GS_ARCHIVE_ENGINEERING_HANDOFF_20261007.md)。用户最新边界：持续推进；必须涉及 UI 的事项记录，尽可能不动前端。工程检查批次仅修改检查脚本和检查名单；用户已追加授权提交、推送，不部署、不改译文，不重启 5175。随后报告的剧情语音问题已单独修复，见 [语音修复记录](GS_ARCHIVE_VOICE_ALIAS_FIX_20261007.md)。

## 完整源码门基线

- 输入提交：`8b7765e066a5ceb11de7828f7ebb069255c50a63`，包含 B007 草稿提交。
- LF 隔离工作树：`E:\Web_build\GS_Archive_engineering_20261007\wtlf`；未挂载主检出的忽略语料，依赖通过 junction 复用。
- 按 `.github/workflows/web-viewer-source-gate.yml` 的 115 个 run 步骤执行：**114 通过、0 失败、1 跳过**（`npm ci`）。原有批量检查 **100/100**。
- 使用 Git Bash、`PYTHONIOENCODING=utf8` 和 `python -S`。本机 Node 24.14.1 / Python 3.14，属于本地干净检出模拟，不是 GitHub Linux runner 的实际结果；依赖未重新安装。
- 编译使用 `build:check`，只输出隔离工作树的 `.analysis/build-check`，不复制 public 语料。TEMP/TMP/TMPDIR 均定向 E 盘。
- 完整逐步记录：`E:\Web_build\GS_Archive_engineering_20261007\gate-8b7765e0\results.json` 及相邻日志。不是媒体包、部署或浏览器验收。

## 4.2 首批：偶像检查改测真实行为

- `verify-idol-navigation-ux.mjs`：执行现有 `navigateArchiveSection`、`openIdolDirectory`、`openPreferredDestination`；验证有无担当都打开目录、清空旧筛选、快捷入口保留来源和重置上下文、未知偶像不导航。目录投影改用真实 Vue `computed/ref`。
- `verify-idol-communication-readiness.mjs`：保留原有 readiness 工具竞态检查；执行现有启动路由判断和详情 watcher，使用真实 Vue watch/effectScope 与导航协调器。覆盖首次加载、陈旧响应、缓存命中、失败重试、导航失效与销毁。
- 两项均移入 `batch`，名单由 100 增至 102；两个检查及覆盖名单检查在无忽略语料的 LF 检出通过。
- 修改后的主检出执行 `npm run verify:source-batch`：**102/102 通过**。这与上面的基线全量门、LF 两项定向验证分别记录，不声称修改后的全部 115 步再次执行。
- 反向测试在 `.analysis/engineering-20261007/mutations/` 的源代码副本上运行，未修改工作区 App.vue。两个正向基线通过；7 个错误变体均触发断言失败：错误目录目的地、快捷入口丢失来源、旧筛选残留、不请求详情、不发布详情、禁用缓存判断、允许陈旧结果发布。
- 反向结果：`.analysis/engineering-20261007/mutations/results.json`；本地执行器在 `E:\Web_build\GS_Archive_engineering_20261007\mutate-idol-verifiers.mjs`。

## 4.2 第二批：歌曲音频检查

- `verify-song-playback-audio.mjs` 保留 61 首完整混音的身份、来源哈希、精确 cue、派生证据及实验音轨边界校验；移除过时的 App 全局音频数据、原生 controls 和 CSS 文本匹配。
- 执行 App 的真实 `currentSongPresentation` 投影及真实 SongPresentation，SSR 渲染真实详情/播放器：56 个普通播放器各使用对应音轨、metadata 预载和播放条，5 个实验播放器优先使用实验入口；缺少音轨时不生成播放器，详情过期时不提供错误音轨。
- 移入 `batch` 后，在 `36dca2ce` 的干净 LF 检出叠加本批脚本/名单执行 **103/103 通过**。日志：`E:\Web_build\GS_Archive_engineering_20261007\song-audio-batch.log`。
- 反向测试仅改隔离工作树：陈旧详情、丢失音轨、错误音轨 URL、禁用实验入口、错误预载方式 5 个变体均断言失败，恢复后重新通过。记录：`E:\Web_build\GS_Archive_engineering_20261007\song-audio-mutations\results.json`。
- 这是数据、生产投影与 SSR 输出验证，不是音频解码、真实播放、布局或 Browser 验收；未改前端运行代码。

## 4.7 terminal 定向修复

- 新访客预期从 Home 修正为 Portal，同时保留显式 Home URL 和已保存 Home 偏好的验证。
- 原检查还遗漏了 `153d8a1c` 已实现的独立称号导航入口，检查名单补上 `honors`；没有更改导航实现、语料或发布基线文件。
- 主检出和干净 LF 检出均 **40 项通过**；将新访客改回 Home、忽略显式 Home URL、移除称号入口均被反向测试拦截。
- 记录：`E:\Web_build\GS_Archive_engineering_20261007\terminal-mutations\results.json`。此脚本仍单独运行，未声称它已进入顶层 verifier batch。

## 4.2 第三批：加载提示行为检查

- `verify-archive-loading-copy.mjs` 保留并扩展真实组件 SSR 至 15 个场景，包含阅读器加载、错误和空正文；新增 `scripts/lib/loading-behavior-contract.mjs`，从 Vue/Babel AST 提取真实声明、模板条件和事件表达式执行。
- 验证启动/资料/舞台/演出文案、硬加载与路由加载分工、选择器准备不盖遮罩、播放器已有帧不被遮挡、阅读器排除、取消动作、路由提示、8 秒慢加载计时与卸载清理、翻译加载/失败/缺译优先级、局部缓冲和两类舞台加载状态。使用真实 Vue 响应式模块；计时器和卸载注册用受控宿主边界，不复制业务判断。
- 在 `5d056d60` 干净 LF 检出叠加本批脚本/名单后，**104/104 批量检查通过**。日志：`E:\Web_build\GS_Archive_engineering_20261007\loading-batch.log`。
- 7 个反向变体均被断言拦截：选择器准备时错误遮罩、错误舞台文案、缺失卸载计时器清理、错误计时长度、丢失 waiting 文案、翻译提示优先级错误、禁用局部缓冲。恢复后再次通过。记录：`E:\Web_build\GS_Archive_engineering_20261007\loading-mutations\results.json`。
- 原脚本中的 CSS 字面量、动画名及已过时的展示结构匹配不再冒充功能证明；布局、动画和设备验收明确留给 UI 检查。未更改前端实现、模板或样式，也不声称执行了 Browser 验收。

## 4.2 第四批：歌曲入口行为检查

- `verify-song-domain-landing.mjs` 保留歌曲、作品、演唱者、封面及音轨数据检查，新增 `scripts/lib/song-landing-behavior.mjs`，执行真实 App 函数、Vue 响应式状态、导航协调器、组件事件及 SSR。
- 覆盖歌曲入口/详情/舞台及返回来源、旧响应抑制、重复分页拒绝、详情身份、筛选/搜索和组件事件；不把源码或 SSR 结果视为真实布局及音频验收。
- `95751cc3` 干净 LF 检出叠加本批三文件：105/105 batch 通过；7 个错误变体均被断言拦截，恢复后的基线通过。日志与反向结果在 `E:\Web_build\GS_Archive_engineering_20261007\song-landing-batch.log`、`song-landing-mutations\results.json`。
- 五个 pending 检查均已转入 batch，移除空 pending 分组。上述 batch 在语音修复之前完成；语音改动的定向回归和构建结果单独记录，未声称重新跑过整套源代码 CI。

## 后续与 UI 边界

- 4.2 已完成 5/5。
- 4.3 曾按“尽可能不动前端”暂缓；2026-10-08 用户明确要求“请你拆”，现已开始按视图族分批抽出逻辑，模板和样式保持不变，见下方续作记录。
- 4.4 个人故事下一段标签已完成：队列入参在缺少 label 时采用已有 name，保留显式 label 优先；未改模板或样式。真实冬马 20101 话 / 2010102 集通过生产投影、控制器 nextTarget 和既有播放器 formatter 得到 EP02；恢复队列同样通过。Browser 从个人故事页点击“播放 EPISODE 01”后，菜单实际显示“下一段 · EP02”。
- 此次标签回归：控制器、744 项真实剧情队列范围、core boundary 与 build:check 通过；隔离副本去掉 name 回退时断言失败，恢复修复后通过，日志为 `E:\Web_build\GS_Archive_engineering_20261007\personal-label-before.log` 和 `personal-label-after.log`。5175 未重启，未重建或上传 read-model。Browser 同时出现“译文暂时无法载入”，作为独立翻译资源状态记录，不将标签验收扩展为翻译可用性验收。
- 4.5 日文巡检入口已修复，两种详情均实际进入并扫描，缺失入口的反向测试失败如预期；见 [详情日文巡检](GS_ARCHIVE_JAPANESE_DETAIL_AUDIT_20261007.md)。仅记录原文、对白和资料小字段，不自行翻译。
- 4.7 的 38 项本地语料体检已完成执行与分类，详见 [语料体检](GS_ARCHIVE_CORPUS_AUDIT_20261007.md)：34 项通过，3 项数据/证据不一致，1 项达到 90 秒限时。仅修正检查脚本和运行参数，数据与基线待另行审阅；terminal 默认入口断言已完成上述定向修复。
- 4.6 页面 lang 与 4.8 问卷/反馈入口保留给用户及 UI 窗口；没有问卷链接，不填写猜测链接。

## 磁盘事件

本次清理闲置浏览器缓存和超过 24 小时的 SSR 转换缓存，回收 23.1 GiB，C 盘可用空间由 24.8 增至 47.9 GiB。保留源码、截图、日志、浏览器状态及在用配置目录，5175 未受影响。明细在 `E:\Web_build\GS_Archive_engineering_20261007\temp-cleanup-receipt.json`。后续本地 CI 临时文件固定写 E 盘，避免继续占用系统 Temp。

## 最终验收与交接

最终源码版本：`f6ffc4c6`。干净 LF 检出完整执行当前 workflow 的 115 步：**114 通过、0 失败、1 跳过 npm ci**。复用主检出 node_modules，Git Bash / Node 24.14.1 / Python 3.14 `-S`；这是本地复现源码门，不声称远端 Linux CI 或部署验收。

日志：`E:\Web_build\GS_Archive_engineering_20261007\gate-f6ffc4c6-final\results.json`，含每一步命令、退出码、耗时及独立日志。第 113 步包含 105/105 source batch；第 114/115 步完成无 public 复制的编译及当前构建审计。

之前 `b51abb3e` 的最终门发现标题索引超出 64 KiB；已按需分片修复并重新全量跑门，未提高预算。55 个译名和 534 条修订绑定全部保留；入口 18,496 字节、各分片 3,996–5,535 字节。详情见 [阅读标题分片](GS_READER_TITLE_SHARDS_20261007.md)。新增文件需包含在后续发布流程中，本轮没有 R2 上传或 Pages 部署。

| 原交接项 | 本轮结论 | 权威证据 |
| --- | --- | --- |
| 4.1 完整源码门 | 完成 | 最新干净 LF 114/0/1 与上述逐步日志 |
| 4.2 五项行为检查 | 完成 | 五项均进入 105 项 batch；各批生产行为、SSR 及反向结果见上文 |
| 4.3 App.vue 拆分 | 2026-10-08 完成四个视图族的首批逻辑提取 | 四批提交、390/1280 对比、最新完整源码门见下文；未宣称整个 App 完全解耦 |
| 4.4 个人故事下一段标签 | 完成 | 真实 2010102 → EP02；控制器/恢复队列断言、反向变体、5175 菜单实测 |
| 4.5 日文巡检详情入口 | 完成 | 卡片/活动实际详情扫描、失败入口反向测试与文字分类报告 |
| 4.6 html lang | 仅记录，等待用户决定 | 未修改 index.html |
| 4.7 38 项语料体检 | 完成体检与分类，保留失败证据 | 34 项通过，3 项数据/证据问题、1 项超时；未改相关数据或基线 |
| 4.8 反馈问卷 | 仅记录，等待链接及 UI 窗口 | 未猜测问卷地址或添加界面入口 |
| 临时语音故障 | 完成 | 实际语音别名、HTTP、解码/播放生命周期及回归，见语音修复记录 |

所有隔离工作树均已清理；最终门生成的审计及 LF 翻译清单差异保存在该日志目录的 `generated-audit.diff`，没有覆盖主检出的发布绑定。主检出依赖保留，两次日文巡检的临时浏览器目录均为空。5175 仍为原进程 74640，未重启。没有写入完整 C 盘媒体包，也没有改动他人的译文或原始资源。

## 2026-10-08 App.vue 拆分：舞台歌曲投影

- 用户已明确要求继续拆分。输入 HEAD `47911ff0`；抽出 `useStageSongProjection`，负责原曲成员、站位顺序、实验音源和歌曲目录。保留原先的详情身份检查及舞台默认 drvalv 语义，未改模板、样式或数据。
- App.vue 从 5182 行降至 5176 行（按换行拆分计数）；Vue SFC parser 对比模板和所有样式内容完全一致。
- 歌曲入口检查仍执行 App 的真实 composable 调用表达式，新增反应式状态切换、重复站位、不匹配详情、空映射、默认歌曲及真实 61 个歌曲实体的成员投影检查。
- 4 个错误变体（颠倒站位、丢失默认歌曲、允许过期成员、清空目录）均触发 AssertionError；基线通过。隔离检查数据在 `E:\Web_build\GS_Archive_engineering_20261007\stage-projection-20261008\`，没有改主工作区生成坏版本。
- `verify:source-batch` 105/105、完整 `verify:reading`、`build:check`、core boundary、歌曲选择器、歌曲舞台 handoff 和 stage intent 检查通过。日志为上述工程目录下 `stage-{batch,reading,build}-20261008.log`。
- Browser 复用 5175：默认 DRIVE A LIVE 暂停于 0:00；390×844 和 1280×900 拆分前后截图肉眼核对，布局、文案和控件不变。舞台 canvas 的重新栅格化细节不作为逐像素一致证明。切换 BRAND NEW FIELD 后，3 人编排和原曲成员按钮正常，点击后编队实际更新为 Jupiter；无 console error。
- 这是第一批舞台投影提取，不表示整个 App.vue 拆分完成。后续仍按歌曲/舞台、摄影、故事、门户逐族推进；没有部署或重启 5175。

## 2026-10-08 App.vue 拆分：摄影目录导航

- 从 `4f99b255` 抽出 `usePhotoCatalogNavigation` 的偶像选择、搜索、实体选择和摄影工作台入口；列表就绪与页面恢复生命周期继续留在 App，由原有导航协调器管理。App 从 5176 行降至 5160 行，模板/样式逐字一致。
- 原摄影检查通过 AST 取得真实 App composable 调用，执行生产模块及真实组件，保留六类目录、弹窗、分页、返回恢复、竞态、取消、错误与重试断言。4 个变体（丢失实体/偶像/搜索、错误工作台路由）全部被拦截，日志在 `photo-navigation-20261008/`。
- 偶像导航检查之前截取两个函数之间整段代码，包含新 composable 初始化后报缺少依赖；现改为 AST 精确提取真实函数，原行为断言不变，重新执行的 7 个错误变体仍全部失败如预期。
- Browser：390 宽摄影目录前后画面一致；1280 宽顶部共同可见区域一致（桌面前后截图可见高度不同，不称全图逐像素一致）。搜索“摄影棚”得到 3 条，打开详情进入工作台，再返回时保留搜索与场景详情；无 console error。对应源码模板/样式一致性断言通过。
- `build:check` 和完整 `verify:reading` 通过；首轮 batch 104/105 暴露上述测试提取问题，修正后重新执行整批 105/105 通过。日志为 `photo-{batch,reading,build}-20261008.log`。

## 2026-10-08 App.vue 拆分：故事目录投影

- 从 `142229b5` 提取 `useStoryCatalogProjection`：偶像范围、领域和活动分类计数、可用性与章节过滤、五种排序、可见条数。搜索仍由既有目录组件处理，没有增设另一套标题过滤。App 从 5160 行降至 5122 行，模板与样式内容完全一致。
- Browser 首轮发现抽取时立即传入了后声明的 `storyCatalogEntries`，产生初始化顺序错误；已把无副作用的 computed 声明移到调用前。新回归按 App 的实际声明顺序执行依赖和 composable 调用；把声明移回后方会确实触发 ReferenceError，不能再仅凭模块测试通过掩盖白屏。
- `verify-story-catalog-projection.mjs` 登记到 batch，覆盖生产 App 接线、响应式更新、过滤、排序、源数组不变和空数据。基线与 6 个反向变体的结果见 `story-projection-20261008/results.json`。
- 修正顺序后重新执行：batch 106/106、完整 reading、build:check 均通过；日志 `story-{batch,reading,build}-20261008.log`。没有复制完整 public。
- 5175 Browser：390/1280 宽目录前后截图布局与文字一致；1394 条总目录切换到活动 36 条，再选跨组合 2 条，最新排序实际生效。初始化修复后的刷新与操作没有新 error；本地浏览器证据不等同线上验收。

## 2026-10-08 App.vue 拆分：门户导航

- 从 `fd1dc7b7` 抽出 `usePortalNavigation` 的进入、来源保留、详情准备与返回；App 从 5122 行降至 5092 行，模板和样式逐字一致。四批累计从 5182 行降至 5092 行；这是四个视图族的首批逻辑边界提取，不表示 App 已完全解耦。
- Browser 暴露原实现的遗漏：歌曲数据在进入门户后释放，但返回分支没有重新加载。补齐歌曲目录和详情恢复，并在加载结束后检查导航修订，避免过期加载把用户带回旧页面。
- 门户回归执行真实 App 接线和生产模块，覆盖原有 13 个加载分支及新增歌曲目录/详情分支；6 个错误变体全部被拦截，基线通过。记录 `portal-navigation-20261008/results.json`。偶像导航原有 7 个错误变体也通过反向检查。
- 390/1280 宽门户前后截图布局与文字一致。5175 实际搜索 BRAND → 门户 → 返回后保留搜索且显示 BRAND NEW FIELD；该歌曲详情往返门户后标题、封面、Jupiter 与制作信息恢复；console 无 error。没有更改界面文案或布局。
- 最终修复后重新执行完整 source batch、reading 与 build:check；日志 `portal-{batch,reading,build}-20261008.log`。所有构建均不复制 public，未重启 5175、上传 R2 或部署。

## 2026-10-08 拆分后的完整源码门

- 已推送四批：`4f99b255`（舞台）、`142229b5`（摄影）、`fd1dc7b7`（故事）、`27a58654`（门户）。最终代码 `27a58654` 在 E 盘干净 LF 检出执行 workflow 全部 115 步：**114 通过、0 失败、1 跳过 npm ci**；复用主检出依赖，环境同前次本地门。第 113 步为 106/106，末两步编译及当前构建审计通过。
- 完整记录：`E:\Web_build\GS_Archive_engineering_20261007\gate-27a58654-final\results.json`。生成的资源审计和 LF 翻译清单差异保存在同目录 `generated-audit.diff`，未覆盖主检出的绑定。本次临时检出与依赖 junction 已移除，主依赖保留。
- 这是本地源码及上述实际 Browser 旅程的验收，未执行线上部署验收。5175 仍是原进程 74640。C 盘可用空间检查为 46.8 GiB；本轮所有临时构建与日志在 E 盘，没有全量媒体复制。
- 收尾时另有译文、审阅记录和新批次在共享工作区更新，均保留，未纳入本次工程提交。之前记录的语料数据差异、页面 lang 与反馈入口仍按原边界待后续处理。

## 2026-10-08 App.vue 继续拆分：舞台导航

- 输入 `250643f6`，提取 `useStageNavigation` 的歌曲入口、多人舞台、单人实验室、目标切换及来源返回，共 5 个函数；App 从 5092 行降到 5027 行。独立 AST 对比确认函数实现、模板与样式均保持一致，19 个接线依赖没有初始化顺序问题。
- 新增 `verify-stage-navigation.mjs`，实际执行 App 的工厂调用、生产模块和导航协调器，覆盖两处异步载入的取消、默认歌曲、身份守卫、缓存、handoff、目标竞争、错误、销毁及退出。适配旧歌曲入口与异步导航检查，没有复制生产逻辑。完整 batch 107/107、reading、build:check 通过。
- 基线通过，11/11 内存错误变体均触发 `ERR_ASSERTION`：默认歌曲、handoff 丢失、过期入口发布、跨歌曲守卫、来源覆盖、切歌错误追加历史、旧目标覆盖、忽略返回来源、错误无来源返回、目录准备丢失、退出未清 handoff。坏模块通过 data URL 执行，没有改动服务中的生产源码。该 verifier 的路由边界是受控依赖，完整恢复由上述 Browser 旅程补证。
- 5175 的 BRAND NEW FIELD 舞台在 390×844 与 1280×900 拆分前后肉眼对比布局、文字和控件一致；canvas 栅格化不声明逐像素一致。实测歌曲详情 → 舞台 → We're the one → 单人实验室 → 多人舞台（原有默认 DRIVE A LIVE）→ 返回原 BRAND NEW FIELD，来源详情恢复且无 console error。
- 日志：`E:\Web_build\GS_Archive_engineering_20261007\stage-nav-{batch,reading,build}-20261008.log`。这轮只使用不复制 public 的构建，并复用原 5175 服务。
- 代码提交 `9fa31503` 已推送。该提交的干净 LF 完整源码门 **114 通过、0 失败、1 跳过 npm ci**；第 113 步 107/107，末两步不复制 public 的编译与构建审计通过。记录：`E:\Web_build\GS_Archive_engineering_20261007\gate-9fa31503-final\results.json`，生成审计差异保存于同目录 `generated-audit.diff`；本次临时检出已清理，主依赖保留。反向检查明细在主检出 `.analysis/engineering-20261008-stage-navigation/mutation-results.json`。验收固定于上述提交，不包含其他窗口随后提交的译文；不代表部署验收。
- 剩余拆分仍有歌曲目录/详情与谱面工具共用的请求计数、数据载入和恢复 watcher，之后再按摄影、故事、门户处理剩余业务编排；首批提取不是整个拆分任务完成。

### 剩余逻辑范围（`9fa31503` 盘点）

App 当前仍有 208 个顶层函数。以下是函数体累计行数，不含多数 refs/computed/watch，不是净减少目标，也不据此机械拆分。

| 顺序 | 待迁职责 | 当前体量与边界 |
| --- | --- | --- |
| 歌曲 | 歌曲目录/详情入口、关联入口、谱面工具、歌曲加载与详情恢复 watch | 已在下方歌曲导航批次提取；模块统一拥有 `pendingSongNavigation`，App 对所有路由调用失效入口并保留整体恢复事务 |
| 摄影 | readiness 与共享返回的少量桥接 | 约 15–20 行；主要业务已抽出，`pendingPhotoCatalogRestore` 属于共享视图恢复，不为减少行数拆坏归属 |
| 故事一 | 目录、章节、详情与外链资源入口 | 已在下方通用故事导航批次提取；目录/详情计数和 5 个 loader 归模块，整体恢复事务仍由 App 管理 |
| 故事二 | 季节、工作、个人故事与生日跳转 | 约 182 行；每个子域的 catalog/detail/status 和请求计数成组迁移 |
| 故事三 | Reader 入口、章节、播放和续读来源 | 约 218 行；repository、两个 reading session、状态及投影应归同一领域，App 只分派恢复 |
| 故事四 | 通信与旧剧情目录 | 约 258 行；保留现有身份、模式与来源恢复合同 |
| 故事五 | 活动剧情与队列 | 约 91 行；保留播放控制器的队列所有权 |
| 故事数据 | 上述子域的数据加载 | 约 270 行；随所属批次迁移，不另外复制 catalog 或身份映射 |
| 门户/Home | 偏好与引导、Home 进入/切换/返回、门户结果分派、Home 数据 | 约 238 行；`homeVisits`、缓存上限、请求计数和 watcher 一起归属，仍从 App 统一路由/卸载失效 |

App 保留唯一导航 refs、history/startup/dispose、跨域协调与路由分派骨架、共享视图恢复和资源释放；各领域模块复用这些实例。卡片、卡池、偶像、组合和资源审计的完整编排没有悄悄算作已完成，也没有因上述盘点扩大成新的 UI 任务。后续每个代码批次仍需模板/样式一致、Browser、行为反向测试与规定源码验收。

## 2026-10-08 App.vue 继续拆分：歌曲与谱面导航

- 输入 `2bd9c548`，提取 `useSongNavigation`：歌曲目录/详情和关联入口、谱面准备/切歌/退出、目录与详情加载、3 个投影和 2 个 watcher。App 从 5027 行降至 4836 行；模板与样式逐字一致，独立 AST 复核确认迁移函数、投影及 watcher 的原有行为不变，22 个依赖没有初始化顺序问题。
- 歌曲、谱面及详情 watcher 共用模块内部的请求计数。App 的 `restoreRoute` 仍在原位置对所有路由调用 `invalidateSongNavigation`；`prepareSongRoute` 仅准备数据并返回是否仍有效，全局恢复事务与视图提交继续由 App 管理。
- 新增真实生产模块/实际 App 接线的 `verify-song-navigation.mjs`，覆盖跨歌曲/谱面/watcher 的竞争与取消、路由失效、默认舞台歌曲、失败策略、目录和详情身份、谱面变体及返回。既有歌曲入口、音频、关联、启动和门户回归共用新的生产模块 harness，未复制业务判断。
- 完整 source batch **108/108**、reading 与 `build:check` 通过；日志为 `E:\Web_build\GS_Archive_engineering_20261007\song-nav-{batch,reading,build}-20261008.log`。构建不复制 public。
- 基线通过，9/9 错误变体触发断言：切歌未共享计数、路由未失效、旧请求守卫丢失、切歌错误追加历史、谱面变体丢失、错误默认歌曲、旧恢复发布、目录身份遗漏、详情身份遗漏。结果在 `E:\Web_build\GS_Archive_engineering_20261007\song-navigation-20261008\results.json`；data URL 隔离变体未写入在用生产源码。
- 5175 Browser：390×844 与 1280×900 的歌曲详情前后对比布局和文案一致；桌面谱面在相同长轨模式与播放时间下保持一致。移动谱面布局/控件一致，但截图中的轨道滚动位置不同，不称逐像素一致；详情截图的一处焦点环来自键盘回顶操作。
- 实际旅程：BRAND NEW FIELD 详情 → 谱面 → 搜索 DRIVE → DRIVE A LIVE → 返回原 BRAND NEW FIELD；工具 → 无预选歌曲的 61 首选择器 → 返回工具。标题、难度及来源均正确，console 无 error。此为现有 dev 服务的本地界面验收，未扩展为真实音频长稳或部署验收。
- 5175 仍为原进程 74640，未重启；没有 R2 上传或完整媒体打包。下一批继续处理故事目录、章节、详情及外部入口的业务逻辑；需要 UI 或数据决策的已记录事项仍保留原边界。
- 代码提交 `1168f0c4` 已推送。首轮干净 LF 门为 112 通过、2 失败、1 跳过；两处失败均来自 `scripts/repair/player-entry.test.mjs` 的路由夹具漏接新歌曲模块。补用实际 App 调用与 `bindSongNavigation`，没有添加空函数替身或修改生产行为。定向 `verify:story-loading-safety` 与 `verify:player-repair`（37/37）通过；内存副本移除过期父页保护时，原断言准确发现旧详情被发布，生产源码哈希未变。证据在主检出 `.analysis/song-fixture-repair-20261008/`，首轮全门与审计差异保存在 `E:\Web_build\GS_Archive_engineering_20261007\gate-1168f0c4-final\`；完整门将对修复后的提交重跑。
- 修复提交 `7380cace` 已推送，并在干净 LF 检出重跑全部 115 步：**114 通过、0 失败、1 跳过 npm ci**。第 113 步 108/108；第 114/115 步编译与构建审计通过。环境仍为复用依赖的本地源码门，不声称远端 CI 或部署验证。完整结果与生成审计差异保存在 `E:\Web_build\GS_Archive_engineering_20261007\gate-7380cace-final\`。
- 本轮隔离检出和 dependency junction 已清理，主依赖与所有检查日志保留；C 盘可用空间为 46.8 GiB。主工作区剩余无关未跟踪文件未处理。故事下一批已取得目录、主线第 2 章和第 1 章序章详情的 390/1280 基线；尚未修改该批生产逻辑，不计作拆分完成。

## 2026-10-08 App.vue 继续拆分：通用故事导航

- 以 `0c98ada7` 为提取基线，新增 `useStoryNavigation`，迁移 19 个入口/播放/加载函数、3 个返回处理器和 2 个非立即 watcher。App 从 4836 行降至 4482 行；独立 AST 复核确认迁移函数、watch 回调、`applyArchiveRoute` 和模板/样式保持一致，42 个依赖没有初始化顺序问题。
- 章节集合与故事详情分别由模块内的请求计数管理；App 在原有恢复位置调用统一失效入口，直接播放器路由也会取消旧请求。路由规范化与元数据准备保留在原来的非直接场景分支，返回路由或失效结果；全局恢复与视图提交继续属于 App。模块先于歌曲模块初始化，保持歌曲关联章节入口可用。
- 新增 `verify-story-navigation.mjs`，执行实际 App 接线、生产模块、Vue 响应式和导航协调器；覆盖两类独立计数、跨域竞争、路由补全与失败回退、loader 身份/分片/形状检查、目录与搜索模式、分页重置、来源返回、外部四类目标、Reader 优先入口和章节/段落队列意图。
- 12 项既有检查改用生产模块共享 harness 或实际生产行为。harness 只暴露 App 实际解构出的处理器并支持本地别名，避免模块有导出却漏接到 App 时仍误判通过。删除 `openStoryIdol` 接线的内存副本会失去该函数并抛出 TypeError；加固后的 12 项定向检查再次全部通过，证据在主检出 `.analysis/story-harness-binding-check/`。
- 完整 source batch **109/109**、reading、`build:check` 通过；日志为 `E:\Web_build\GS_Archive_engineering_20261007\story-nav-{batch,reading,build}-20261008.log`。共享 harness 接线加固后又重跑上述 12 项定向检查；最终提交的完整源码门另行记录。构建没有复制 public。
- 基线与 14/14 错误变体验证完成，每个变体均触发断言：两类计数失效、跨域修订守卫、过期恢复发布、章节别名、歌曲来源返回、段落队列意图、四类资源身份、活动 Reader 优先、分页重置和恢复失败回退。结果在主检出 `.analysis/engineering-20261008-story-navigation/results.json`；变体使用内存 data URL，没有改写服务中的生产源码。
- 5175 Browser：390×844 和 1280×900 的故事目录、主线第 2 章及第 1 章序章详情在拆分前后布局与文案一致；桌面目录截图中“设置担当”的指针悬停态单独排除，不称逐像素一致。详情返回保留搜索模式和 1394 条目录；分类入口打开第 2 章，显示 11 章、102 段。
- 实际旅程还覆盖章节 EPISODE 02 → 播放器实际帧/对白 → 返回原章节，以及第 7 话 → 阅读 EPISODE 01 → 返回原章节并保留展开条目；console 无 error。外部资源开关关闭，外部跳转只由行为检查覆盖。此处只证明本地渲染与入口/返回，不扩展为音频解码、长稳或部署验收。
- 5175 保持原进程 74640；未重启、上传 R2 或打包媒体。共享分支期间收到另一窗口提交 `9225033e`（B013/B014 译文），原样保留；本批仅提交工程拆分、回归与记录，完整源码门将检查合并后的提交。季节/工作/个人与生日、Reader、通信、活动和 Home 剩余逻辑继续按批处理。
- 代码提交 `ef60beb7` 已推送，干净 LF 检出执行全部 115 步：**114 通过、0 失败、1 跳过 npm ci**。第 113 步为最终接线加固后的 109/109，末两步编译与审计通过。结果及生成审计差异保存在 `E:\Web_build\GS_Archive_engineering_20261007\gate-ef60beb7-final\`；本地源码门不等同远端 CI 或部署验收。
- 本次临时检出及依赖 junction 已清理，主依赖与证据保留；C 盘可用空间仍为 46.8 GiB。下一批季节、工作、个人页面的 390/1280 基线已记录；生日共享入口在现有实现中正确定位到个人故事 `20102 / 2010201`。
