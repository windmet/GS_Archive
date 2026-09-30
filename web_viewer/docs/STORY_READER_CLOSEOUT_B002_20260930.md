# 阅读器与 RAW 分支修复收口，接续 B002 翻译

收口输入 HEAD：`52d48e02df9db2dfe8cc829d56f3599ea203ef10`；分支 `codex/story-interaction-v2-before-b002`。本文件是文档收口，不改运行时、RAW、compiled、Reader、翻译内容或审核状态。

## 已完成的产品与数据工作

- Reader 四套主题、头像显示及选项卡沿用已验收实现；桌面工具精简，手机底部浮动导航和设置面板。
- 顶部切换话目，底部/快捷目录定位 EP；左右箭头只切换相邻 EP，本话末尾明确进入下一话。
- 手机入口默认单 EP；桌面正式话目入口默认整话并定位所选 EP/行。按设备导航时决定范围，不在阅读中因缩放替换正文。
- 有源身份匹配的译文时优先显示译文大标题；原题保留。轻量标题索引与拆分阅读索引保持来源及版本校验。
- 话目切换保留 Reader，并使用有界、已验证的正文缓存；冷加载保留目标抬头，延迟显示阅读面内的占位，消除通用加载框闪回。
- RAW 选项解析以真实命令与路径为证据，不按标签数字/尾号猜测；appeal 在编译阶段归为展示元数据，真实附文保留。
- 第四话 EP07 的身高错答为合法局部重答。Player 按 RAW 返回问题；Reader 收起该 EP 后文、提示重答，搜索仍可展开正确路径。前两题错答汇合，未发现 EP08 读取这些答案的条件命令。

本轮最后四个提交：`f12cc245`、`04697298`、`1d7266c2`、`52d48e02`，均已推送。详情与验收边界见 [RAW 修复记录](RAW_SELECTION_FLOW_REPAIR_20260930.md) 和 [局部重答验收](READER_LOCAL_RETRY_20260930.md)。

## 冻结与验收边界

- 当前 2,801 份 Reading：2,799 ready；两个真实源标签缺失案例保持 unsupported，不猜测补写 RAW。
- 已完成相关 Reading/Player/RAW/来源一致性回归、build:check、本地双端 Browser 旅程与完整 publication ledger 检查。201 releases / 1,368 stable logical IDs；325 runtime forks / 324 ready 阅读分支树。
- B001 再验通过：52 Reader 文档、42 runtime catalogues、993 source-bound entries。保持 reviewed、not_final；其人工批准不延伸到 B002 或其他批次。
- 5197 服务归属已核实，继续使用现有生产代码 QA bundle及资源映射；readmodels 在 `E:/Web_build/SideM_EP07_Retry_Models_20260930`，release `deb7832d7615bf50edbb72909638d252652d71c5e7f6d66f5fe4d745faa0c8a1`。
- 本轮不是部署、真实设备或完整媒体验收。收口仅检查文档/链接/diff，不重复构建或复制媒体包。既有 QA、RAW、未跟踪文档与其他材料均保留。

## B002 的正式接续入口

旧 R3 B002 为 `B002-main`，59 个完整 Reader 文档 / 999 个目标行，范围从 `1_4_001_06_a` 至 `1_4_002_01_g`。它涉及以下七个故事标题：

1. letter from Cafe Parade
2. 3人一緒にえいえい、おー！
3. 出来ることは、諦めないこと
4. 熱く冷静に燃え上がる男たち
5. 過去と未来を照らす星
6. 黒い影
7. 始動、『男極ッ！アイドルリーグ』

旧包 `run-c6e52c1ff0f9-r3-reader` 仅保留作比较；它的 source_commit 早于本轮修复，不能直接作为当前回导包。先提交此收口文档，再以当前提交重新生成 R3：

```powershell
npm run translation:studio:prepare
# 输出到 .analysis/translation-studio/run-<当前 HEAD 前 12 位>
# 本次使用其中 B002-main/input.md；batch-map.json 留在本地用于来源校验。
```

装包后检查 plan、B002 文档/RID/unit 唯一性、Reader/compiled/RAW 与输入/政策哈希，比较旧批单位覆盖。当前还没有新的 B002 模型输出，不能记录为翻译完成或结构 PASS。

模型阶段用全新的会话，交付完整 `B002-main/input.md`。保存未经修改的两列表格为同目录 `output.md`。生成后到检查/回导前保持 HEAD 不变；现有 checker 明确要求 source_commit 等于当前 HEAD，连文档提交也会使旧包失效。确有新变更时重新装包，不手改 map/hash。

```powershell
npm run translation:studio:check -- .analysis/translation-studio/run-<HEAD前12位>/B002-main
npm run translation:studio:import -- .analysis/translation-studio/run-<HEAD前12位>/B002-main
```

结构通过后只生成本地 draft；随后做语义质量审查、必要的独立 quality-repair/merge、Reader 双语通读。只有用户明确批准 B002 全批后才提升为 reviewed；不自动写 public、标为 final 或部署。流程与试验政策继续参考 [R3 指南](TRANSLATION_STUDIO_R3_TRIAL.md)，B001 审核依据见 [B001 记录](TRANSLATION_B001_REVIEW_20260929.md)。
