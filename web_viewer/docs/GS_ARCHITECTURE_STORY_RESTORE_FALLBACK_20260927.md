# 故事路由恢复失败回退（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `c7288b6`。`story_detail` 与 `story_collection` 的正常直达、交互、Reader/Player 返回已在各自 2026-09-25 cutover 记录验收。本批移除两处仅在浏览器历史或直达恢复失败时触发的 `ensureLegacyArchiveData()`；缺失叶子仍回到已迁移的 `story_catalog`，由目录自身加载 Read Model landing。

`verify:archive-startup-route` 在实际启动回调中分别模拟缺失故事与缺失章节，断言路由落到目录且旧整批加载调用为零。`verify:archive-async-navigation` 与 `build:check` 通过。构建输出复用 `.analysis/build-check`，未复制 public 媒体。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、public 和 r22 Read Model 映射，旧全量 `/data/` 来源返回 503。打开 `?view=story_detail&story=missing.json` 与 `?view=story_collection&story_type=main&story_section=missing` 均归一到 `?view=story_catalog`，目录实际显示 22 篇主线和章节卡片。控制台各有一条预期的缺失叶子错误日志；页面未被旧数据请求卡住。该样本只证明缺失叶子的本地回退，不代表全部故事内容、设备或发布包验收。
