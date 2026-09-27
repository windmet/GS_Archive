# 生日档案共享章节入口（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `2af2234`。生日集合叶子的 `canonicalRelation` 已提供偶像、章节和分段身份；正式个人故事详情由 `idol-stories` Read Model 叶子承接。本批把共享章节跳转改为验证 inline bootstrap 偶像后直接读取该叶子，不再先读 `idolEpisode`、`mobileArchive`、`randomTalkPresentation` 三份旧通信索引。其他通信展示逻辑未变。

`verify-idol-story-readmodel-navigation.mjs` 对实际跳转函数断言目标章节/分段、页面提交以及旧通信索引调用为零；`build:check` 通过，输出复用 `.analysis/build-check`，未复制 public 媒体。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、public 与 r22 Read Model 映射，旧全量 `/data/` 来源返回 503。直达冬馬生日集合 `?view=story_collection&story_type=birthday&story_section=001tom`，点击共享章节的“Idol Episode 第2話”，正式个人故事显示目标标题“世界にひとつだけのバースデーカレー”，URL 带 `story_section=20102&episode=2010201`；点击返回恢复冬馬生日集合。当前旅程无新 console error。该本地样本不等于全部生日关系、设备或发布包验收。
