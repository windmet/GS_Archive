# 新审阅后的修复路线（2026-09-27）

基线：本地 `codex/gs-architecture-rebuild`，`26d6957`。审阅作为问题清单，以下安排已与本地生产调用及构建脚本核对。审阅中的 GitHub CI/分支保护状态不是本地代码证据，需要独立远端核验；本地 `master` 未同步，不能用其 ahead 数复述远端比较。

## 修复顺序与验收条件

| 批次 | 工作 | 完成条件 |
| --- | --- | --- |
| A：组合与卡片操作 | 清理 `openUnitStory/openUnitCards/openCardScenario` 的整批门禁；卡片偶像目录使用已生成目录；补组合/卡片 Player 刷新；卡片语音深链使用单卡详情 | 回归覆盖当前选择、失效响应及刷新返回；Browser 在阻断旧整批表与 card-detail 大索引时走实际操作 |
| B：事实账本与自动审计 | 路由合同区分直达、数据、内部操作、Player、组件、Browser、设备；构建生成入口 import graph/预算及 cutover 报告；接 source CI | 中间状态可校验，剩余阻塞可列出；旧全量入口存在时自动结论保持 false；不能靠人工翻总开关获得通过 |
| C：剩余消费者 | birthday、external 暂停页、其他 idols 分类、Stage/Lab 和其返回路径；移除剩余静态 route imports | 每个旧调用均有替代或明确保留原因；逐条 URL/内部动作与返回旅程覆盖 |
| D：生产清理 | 删除旧 Repository 的生产依赖及无用 ref/computed/watch；补全路由 parity | 生产 import graph 无旧全量/重型入口依赖；32 条公开 route 账本无实现缺口 |
| E：最终候选 | 当前 release 的 artifacts 校验、严格 cutover gate、assembler 预检及设备/部署验收 | 真实设备证据与完整媒体/服务策略齐全后才允许最终组装；本机 Browser 证据不自动升级为设备通过 |

每批按 `BUILD_ACCEPTANCE_POLICY.md` 做范围验证、显式提交和推送。代码输出复用 `.analysis/build-check`。本轮首先落实 A 和 B；C/D 的具体工作按 A/B 暴露的生产依赖继续细化。CI 只对源代码和可重建 fixture 作自动验证，不能伪造 ignored 真实语料或设备证据。最终发布 gate 保持严格，阶段性工程 gate 允许有明确列出的未完成项。

## 已核实的问题

- `App.vue` 三个上述操作仍调用 `runWhenLegacyReady`；`idols?category=cards` 的列表仍来自旧 `cardIndexData`。
- Player startup 白名单未包含 `unit_detail/card_detail` 返回目标；带 card/voice 的路由仍调用 `ensureCardDetailData`。
- 旧整批 `loadArchiveData`、三份 communication 表以及舞台旧索引仍在生产链中。
- 路由合同 32 项全为 false；现有 checker 只有最终完成模式，不能准确表达阶段进度。
- `build:check` 仅编译，无 startup/cutover 报告；source workflow 尚未接 readmodels 测试与审计，push 触发仅限 master。

该计划不构成最终 cutover、合并或部署签收。

## 执行进度

- A 已落实并完成本机回归/Browser 验收，边界与旅程见 [组合与卡片操作记录](GS_ARCHITECTURE_UNIT_CARD_ACTIONS_20260927.md)。
