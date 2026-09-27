# 路由账本与构建审计（2026-09-27）

本批承接 `59fc931` 的组合/卡片操作修复。提供阶段进度校验与最终拒绝条件；未组装或部署 Pages。

## 实现

- 32 条公开路由与 `VALID_VIEWS` 双向核对；分别记录直达、数据、内部操作、Player、组件、parity、Browser、设备及旧依赖。
- 已迁移标签必须引用本地证据文件。历史 Browser 样本保留原基线，不自动升级为当前版本完整 parity。设备签收必须匹配 release、源版本和源指纹。
- `build:check` 保持不复制 public 语料，代码写入复用目录 `_app`。从 Rollup 的实际模块/静态 import 图生成报告，并在 Vite 最终写盘后计算 chunk 哈希和 gzip 字节。
- 报告绑定 HEAD、dirty 状态、源文件哈希、bootstrap release、路由合同、启动策略及两个报告间的哈希。检查器复核当前源码和构建文件是否漂移。
- `--progress` 允许清楚列出的迁移缺口；严格检查仍拒绝旧生产加载器、入口禁用模块、未完成路由与设备证据。assembler 增加 `--check-only`，成功或失败均不创建候选目录。
- source workflow 增加当前重构分支 push 触发、readmodels 测试、路由进度检查和构建审计。分支保护不在本次代码变更范围内。

## 本机验证

- readmodels 全套 40 项曾全部通过；增加报告一致性校验后，受影响的 assembler/审计 9 项重新通过。
- `build:check` 和 `verify:build-audit` 阶段检查通过；严格 final 检查按预期拒绝。
- 当前入口静态闭包 gzip 估算 132,844 字节（非实机网络测量），14 个待移出模块；仍保留 `ArchiveDataRepository` 及 `loadArchiveData / ensureLegacyArchiveData / runWhenLegacyReady` 调用。
- 路由账本：直达 27/32、数据 25/32、内部操作 18/32、组件 26/32；完整 parity 0/32、设备 0/32。Player 就绪计数包含不适用的路由，不能解释为播放器测试覆盖率。
- r22 校验 8,419 个产物，bootstrap 13,610 字节；只证明数据字节、描述符及 schema。
- 在既有 5186 阻断旧整批数据的 QA 服务上，重新导航到 Jupiter 详情，再点“查看卡片”，成功显示 Jupiter 三位成员；最终页面 error 日志为空。新 `_app` 产物可以启动并动态加载此旅程。此前播放器/语音及刷新验收见 [A 批记录](GS_ARCHITECTURE_UNIT_CARD_ACTIONS_20260927.md)，其资源限制继续适用。

本批开发验证的构建基线为 `59fc931` 加本批未提交变更，因此报告正确标记 dirty。提交后需重新生成当前 HEAD 报告再作严格预检；不能复用旧 HEAD 报告作为发布签收。

## 下一批

按 [修复路线](GS_ARCHITECTURE_REVIEW_REPAIR_PLAN_20260927.md) 继续清理 birthday、external、idols 其他分类、Stage/Lab 和静态 route imports，再删除旧 Repository 生产依赖。最终 assembler 保持关闭，直到路由 parity 与设备证据齐全。
