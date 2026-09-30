# RAW 选择与分支编译修复（2026-09-30）

输入：`codex/story-interaction-v2-before-b002`，`279807e6356d57fcb9d5f9828ca110f9aa618e49`。本批修复当前挂载的 compiled → reading → readmodels → Player/Reader 链路；不重新编译或替换画面快照、对白、音频、译文或 RAW 包。

遍历 1,435 个 RAW 剧情包、4,939 份 Command 脚本、330,025 条指令；1,286 份脚本含选择。非 Command 的聊天 Nodes JSON 和空占位文件单独登记，扫描错误为 0。12 处 `appeal` 均来自 `text_select` 第三栏，聊天第三栏 2,268 处真实附文保留。

旧问题来自有限的电话两选一修补与编译投影丢失 label，而不是 EP 尾号。新解析器按源文件、part、command_index、原文和精确 RAW 哈希绑定，解析任意标签拼写的前向命令图，以各路径必经的共同后继证明汇合。支持多选、聊天、共用正文、嵌套选择、静默画面和结束选择；缺失标签继续拒绝。严格 v2 投影和拆分 episode 均保留、重定位这些证据。

挂载修复 511 份 compiled 文件，增加 378 个父/分段分支证据；仅 5 个 option target 有 RAW 证明的修正（舞田類的一次连续选择，活动 30005 的共用正文：父/分段各两项）。所有原有 step/text unit/source hash/dialogue/scene/audio 字段深比较保持一致。`appeal` 保留原文和 text_ref，在编译阶段标记 `presentation-marker`，阅读文档生成 `choice_metadata`，公共阅读投影不再当作附文；旧锚点仍能定位对应选项，旧缓存显示回退保留。

阅读文档 2,801 份：ready 2,492 → 2,798，unsupported 309 → 3。指定第三话 EP04/05/08、第十话 EP09/10 已 ready。另两份原先因 `fadecolor` 被误判的文档恢复，作为静默视觉步骤投影。

剩余 3 份是 RAW 缺陷，不猜测替代标签：

| 文档 | 源证据 |
| --- | --- |
| `025suz_403_2_4_025_03_09_b` | cmd20/21 都指向 `phone_select2`，后面仅 `phone_select1` 标签 |
| `033shr_402_2_4_033_02_09_a` | cmd19 指向 `phone_select3`，cmd20 标签实际为 `0.5` |
| `1_4_001_04_g` | cmd55 跳往 `g3000`，不存在该前向标签；另一分支跳往 `g4000` |

校验：全 1,286 份含选择 RAW 经当前 Python 编译器回归，仅上述 3 份异常；2,801 文档完整哈希/合同/行唯一性/真实附文/元数据别名验证；324 个阅读分支的所有选项执行实际 useStoryNavigation 前进、嵌套选择、返回和结束检查；损坏证据拒绝。`verify:reading`、`verify:reading-sources`、`verify:player-qa`、`verify:story-schema`、`verify:reviewed-b001` 通过（B001 52 文档、42 目录、993 单位）。原 schema 验证把历史 identity backfill 一律误当 strict promotion，现按实际 runtime_contract 区分，严格输出仍必须登记、通过严格 schema。

精确扫描、备份和候选证据在 `E:/Web_build/SideM_RAW_Flow_QA_20260930`；包含 `raw-selection-inventory.json`、`repair-ledger.json`、`compiler-acceptance.json`、`reading-candidate-acceptance.json` 和逐文件 `before/`。此目录为小型 JSON 源/校验材料，不含媒体包。发布账本新增 supersede 事务，保留既有 RAW 来源和全部 owner artifacts，未把 compatibility 数据提升为严格 Runtime。

readmodels 输出在 `E:/Web_build/SideM_RAW_Flow_Models_20260930`，release `887fb70b264079c74592618db09f08abe51a014b2efb3e424e9483c06bbbe92c`，8,420 个数据产物全部通过 `verify_artifacts.mjs`。bootstrap 与 route ledger 绑定此次 release；原路由、设备验收状态保持原有边界。第一话此前只在本地存在的 11 个严格 compiled 产物现显式纳入 Git，与 publication owner 清单一致。

提交前 `npm run build:check` 通过：2,598 模块，复用 `.analysis/build-check`，不复制 public。`verify-archive-build-audit.mjs --progress` 通过，启动 gzip 123,824 bytes，禁用模块及生产 legacy 模块清单为空。实际 Browser 使用 5197 上 `serve-player-qa-preview.mjs` 的生产 bundle、上述 readmodels 与已有 public 资源映射；没有生成完整资产包。该轮验收 bundle 为 `72929c0` 加本批阅读选项卡、说话人头像与配色工作区变更，构建 audit 如实记录 sourceDirty。推送前再给清洁提交绑定生产构建，最终 HEAD、sourceDirty、bundle 与启动预算记录在 QA 目录的 `final-build-audit.json`，不以工作区构建冒充清洁提交构建。

Browser 实际验收（默认 505×515 视口）：

- 通过“切换话目”和 EP 目录进入第三话 EP04/05/08，三个选项各自的电话/聊天回复与共同后续完整可读；EP08 搜索选项命中 1 处，下一处定位到 `step-27:option-0`。
- 第十话 EP09/10 共用正文只显示一次，EP09 两条真正的附文仍在；第一话搜索 `appeal` 为 0 结果。
- 第三话 EP04 从阅读器“播放本段”进入真实 Player：第二项“听起来好难啊”进入 24/30、25/30 两句回复，再直接进入共同正文 27/30；返回为同一分支的 25/30，没有经过另外选项回复。切换期间出现的中间快照待画面准备完成后正确落位。
- Reader 控制台无相关错误。Player 未捕获 error；存在 Pixi/Spine 的 update/tint 警告栈，不将此批文本分支验收提升为全画面/媒体验收。
- 截图保存在上述 QA 目录：`browser-third-ep04.png`、`browser-third-ep08-branches.png`、`browser-player-ep04-selected-branch.png`。

用户追加提供的视频存档图用于三选项 Call 配色：原文第一项绿色、第二项青绿、第三项蓝色；白字、对应明亮描边与轻微外光，气泡尾巴同色。随后按存档将按钮显示顺序反转为第三、第二、第一项；保留源 index、目标和选中状态，颜色绑定源 index。仅 Call 的三选项使用这套样式。Browser 确认从上到下蓝、青绿、绿；顶部蓝色按钮进入原第三项回复 26/30。截图 `browser-player-three-options-reversed.png`。`verify:player-qa` 通过。

阅读器追加改为交互式选项卡：默认只显示第一条反应；任意切换，共同正文保留在外层一次。正文与真实附文、旧锚点仍保持 canonical，搜索覆盖所有已载入的分支，命中隐藏回复会先展开完整路径。321 个 ready 分支树全部通过行引用完整性与每个锚点路径检查；12 个旧元数据别名、嵌套 fixture、真实分支内的单选项不覆盖外层按钮。实际 Vue SSR 检查第三话 EP04 各选项只出现对应回复、共同正文一次；加入 `verify:reading` 门禁。

Browser 在 1280×720/900 桌面与 390×844 手机验证横排/纵排、三项切换、ArrowRight 换项、隐藏第二项回复搜索命中后定位 `step-24:text`、语言切换保持手动选项；深夜主题激活项为 `#2dd4bf` 配 `#0f172a` 字色，复原原有暖阳偏好。临时视口覆盖已重置。截图 `browser-reader-choice-tabs-desktop.png`、`browser-reader-choice-tabs-mobile.png`。

头像缺失链路：RAW/compiled 的 `chara_id`、Reading 的 performance actor 仍在，显示层旧头像策略将 Call/Chat 的 `medium-policy-unavailable` 排除；遗留 snapshot `phone_mode` 还会使后续 ADV 得到同一 visual reason。说话人参考头像现要求源 performance actor 与公开原文姓名一致（支持原文 NBSP），不改 stage presence/RAW/snapshot。unknown、演员冲突、隐藏/轮廓或明确不在场规则保留；NPC 审计清单不扩张。第三话 EP04 至 EP10 回归通过；Browser 确认悠介两条分支回复图片实际 loaded，后续 EP05 的隼人、四季、春名头像 loaded。分支面板内定位/搜索行不再增加竖线。截图 `browser-reader-choice-tabs-avatars-desktop.png`；Reader 无 console error。

不宣称部署、媒体发布、真实设备或全分支画面验收；三份缺失/错误标签的 RAW 仍明确 unsupported，原始来源不改写。

Publication 全量门禁最终通过：200 个 releases / 1,368 个稳定 logical IDs。首次检查仅第一话 11 个新增文件缺 LF 声明；补限定 `.gitattributes` 规则后，逐文件及全量复验通过，未扩大归一化范围。
