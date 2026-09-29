# 剧情门户旧运行时回退清理（2026-09-27）

## 输入与范围

- 输入 HEAD：`625a3fc9d345782c3ea1a3401867402f236b1d1f`，分支 `codex/gs-architecture-rebuild`。
- ReadModels release：`409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`，本地候选位于 `E:\GS_ReadModels_QA\candidate_20260927_r23`。
- 指导包 `GS_Architecture_Rebuild_20260925.zip` 仅用作迁移目标与验收参考；以本地代码、数据和浏览器结果为准。
- 本批只移除 `App.vue` 对剧情目录、主线/额外/生日落地页的旧运行时构建与回退接线，并去除已无消费者的旧全局数据赋值。剧情 ReadModels 产物及发布策略没有改动。

## 改动

- 剧情目录由 `storyReadModelCatalog` 提供；主线、额外、生日落地页由 `storyCatalogLanding` 提供。旧 `buildStoryCatalog`、`buildStoryCollections`、各故事域运行时构建器及活动关系补丁不再由 `App.vue` 调用。
- 搜索列表、季节/工作计数不再回退到旧全局数据。资料状态页的验证与 UI 资产参数只取对应的资源 ReadModel 明细。
- 站外视频导航发布开关当前关闭，因此站外导航条目保持空列表；关闭态仍由既有页面呈现。若将来重新开放该入口，需要重新审核并投影导航数据。
- 对应源码接线检查调整为断言 ReadModels 接入，保留真实语料的语义检查。

## 验证

- `npm run verify:story-catalog`、`verify:archive-presentation`、`verify:main-story-domain-landing`、`verify:extra-story-domain-landing`、`verify:birthday-story-domain-landing`、`verify:external-story-resource-ui`、`verify:archive-async-navigation`、`verify:archive-startup-route`：通过。
- `npm run build:check`：通过，完整 Vite 代码编译至本工程 `.analysis/build-check`；`copyPublicDir:false`，没有复制 public 语料。初始 JS gzip 估算 112,632 字节。
- `npm run verify:build-audit`、`verify:cutover-routes`：进度审计通过。32 条路由中入口 31、数据 30、动作 26 已迁移；parity 和设备验收均为 0。`ArchiveDataRepository.js` 仍在生产代码中，`globalArchiveLoadRemoved=false`。
- Browser：复用本地 `http://127.0.0.1:5188` QA 服务，映射 `.analysis/build-check` 生产代码、现有 public 和 r23 页。主线入口显示 3 章 / 22 官方篇 / 204 段；额外入口显示 7 官方作品 / 47 章 / 44 段；生日入口显示 51 组档案 / 181 条记录，角色集合、返回与检索可用。站外资源入口显示关闭提示，资料状态页显示 ReadModel 数据。检查的页面无浏览器 error 日志。

## 边界

- 本批移除了这些剧情页面在 `App.vue` 的旧数据回退；其他未迁移路径仍可触发 `loadArchiveData`，全局加载尚未移除，不能宣称完整架构切换或网络负载消失。
- 本地 Browser 和代码构建不代表真机、离线、全量媒体包、线上部署或全路由对等验收。未修改或发布 R2 / Pages。
