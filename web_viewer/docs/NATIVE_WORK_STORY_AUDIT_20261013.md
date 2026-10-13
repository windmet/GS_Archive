# 工作剧情组织与目录准确性核查

2026-10-13；输入 HEAD `a64249aa`。只读核查：不改前端、目录数据或资源，不构建、不重启 5212、不部署。

## 结论

当前“工作短剧情 / 场景台词”的主分类与原版两张表一致。不是把完整剧情拆成单句，也不是按脚本长度猜类别。已将当前 decoded masterdata 的全部 637 条与目录逐项核对偶像、GroupId、ResourceId，无缺项或身份差异；再读取全部实际 compiled 文件核对对白数，无差异。

| 原版表 | 目录类别 | 数量 | 实际对白数 |
| --- | --- | --- | --- |
| 54 JobStories | 场景台词 scene_lines | 441（每位 9 条） | 全部 1 段 |
| 55 JobStoryAppendixes | 工作短剧情 short_stories | 196（每位 4 段） | 189 段为 10 段对白，6 段为 9 段对白，1 段为 11 段对白 |

这里的“一段对白”可包含换行及多个句子，不等同于只有一个语法句子。step_count 还包含淡入淡出等步骤，不能拿它直接当对白数。

## 表关系与原版播放

schema `../data_pipeline/schema/il2cpp_protobuf_schema.json`：

- JobData（table 53）：字段 3 JobStoryGroupId、字段 4 JobStoryAppendixGroupId、字段 6 SortOrder、字段 9 Term、字段 10 IdolType。
- JobStoryData / JobStoryAppendixData：字段 1 Id、2 GroupId、3 IdolId、4 Term、5 ResourceId。
- JobStartReply：字段 1 JobStoryId、字段 2 JobStoryAppendixId。

三个属性工作池：Physical 关联 11 / 21，Intelli 关联 12 / 22，Mental 关联 13 / 23。みんなのお仕事是第四个工作选项，本次表中没有独立的两类 group ID，不能据此要求再出现一套独立剧情。

本次以现有 Ghidra 工程 `sidem_il2cpp` 的 `libil2cpp.decrypted.so` 补充只读反编译，14 个目标全部成功。`WorkTopView.WorkStartAPI`（RVA `0x1ff67a4`）调用 JobService.Start；成功回调（`0x229745c`）从 JobStartReply 取前两个 ID 传入 PlayADVView。`PlayADVView`（`0x1ff69ac`）先将第一个加入播放列表，再在第二个非零时追加第二个。WorkResultView 的继续工作路径也有相同 PlayADVView 接口（`0x1ff308c`）。因此客户端支持把单句场景与较长 appendix 按次序播放，而档案按内容类型分别展示。

具体选择哪条、何时返回 appendix、概率和未返回条件不能由本次客户端方法推断：选择结果来自服务端响应。本次没有服务端实现或真实历史响应作为依据，不声称 appendix 每次必播，也不声称每条单句与某个 appendix 存在固定配对。

工作选单的山村贤属于另一路：`WorkTopView.<IdolGenerate>.MoveNext`（`0x2297610`）载入 `scenario_4_1_101_01` 和 `101ken_001_00`，构造 5 个工作选单语音候选并打乱后循环播放。它们不属于这 49 位偶像的 637 条工作剧情；不能将本次“637 条完整”扩展成整个工作功能所有语音入口都已在工作档案展示。

## 当前实现及真实缺口

`../data_pipeline/sidem_masterdata/work.py` 按 table 54 / 55 映射类别，用 GroupId 关联 JobData，再按 IdolId 建立目录。`src/components/archive/ArchiveWorkStory.vue` 分成工作短剧情与场景台词两个页签，播放时传完整 compiled_file。这个组织方法对现有数据成立。

发现两个元数据问题，但本次数据未产生可见错序或漏项：

1. JobData 的 sort_order 错取字段 10（IdolType），真实 SortOrder 是字段 6；当前四行两者恰好都是 1、2、3、4，掩盖了映射错误。字段 10 应保留为独立属性。
2. JobStory / Appendix 的 Term 仅出现在来源字段说明，未保留实际值；当前全部 637 条有效期均相同（946652400 至 4102412400），所以未发现季节或限时条目被漏掉。未来若表有差异，目录无法展示或复原其条件。

场景标题另有展示边界：637 条中 453 条有背景名，184 条无名称。此名称来自 compiled 背景关联 PictureStudio 名称，不是 JobStories 自带的剧情标题；不能把背景地点理解成原版剧情章节名。短剧情 title 则来自 compiled 汇总内容，本次未发现类型或归属错误。

建议保留当前两类目录，后续修正排序字段并保留有效期与 IdolType；若要表达原版玩法，可说明“工作开始场景 / 工作附加短剧情”，但不要制造 9 对 4 的固定一一配对，也不要为了长度一致拼接无依据的剧情。

## 验证与证据边界

- `.analysis/native-work-audit/tables.json`：当前 table 53、54、55 解码结果。
- `.analysis/native-work-audit/coverage.json`：637 个实际 compiled 文件的对白统计及目录比较，无差异；184 个背景名称未知。
- `.analysis/native-work-audit/decompiled_annotated/`：14 个只读反编译目标，成功 14、失败 0。
- `node scripts/verify-work-story-index.mjs`：通过（49 位、441 场景、196 短剧情、0 缺资源，Reader 自然入口覆盖）。
- `python scripts/verify-masterdata-work.py`：通过投影与来源合同；此次未传 mounted-baseline 参数，不把它写成历史哈希基线复验。
- 本次为数据、源码和反编译核查，未声称原版游戏运行验收或 637 条逐一浏览器播放。纯文档按 BUILD_ACCEPTANCE_POLICY 不运行构建。
