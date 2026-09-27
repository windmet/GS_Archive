# 组合与卡片内部操作修复（2026-09-27）

输入 HEAD：`60b8806`。移除组合剧情、组合卡片、卡片剧情的整批 legacy 门禁；组合卡片仍进入原有按组合筛选的成员目录，目录身份来自 bootstrap，卡片归属来自卡片 catalog。目录载入失败留在原页，导航离开后失效结果不再改变当前页。`idols?category=cards` 的刷新与来源恢复使用同一目录。

组合/卡片 Player 返回目标纳入 Read Model 启动，刷新时准备对应单实体详情。卡片 voice 深链使用该卡叶子中的 source-backed preview，不再读取 `card_detail_index.json`。

## 验证

- `verify:archive-async-navigation`、`verify:archive-startup-route`、`verify:archive-navigation-state`、`verify:card-voice-preview`、`verify:episode-queue` 通过。新增真实函数回归覆盖组合成员目录、失效响应、失败重试提示、scenario 入口、voice 叶子恢复和失效 voice 响应。
- `build:check` 通过：复用 `.analysis/build-check`，不复制 public。入口 JS 415.17 kB / gzip 132.85 kB。
- Browser 插件可用，复用 `127.0.0.1:5186` 生产代码映射服务、当前 public 与 `E:\GS_readmodels_candidate_20260927_r22\pages`。旧资料批次、旧卡片详情大表及全站 Reading manifest 返回 503，compiled 场景正文按需放行。
- Jupiter 详情 → 查看卡片：显示三名成员；刷新 URL 后仍是 Jupiter（3）；返回后是 Jupiter 详情。
- Jupiter → `はじまりの前の、はじまり` → Player → 刷新 → 返回：恢复同组合详情。
- 冬馬卡片 `001tom_sr07` → `勝利を掴め！` → Player → 刷新：显示对应对白；返回同卡详情。
- 同卡触摸语音 `2_3_001_07_00_01` → 演出预览 → 刷新：显示同一对白和人物；返回同卡详情。截图观察视口为 465×492，页面身份、非空内容、按钮交互和返回均通过，无框架错误覆盖层。

阻断服务同时拒绝人物配置，组合演出出现 10 项预载诊断；语音预览还记录到 LipSync 曲线 404 和 Spine 警告。最后卡片/voice 复验标签的 error 日志为空，warning 非空。因此本批只签收导航、实体恢复和按需数据路径；不签收完整模型演出、声音/口型、真机或发布包。旧全量 loader 和其他 compatibility path 仍存在。
