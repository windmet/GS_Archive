# 未使用语音存档与愚人节关联（2026-10-15）

## 未使用语音存档

- 页面：收藏 → 未使用语音（`/unused/`，view `unused_archive`）。数据 `src/data/unusedVoiceArchive.json`，由 `scripts/build-unused-voice-archive.mjs` 从转换后的语音目录和 RAW 脚本生成，共 963 条：
  - `9_1`、`9_9`：各 51 条
  - `2_5` appeal：345 条（齋藤只有 01、07 两条）
  - `3_2` live_result：200 条
  - `3_3` cheers：49 条
  - `3_4`：245 条
  - `3_5_101`：1 条
  - 齋藤 `3_1_102`：21 条，其中 00–14 有文字
- 只有齋藤那 15 句有文字，作为 `unused-voice` 进入翻译流程（card-lines 分片），其余条目只有语音。
- 全部 m4a 都在 R2：2026-10-14 上传前的桶清单里有 `assets/voice/` 32,421 个对象，抽查各组都在。本地 Browser 验收时临时把 worktree 的 `public/assets/voice` 链接到主 checkout 的语音目录，确认能播放、按钮状态正确、手机宽度没有横向滚动，验收后已删除链接。

## 愚人节

已有证据：
- 剧情：602（2022）和 610（2023）播放同一个脚本 `5_03_000_22` 的 a、b 两篇，a 篇最后是 `live 2` 指令，接这首歌的 Live。编译后的剧情没有保留这一步。
- 主数据配置：`aprilfools_song_id` = 47（`drv999`）；`aprilfools_open_at` / `aprilfools_close_at` 为 2023-04-01 00:00 至 04-02 00:00 JST，与 610 第一篇的开放时间完全相同；`aprilfools_song_information_text_001` 写的演唱者是「齋藤孝司（CV：立木文彦）」。
- 客户端还有愚人节专用的应援 cut-in、音效和难度换算（`AprilFoolDifficultyTypeConvertor`），RAW 里没找到对应的单独资源。
- 小人舞台的 `drv999` 资源已经收录：背景屏视频 2 条、舞台图 3 张、社长小人的精灵图。

这次补上的：
- `song_related_entity_index.json` 增加 610 关联和 `special_performer`（齋藤 孝司 / 立木文彦），重新生成 `song_catalog.json`，schema 允许这个字段。原来 602 关联的 wiki 链接少了一个「ル」，已改成正确地址。
- 602、610 的剧情页由 `extraStoryTaxonomy.js` 提供关联歌曲卡（封面 + 跳转 `/songs/drv999/`）。故意不改 read model 的结构，以免破坏 legacy parity 校验。

没有的和暂缓的：
- 头图：602、603、610 在 table 178（ExtraStoryChapterData）里都没有行，RAW 里也没有对应的 `image_story_extra` 包，所以没有官方头图。没有拿舞台图或 wiki 图片代替。
- 歌曲页上的 610 关联和演唱者说明来自 `song_catalog.json`，要等下次 read model 发布后才会显示；当前候选 `rm-release-20261015` 还是旧数据。
- 剧情 Player：没有重新编译剧情（`live` 只在 `5_03_000_22_a` 出现，加步骤会改变步数，牵动阅读定位和文本身份）。改由 `src/data/storyLiveLinks.js` 记录「前篇第 27 步之后进入 drv999」，Player 播完前篇时在完成面板里给出「进入 Live：DRIVE A LIVE（パッションMAX Ver.）」，点击后关闭 Player 并打开歌曲页。分集文件 `5_03_000_22_a` 和合并文件 `5_03_000_22` 都用第 27 步。

## 验证

- `build:check` 通过。
- 路由类：`verify:routes`、`verify:route-schema`、`verify-portal-navigation` 通过。
- 歌曲与剧情类：`verify-song-catalog`（需要 `SIDEM_ARCHIVE_SOURCES_CONFIG` 才能找到 RAW）、`verify-song-domain-landing`、`verify-story-collections`、`verify-extra-story-domain-landing`、`verify-story-catalog` 通过。
- 翻译类：翻译工作流、card-line、character-line、chat 的校验都通过。
- `scripts/terminal/verify-terminal-contracts.mjs` 原来就失败，因为预期的导航列表里少了货币、服装两项；后来又少了未使用语音。现在已经补上这三项，40 项检查全部通过。

## 603「2022年3月プロミ連動ストーリー」

- 本地资料：故事 60301「運動会が終わって」，脚本 `5_04_000_22`，2022-03-13 20:30 JST 公开。只有一段群聊（talk），16 位偶像谈运动会后的感想，BGM `growingsmiles_energy`。table 178 没有这一行，RAW 也没有头图。
- 外部：wiki 的エクストラストーリー一览没有收录 603。Fami通的报道确认「THE IDOLM@STER SideM PRODUCER MEETING 315 BE@T OF PASSION FESTIVAL!!!」于 2022-03-12、13 在武蔵野の森総合スポーツプラザ举办，所以这篇是在 Day 2 当晚公开的。报道里没有提到运动会，运动会只在剧情里出现。
- 已把 `extraStoryTaxonomy.js` 里 603 的说明改为写明这场活动，来源链接改为 Fami通报道。这两项会进入 read model，重新生成候选版本之后才会显示。没有关联歌曲，也没有头图。
