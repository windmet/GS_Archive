# Reading locator：canonical parent descriptor 数据变更方案（批次 D）

日期：2026-10-11。输入 HEAD：`ae2b1677`。本批**只做方案与覆盖度实测**，没有改生成器、shard、校验或消费者；没有重建 release、没有部署。需要下面第 6 节的几项决定后再实施。

## 1. 目标与不做什么

目标：只给出 `?view=reader&reading=<doc>` 的冷链接（刷新、新标签、分享）也能知道“这篇正文的正式上级页是哪里”，使 `closeStoryReader` 的兜底落到正确的活动 / 合集 / 偶像故事页，并让 Reader URL 之后可以去掉 `category event parent story story_section story_type unit idol episode work_mode` 这类重复身份字段（批次 F）。

不做：不改 URL 协议；不把浏览来源（我从哪点进来）放进数据——来源仍只存于 history state；不重复建立一套故事归属数据，descriptor 只引用现有已验证索引。

## 2. 现状（事实）

- locator 由 `readmodels/lib/reading_locator_projection.mjs` 的 `buildReadingLocatorRecords(manifest, directoryEntries)` 生成：每条记录 `{ id, summary, view: { entry, entries } }`，按 256 个哈希 shard 发布（`reading-docs.shard`），checkout 适配器在 `readmodels/lib/checkout_adapter.mjs:232` 调用。
- `view.entry` 是 manifest 条目：`document_id logical_id scenario_id file sha256 source_file source_sha256 status row_count title episode_label domain parent_file`，其中 797 条另有 `directory_id directory_order`。**没有任何上级页身份字段。**
- 消费端 `useReaderNavigation.js` 的 locator resolver 只校验 `rows[].view.entry` 与 `view.entries` 存在，新增可选字段不会触发校验失败。
- 当前 Reader 冷启动的父页身份全部来自 URL（`category event parent story story_section story_type unit idol episode work_mode`），locator 不提供。

## 3. 提案：additive 的 `view.parent`

在 shard 行 `view` 上增加一个**可选**字段，不改变 `entry` / `entries`：

```json
{ "id": "<document_id>",
  "view": { "entry": {...}, "entries": [...],
    "parent": { "route": { "view": "event_detail", "event": "10001" }, "source": "event-resource-graph" } } }
```

- `route` 就是该上级页的 canonical 路由字段（只含 `view` 与身份字段，不含来源、语言、阅读位置），消费端直接交给 `normalizeArchiveRoute`，无需再翻译一套。各域取值：

| domain | route |
| --- | --- |
| event | `{ view: event_detail, event }` |
| main / unit_story / birthday / extra / card_scenarios | `{ view: story_collection, storyType, storySection }`；无合集时 `{ view: story_detail, story }` |
| idol_story | `{ view: idol_story_archive, idol, storySection, episode }` |
| work | `{ view: work_archive, idol, story?, workMode }` |
| seasonal | `{ view: seasonal_campaign, storySection, idol }` |

- `source` 记录证据来源（用的是哪份已验证索引），便于审计；缺失用 `parent: null`，**不猜测**。
- 兼容：旧客户端 / 已缓存的旧 shard 没有 `parent`，行为与现在完全相同（继续用 URL 字段）。消费端读取时 `parent` 是“补充事实”，URL 显式字段优先，二者冲突时以 URL 为准并记录而不是报错（批次 E/F 再收紧）。

## 4. 覆盖度实测（初步，非最终）

用独立 Python 脚本把 3113 条 manifest 条目按各域的现有索引做精确文件键匹配（不是投影代码本身，**键的选取有猜测成分，只能当上限与风险提示**）：

| domain | 条目数 | 可由现有索引映射 | 说明 |
| --- | --- | --- | --- |
| event | 396 | 396 | 经 `parent_file` 匹配 `event-resource-graph` 的 `storyFile`；**36 个活动故事文件里有 2 个被多个活动共用**（复刻），需要规定 canonical 取哪个活动 |
| work | 637 | 637 | `work_story_index` 的 `compiled_file` |
| idol_story | 491 | 491 | `idol_episode_index` 的 `resource_id` |
| card_scenarios | 342 | 342 | `story_catalog` 条目 |
| birthday | 152 | 152 | `story_catalog` 条目 |
| extra | 45 | 43 | 另 2 条需查 `extraIdentity` |
| seasonal | 306 | 57 | 我的匹配键不对（campaign 的参与者/导语文件键），需用 `seasonal_ledger` / `seasonal_campaign_index` 的真实归属函数重做 |
| main | 204 | 0 | 不在 `story_catalog.entries` 的 file 键里，需用 `mainIdentity.logicalEntries[compiledFile]` |
| unit_story | 540 | 0 | 同上，需确认其归属索引 |

结论：约 2/3 域已能明确映射；main、unit_story、seasonal 需要用真实投影函数重做，不能凭这次匹配结果下结论。

## 5. 实施步骤与验证

1. 生成端：在 `reading_locator_projection.mjs` 增加 `parentFor(entry, indexes)`，每域用**与页面相同的归属函数**（复用 `src/data/` 下 storyCollections / storyCatalog / eventResourceGraph，不新写一份），`buildReadingLocatorRecords` 把结果放进 `view.parent`。unmapped 的域先 `parent: null` 并在构建日志里计数；协议上不允许猜。
2. 校验：`readmodels/tests/reading_locator_projection.test.mjs` 增加断言：每条 `parent.route` 通过 `normalizeArchiveRoute` 保持 view 不变；各域覆盖数写成不得回退的下限；复刻活动的 canonical 选择可复算；`parent.route` 不含来源 / 语言 / 位置字段。
3. 对账（parity）：用现有 reader harness，对每域抽样，断言 “`view.parent.route` 与当前 `openXReader` 写进 URL 的父页字段一致”。这是证明新数据与现有行为等价的关键测试。
4. 体积：约 3113 行 × 每行几十字节，估计在 shard 内新增 100–200KB 总量，分散到 256 个 shard，远低于 `budgets.json` 的 `detailDecodedBytes: 786432`；实施后用 `readmodels/tests/artifacts.test.mjs` 和预算检查实测，不以估计代替。
5. 发布边界：shard 内容变化会改变 model release hash，需要按既有流程重建 candidate、更新 `bootstrap.inline.json` 与 `contracts/routes.json` 的绑定、重新装配并跑 artifact / cutover 校验。**这只是本地候选；部署、R2 与 Pages 另行授权**，descriptor 不授予部署许可。
6. 消费端（后续批次 E/F，不在本批）：冷启动无父页字段时用 `parent.route`；`readerReturnDecision` 增加 `parent` 输入作为“没有来源且没有 URL 字段”的兜底，从而修好新标签直开 Reader 返回落到故事目录的问题。

## 6. 需要你确认的决定

1. descriptor 形态：采用 §3 的“canonical 路由字段对象”（推荐，消费端零翻译），还是只存语义 id（`{kind, id}`，消费端再翻译，更抽象但多一层）？
2. 复刻活动共用同一故事文件时，canonical parent 取**首次上线的活动**，还是 `isReprint=false` 的活动？（2 个文件受影响，需选一个固定规则。）
3. 未映射条目：允许 `parent: null`（推荐，逐步补齐，构建日志计数并设下限），还是任何一域未映射就让构建失败？
4. 是否授权在本地重建 read-model candidate（会改 release hash 与 `bootstrap.inline.json`，不部署）。

## 7. 验证边界

本批运行：只读 Python 覆盖统计（上表）、读取 `readmodels` 生成器与契约源码。未运行：任何应用回归、`build:check`、read-model 构建、Browser。覆盖数是初步上限，需在实施时用真实投影函数重新统计。
