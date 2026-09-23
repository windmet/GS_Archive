# 数据契约与请求生命周期

2026-09-08，重构 F1。`ArchiveDataRepository.js` 管理资源地址、请求、缓存与
错误聚合；`archiveDataContracts.js` 提供独立的同步 `validateArchivePayload`。
它们不依赖 Vue 组件或 DOM。原有命名加载入口、URL 与返回形状保留。

## 浏览器检查与档案覆盖

移出浏览器的固定数量不等于取消验证：

| 产品 | 浏览器接受条件 | 正式档案验证 |
| --- | --- | --- |
| birthdayStorySemantic | v1；唯一 chapter/section/announcement；episode key 身份、章节和公告引用有效；meta 与实际数组/索引数量一致 | verify-birthday-story-semantics 仍要求 4 章、181 episode、78 announcement 及准确的来源/归属 |
| extraStoryVisualIndex | v1；唯一 entry/chapter；by_chapter_id 完整对应 entry；meta.entry_count 与实际数量一致 | verify-extra-story-domain-landing 仍核对 7 个正式作品及全部 47 章节/RAW 视觉关系 |
| songPlaybackAudio | v1 local-derived/song_detail；song key/code 一致；full-mix 与本地 URL；summary 与实际曲数一致 | verify-song-playback-audio 仍核对 61 个完整混音、catalog 全覆盖和源/派生契约 |

测试用较小但关系完整的档案证明浏览器不再依赖某个历史快照的数量；也测试
错误总数、重复 ID、丢失章节/公告、错指图片 entry、错误曲目身份/URL/status 必须拒绝。
其他产品的原有形状检查机械迁移。统一拒绝顶层数组；原最低版本判断现要求
整数版本，避免 undefined 或字符串经 `<` 比较漏过。不宣称所有产品已有完整深层 schema。

## 请求与缓存

`createArchiveDataRepository({ fetchImpl })` 创建独立 cache，默认实例继续导出
loadArchiveData、loadCardDetailData、loadIdolCommunicationData、clearArchiveDataCache。
测试可注入 transport，无需替换全局 fetch 或访问网络。

同 key 的普通请求共用 pending/cache；fresh 请求使用 no-store 并替换 cache。
clear 只清缓存，不取消已发出的请求。旧调用者仍可收到自己的结果。
失败只在 cache 仍指向该 request 时才清理，不能删除 fresh/clear 后的新 request。
旧代码在“旧请求 pending → fresh 成功 → 旧请求失败 → 再次读取”测试中发出第三次
请求（3 !== 2），此竞态现已修复。

HTTP、HTML fallback、JSON 解析/契约失败仍附带 key/URL 并允许重试。
loadArchiveData 继续返回成功产品与逐 key errors，不将单项失败升级为整体失败；
独立 communication 加载仍使用 Promise.all 的失败语义。

## 证据与剩余工作

`npm run verify:archive-data` 检查 27 个注册产品的契约、较小档案和破损关联，
以及请求合并、fresh/clear 竞态、四类重试、部分结果与 lazy-load 错误。
其中 compiledIndex 用 categories fixture，其余读取提交的 JSON，不读取 ignored 媒体。
CI 已接入。歌曲域、完整混音、生日语义/页面、额外剧情、命名目录回归和 source-only
构建通过；旧源码字符串断言改为调用实际契约函数。

内置浏览器观察到生日页 51 主体/181 记录/29 共享，以及歌曲目录 → BRAND NEW FIELD
详情的正常单轨来源和时长，截图可见正常详情，无 error；没有播放音频。
本批没有修改数据文件或 UI 布局，也不等于整站响应式/媒体回归。
App 的数据状态、feature 组合与导航拆分仍未完成，按总体重构计划继续。
