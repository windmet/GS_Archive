# GS Player QA 修复记录（2026-09-30）

输入包：`GS_Player_QA_Repair_e0b1c943.zip`。输入 HEAD：`e0b1c94384bf051cdde2c088206d9b80240d186f`；工作分支：`codex/player-qa-before-b002`。包内材料作为需求和参考实现审阅；本轮不部署、不更新 R2、不重新翻译 B001。

## 来源结构批次

- `1_4_001_05_c/d`：从原 RAW 的 `phone_select`、`jump_point`、前向 `jump` 和明确 `phone_end` 推导有限互斥分支及公共后文；新增证据元数据，保留所有原始 step、正文、`text_ref`。运行时沿选中路径汇合，Reader 标注两条互斥分支；分支内单行定位保持明确限制，整篇演出从头选择。
- `1_4_001_05_h`：RAW command 213 `talk_start ["2", "13"]` 到 command 238 `talk_end`，字典 unit 13 对应 THE 虎牙道。线程归属统一控制群名和主题；不从私聊当前发言人猜组合背景。
- 重建 c/d/h Reader、manifest/coverage，并追加 publication release；旧 release、42 个已审 overlay、receipt 和 output 保持不变。B001 来源检查仍通过（993 单元）。全库仍有 309 个 unsupported 文档，不扩大放行。
- 候选工具只写显式输出路径，不修改输入：`scripts/derive-phone-forks.py`、`scripts/derive-chat-threads.py`。Reader 可用状态由生成和验证合同计算，未手改 status。

相关回归：`verify:reading`、`verify:reading-sources`、`verify:reviewed-b001`、`verify:communication-presentation`、`verify:communication-assets`、`verify:player-qa` 已通过。两个真实电话分支分别验证选项 A/B 路径和返回历史。

## 验证边界与既有失败

`.analysis/player-b002-repair/regressions/results.json` 保存 100 个实际命令及退出码。首轮 95 个通过；名牌/线程语义的两项旧断言修订后通过；publication summary marker 同步后 `verify:archive-baseline:source-only` 通过。

`verify:story-schema` 和 `verify:episode-artifacts` 仍失败：前者缺 `story-collection:1_1_001jup_01_1_1_001_01` authoritative registry 条目，后者 episode manifest 缺 `1_2_002_12_a.json`。使用 e0b1c943 的脚本、schema、fixture、pipeline、publication manifest 和 registry，在独立小型来源目录挂载现有 compiled 语料，重现相同首个错误；这些失败对象未被本轮修改。日志位于 `.analysis/player-b002-repair/baseline-source/`。门禁未放宽。

包内 Python 16 项使用进程级 `core.autocrlf=false` 运行通过（默认 Windows synthetic Git fixture 会因自动换行失败）；完成策略参考测试 16 项通过；真实 resolver 的 Producer 测试 18 项通过。它们不等于 Browser 或真机验收。

源码编译使用 `build:check`，无 public 语料复制。最终源码、Browser 和 ReadModel 绑定验证待整合；本记录后续补充实际结果。
