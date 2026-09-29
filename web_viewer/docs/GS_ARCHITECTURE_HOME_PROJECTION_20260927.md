# 首页展示移除旧全量资料兜底（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `f00b470`。Home 统计、亮点和偶像列表从 Home Read Model 索引读取；索引未到时只使用内联启动偶像名单，不从已加载的旧全量仓库重建首页资料。“我的偶像”引用只取内联偶像字典和组合归属。旧首页资料转换器保留给构建与独立数据校验，不再由 App 生产接线调用。

`verify:home` 增加生产 computed 投影回归：内联启动状态与索引抵达后的资料来源均经过验证。`verify:archive-startup-route`、`verify:archive-async-navigation`、`verify:cutover-routes`、`build:check` 与 `verify:build-audit` 均通过。构建复用 `.analysis/build-check`，未复制完整 public 媒体。Browser 在 `127.0.0.1:5186` 使用当前生产代码构建、public 和 r22 Read Model 映射；旧全量 `/data/` 来源返回 503。从欢迎页选择冬馬进入游戏风首页，切换翔太，再进 Portal 返回翔太首页，刷新直达 URL 后仍显示翔太；检查时无 console error。这是本机代表旅程，不是设备或发布包验收。

这只移除了首页展示投影的旧资料来源；跨域返回、播放器和其他路由的旧仓库依赖仍需继续处理。
