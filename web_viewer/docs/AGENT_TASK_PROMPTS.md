# AGENT_TASK_PROMPTS

为你以后每次开本地 agent 任务准备的 prompt 模板。

---

## A. 通用代码审查 prompt

请先阅读：

1. `docs/AGENT_START_HERE.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DO_NOT_REOPEN.md`

本次任务只审查以下文件：

* `[填入文件路径]`

请不要扫描 raw 资产、历史备份、archive、node_modules、dist。

审查目标：

* 判断这个文件当前职责是否清楚
* 是否有明显应该拆出的逻辑
* 是否存在重复逻辑
* 是否存在会影响 smoke 样例的风险
* 给出最小修改建议

回答格式：

1. 当前判断
2. 不建议改的部分
3. 建议小步拆出的部分
4. 具体涉及文件
5. smoke 验证方式
6. 回滚方式

不要重新讨论已经解决的 Y 轴定位、粒子复刻、debug 面板历史膨胀问题。

---

## B. SpineStage.vue 专用审查 prompt

请阅读：

1. `docs/AGENT_START_HERE.md`
2. `docs/PROJECT_MAP.md`
3. `docs/SMOKE_CASES.md`
4. `docs/DO_NOT_REOPEN.md`
5. `src/components/SpineStage.vue`

本次只判断 `SpineStage.vue` 是否还需要小步拆分。

注意：

* 当前本地版本的 Y 轴定位问题已经解决，不要重新展开旧定位问题。
* debug 面板已经减重，不要建议恢复旧字段。
* 不要因为文件行数较长就建议大重构。
* 优先判断是否存在 agent 容易误读的混杂职责。

请重点检查：

1. template 中 debug 面板是否适合拆成 `SpineStageDebugPanel.vue`
2. URL 参数读取是否适合拆成 `spineStageRuntimeConfig.js`
3. store/data preload 是否适合拆成 `useSpineStageStores.js`
4. `applyState` 是否仍适合暂时保留在组件内
5. 拆分后如何用 smoke case 验证不回归

输出时给出：

* 必拆
* 可拆但不急
* 不建议拆
* 推荐执行顺序

---

## C. smoke 样例建设 prompt

请阅读：

1. `docs/AGENT_START_HERE.md`
2. `docs/PROJECT_MAP.md`
3. `docs/SMOKE_CASES.md`
4. `docs/SMOKE_EXPECTATIONS.md`

本次任务是完善 smoke 样例，不做业务重构。

请完成：

1. 检查现有 fixture 是否覆盖以下场景：
   * 单人立绘
   * 双人立绘
   * 三人立绘
   * 背景切换
   * 表情切换
   * 动作切换
   * 同模型更新
   * 换模型重生
   * 角色退场
   * z-order / idol_priority
   * fallback background
   * 缺失 spine silhouette fallback
   * scene icon 显示
2. 如果缺少样例，只给出需要新增的 fixture 文件清单。
3. 不要扫描全量 raw。
4. 不要改运行逻辑。
5. 不要重新讨论历史定位问题。

输出格式：

* 已覆盖
* 未覆盖
* 建议新增 fixture
* 每个 fixture 的最小 step JSON 字段
* 验证方式

---

## D. 修改代码前的保护 prompt

在修改前，请先给出计划，不要直接改代码。

计划必须包括：

1. 修改目标
2. 涉及文件
3. 不会触碰的文件
4. smoke case
5. 预期行为
6. 回滚方式

限制：

* 不要扫描 raw 全目录
* 不要修改 archive / backup
* 不要引入新依赖
* 不要重写已稳定逻辑
* 不要重新展开 DO_NOT_REOPEN 中的问题

等我确认后再实施。

---

## E. 资源路径查询 prompt

请先阅读：

1. `docs/AGENT_START_HERE.md`
2. `docs/PROJECT_MAP.md`

本次任务只查询以下资源：

* `[填入资源名称或 ID]`

不要扫描 raw 全目录。优先查询：

1. `src/utils/AssetResolver.js` — 查看 URL 构造逻辑
2. 对应的 store / manifest — 查看资源是否存在
3. `public/assets/` 下对应目录 — 只列出该目录

不要讨论不相关的架构问题。
