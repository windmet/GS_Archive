# 第四话 EP07：RAW 局部重答与阅读分支

输入 HEAD `04697298`，分支 `codex/story-interaction-v2-before-b002`。前两批 Reader 双端控制、稳定加载、译文标题和设备默认阅读范围已提交并推送。

## 源链路与后续影响

再次直接提取 `RAW/asset/scenario_1_4_001_04.unity3d`，bundle SHA256 `48dbd521fece83d18c444d6f206fadfc7867c7058b8c48869107b7790d6ab22b`。EP07 原始 TextAsset SHA256 `9ab43861fde93f8671213f3b2123cbc5c56f87ace99c21c1c7234f724d7f63ba`，与前轮完整 RAW 审计一致。

| 问题 | 选项与 RAW 路径 | 后续 |
| --- | --- | --- |
| 古論クリス的前职 | cmd12 海洋学者 → cmd14；cmd13 天文学者 → cmd18 | 错答多一段制作人的疑问，均汇合 cmd23 `g2000` |
| 北村想楽的兴趣 | cmd28 川柳 → cmd30；cmd29 俳句 → cmd34 | 错答多一段制作人的疑问，均汇合 cmd39 `g3000` |
| 葛之葉雨彦的身高 | cmd44 191cm → cmd46 → cmd49 jump `g4000`；cmd45 199cm → cmd50 → cmd55 jump `g3000` | 191cm 到 cmd56 继续；199cm 返回 cmd39，重复该问题 |

第三题不是“没有标签”。cmd39 标签真实存在，错误出在编译器仅查找向前标签。答错反应和制作人的“再来一次”也与重答一致。正确选项的 jump_point 含 `bestanswer` 标记；本批保留原始标记证据，不凭它发明游戏分数、奖励或持久状态。

EP07 的 62 个命令没有持久变量/条件读取，EP08 的 235 个命令也没有读取 EP07 回答的条件分支，后续是固定脚本。在这份 RAW 的证据范围内，选项影响局部反应与第三题是否重答，没有后续剧情分流的证据。

## 修复合同

编译器仅接纳具有明确 RAW jump、唯一目标、单一向前出口、无嵌套选择/状态命令的局部重答。返回前缀必须连续对应当前问题前的已编译步骤；缺失/歧义目标、不安全前缀、跨 EP 返回继续拒绝。没有按文件名、标签数字或尾号设例外。已有前向分支合同保持兼容。

分支证据保存返回 step index/ID、RAW target/jump command 和 label。播放器在错答末尾返回问题前缀，保留已走路径的返回历史；答对进入共同后续。阅读器只显示当前反应，错答显示重答提示及返回选项按钮，同时暂时收起该 EP 的后续正文。选择继续分支后恢复正文；搜索后续锚点会先恢复可继续的选项。源行、text_ref、翻译单位和旧锚点不改写。

修复仅挂载第四话 aggregate 和 EP07 两份 compiled；深比较全部旧步骤、文本、场景和音频保持一致。新增 publication supersede `2026-09-30-raw-local-retry-001`，保留同一 owner 的全部 11 个 artifacts。重新生成 EP07 Reading、manifest/coverage 与译文标题的精确版本绑定；RAW 与翻译内容不变。

## 代码与数据验证

- 全 1,286 个含选择 RAW 分段重新通过编译；新增非数字标签重答、缺失/重复标签和不安全前缀回归。
- 2,801 个 Reading 合同回归：2,799 ready，两个源标签缺失案例仍 unsupported；12 个 appeal 元数据标记保持。
- 325 个 runtime forks 使用真实 useStoryNavigation 验证选择、前进和返回；错答返回问题，再答对到共同出口；损坏 retry 边界拒绝。
- 324 个 ready 阅读分支树验证全部源行引用唯一、隐藏锚点路径完整；后续搜索恢复继续路径。
- verify:reading、publication/schema、代码构建与 Browser 验收结果记录在后续验收节。

小型原始 JSON、候选、前后备份、ledger 与报告保存在 `E:/Web_build/SideM_EP07_Retry_QA_20260930`，不包含媒体包。既有无关文件保留；本轮不会作生产部署或完整资源打包。
