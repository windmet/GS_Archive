# 工程续作记录（2026-10-07）

接续 [工程交接](GS_ARCHIVE_ENGINEERING_HANDOFF_20261007.md)。用户最新边界：持续推进；必须涉及 UI 的事项记录，尽可能不动前端。此批仅修改检查脚本和检查名单；不推送、不部署、不改译文，不重启 5175。

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

## 后续与 UI 边界

- 4.2 已完成 4/5，仍有歌曲入口检查待改造。
- 4.3 App.vue 逻辑拆分涉及前端并要求前后截图；按最新用户要求先记录，优先推进工具、数据与检查，当前未执行。
- 4.4 个人故事下一段标签：仍待数据/队列修复与真实数据断言；最终菜单显示属于浏览器验收，不能用源码测试冒充。
- 4.5 日文巡检入口修复、4.7 的 38 项本地语料检查仍待执行；terminal 默认入口断言已完成上述定向修复。
- 4.6 页面 lang 与 4.8 问卷/反馈入口保留给用户及 UI 窗口；没有问卷链接，不填写猜测链接。

## 磁盘事件

本次清理闲置浏览器缓存和超过 24 小时的 SSR 转换缓存，回收 23.1 GiB，C 盘可用空间由 24.8 增至 47.9 GiB。保留源码、截图、日志、浏览器状态及在用配置目录，5175 未受影响。明细在 `E:\Web_build\GS_Archive_engineering_20261007\temp-cleanup-receipt.json`。后续本地 CI 临时文件固定写 E 盘，避免继续占用系统 Temp。
