# 本地加载修复（2026-09-24）

输入：`GS_local_fix_20260924.zip`，包内 SHA256 全部一致；受影响文件 blob 与当前 `361c5828f730e0962d9bfb2d17b761c7e240d194` 一致。分支 `codex/local-loading-fixes`。包内指令仅作参考；站外导航暂停经用户另行明确批准。本轮没有发布、操作 R2 或变更媒体。

## 修复

- 可播放音频与可选口型解耦；语音总等待 20 秒，可选口型 8 秒，共享字节请求 30 秒。取消可结束调用方等待，不声称中断浏览器底层解码。旧场景、已停止声音不能被晚到口型写回。
- 失败清除同句去重，ADV 提供独立重试按钮，用户手势解锁音频且阻止冒泡到下一句。source.start 抛错清理 source、状态和去重；停止时撤下 ended 回调，避免停止被改写成自然结束。
- 图片网络 25 秒、纹理就绪 10 秒；超时不能伪装成功。图片/背景/Spine 场景取消信号透传，保留旧画面及 token 守卫。预载消费预算 25 秒，共享传输上限 30 秒。
- 8 秒显示慢加载说明，保留取消与原有失败重试入口。先前预载失败标为历史诊断，不把它等同于当前仍缺画面。未实现全资源恢复状态归并。
- 两类配置只在开发态使用 no-store；不添加另一套缓存。音频候选只在 HTTP 404/410 时切换别名，网络/服务错误保留失败原因。
- 共享发布策略关闭站外导航、四处详情入口和 registry 请求；旧页面显示中性暂停说明。Functions 及 Vite 开发/预览中间件对指定 registry GET/HEAD 返回 410/no-store，保留映射与原始登记数据。线上旧部署和已缓存内容未撤回。

## 验证

原始语音源码故障注入确认 3 个旧问题；修复后验证独立播放、同句恢复、不可取消解码期限、旧口型隔离和 source.start 异常恢复。新增 `verify:voice-load-recovery`、`verify:load-boundaries`、`verify:external-publication-off` 命令。

通过：11 个加载边界测试、image texture 生命周期、完整 `verify:story-loading-safety`（含音频会话及 100 次切换清理）、Spine 场景替换/取消、图集加载、共享传输、配置预载、站外映射/界面/关闭策略、档案仓库、gzip 路由、数据 revision 路由、reading 全套及 `build:check`。构建只写 `.analysis/build-check`，无 public 全库复制；保留已有 chunk 大小提示。

Browser plugin not available；使用现有 Playwright Chromium，未安装依赖。普通 Vite 服务和关闭 watcher 的临时服务均曾出现请求等待，因此改用本地 Node HTTP 适配器，将构建代码与 `.deploy/voice64/full-manifest.json` 的现有对象精确映射到 `http://127.0.0.1:5188`，执行当前 Functions。无媒体副本。

实际浏览器路径：

1. 旧站外入口 → 暂停说明 → 返回故事目录。无 registry 请求、无页面异常；1366×900 和 390×844 有渲染证据。
2. `episodes/1_4_001_00_a.json` 的 at_step=20 → 强制语音请求失败 → 点击“语音未载入 · 重试” → 恢复。URL、台词位置 19 / 26 保持不变，未捕获页面错误为 0。
3. 同一路径背景延迟 12 秒 → 出现慢加载说明 → 继续等待 → 正常显示剧情，未进入失败门禁。手机宽度下慢加载与恢复状态截图已检查。

截图及浏览器脚本：`E:/Web_build/GS_local_fix_candidate_20260924/`。回归日志：本 checkout `.analysis/local-fix-*.log`。这是本地 Chromium 与故障注入验收，不是 Android Edge、iPad Safari 或 QQ 真机验收，也没有验证本轮线上效果。

## 后续边界

当前没有证据支持更换 AAC、WebP 或添加原生 audio fallback。服务端单 GET/边缘缓存、worker pool 性能调优和设备逐阶段时钟属于后续测量工作，本轮不把候选建议直接当成已证明的根因。电话/聊天没有独立语音状态展示，本轮未增加独立重试 UI。

回退依据是本轮之前的兼容 gzip/64k 提交 `361c582` 与已冻结 Production 包，不是旧 master。未经新部署指令不切正式入口。

## 正式发布补充

用户随后明确要求直接更新正式线上部署。以源码 `37fe0559adb83d76657b91addee7baa21bd76d15` 构建独立小包 `.deploy/local-fix-production-37fe055`（copyPublicDir=false，3 个受版本控制的翻译文件显式复制），沿用原 R2 绑定、gzip all 和固定 data revision，未操作媒体。

正式部署：`6ed057d8-7178-4183-96bd-a5f5c1942406`；入口 <https://gs-archive-preview.pages.dev>；不可变地址 <https://6ed057d8.gs-archive-preview.pages.dev>。Cloudflare API 已确认 canonical deployment 为上述 Production 部署，35 个线上静态文件均与发布包逐字节一致。

正式入口 registry GET/HEAD 已为 410/no-store；gzip 抽样解码 hash、Range 忽略并返回 200、identity 406 正常。媒体检查包含 PNG/WebP 映射、数据 HEAD、ETag/304、语音 Range/416、404/405，全部通过。日志 `.analysis/local-fix-production-*.log`，部署回执位于发布包 `production-receipt.json`。旧 immutable 部署未删除，其历史 registry 内容未追溯撤回。

新 Production 部署的 160 条语音 HTTP 检查全部通过、0 失败，完成时间 2026-09-24T12:50:18.970Z；包含字节 SHA256、GET/HEAD、ETag/304、MIME、首尾 Range/206 与 416。线上 HTTP 验证不替代真机听感与交互验收。
