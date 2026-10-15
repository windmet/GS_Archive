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
- 剧情 Player 里没有补 `live` 这一步，需要改剧情编译。

## 验证

- `build:check` 通过。
- 路由类：`verify:routes`、`verify:route-schema`、`verify-portal-navigation` 通过。
- 歌曲与剧情类：`verify-song-catalog`（需要 `SIDEM_ARCHIVE_SOURCES_CONFIG` 才能找到 RAW）、`verify-song-domain-landing`、`verify-story-collections`、`verify-extra-story-domain-landing`、`verify-story-catalog` 通过。
- 翻译类：翻译工作流、card-line、character-line、chat 的校验都通过。
- `scripts/terminal/verify-terminal-contracts.mjs` 在这次改动之前就失败：它预期的导航列表里缺货币和服装两项。这次没有改它。
