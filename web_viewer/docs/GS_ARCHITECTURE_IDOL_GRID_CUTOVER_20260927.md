# 偶像网格数据与旧分类返回（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `1a630ca`。现行路由合同将旧 `idols&category=idol_chat/idol_phone` 规范化到 Mobile 选择页或指定偶像的 Mobile 档案。公开的 `idols` 网格只接收偶像与卡片分类。本批让偶像网格始终使用 inline bootstrap 的 49 位偶像，卡片成员网格只使用已读取的卡片 Read Model 目录计数；去掉 compiled index 及旧卡片索引对这些网格的后备读数。

旧聊天/电话分组和文件 URL 仍由已有的 alias Read Model 承接。文件返回分组；分组返回 Mobile 偶像选择页，且不会保留分组为选择页的退出来源。旧偶像分组返回时读取偶像详情叶子，不依赖兼容档案数据。清理了无法从现行 `idols` 路由到达的聊天/电话网格分支。

`verify-idol-navigation-ux.mjs` 对实际计算和返回函数断言 inline/card 数据、旧索引不读取、两级返回目标；`verify-archive-routes.mjs`、`verify:archive-navigation-state`、`verify:archive-async-navigation` 与 `build:check` 通过。构建输出复用 `.analysis/build-check`，未复制 public 媒体。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、public 与 r22 Read Model 映射，旧全量 `/data/` 来源返回 503。偶像目录显示 49 人，选择冬馬打开详情；卡片成员目录显示 49 人；旧聊天根 URL 到 Mobile 选择页。群聊文件 `8_2_x_001jup_8_2_1_001` 返回 Jupiter 分组，再返回 Mobile 选择页，退出选择进入门户；旧偶像分组返回冬馬详情。检查时无新增 console error。以上为本地代表性旅程，未覆盖全部群聊、设备或发布包。
