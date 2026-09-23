# R2：阅读视觉身份纯投影

2026-09-09，基线 `0292c8e`。本批完成投影规则和源数据验算；尚未改写公开 reading artifact，
也未接入 Reader 头像。按既定计划，公开交付与 R3 v2 迁移一起完成，避免连续两次产物换版。

实现：`shared/reading/ReadingVisualIdentity.js`。

## 规则与边界

- 调用者先使用已有 `normalizeScenario`，提供单步、行种类、canonical speaker 和从
  `idol_unit_dictionary.json` 获得的偶像 ID 集合。函数不加载媒体，不解析 RAW，不修改输入。
- performance 仅使用当前 step.chara_id 与字典。别名（如 047shu_001）、群体或未知 ID
  保留 unresolved，不从文件名、姓名或附近人物猜测。
- visual 仅观察当前 entry snapshot，要求明确 visible=true 和唯一对应 actor。
  settled 有差异会记录诊断，但不能提前引入未来出场，也不抹掉 entry 时仍可见的人物。
- 只对常规 adv 舞台对白开放；call/talk 及 phone_mode/talk_mode 需独立媒介策略。
- actor 与 speaker 冲突、重复 stage actor、缺快照/visible、未确认的 model 对应关系都不出正常头像。
- 黑色 idol_color 或显式 silhouette 为隐藏形象；fade、颜色过渡、滑动等动态证据暂为 unknown。
  本层不声称完成相机裁剪、遮挡或逐帧像素可见性求解。
- `parts_visible=false` 经 `SpineManager.setSpinePartsVisible` 核实只控制 optional costume slots，
  不作为人物隐藏条件。alpha=0 则无正常头像。
- 名字继续交给 readingPresentationSpeaker，unknown 不允许姓名本地化；新头像选择函数只读
  visual/performance，并校验行 step ID，一样不会把 unknown 改成 named。

视觉 presence 候选值为 visible/hidden/offstage/silhouette/unknown/not-applicable。
这是即将纳入 v2 的投影结构；仍需在 ReadingContract 中冻结、校验并完成消费者迁移。

## 证据

`npm run verify:reading-visual-sources` 对 204 份既有产物的 compiled bytes 做 source SHA 校验，
按原 row.step_index/step_id 逐行对应并验算 3483 行：

| 结果 | 行数 |
| --- | ---: |
| 明确可见 | 939 |
| 非偶像对白/结构文本，不适用 | 676 |
| 不在当前舞台 | 34 |
| 未确定 | 1834 |

未确定原因：1382 行媒介策略待定义，417 行表演主体未解析，22 行动态外观，13 行 model 对应
未核实。以上是按拟定新规则的源投影统计，不是当前页面头像统计，也不是数据丢失结论。

真实 `1_4_001_00_a` 第 12 步验证了 chara_id=047shu、unknown 姓名、entry 中可见 Spine；
新投影选择秀头像，姓名投影仍为 `？？？`。不依赖从 RAW 再识别一次。

`verify-reading-visual-identity.mjs` 的正反例覆盖多人同屏、unknown/named、Producer/结构行、
缺身份/快照/可见性、hidden/silhouette、过渡、重复 actor、媒介、entry/settled 冲突、
可选部件与错误行锚点。基础矩阵已加入 `verify:reading`，CI 不依赖本地 compiled 媒体树。

Reader 原文/译文/双语的真实头像展示、图片失败回退与辅助文本验收留给 R3；本批没有宣称
用户页面上的 `？？？` 头像已经修复。下一步集中迁移 generator/manifest/contract/repository/
playback/Reader，再重生成相同 204 份产物，保留原文、row_id、source SHA 和 unsupported 范围。
