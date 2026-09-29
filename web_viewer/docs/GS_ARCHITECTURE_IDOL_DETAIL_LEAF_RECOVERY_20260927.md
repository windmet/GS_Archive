# 偶像详情返回路径改读单偶像叶子（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `eb44cff`。从卡片列表等页面返回 `idol_detail` 时，旧监听曾补取三份通信索引。本批改为按当前偶像 ID 读取详情 Read Model 叶子；只有仍属于当前导航、页面和偶像的响应才能发布。旧通信索引的详情页就绪监听与重试接线已移除；外部故事资源功能所用的独立加载器仍保留。

`verify:archive-async-navigation`、`verify:archive-navigation-state`、`verify-idol-communication-readiness.mjs`、`verify:cutover-routes`、`build:check` 与 `verify:build-audit` 通过。新增回归覆盖缺叶子返回、晚到响应失效；构建输出复用 `.analysis/build-check`，不含完整 public 媒体。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、当前 public 和 r22 Read Model 映射，旧全量 `/data/` 来源被阻断。从 `?view=cards&category=cards&idol=001tom` 点“返回”到 `?view=idol_detail&category=idol&idol=001tom`，显示冬馬档案、个人聊天 20 条、电话通信 9 条和相关歌曲/活动；检查时无 console error。这是本机代表旅程，不是设备或发布验收。

偶像资料、统计及关联数据的 computed 仍有旧 archive ref 兜底，路由台账保留此剩余依赖；全量仓库仍在生产依赖中。
