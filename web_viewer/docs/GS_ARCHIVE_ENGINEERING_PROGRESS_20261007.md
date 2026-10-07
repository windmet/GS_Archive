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

## 后续与 UI 边界

- 4.2 仍有加载提示、歌曲入口、歌曲音频三个检查待改造；不能把本批当作五项全部完成。
- 4.3 App.vue 逻辑拆分涉及前端并要求前后截图；按最新用户要求先记录，优先推进工具、数据与检查，当前未执行。
- 4.4 个人故事下一段标签：仍待数据/队列修复与真实数据断言；最终菜单显示属于浏览器验收，不能用源码测试冒充。
- 4.5 日文巡检入口修复、4.7 的 38 项本地语料检查及 terminal 默认入口断言仍待执行。
- 4.6 页面 lang 与 4.8 问卷/反馈入口保留给用户及 UI 窗口；没有问卷链接，不填写猜测链接。

## 磁盘事件

本次清理闲置浏览器缓存和超过 24 小时的 SSR 转换缓存，回收 23.1 GiB，C 盘可用空间由 24.8 增至 47.9 GiB。保留源码、截图、日志、浏览器状态及在用配置目录，5175 未受影响。明细在 `E:\Web_build\GS_Archive_engineering_20261007\temp-cleanup-receipt.json`。后续本地 CI 临时文件固定写 E 盘，避免继续占用系统 Temp。
