# R3：ReadingDocument v2 迁移与页面接入

2026-09-09，实施基线 `e4fca59`。承接 [R2 投影](READING_R2_PROJECTION_20260909.md)。

## 交付契约

- reading artifact schema_version=2；manifest 自身仍是版本 1 的发现结构，其每条 entry.schema_version=2。
- 文件与零基播放范围集中在 document.playback；row.anchor 保留原 row_id、step_id、step_index 和来源证据，删除逐行 playback 副本。
- 每行新增 performance、visual、diagnostics。生成阶段先经现有 ScenarioNormalizer，再使用正式偶像字典和 R2 的 entry-only 投影。
- Reader 现有 readingAvatarEntity 入口切换到 visual 投影；unknown 标签保护继续独立运行。未把 unknown 改为 named，未从附近 Spine 猜身份。
- ReadingContract 在 repository 读取边界验证 v2、播放范围、视觉主体/步号对应、presence、来源和可见对白资格；错误或 v1 数据明确拒绝，无组件内兼容猜测。
- ReadingPlayback 从 document range 与 row.step_index 组成定点或全篇目标；源 SHA、总步数、行身份及 URL 版本/范围校验保留。

本批重生成原批准范围的 204 个阅读文档和 manifest，仍是 183 ready、21 unsupported。
未改写 compiled、RAW、译文或扩展 Wiki 导入范围。迁移前后全量对象比较确认：除新增投影、
schema_version 与播放范围搬迁外，原文、text_ref、canonical speaker、row_id、来源 SHA、
控制流、诊断、状态、presentation 均保持一致。artifact SHA 按新内容更新；旧带 revision
链接会要求重新载入，行 ID 本身可继续定位。消费者与产物需要同步更新，本批未发布站点。

## 验收证据

页面：`http://localhost:5175/?view=reader&reading=1_4_001_00_a&reading_row=1_4_001_00_a%3Astep-12%3Atext`。
Browser 插件，桌面 1280×800 与手机 390×844。

| 项目 | 结果 |
| --- | --- |
| 秀第 12 步 | 实际加载 047shu 头像，naturalWidth=148；标签仍为 ？？？ |
| 原文/译文/双语 | 均保留同一头像与未知姓名；本篇译文提示暂无法载入并回退原文，不宣称验证了该句中文译文 |
| 辅助文本 | 头像 alt 为空，无 title/aria-label 泄露姓名 |
| 查找真实姓名 | 搜索“天峰秀”无匹配，未知行不作为真实姓名索引 |
| 布局 | 手机未知对白卡片实际截图，无横向溢出；Producer 无偶像头像 |
| 全篇播放 | URL 从第 1 步进入，source range=1..27；实际进入开场标题，未从返回行 12 开始 |
| 返回 | 保留 reading_row 第 12 步与双语模式 |
| 控制台 | Reader 验收无 warn/error；Player 警告沿用既有运行时边界 |

通过：verify:reading、verify:reading-sources、verify:reading-visual-sources、
本地 compiled 来源 playback 校验、verify:archive-async-navigation、source-only Vite 构建。
新增 SSR 用例验证真实第 12 步在三种模式的头像、标签和辅助文本；repository 负例新增
v1 拒绝、视觉步号不符、未知 presence、缺 performance、遗留行级 playback。
构建主包 525.77 kB，既有 500 kB 阈值警告仍在。

## 后续补验（基线 cc14b83）

有效译文：正式 overlay `public/translations/zh-CN/scenarios/1_4_001_01.json` 与
`1_4_001_01_d` 第 7 步 text_ref/source_hash 匹配。实际页面 translation 模式显示
“？？？ / ……嗯，是我。”；bilingual 模式同时显示日文“……ああ、そうだけど。”和
中文，DOM lang 分别为 ja-JP、zh-CN。此样本 visual.reason=medium-policy-unavailable，
不作为头像可见用例；头像保密仍由序章第 12 步证明。

404 回退：在独立 Vite 服务 `127.0.0.1:5176` 上运行相同 app/config/source，只在服务端
拦截 `/assets/idols/icons/image_chara_icon_047shu.png` 返回 HTTP 404。未改正式图片、
reading JSON 或译文。服务输出确认命中 Controlled avatar HTTP 404；实际 Reader 第 12 步
img.hidden=true、naturalWidth=0、DOM 宽度=0，姓名/正文不变，截图确认无破图与遗留头像空位。
这一项证明现有 error→hidden 分支可用，不表示自动重试或占位头像功能已实现。
验收后按进程命令行与端口核实，仅停止该临时服务；5175 原开发服务 PID 33944 保持运行。

截图保存在本机 visualization 目录：`reader-valid-bilingual.png`、`reader-avatar-404.png`。
这两项剩余补验已完成。电话/聊天策略、动态外观、未解析 actor/model 仍按 R2 保守不显示，
不能称全部头像覆盖完成。正式长稳继续后移。后续主线为 P1 资源计划与加载状态。
