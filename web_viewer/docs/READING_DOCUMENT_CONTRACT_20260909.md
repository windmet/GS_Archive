# ReadingDocument v1：首批产物与加载契约

D2 扩展：manifest v1 现可含显式 source_file，缺省时不推断目录关联。
逐句演出采用独立 at_step 与 reading_rev；来源校验、返回和验收见
[READING_D2_ACCEPTANCE_20260909.md](READING_D2_ACCEPTANCE_20260909.md)。

日期：2026-09-09；实现起点 ea1135e。本文件记录 60b141f 数据批次。
后续页面及第五份译文样本已接入，当前状态见 [D1 验收](READING_D1_ACCEPTANCE_20260909.md)。
以下为数据批次当时的边界：本批交付 D1 的数据与请求层。
独立 Reader 页面、语言控件、真实浏览器冷启动及 D2/F 往返尚未实现，D1 未完成。

## 输入和覆盖

只读取 config/reading-samples.v1.json 的四份既有 compiled episode；不解释 RAW，
不重新编译剧情，不扩大 strict-v2 发布。严格输入须有 authoritative publication
registry 的逻辑身份和 episode 路径关系。兼容输入须有现有 Story Catalog 章节与
分段关系、匹配的 aggregate_source 和 scenario 身份；它们是 catalog-compatibility，
不声称为 ledger-governed strict publication。

| 文档 | 来源 | 当前文本能力 |
| --- | --- | --- |
| 1_4_001_00_a | strict v2，主线序章 | ready；标题、梗概、对白、未知说话人 |
| 1_4_001_01_a | strict v2，主线第1话 | ready；时间/地点字幕、两处单选与详细文本 |
| 1_4_001_02_a | compatibility v1，主线第2话 | ready；原文、字幕、单选；缺 text_ref 明示 |
| 1_4_001_03_h | compatibility v1，主线第3话 | unsupported；三选项目标已知，分支结束和贴图文字不可可靠还原 |

ready 仅是该文本投影的能力，不代表独立页面或演出验收。
未列入样本的文档返回 not-generated。manifest 不含正文。

## 版本、来源与行

Reading schema_version 独立为 1，由 shared/reading/ReadingContract.js 验证；
不改变 runtime schema。每篇 source 保留 compiled 文件、实际字节 SHA-256、输入
schema/runtime contract、raw_hash（若存在）、aggregate_source 和总步数。
document_id 是分段身份；logical_id 是现有故事身份；text_catalog_id 保持来源值，
不把 episode ID 错当父级 translation catalog ID。

rows 按 compiled 来源顺序保留 title / synopsis / narration / dialogue / caption /
choice / choice_detail；标题显示文字单独成行，不误认为说话人。
source_text、text_ref 和 speaker 的来源显示名原样保留。text_ref 缺失为 null，
不重编号、不合成 source_hash。兼容 inline translation 保留给现有 resolver。
说话人通过现有 LegacyDialogueAdapter 适配；不根据舞台 chara_id 猜测身份。
只有明确 named/idol 且 entity_type=idol 的单人身份可使用静态头像；unknown 即使
具有 entity_id 也不能揭露头像。

anchor 分开记录 row_id、源 step_id、零起始 step_index、来源 part/file/command
范围和播放文件范围。row_id 是文档局部 UI 锚点，不是新 text_ref；文档升级必须
重新核对位置。播放索引通过实际数组位置获取，不以 step_id - 1 计算。
现阶段 playback 字段是映射数据，尚未接入 Full Player。

## 分支边界

controls 保留 choice_id/option_id（缺失为 null）、原 label、目标 step ID 与
实际目标 index，以及 resolved/unresolved。原选项和 detail 均不静默丢弃。
当前可连续展示范围只包含下一步的单选。多选的分支出口不能从 label 名称、相邻
位置或旧播放器的跳转行为推断；无法封闭的分支、后跳/循环、跨步跳转和未知步骤
均标为 unsupported。unsupported 文档保留来源行用于诊断，后续 Reader 不得将
这些行直接显示为一条完整连续剧情。贴图消息没有文字替代时也标未支持。

## Repository 与后续页面所有权

ReadingRepository 先请求小型 manifest，再请求指定一篇；缓存键是 schema + ID +
文档 SHA-256。实际响应字节校验摘要，再校验身份/行/播放范围，缓存对象深冻结。
失败可重试；manifest fresh 后按新摘要读取；过期 manifest 失败不会删除新请求。
文档缓存上限 16；没有媒体依赖、预取或全库正文加载。

repository 不写 Vue/route/loading 状态，也不使用每个调用者的 AbortSignal 取消
共享请求。后续页面必须复用 ArchiveNavigationCoordinator 的 intent 判定，只有
当前导航可原子发布 loading/error/empty/unsupported/ready，不新增平行导航 owner。
语言展示接 createStoryLocalization.resolveUnit，沿用 TranslationRepository，
不直接调用 prepareScenario。以上页面接入仍待实施。

## 已执行验证

- npm run generate:reading：只生成四篇及 manifest，不修改来源 compiled。
- npm run verify:reading-sources：对本机实际 compiled 字节重建并逐篇精确比较。
- npm run verify:reading：四个真实样本、所有现有 text_ref 原文 hash、标题/字幕/
  unknown、单选/多选；合成非连续 step ID、循环/缺目标、空文档、未知类型、输入
  不变、版本拒绝；repository 请求粒度、并发复用、摘要失败重试、版本切换、
  过期 manifest 失败、缓存不可变和错误范围拒绝。

verify:reading 已接现有 Source Gate；它不依赖未跟踪的兼容 compiled。
verify:reading-sources 需要本地样本来源，仅作显式本地校验。
reading JSON 使用窄范围 LF 属性，避免跨平台检出改变 manifest 的字节摘要。
本批没有 UI 改动、浏览器验收、正式长稳或部署；不要将这些静态与传输测试提升
为 D1 完整验收。
