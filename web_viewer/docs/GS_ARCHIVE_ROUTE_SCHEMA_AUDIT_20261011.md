# GS Archive per-view route schema 审计（只读）

日期：2026-10-11。输入 HEAD：`26425444`（分支 `codex/portal-architecture-cleanup-20261004`）。本批只新增只读审计脚本 [audit-route-schema.mjs](../scripts/audit-route-schema.mjs) 与本文档；没有改变任何路由行为。应用回归与 Browser 均未运行（无行为变更）。

## 1. 方法与边界

`node scripts/audit-route-schema.mjs`（加 `--json` 输出原始数据）对 41 个 view（player 按 return=reader / event_detail / files 分三种）做两种测量：

| 测量 | 做法 | 含义 |
| --- | --- | --- |
| emitted（脏状态） | 给 `useArchiveNavigationState` 的每个 ref 赋值，逐 view 调 `currentArchiveRoute()` 再 `buildArchiveUrl()` | **上界**：若全局状态残留，该 view 的地址栏最多可能写出哪些参数 |
| survives（饱和 URL） | 给 URL 带上全部 `ROUTE_QUERY_KEYS`，经 `readArchiveRoute` → `buildArchiveUrl` 回写 | 一个带无关参数的链接，经解析后哪些被原样保留 |

两者都不是线上观测。emitted 的实际出现取决于 `applyArchiveRoute` 是否在每次路由应用时清空不属于该 view 的 ref——这点本批**未核实**，下面的 “emitted” 数字只能当上界，不能当已发生的泄漏。survives 则是确定的代码事实。

“draft-owned” 是我按页面契约与生成器推出的草案归属表（脚本内 `DRAFT`），**每项都需要对应页面确认后才能执行**；它不是已验证的契约。`from`、`portal_from`、`home_from` 已在 `26425444` 之前的两个提交里移入 history state，统计时视为非 URL 字段。

## 2. 事实

1. **没有 per-view 序列化约束。** 除 portal、welcome、idol_picker、reader、player 有各自的早返回分支外，其余 36 个 view 共用同一个通用分支，能写出同一批约 30 个参数。`normalizeArchiveRoute` 也不按 view 裁剪：饱和 URL 回写后，每个 view 仍保留 20–31 个参数（例如 `?view=about&card=x&story_type=main&gasha=...` 解析后原样回写）。结果：任何手写或残留的无关参数会永久留在该页面 URL 上。
2. **草案归属表对照的总量**（含更正）：本文首版写的 “511 / 1180” 有误——survives 测量的饱和 URL 误带了 `scenario`，使每个 view 都被解析成 player，数字偏高。更正后的基线（批次 B 之前、批次 C 之后）：emitted 上界多出 477 个，survives 多出 950 个“非自有”参数。通用分支上的固定 15 个（`availability card category episode event idol mobile_mode mobile_scenario q return sort story_mode story_section story_type unit_filter`）出现在几乎所有目录/详情类 view 上。
3. **`return` 参数**（已在批次 C 修复）：`returnViewAfterPlayer` 默认 `files`，非 player view 只要该 ref 残留为其他值，就会把 `return=…` 写进普通页面。这是 emitted 里最像真实泄漏路径的一项，需要确认 `applyArchiveRoute` 是否在非 player 路由上重置它。
4. **Reader 与 reader-origin Player 重复携带了父页身份**：Reader 写 `category event parent story story_section story_type unit`，这些都能从 `reading` 的 locator 推出（待 locator 增加 canonical parent，见 §5）。Player(return=reader) 在写完 Reader 字段后不会早返回，继续落入通用分支，因此同样带这 7 项（emitted 实测），并叠加 scenario 与步数范围。
5. **`reading_rev` 总是写入。** `currentArchiveRoute()` 每次都带 `readingRev: readingRevision.value`，所以现在每个 Reader/Player 链接都含 64 位 hash，与第 6 项产品要求（默认最新、URL 极简）相反。见 §4。

## 3. 建议的 schema 机制（未实现）

1. 新增 `ROUTE_SCHEMA`（声明式表：view → 自有参数、必填参数、参数值域），与现有 `ARCHIVE_ROUTE_CONTRACTS` 合并而不是并存。`ROUTE_QUERY_KEYS`、`VALID_*` 值域集合由它派生，消除手写重复。
2. `buildArchiveUrl` 只序列化 schema 内参数；`normalizeArchiveRoute` 对每个 view 丢弃非自有字段。**兼容规则**：解析（读）仍接受旧 URL 的多余参数并忽略；只改写入。旧链接打开后，下一次写入即被规整。
3. 分三步，先观测再收紧：
   - S0：把草案表搬进 `src/core/routeSchema.js`，加 `verify-route-schema.mjs`：断言每个 `VALID_VIEWS` 有条目、schema 参数 ⊆ `ROUTE_QUERY_KEYS`、`ARCHIVE_ROUTE_CONTRACTS.required` ⊆ schema；**仅报告**多余项，不改行为。
   - S1：对已逐页确认的 view（先从无参数页：about、archive_status、experiments、spine_lab、welcome、unit_catalog、episode_zero_units 开始）启用写入裁剪。
   - S2：其余目录与详情页逐组确认并启用；最后处理 reader 与 player。
4. 每个 S1/S2 批次都带该 view 的往返测试：自有参数全部保留、旧 URL 的多余参数被忽略、刷新/后退/深链接行为不变。

## 4. 第 6 项产品要求的落点（默认最新，按需锁定）

要求：默认链接 `?view=reader&reading=<doc>&reading_row=<row>`，不含 `reading_rev`；URL 显式带 `reading_rev` 时才锁定历史 revision；常规复制链接产出默认链接；永久链接作为日后 Reader 菜单项。

现状与风险（需实施前确认）：
- 解析端已支持 `reading_rev`，这条能力不变。
- 写入端要改成：仅当用户显式选择“锁定当前版本”（新增布尔状态，如 `readingRevisionPinned`）时写出 `reading_rev`；默认路径 `readingRev` 仍保留在内存里供同会话 Player 验证，**不进地址栏**。
- 风险：Reader 到 Player 当前靠 URL 上的 revision 对齐“正文版本 = 演出来源版本”（`useReaderNavigation.js` 的 `openReaderPlayback` 在 route 带 `readingRev` 时验证 `route.readingRev` 与 entry 一致，不一致报“阅读版本已变化”）。去掉默认 rev 后，刷新后的 Player 链接需要退回到“用当前 manifest 的 entry.sha256”，并保持“来源字节摘要校验”（`readingPlaybackTarget`）不变。**这条属于播放证明路径，必须单独成批并跑全套 reader/playback 验证，不与 schema 混批。**
- 新标签打开旧的带 rev 链接：继续按显式锁定处理。

## 5. 后续批次建议（每批独立、可回退）

| 批次 | 内容 | 前置 |
| --- | --- | --- |
| A | S0：routeSchema 表 + 校验脚本（只报告） | 无；可立即做 |
| B | S1：无参数页启用写入裁剪 | A |
| C | `return` 泄漏：确认并重置 `returnViewAfterPlayer`，补回归 | 可与 B 并行，范围小 |
| D | reading locator 增加 canonical parent descriptor（ReadModel 形状变更：生成器、shard、校验、消费者、版本同步） | 需明确确认 |
| E | Reader URL 去掉默认 `reading_rev`，增加显式锁定状态（§4） | D 之后更稳；播放证明路径，单独验证 |
| F | S2：目录/详情页逐组裁剪；Reader 仅保留 identity + position + 显式偏好 | A、B、D |
| G | 减少 `parentView` 作为浏览来源 | D 之后 |
| H | Player URL 瘦身、path aliases | 最后 |

## 6. 本批验证边界

- 运行：`node scripts/audit-route-schema.mjs`（输出见 §1–2 的数字）。
- 未运行：应用回归、`build:check`、Browser（无行为变更；脚本只读，不被任何运行路径引用）。
- 草案归属表未经页面逐个确认，不得直接用于强制裁剪。

## 7. 执行状态（更新）

- 批次 A（schema 草案表 `src/core/routeSchema.js` + `verify-route-schema.mjs`）：完成。
- 批次 C（`return` 只在 player 写入）：完成，守卫测试已覆盖。
- 批次 B（对 about、archive_status、experiments、spine_lab、welcome、unit_catalog、episode_zero_units 启用写入裁剪）：完成。机制是 `ENFORCED_ROUTE_VIEWS` + `pruneToRouteSchema`，在 `buildArchiveUrl` 末尾裁剪；读取不变，旧 URL 的多余参数照常解析，下一次写入被丢弃；`from` 等上下文参数不被裁剪。实施后同一测量：emitted 上界 379，survives 768。
- 同批补了 `event_detail` 缺 event 时 `eventBrowse` 为空导致 `buildArchiveUrl` 抛 TypeError 的保护。
