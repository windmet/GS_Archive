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
| 故事二 | 季节、工作、个人故事与生日跳转 | 已在下方故事档案导航批次提取；6 个 loader、3 个请求计数、4 个身份投影及恢复准备归模块 |
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

## 2026-10-08 App.vue 继续拆分：季节、工作与个人故事档案

- 输入 `f0fcbe86`，提取 `useStoryArchiveNavigation`：14 个入口/播放函数、6 个 loader、4 个 computed、3 个返回处理器和三个私有请求计数。App 从 4482 行降至 4137 行，净减 345 行。独立 AST 对照确认上述原函数/投影/返回体及 `applyArchiveRoute` 不变，模板与样式逐字一致，35 个依赖的初始化顺序通过。
- 模块先于通用故事模块初始化；反向调用 `openStoryCatalog`、`openProjectedCollection` 使用原 App 实际延迟回调，不提前捕获未初始化的绑定。共享导航 refs、read-model ownership 清理及整体恢复事务仍在 App。新模块没有 watcher；恢复入口保留在原非直接播放器分支，直接播放器同样执行失效入口，但不预先加载父页。
- 新增真实 App 接线/生产模块的 `verify-story-archive-navigation.mjs`，覆盖三类独立请求计数、同域切换和跨域抢占、陈旧成功/失败、六类加载器身份/形状/计数/取消/缓存、季节三层回退、工作标签保留、个人定位重置、生日与两类通信关联、过滤后的播放队列，以及真实通用故事和 Portal 模块往返。
- 7 个旧检查适配真实模块 harness，保留原行为断言。独立复核指出只直接调用模块返回/恢复方法不能证明 App 接线，已补实际 `goArchiveBack` 与 `restoreRoute` 三域路径、返回值采用及失效委托计数；末端页面发布仍为受控边界。回归同时确认 raw-player 首帧前无父页加载，加载与播放器修复链（37/37）通过。
- 初次反向检查暴露默认企划排在夹具首位的盲点；改为默认项排第二，保留无默认时取首条和空目录失败。最终基线通过，**23/23 错误变体**触发断言，包括误接 Back、旁路恢复准备、丢弃准备结果和遗漏 App 失效调用。结果在主检出 `.analysis/engineering-20261008-story-archive-navigation/results.json`；测试只通过内存源码变体执行，未改写服务中的生产源码。
- 最终 source batch **110/110**、reading 与 `build:check` 通过；日志为 `E:\Web_build\GS_Archive_engineering_20261007\story-archive-{batch,reading,build}-20261008.log`。旧夹具和修复链明细保存在主检出 `.analysis/story-archive-fixture-check/`。所有构建不复制 public。
- 5175 Browser：季节、冬马工作及个人故事在 390×844 前后肉眼对照布局和文字一致；1280 桌面共同可见区域一致，前后截图的实际可见高度有差异，且现场担当偏好从未设置变为苍井享介，不把这些现场差异计作代码改动或逐像素一致证明。
- 实际旅程：工作档案切换至场景台词后改选翔太，`work_mode=lines` 和选中标签保留；季节 2023 Valentine → 2022 → White Day → 事务所 → 山村贤演出实际帧/对白 → 返回原企划；冬马个人故事 → 生日档案共享入口 → `20102 / 2010201` → SMALL TALK 02 演出 → 返回原章；第 2 话后日谈通信 → 剧情条件入口 → `20102 / 2010208` 精确定位。个人故事刷新可正常载入，console 无 error。
- Browser 的通信关联使用电话来源；unit 来源由真实模块行为回归覆盖。上述是本地 dev 渲染、跳转及返回验收，不扩展为音频解码、长稳或线上发布证明。5175 原服务保持运行，没有重启、R2 上传或完整媒体打包。剩余 Reader、通信/旧目录、活动和 Home 编排继续按原工程边界处理。
- 代码提交 `b6c6b833` 已推送。干净 LF 检出执行全部 115 步：**114 通过、0 失败、1 跳过 npm ci**；第 113 步为最终加固后的 110/110，末两步不复制 public 的编译与审计通过。结果与生成审计差异保存在 `E:\Web_build\GS_Archive_engineering_20261007\gate-b6c6b833-final\`，独立 AST 证据为主检出 `.analysis/engineering-20261008-story-archive-navigation/diff-review.json`。
- 本次临时检出及依赖 junction 已清理，主依赖保留；C 盘可用 46.7 GiB，5175 PID 仍为 74640。源码门固定于上述提交；另一窗口随后新增的 B015 审阅、译文、标题/检索索引、审计和检查脚本改动均未触碰，不纳入本次提交验收。

### Reader 下一批边界（`b6c6b833` 只读盘点）

- 建议一次提取 `useReaderNavigation`：17 个既有入口/阅读/播放/续读函数、4 个功能状态 ref、2 个 computed、repository 与两种 session，再通过 `applyReaderRoute` 和 `loadReaderQueue` 接回 App 原有分派位置。URL refs、跨域队列和恢复事务仍由 App 统一持有。没有新增 watcher 或卸载清理的理由，保留章节 session 原有 close 时机。
- factory 可放原 Reader 状态初始化位置；更早的播放器 `resolveReaderSource` 和通用故事 `openStoryReader` 必须延迟读取。新回归需检查真实初始化和闭包，不能沿用旧 Reading 夹具在创建后替换 session/repository/ref 对象的做法。重点适配 reading-navigation、reading-playback、player-entry，以及把 `readingState` 当切片终点的 terminal-idol-localization；一并核对 async/startup/portal 调度。
- 本轮只完成上述盘点，并保留冬马第 2 话 EP05 Reader 的 390/1280 可见基线；桌面与移动截图阅读滚动位置不同，后续对照需分别恢复同一位置。尚未修改 Reader 生产逻辑。

## 2026-10-08 App.vue 继续拆分：Reader 会话与导航

- 输入 `9f96acb8`，提取 `useReaderNavigation`：17 个原函数、4 个状态 ref、2 个 computed、ReadingRepository 与单篇/整话 session；另以 `applyReaderRoute`、`loadReaderQueue` 承接原 App 分支。App 从 4137 行降至 3843 行，净减 294 行。独立 AST 检查确认原函数、9 个声明、Reader 分支及队列兜底的原有逻辑一致，其他路由/队列分支和模板/样式不变；42 个依赖和 25 个 App 输出完成接线。
- 更早初始化的播放控制器和通用故事模块通过延迟回调读取 Reader 续播来源与入口。repository 和单篇 session 成为领域内部实例，URL refs、导航协调器、全局恢复/销毁仍由 App 持有；未新增 watcher、卸载动作或改变章节 session 的关闭时机。
- 新增 `verify-reader-navigation.mjs` 并纳入 source batch：真实 App 初始化/解构、Reader 路由和队列分派、通用故事入口及控制器续播回调都实际执行；使用真实 ReadModelClient、ReadingRepository、两种 session 和播放控制器。默认使用带匹配摘要的 synthetic compiled，保持干净源码检出可执行；`--local-sources` 另行通过仓库现有编译语料。媒体组件/预载为明确边界，不能把该测试称为音频播放验收。
- 5 项旧检查使用真实 Reader harness，或把偶像 computed 的位置哨兵改为实际声明的 AST 提取；保留原场景断言。检查范围含阅读导航/播放、播放器入口、偶像详情与终端本地化，关联异步/启动/门户检查也通过。初始化不预先塞入 Reader 占位函数，harness 只暴露 App 实际解构的输出。
- 基线通过，**20/20 错误变体**均触发断言：活动分段发布、领域投影、刷新失效、可选目录失败、跨目录复用、陈旧目录发布、章节定位版本、切话来源、返回 scope/work mode、播放范围、相邻话目/来源版本、无效正文行、队列文件，以及 App 两处分派、缺输出和两处延迟回调。记录在主检出 `.analysis/engineering-20261008-reader-navigation/results.json`；AST 证据为同目录 `diff-review.json`。变体只在 E 盘 QA 脚本与内存 data URL 中运行，没有改写服务中的源码。
- 5175 Browser：新取得相同正文起点的冬马第 2 话 EP05 基线；390×844 和 1280×900 前后布局与文字肉眼一致。刷新正文、单篇 → 实际演出帧（6/41）→ 原正文通过。原用户链接恢复到主线第 7 话 EP10（5/47），桌面返回整话并切到第 8 话；隔离后台标签页复核手机话目菜单切换、返回目录保留第 8 话 URL/展开、再次进入及 EP01→EP02 正文切换均正确。
- 故意使用过期 `reading_rev` 后显示版本提示，“重新载入正文”清除旧绑定并保留来源。原标签页在操作间隙曾发生其他章节选择变化；隔离标签页未复现，不将该现场归因于共享视图恢复。个人单篇的快速定位按钮空标签在拆分前后均存在，作为后续 UI/投影检查线索保留，本批不更改。
- 原用户链接首次进入曾显示“语音未载入 · 重试”，点击后提示消失；隔离标签页的直接进入也出现首段提示。仅凭界面不能区分首次播放策略与资源/解码原因，未据此宣称声音或长期稳定性通过。Reader 回归无 console error；Pixi Spine 的现有 warning 不计为本次新增错误。
- 独立复核发现旧迟到目录检查的正文身份与夹具不匹配，可能让错误发布也得到 null；已改为匹配身份，内存移除发布守卫后该旧断言准确失败，生产代码未改。最终 source batch **111/111**、完整 reading、`verify:story-loading-safety`、`verify:player-repair`（37/37）均通过；旧夹具修复后重跑完整 reading，通过记录为 `reader-reading-final-20261008.log`。
- 本批复用原 5175 进程 74640；没有重启、R2 上传、部署或完整 public 打包。`build:check` 通过（20.59 秒），输出仍为 `.analysis/build-check`。日志放在 `E:\Web_build\GS_Archive_engineering_20261007\reader-{build,reading,batch}-20261008.log`；完整源码门结果随后补录。共享工作区的 B015 译文、索引、审计和检查脚本改动保留，未纳入本批。
- 代码提交 `5a119b48` 已推送。该提交的干净 LF 检出完成全部 115 步：**114 通过、0 失败、1 跳过 npm ci**，第 113 步为 111/111，最后两步编译与构建审计通过。记录与生成审计差异为 `E:\Web_build\GS_Archive_engineering_20261007\gate-5a119b48-final\{results.json,generated-audit.diff}`；本地源码门不等同远端 CI 或线上部署验收。
- 本次临时检出及依赖 junction 已清理，主依赖保留；清理后 C 盘可用 46.55 GiB，5175 仍为原进程 74640。另一窗口在验收期间提交 `7e86f113`（B015–B017 草稿，含其标题工作）；保留在共享分支，本次源码门固定于 `5a119b48`，不包含该后续提交。

### 通信与旧目录下一批边界（Reader 拆分后只读盘点）

- 分两批，先 `useMobileNavigation` 再 `useLegacyAliasNavigation`。通信迁移 9 个入口/切换/播放函数、3 个 loader、2 个 options computed、返回处理器和请求计数，提供 prepare/invalidate；27 个依赖、17 个输出。factory 必须晚于 navigation 初始化、早于通用故事模块接收 `openStoryPhone`，不能简单放回原 options 位置。
- 旧目录迁移 8 个入口/返回函数、3 个 alias loader/publish、4 个 computed 和请求计数，提供 prepare/invalidate；22 个依赖、17 个输出。`openUnit` 属于旧前传入口，现代 `openArchiveUnit` 保留原归属。payload/status refs、共享 ownership、URL watcher 与整体导航生命周期仍在 App。
- 两个 prepare 保留各自原 restore 分支的身份、失败回退和调用位置；所有 restore 路径执行 invalidator。App apply 阶段既有 hydration 与统一状态分派先不合并，其规则与 restore prepare 不完全相同。尤其保留通信成员身份、电话文件到记录 ID、随机会话范围与旧目录父级 category/owner 校验。
- 必须适配 relation-navigation 的 `openMobileCard` 抽取、startup-route/修复链/故事档案的 restore fixture；旧目录还影响 idol-navigation-ux 与 archive-async-navigation 的宽切片边界。新增回归应验证实际 App 输入/输出、共享计数交叉竞争、明确来源和直接播放器零父页加载；projection 单测不能替代运行时导航回归。本轮只完成盘点，尚未实施上述两批。


### 通信导航拆分（2026-10-08，输入 d6418783）

- 提取 `useMobileNavigation`：12 个既有入口/选择/播放/加载函数、2 个 computed、私有请求计数，加上 Back、恢复准备及失效入口；27 个输入、17 个输出。App 3856→3661 行，模板、样式与 `applyArchiveRoute` 保持不变。12 个函数及 3 个声明通过 AST 等价检查，记录于 `.analysis/mobile-diff-review.json`。
- 新增真实 App 接线回归与 harness；适配启动恢复、故事档案、关联跳转和播放器入口夹具。覆盖三种选择器共享竞争（旧成功/旧失败）、失效/卸载、目录字段及身份验证、缓存/取消、单位归属、电话文件与记录定位、随机话题范围、关联卡片、实际 Back 绑定及实际 restore 的成功/降级/过期路径。无 UI 文案或布局修改。
- `verify:source-batch` 112/112、`verify:reading`、player repair 37/37、新通信回归、`build:check` 通过。首次编译在 Git 所有权审计失败，以进程级 safe.directory 重跑成功（14.12 秒）。日志 `.analysis/mobile-{source-batch,reading,player-repair,build-check}.log`；输出仅 `.analysis/build-check`，不复制 public。
- 5175 Browser：皮埃尔电话演出显示实际画面/对白并返回原目录；电话关联卡片往返；改选冬马后 phone 分类保留；组合聊天独立改选 Beit；切换随机分类回到冬马所属 Jupiter；第二随机话题仅播放步骤 7–11（界面 1/5），返回保留随机分类。390×844 和 1280×900 通信布局检查通过。这些是本地 dev 导航与画面验收，不作为音频解码、长稳或线上发布证明。
- 原 5175 PID 74640 保持，未重启、部署、上传或完整打包。其他窗口翻译、审计、`.gitattributes` 及未跟踪资料保留。代码提交 `5a0f1e59` 已推送；门禁结果见下。

- 固定 `5a0f1e59` 的干净 LF 完整源码门禁执行 115 步：113 通过、1 失败、1 跳过 npm ci（复用依赖）。唯一失败为新增 `verify-mobile-navigation.mjs` 末尾多一空行；`61724e04` 仅删除该空行，已推送，原范围 `git diff --check 39d79ba2… 61724e04` 和通信回归复验通过。原门禁报告不改写成全绿，也未为纯空白修正重复运行其他 113 项；源码与行为保持相同。
- 证据位于 `E:\Web_build\GS_Archive_engineering_20261007\gate-5a0f1e59-final\`：`results.json` 为原始门禁结果，`whitespace-correction.json` 为修正复验，`mobile-diff-review.json` 为 AST 对照，`generated-audit.diff` 为门禁生成差异。最终批量为 112/112，编译与当前构建审计通过。临时检出及 junction 已移除，主依赖保留；清理后 C 盘可用 48.38 GiB，5175 PID 74640。
- Browser 刷新后仍恢复皮埃尔 phone 页面，检查期间 console 无 error，临时 viewport 已重置。下一批继续旧目录兼容导航；本轮不引入 UI 改造。


### 旧目录兼容导航拆分（2026-10-08，输入 999d9b00）

- 提取 `useLegacyAliasNavigation`：11 个既有函数、4 个 computed、私有请求计数及 prepare/invalidate；22 个依赖、17 个输出。App 3661→3478 行。AST 对照确认迁移函数、5 个声明、模板/样式、`goArchiveBack`、`applyArchiveRoute` 及 restore 委托外内容不变，证据 `.analysis/legacy-diff-review.json`。现代 `openArchiveUnit`、payload refs、共享生命周期仍留在原处。
- 新真实 App harness/verifier 覆盖目录/文件身份、category/owner 父级匹配、哈希 descriptor、筛选、缺失文件不播放、三入口交叉竞争、旧成功/旧失败、私有失效/全局 revision/卸载、返回分支；同时执行真实 restore 与 apply，验证恢复成功/降级/过期以及直接播放器不加载父目录。适配六个既有夹具，语音预览的脆弱字符串切片改为 AST 函数提取。
- 源码 batch 113/113、reading、player repair 37/37、新 legacy verifier 和 `build:check`（22.57 秒）通过；夹具提取整理后 async-navigation 再次通过。日志 `.analysis/legacy-{source-batch,reading,player-repair,build-check}.log`。构建只写固定 `.analysis/build-check`，不复制 public。
- 5175 Browser：旧前传组合目录→Jupiter→第一话文件→演出实际对白→返回同一文件；输入无匹配搜索显示空态；清空并刷新恢复；再返回 Jupiter 章节及组合目录。三层目录在 390 与 1280 宽度前后肉眼对照结构和内容一致，指针悬停/焦点高亮不同不计为代码外观变化。console 无 error，临时 viewport 已重置。没有将上述视图与跳转验收扩展为音频/长稳/发布验收。
- 仅记录既有 UI 待办：旧兼容目录仍展示 episodes/files、源文件名及 voices/lips 技术数量；本批未改文案、元素或样式。仍不部署、不上传、不重启 5175。代码提交 `48119223` 已推送；完整门及测试加固见下。

- 固定 `48119223` 的 LF 干净检出完整门：115 步中 114 通过、0 失败、1 跳过 npm ci；batch 为 113/113，最后编译与当前构建审计通过。结果 `E:\Web_build\GS_Archive_engineering_20261007\gate-48119223-final\results.json`，未挂载主检出的忽略语料，临时文件仍定向 E 盘。
- 反向验证促成两处测试加固：直接断言 group/file payload 不串写，以及返回组合目录时同时清空旧 group/episode。加固后的正向基线通过，9/9 错误变体被断言拦截（父 category、父 owner、缺少发布、私有失效、共享请求序号、缺失文件播放、章节清理、App 恢复结果未采纳、App 接错 payload ref）。变体只在 `.analysis/legacy-mutations/` 与内存模块副本中执行，不改服务源码。
- 全门结束后，仅将加固脚本叠加到同一 LF 干净检出并单独运行，通过；这不是对后续测试改动重跑全部 115 步的声明，生产代码与全门版本完全相同。脚本哈希与结果见上述门目录 `strengthened-verifier.json`、`legacy-strengthened-verifier.log`；AST 与反向记录分别是 `legacy-diff-review.json`、`mutation-results.json`。
- 生成审计和测试加固差异已分别保存，临时检出及 node_modules junction 已清理，主依赖保留；清理后 C 盘可用 48.45 GiB，5175 PID 74640。其他未跟踪资料保留。

### 下一批活动导航边界（只读盘点）

- 活动详情先关注 9 个入口/返回/播放/关联/加载函数、4 个详情 computed 与请求计数。保留奖励分页的 eventId/count、castReferences 对齐、目录去重和中止检查；恢复与 App apply 的职责不混并。
- 现有活动目录 browse/query/ready 与共享 `restoreDetailSource`、`pendingEventCatalogRestore` 相互关联，提取前再次核对状态初始化和返回滚动恢复。`openDomainCatalog` 同时负责多个目录，不直接并入活动详情模块。
- 需适配 event-readmodel-navigation、event-view-consumer、event-catalog-navigation、relation-navigation、各 restore fixture，以及 async-navigation 中依赖 `openEventCard` 的旧宽切片终点。先验证同一批，再继续 Home 等剩余编排。

### 活动导航拆分（2026-10-08，输入 9f0f81df，续作 HEAD e662d948）

- 提取 `useEventNavigation`：9 个既有函数、4 个 computed、私有请求计数及 prepare/invalidate；27 个依赖、15 个输出。App 3478→3357 行。AST 对照确认迁移函数和 5 个声明等价，模板/样式、`applyArchiveRoute`、`goArchiveBack`、restore 委托外逻辑不变，证据 `.analysis/event-diff-review.json`。共享目录 browse/query/ready 与 payload 生命周期继续由 App 管理。
- 活动 factory 晚于卡片/组合 computed 初始化；故事模块到活动详情改为延迟回调，真实 App harness 验证先初始化故事、后初始化活动再跳转。旧活动详情、奖励分页、目录组件、关联跳转、启动及播放器恢复检查改用真实 factory，保留既有断言；移除 async fixture 中原本起点已不存在的空字符串切片。
- 新回归覆盖目录 count/去重/身份/取消及缓存，castReferences 对齐，活动投影、队列过滤与返回上下文、旧成功不覆盖新选择、私有失效/全局 revision/卸载、关联卡片的迟到防护、来源返回分支、实际 restore 的成功/降级/过期及直接播放器零父页加载。奖励分页 schema、eventId、count、缺页等仍由原消费者回归执行。
- 反向验证促成过期 payload 与 App 状态隔离断言加固；正向基线通过，14/14 错误变体被拦截，包含延迟接线丢失、接错 payload、restore 未采纳、过期发布、关联守卫、播放过滤/缺失/返回、目录取消与身份、cast 引用。记录 `.analysis/event-mutations/results.json`，变体仅运行于 E 盘测试副本和内存模块，不改服务源码。
- source batch 114/114、完整 reading、player repair 37/37 与 `build:check`（22.41 秒）通过；输出仅 `.analysis/build-check`、不复制 public。日志 `.analysis/event-{source-batch,reading,player-repair,build-check}.log`。反向加固后的新回归基线再次通过；完整干净源码门结果随后补录。
- 5175 Browser：Plus 1 搜索→原期活动→播放实际对白（7/18）→返回；奖励卡片、出演者握野英雄及 FRAME 组合分别往返；详情刷新后返回目录保留 Plus 1 与两条结果。390×844 和 1280×900 的目录/详情对照布局内容一致（焦点高亮差异除外）；没有白屏或框架错误，console 无 error，保留既有 Pixi Spine warning。测试视口已重置。未把本地导航/画面验收称为音频解码、长稳或发布验收。
- UI/数据待办仅记录：奖励列表仍有「未绑定图片」与原文道具名；关联卡说明仍有「获得方式待确认」。本批不修改这些展示。原 5175 PID 74640 保持，没有重启、部署、R2 上传或完整资源打包；共享工作区译文及其他未跟踪资料保留。

- 代码 `9e3ed2e7` 已推送。固定该提交的 LF 干净检出完整源码门 115 步：**114 通过、0 失败、1 跳过 npm ci**；其中 batch 114/114，最后代码编译与当前构建审计通过。证据 `E:\Web_build\GS_Archive_engineering_20261007\gate-9e3ed2e7-final\` 下的 `results.json`、`generated-audit.diff`、`event-diff-review.json`、`mutation-results.json`；这是本地源码门，不是远端 CI 或上线验收。
- 临时检出与依赖 junction 已清理，主依赖保留，清理回执 `cleanup.json`：C 盘可用 49.41 GiB，5175 仍为 PID 74640。收尾发现另一窗口新增未提交的 `src/components/archive/ArchiveEventDetail.vue` UI 改动（文件时间 19:56）；原样保留、不纳入本批。上述固定提交门禁与此前 Browser 旅程不扩展为这份后续 UI 改动的验收。

### 下一批 Home 编排边界（活动拆分后只读盘点）

- 下一批优先 `useHomeNavigation`：`loadHomeIndex`、`loadHomeIdol`、`openGameHome`、`closeHomeVisit`，及 `homeSelectedId` 异步 watcher 的处理器。同一私有请求计数必须贯穿打开、切换、restore 和 unmount；App 保留 watcher 注册与统一生命周期，只委托处理器和 invalidate。
- `recentHomeProfiles` 与三人缓存淘汰随 loader 一起归属；`homeVisits` 仍需作为同一个 Map 交给 `usePortalNavigation`，保留临时访问的台词/服装和门户范围/搜索返回。读取页的去重、hydrate 校验、中止后不发布与缓存命中顺序不能改变。
- `archiveStats`…`idolPickerLabel` 保持连续，首页/picker computed 暂留 App，factory 应在该区域之后、所有消费者之前绑定。`goHome` 的跨领域清理、用户偏好写入、onboarding/picker 分派和 Home 三个跨域快捷入口先保持原归属，避免把偏好修改与临时 Home 访问混在一批。
- 已确认受影响护栏：home-portal-visits 的函数提取、async-navigation 中以 `loadHomeIndex` 为终点的切片、各 restore fixture 与 App 卸载处计数；后续测试必须执行真实 Home loader、共享请求和三人缓存，不仅替换 Home 打开函数。当前仅盘点，尚未实施 Home 拆分。

### Home 加载与临时访问拆分（2026-10-08，输入 02056b0c）

- 提取 `useHomeNavigation`：4 个既有加载/打开/返回函数、偶像切换 watcher 处理器、三人缓存顺序/请求计数/访问 Map，以及 prepare/invalidate；24 个依赖、8 个输出。App 3357→3257 行。模板、样式、首页投影块、偏好与 onboarding/picker、统一 apply/Back 保持原处；App 保留 watcher 注册和卸载生命周期。AST 等价记录 `.analysis/home-diff-review.json` 验证函数、watcher body、迁移状态，以及 restore/unmount 委托外内容。
- 新增真实 App harness/verifier：目录 bootstrap 顺序与身份、profile 身份、台词页去重及缺行/多行/错序/缺 previewStep、signal/priority、中止后不发布、缓存命中更新及三人 LRU、候选优先级、失败重试、偏好隔离、台词/服装/门户范围返回、Portal 与 Home 共享同一 Map。实际执行 Vue watcher 注册、App restore 与卸载；旧成功/旧失败跨打开和切换竞争不覆盖新 owner，直接播放器不加载父 Home。
- 旧 Home 临时访问检查改用真实 loader 与 App factory；适配启动/故事档案/通信/旧目录/活动/播放器 restore 夹具，async 的 `loadScenario` 不再依赖 `loadHomeIndex` 字符串终点而采用实际函数 AST。新 fixture 的索引与 bootstrap 分开拷贝，避免损坏测试同时修改预期值。
- 正向基线通过，17/17 反向变体被拦截（目录/profile 身份、两级中止、LRU 命中/容量、访问保存/台词、共享请求、watcher 回滚/结束、App 恢复采纳、watcher/unmount 接线、Portal Map、错误 profile ref）。记录 `.analysis/home-mutations/results.json`；变体不写服务源码。source batch 115/115、完整 reading、player repair 37/37、`build:check`（17.63 秒）通过，最终新增 Map 回归与断言加固后的基线再次通过。日志 `.analysis/home-{source-batch,reading,player-repair,build-check}.log`，构建输出固定 `.analysis/build-check`、不复制 public。
- Browser 5175：以享介首句与基础常服取得 390、1280 宽度基线，恢复相同 URL 后静态控件布局与文案肉眼一致，Spine 姿态随时间变化。手机切换茁壮明彩服装和第 2 句→返回资料馆→重新进入，URL、台词和服装保留；首句深链接刷新恢复通过。中途跨较长操作间隔曾丢失临时访问状态，同一会话连续往返未复现；共享开发期间存在其他窗口 HMR，不据此单独归因于本次逻辑。热更新写入期 20:04 出现一次 App reload error，随后刷新恢复；最终全新后台标签页恢复首句、基础常服与实际立绘，console error 为 0，未出现白屏或框架 overlay；临时 viewport 已重置。上述仅证明本地页面/导航，不作为音频或长稳验收。
- UI 待办仅记录：首页第二句在未设制作人时仍显示 `●●●●●●●●●●監督`；不在本批调整称呼或文案。另一窗口已提交 B026–B027 译文及活动/档案样式（包括 `f454ddab`、`454b6a9d`、`31876817`、`a005c3c3`），原样保留；本批没有改动组件模板或样式，没有重启、部署、R2 上传或完整资源打包。

- 代码 `8adf48f1` 已推送。固定该提交的 LF 干净检出完成全部 115 步：**114 通过、0 失败、1 跳过 npm ci**；source batch 115/115，最后编译（33.423 秒）与当前构建审计通过。证据位于 `E:\Web_build\GS_Archive_engineering_20261007\gate-8adf48f1-final\`，包括 `results.json`、`generated-audit.diff`、`home-diff-review.json`、`mutation-results.json`；这是本地源码门，不代表远端 CI、媒体发布或上线验收。
- 临时工作树及依赖 junction 已清理，主工程依赖保留，见同目录 `cleanup.json`。清理后 C 盘可用 48.55 GiB，5175 仍为 PID 74640。收尾发现另一窗口新增 `src/components/archive/ArchiveImmersiveHome.vue` 与 `src/styles/archive-home-day.css` 改动，原样保留、不纳入本批；固定提交门禁及此前 Browser 旅程不扩展为这两份后续 UI 改动的验收。

### 下一批偶像档案边界（Home 拆分后只读盘点）

- 下一批优先 `useIdolNavigation`：`openPrimaryIdol`、`openIdolReadModel`、`openIdolDirectory`、`selectPrimaryIdol`、两个 read-model loader、详情 watcher 处理器、请求计数与 prepare/invalidate；身份/资料/显示名/统计/活动/歌曲 6 个 computed 可随同迁移。初步 22 个依赖、15 个输出，实施时以 AST 的真实引用再次核对。
- 入口与 `[view,currentCharacterId]` watcher 必须共享请求计数；保留 `selection` 只更新选择、`captureSource/resetContext/clearUnit/clearEventContext` 各自语义。恢复时无效偶像进入 profile picker，加载失败回偶像目录，不能混成同一回退。
- factory 需早于 Legacy/Event/Song 等调用方，且晚于 navigation/refs 初始化；若把 computed 一起迁移，可放在 Home 接线之后，保留 `archiveStats`…`idolPickerLabel` 原连续块。显示名仍通过 App 的既有函数依赖，避免重做本地化。
- `openIdol` 中卡片目录分支、`openIdolDomain` 跨领域分派、现代组合、卡片共享请求计数和 `goHome` 全局清理暂不并入。主要受影响护栏是 idol-readmodel-navigation、idol-navigation-ux、idol-communication-readiness 的实际 watcher、relation-navigation、各 restore fixture，以及提取详情 computed 的旧投影检查。当前只盘点，尚未实施。

### 偶像导航迁移前的真实加载回归（2026-10-08）

- 复核发现旧 idol-readmodel-navigation 与 communication-readiness 测试替换了内部 `loadIdolDetail`，无法覆盖迁移中的目录/详情校验丢失。新增 `idol-navigation-harness.mjs` 与 `verify-idol-loading-boundary.mjs`，以 AST 执行 App 当前 6 个函数、6 个 computed 与同一请求计数，真实加载函数保持在一起；仅在 ReadModelClient 传输边界提供夹具。新检查纳入 source batch，旧检查保留。
- 覆盖索引→分页→详情的请求路径与身份/options、目录顺序/数量/名称/描述符、叶子 profile/stats/events/songs、取消后不入缓存、缓存复用、未知身份不发请求、失败重试、旧成功/旧失败不覆盖新选择、全局失效/卸载、各入口选项保留与清理、selection 分支、投影身份隔离。实际注册 Vue watcher，验证 watcher→点击及点击→watcher 两种竞争共用计数。
- 正向基线通过，8/8 内存错误变体被断言拦截：目录名称、数量、取消、profile 身份、请求归属、投影身份、活动上下文清理、selection 分派。证据 `.analysis/idol-boundary-mutations/results.json`；变体没有写入服务源码。旧 idol-readmodel-navigation 与 archive-relation-navigation 回归也通过。
- 本批先建立迁移前行为证据，尚未提取 `useIdolNavigation`；生产代码、模板和样式均未修改，因此不重复构建或声称新增 Browser 验收。其他窗口提交的 `0400c47c` 及后续门户 UI 编辑保留，不属于本批验收。下一步迁移上述生产逻辑，并将 harness 改为执行 App 的真实 factory 参数和解构输出，再验证恢复与生命周期接线。
- 当前共享工作区 source batch **115/116**：仅 `verify-design-tokens.mjs` 失败，指出正在编辑的 `ArchivePortalOverview.vue`（4 处 box-shadow）与 `PortalCardBento.vue`（background、box-shadow）使用 `--gs-ink`。只在内存中用 `0400c47c` 对应两份文件作对照，同一检查通过，未改写、还原或暂存这两份 UI 文件。日志 `.analysis/idol-boundary-source-batch.log`、`.analysis/idol-boundary-design-head.log`。不能将该对照写作当前共享工作区全绿；新增回归及最终反向检查已单独重跑通过。

### 偶像档案导航拆分（2026-10-08，输入 6755824a）

- 提取 `useIdolNavigation`：6 个既有导航/加载函数、6 个身份隔离 computed、详情 watcher 处理器、私有请求计数及 prepare/invalidate；22 个依赖、15 个输出。App 3257→3159 行，净减 98 行。factory 位于 Home 之后、Legacy/Event/Song 之前，初始化依赖顺序已检查。
- AST 对照确认迁移函数、computed、请求计数与 watcher body 等价；模板/样式、apply/Back/goHome、openIdol/openIdolDomain 跨域分派以及原 unmount 不变；restore 仅替换原偶像 prepare 分支与计数失效调用。证据 `.analysis/idol-diff-review.json`。无效偶像仍去 profile picker，加载失败仍回偶像目录；直接播放器不加载父偶像。
- 上一批真实加载 harness 改为执行 App 实际 factory 参数与解构输出；旧导航、通信 watcher、目录 UX、关联跳转、启动/播放器恢复及本地化投影检查同步适配，内部偶像 loader 不再使用旧 stub。恢复夹具保留同一个客户端对象，避免测试中的取消包装与模块引用分离。跨域入口未返回异步请求的既有语义不变，关联检查在请求完成后观察结果。
- 新增实际 restore 的成功、未知身份、失败回退、旧成功/旧失败竞争及直接播放器零父页请求；实际 unmount 验证卸载后不发布。正向基线通过，14/14 内存错误变体被断言拦截，覆盖目录名称/数量/取消、profile 身份、请求归属、投影身份、上下文清理、selection、私有失效、无效恢复/过期恢复、App 恢复采纳、watcher 接线和卸载 dispose。证据 `.analysis/idol-mutations/results.json`；变体没有写服务源码。
- source batch 116/116、完整 reading、player repair 37/37、独立偶像/关联导航及终端偶像本地化检查通过；新增卸载断言后的基线和反向检查再次通过。`build:check` 通过（21.42 秒），输出固定 `.analysis/build-check`，不复制 public。日志 `.analysis/idol-{source-batch-final,reading,player-repair,localization,build-check}.log`。
- 5175 Browser：1280 宽度冬马详情迁移前后布局/文字一致；下一位切翔太、刷新恢复、电话通信 6 条入口及返回详情通过。390×844 选择器切北斗、URL 更新，再用全新标签页直接恢复北斗详情通过；控制台无 error，无白屏或框架 overlay。临时视口已重置、标签页关闭。这是页面/导航验收，不代表语音解码、长稳或发布验收。
- 本批没有修改组件模板、样式、文案或译文，没有重启、部署、R2 上传或完整资源打包。其他窗口已提交 `5a249b0f` 门户令牌调整，及其后续翻译审计改动均保留；此前共享工作区设计令牌失败已由该窗口处理，最终 batch 通过。固定提交的完整干净源码门随后补录。

- 代码 `13bb87d1` 已推送。固定该提交的干净 LF 检出完整 115 步结果为 **113 通过、1 失败、1 跳过 npm ci**：唯一失败是另一窗口此前提交的 `archive-home-day.css` 末尾空行；source batch 116/116、最终编译与当前构建审计均通过。证据 `E:\Web_build\GS_Archive_engineering_20261007\gate-13bb87d1-final\results.json`。预检查曾因临时检出 CRLF 停止，恢复索引所记录的 LF、保留显式 CRLF 夹具并确认干净后才执行完整源码门。
- 后续 `4b968e3d` 仅移除上述一个末尾 LF，已推送；字节对照确认没有 CSS 声明或其他文件变化，完整 base→修复提交的 whitespace 检查通过，证据同目录 `whitespace-repair.json`。没有将原始失败报告改成全绿，也未对纯末尾空白重复执行全部源码门；此处是原完整门结果加单项修复复验，不是新提交全门或远端 CI 声明。
- 生成审计差异、AST/反向记录已保存到同目录，临时检出及 node_modules junction 已清理、主依赖保留；`cleanup.json` 记录 C 盘可用 47.91 GiB，5175 仍为 PID 74640。没有部署、R2 上传或完整资源包。

### 下一批组合档案边界（偶像拆分后只读盘点）

- 组合详情适合下一批：`openArchiveUnit`、`openUnitFromIdol`、两个 Unit loader，以及 `unitCatalogEntries/currentArchiveUnit/currentArchiveUnitEntry/currentArchiveUnitMembers/currentArchiveUnitStories/currentArchiveUnitSongs` 六个 computed；加入 prepare/invalidate 以承接原 restore 分支与私有计数。实际分组数/顺序来自 bootstrap 中去重的 unitId，目录和详情两级身份校验、信号取消与 code/id 双入口均须保留。
- `openUnitMember`、`openUnitStory`、`openUnitEvent` 可作为 Unit 对外入口随模块迁移，但 Event factory 晚于当前 Unit computed，必须用延迟回调连接 `openEventDetail`，不提前读取未初始化的 const。App 的 `watch(view)` 同时负责组合目录元数据和卡名翻译，保留原注册与触发时机。
- `openUnitCards` 使用的是 `pendingCardNavigation`，与卡片目录/详情竞争；这一批先保留 App，不能另建 Unit 私有卡片计数而改变竞争语义。后续卡片模块统一处理该入口。通用 route apply/Back、Portal hydration 和全局缓存清理也保持既有边界。
- 受影响检查包括 unit-readmodel-navigation 的函数切片、relation-navigation 的三个组合入口、各 restore fixture、Unit computed 消费者；既有 Unit 入口测试同样替换内部 loader，迁移时改为真实目录/详情传输，验证双身份入口、错误身份、迟到成功/失败、取消、恢复与播放器父来源。当前仅盘点，未实施 Unit 拆分。

### 组合档案导航拆分（2026-10-08，输入 9a89da72）

- 提取 `useUnitNavigation`：7 个既有导航/加载函数、6 个 computed、私有计数与 prepare/invalidate；18 个依赖、15 个输出。App 3159→3064 行（含清理迁移留下的空白），净减 95 行。AST 证据 `.analysis/unit-diff-review.json` 确认函数、投影与计数等价，模板/样式、apply/Back/goHome、原 unmount、跨域入口与 `openUnitCards` 不变，restore 仅委托 Unit 分支与失效计数。
- factory 保留在原组合投影位置，早于 Event/Song 等消费者；`openEventDetail` 通过 App 延迟回调绑定。`watch(view)` 中目录元数据加载和卡名翻译时机保持原样，组合到卡片仍使用 App 的共享卡片计数。七个输出入口包括成员、剧情、活动关联，不更改返回来源。
- 新增真实 App factory harness 与 `verify-unit-navigation`，覆盖 bootstrap 组合去重顺序、目录数量/身份/结构、详情身份与成员/统计/歌曲/剧情形状、code/id 双入口、缓存复用、取消后不发布、目录回退投影和旧详情隔离、上下文清理与保留、成员/剧情/活动入口、旧成功/旧失败竞争、私有失效/全局 revision/卸载，以及真实 App restore 成功、失败、过期和直接播放器零父目录加载。旧 Unit 测试改用真实加载链，关联检查增加组合→活动，移除已被真实 factory 覆盖的假入口。
- 正向基线通过，16/16 内存错误变体被拦截，包含目录数量/身份/取消、详情身份、双入口、投影归属、活动上下文、私有失效、恢复降级/过期/采纳、成员参数、缺失剧情、规范组合代码、prepare 目标页和延迟 Event 接线。记录 `.analysis/unit-mutations/results.json`；变体不写服务源码。
- source batch 117/117、完整 reading、player repair 37/37、旧 Unit/卡片/关联与启动回归通过；`build:check` 通过（14.73 秒），输出固定 `.analysis/build-check`，不复制 public。移除无效测试占位和空白后，相关 Unit/关联回归与 AST 对照再次通过。日志 `.analysis/unit-{source-batch,reading,player-repair,build-check,startup}.log`。
- 5175 Browser：Jupiter 详情在 1280 宽度和 390×844 下迁移前后布局/文字一致。手机成员翔太→返回、固定组合活动 Inner Dignity→返回、成员卡片目录保留 Jupiter 3 人筛选→返回均通过。桌面组合剧情进入实际对白 5/233，并返回 `unit_detail&unit=01jup`。这些证据不代表音频解码、长稳或线上发布验收。本批没有改组件模板、样式、文案或译文，没有重启、部署、R2 上传或完整资源打包；其他窗口翻译审计工作保持原样。
- Jupiter 返回后刷新恢复通过，console error 为 0；临时视口已重置、临时标签页已关闭。完整干净源码门结果随后补录。

- 代码 `396971e7` 已推送。固定该提交的干净 LF 检出完成全部 115 步：**114 通过、0 失败、1 跳过 npm ci**；source batch 117/117、最终 `build:check`（16.50 秒）与当前构建审计通过。编译未复制 public；既有大 chunk 与运行时背景资源解析提示仍存在。这是本地源码门，不代表远端 CI、媒体发布或上线验收。
- 证据保存在 `E:\Web_build\GS_Archive_engineering_20261007\gate-396971e7-final\`：`results.json`、`generated-audit.diff`、`unit-diff-review.json`、`mutation-results.json` 与 `cleanup.json`。临时检出和依赖 junction 已清理，主工程依赖保留；C 盘可用 47.89 GiB，5175 仍为 PID 74640，未重启。

### 下一批卡片导航边界（组合拆分后只读盘点）

- 下一批统一处理卡片目录、卡片详情与 `openUnitCards`，共享一个 `pendingCardNavigation`；不要按入口另建计数。基础边界包括三项 loader（facets/catalog/detail）、目录/详情打开、偶像筛选、返回卡片目录与同系列入口；目录/筛选/详情身份/前后卡/同系列等 computed 可随同迁移，实施时再核对准确依赖数。
- 保留 facets 的单次请求复用、失败后可重试，以及目录的可选属性回退；目录校验数量、resource_id 唯一性、id 对齐、ownerReference 和两个整数计数，中止后不发布。详情必须携带 expectedId 并校验 resource_id、ownerReference、home_voice_cues/scenario_entries。新回归需实际执行这条加载链，而不是复用旧卡片测试的内部 loader stub。
- factory 应位于 Unit 之后、Event 之前，继续让 Event 接收实际 card refs/入口。卡片到活动、卡池的跨域回调若迁入，须按实际初始化顺序延迟绑定。`openIdol` 的双目录分派、`openVoicePreview/restoreVoicePreview` 的播放控制及统一 apply/Back 暂留 App；声音入口不能因拆分改变 revision、目标卡身份或返回来源。
- 重点验证卡片列表→详情→组合卡片目录交叉竞争，过滤条件清理/保留、详情身份隔离、成员 owner 与来源恢复、深链接/player 父卡加载、可选 facets 失败和取消。主要影响旧 card-readmodel-navigation、card-filtering、relation-navigation、async/player voice 与各 restore fixture。当前只盘点，未实施卡片拆分。

### 卡片导航迁移前的真实加载回归（2026-10-08，输入 e8bc33eb）

- 新增 `card-navigation-harness.mjs` 与 `verify-card-loading-boundary.mjs`，通过 AST 提取并共同执行 App 当前 15 个函数、15 个 computed、共享请求计数和 facets promise。内部 loader 不替换，仅在 ReadModelClient、facets HTTP 和跨域回调边界提供夹具；新 verifier 纳入 source batch。
- 覆盖两页目录合并、bootstrap 数量、资源 ID 唯一性与对齐、owner/计数字段、详情 expectedId/身份/数组、缓存复用、未知卡不发叶子请求；真实属性函数校验 facets release 和 detail hash，保留内置属性，可选数据失败不阻断目录，失败后可重试，共享在途 promise。分别在分页和 facets 等待期间取消，确认不发布目录缓存。
- 三入口（列表、详情、组合卡片目录）两两竞争，迟到成功和失败均不覆盖当前页面；另隔离全局 revision 检查共享私有计数，避免两层保护互相掩盖。覆盖全局失效/卸载、页面准备等待、失败重试、过滤和上下文清理/保留、详情投影身份、前后卡/同系列、成员/剧情/活动/卡池入口，以及来源返回和集合卡片目标校验。
- 正向基线通过，14/14 内存错误变体被断言拦截：目录数量/身份/取消、详情身份/expectedId、facets 重试、内置属性、投影归属、三个入口计数、活动上下文、组合目录目标和页面准备。证据 `.analysis/card-boundary-mutations/results.json`；变体没有改写服务源码。旧卡片导航和关联导航 17 条生产边回归通过。
- source batch **118/118** 通过，日志 `.analysis/card-boundary-source-batch.log`；覆盖清单检查通过。随后仅加强 facets 重试失败的断言类型，正向基线与全部反向变体再次通过。
- 本批仅建立迁移前证据，尚未迁移卡片生产逻辑；未修改 App、组件模板、样式或播放行为，不重复构建或声称新增 Browser 验收。共享窗口正在修改门户两个组件及删除 `portal-bento.css`，原样保留，不纳入本批提交。下一步提取真实生产逻辑，并将 harness 改为执行 App 的真实 factory 参数和解构输出，补齐 restore/生命周期接线验收。
