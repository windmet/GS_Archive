# D2：现有入口与逐句演出往返

最新产品计划见 [Reader/Player 下一阶段](READER_PLAYER_NEXT_PHASE_20260909.md)：普通 Reader
改为顶部唯一完整演出入口，逐句按钮退出 UI；本文件中的底层深链、版本校验和返回定位
能力保留。以下是历史验收记录，不代表下一版仍应逐行展示工具按钮。

2026-09-09；起点 6b3a52b，codex/archive-architecture-refactor。

本批在 D1 的五份样本上完成 D2 首批闭环，沿用 F 的唯一 playback controller。
四份可读正文由主线集合的既有分段入口发现；多选未支持样本不显示可读入口。
不表示全库可读，也未扩大 strict-v2 发布、修改 compiled/translation 或部署。

## 使用行为与边界

- 主线集合按 manifest 中显式 source_file 匹配分段，提供并列阅读/演出按钮。
  目录只请求小型 manifest，不预取全部正文；原 v1 manifest 缺少该可选字段时仍可
  直达阅读，但不推断目录关联。生成器、运行时校验与文档来源交叉校验同步更新。
- 正文可选“从这里演出”；标题/梗概不提供无法可靠起播的按钮。已有选择结构支持
  边界不扩大。未知说话人继续隐藏身份，文本/翻译仍由原 resolver 处理。
- at_step 是独立的一基数组位置；start_step/end_step 仍决定范围。原 source
  step_id 仅校验身份，不能当数组位置使用。播放器从指定句进入后仍能回看前文。
- URL 保存 reading/reading_row/reading_mode/reading_rev，版本为正文产物 SHA。
  Reader 与 Player 共享原 nav refs，不增加返回状态仓库或第二条播放队列。
- 返回恢复发起演出的同一句与阅读语言，释放 currentScenario/舞台；主线来源使用
  既有 story_type/story_section/story 字段，返回原集合及展开话目。无来源深链
  返回故事目录。首批来源范围限定为 main，未扩到活动/卡片/其它关系上下文。
- 演出刷新先载入并验证阅读产物，核对 URL 的文件、完整范围和目标句。读取 compiled
  原始字节，校验 SHA、step 数及目标 step_id 后才允许导入播放器/预载媒体。
  过期版本、篡改目标或来源不符留在 Reader，显示明确反馈及“重新载入正文”。
  刷新正文重新取得 manifest；全过程继续服从同一个 navigation intent。
- 阅读发起演出期间用行内准备状态，保留导航操作，不让既有全屏加载遮罩挡住门户。
  受控延迟下离开后，迟到响应不可恢复播放器。
- 错误反馈会聚焦并滚入可见区域，避免长文中提示被留在屏外。行按钮保持 44px
  最小高度，沿用 Reader 的字体和色彩，不引入新的设计系统。

## 机械验证

verify:reading 增加实际 App actions + coordinator/controller/session 的往返测试。
CI 使用有意非连续 step ID 的 synthetic compiled，不能把本机未跟踪的媒体树作为
CI 依赖；额外 `node scripts/verify-reading-playback.mjs --local-sources` 校验本地
真实 published compiled。覆盖媒体之前的摘要拒绝、文档版本、定位/范围不符、
主线来源、刷新、关闭释放、晚到请求不能重新打开播放器。

verify:story-playback-range 增加独立初始位置与上一段，保留原边界/背景/选择用例。
原 1,792 个 view/return/parent 对照保持；新字段只在新路径出现。
本地通过 reading、reading-sources、archive-navigation-state、routes、
archive-async-navigation、archive-startup-route、portal-navigation、
playback-controller、story-playback-range、archive-baseline:source-only。
source-only Vite build 通过；未复制完整 public 媒体树。主 chunk 仍有既有 500kB
提示，本批不作为启动性能优化完成的证明。

## Browser/IAB

正式 QA 使用本 checkout 的 5175；隔离受控故障使用 5176，仓库外 fault 配置，
未改写真实 compiled。实际行为：

- 主线 main/101、第1話的エピソード4，从阅读按钮进入；第7句
  「……ああ、そうだけど。」演出显示 7/48，“上一段”进入第6句。
- 演出刷新仍为第7句；返回 Reader 的选中/焦点为 step-7:text，canvas=0。
  再返回保留原集合及第1話展开。浏览器后退恢复同句，前进恢复集合。
- 原文与双语阅读进入演出均保留阅读模式在返回链接；播放器维持自身语言偏好，
  本批不擅自覆盖全局演出偏好。
- 故意返回不同 compiled 字节时，Reader 提示来源不一致；请求记录中没有
  StoryViewer、Spine 或媒体请求，canvas=0。解除故障后重新载入正文清除提示。

最终 320×740、390×844、1280×800 检查无横向溢出；按钮约 44px。
正常路径控制台无 error；保留既有 Spine.update/tint 兼容警告，未扩为 Runtime 审计。
故障路径的来源校验 error 为受控输入预期结果。
12 秒延迟下已实际切到门户，响应完成后仍为门户且 canvas=0。

证据目录：C:/Users/windm/.codex/evidence/sidem-reading-playback/2026-09-09/。
本批仅短流程 UI/来源/导航验收，不声称听感、全部 cue 或 pre-E 正式长稳通过。

## 后续

D2/F 首批完成后推进 E1 纯 shadow，明确状态时间/排序/继承契约及支持 channel。
pre-E 仍按用户意见后置，但 E2 接管 renderer 前须补正式冻结基线。
搜索、定位摘要与本地阅读记录仍未实现，按既定路线随后推进。
