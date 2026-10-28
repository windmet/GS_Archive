# 深链接 R1 执行记录

日期：2026-10-28。输入 HEAD：`36743743`（#117），执行分支：`portal/20261028-deep-links`。
工作目录：`E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`，LF 检出。
任务边界与排期见 [交接文档](GS_ARCHIVE_HANDOFF_20261028_DEEP_LINKS.md)。本批只做 R1，R2 等 R1 合入。

## 实现

- R1-1：`publicRoutes.js` 统一 8 类实体/地点与 14 个目录的地址事实；locator、标题和外壳共享注册表。提交 `2778bd9a`。
- R1-2：按页面 props 和投影消费者校正 8 个目录的参数白名单并启用裁剪；目录隐含身份键从注册表派生。清空全部公开地址的裁剪例外，组件新增手写 `?view=` 会触发 guard。补充 Browser 发现招募搜索由 `useGashaNavigation` 消费，`gashas` 需保留 `q`。
- R1-3：用户确认 D1 推荐命名，新增 `/live/`、`/studio/`、`/about/`、`/status/` 及对应栏目标题和 head 外壳。D2 也已确认方案 A，本批尚未实现剧情路径。
- 保留内部 query 规范、旧 query 优先、未知路径启动偏好、来源 history 及恢复键。无 App、模板、样式或面包屑实现改动。
- 补充 Browser P30 发现冷活动链接返回组合/卡片时只有页面变化，地址仍留在活动详情。`useEventNavigation` 在既有页面恢复完成后提交目标 history，校验 revision、view 和 disposal，避免晚到的返回覆盖新导航；未改数据加载职责。单元回归覆盖两个归属及异步取消。
- 标题表的小改位置：`src/presentation/ArchiveDocumentTitle.js:11`（实体视图由注册表派生）、`:12`（地点栏目由注册表派生）、`:13`（栏目标题由注册表派生）。
- 预览包现有逻辑已按外壳目录派生 `_headers`，新增前缀自动加入，不改发布脚本、不打全量包。

## 外壳和审计

R1-1 在修改前、修改后均执行 `build:check` 与生成器。固定修改前模板比较 1,209 个文件的 SHA-256，全部一致；审计文本也完全一致。两次真实编译的入口 bundle 文件名从 `index-B5hax2Zy.js` 变为 `index-nkS1kIPm.js`，因此跨构建的完整 HTML 字节不一致，不能称“两个不同 bundle 的外壳全字节零差异”。固定模板比较核对的是生成器行为零变化。

R1-3 外壳数量为 **1,213**：原有 1,209 + 四个工具入口；目录根 14 → 18。最终 `--dist=.analysis/build-check` 检查全部 1,213 个外壳通过；固定修改前模板复核最终结果，原有 1,209 个仍逐字节一致。

审计采用已规范化后的 view 和注册表隐含参数计算所有权，避免把旧 `idols+idol` 别名归到目录或把 `category=cards` 误报为泄漏。JSON 输出补充 `emittedSchema`、`survivesSchema`，保留原参数数组。

| view | 修改前 emitted / survives 额外参数 | 修改后 |
|---|---|---|
| idols | 0 / 0（旧别名） | 0 / 0（按实际 idol_detail） |
| cards | 12 / 23 | 0 / 0 |
| song_catalog | 14 / 24 | 0 / 0 |
| event_catalog | 14 / 25 | 0 / 0 |
| gashas | 14 / 24 | 0 / 0 |
| story_catalog | 8 / 19 | 0 / 0 |
| collection_catalog | 14 / 25 | 0 / 0 |
| photo_catalog | 14 / 25 | 0 / 0 |

初次 R1-2/3 快照在旧审计口径下，emitted 250 → 156、survives 474 → 312；补正实际 view 与隐含参数的统计口径后为 138 / 298。补 `gashas.q` 后复核有效口径仍为 138 / 298，八个目录额外参数仍为零。统计口径校正与运行时裁剪收益分开记录；未审核的剧情/播放器等仍保留后续批次，不把全表当作零泄漏。

## 回归与门禁

已通过：`verify:routes`、`verify:route-schema`、`verify:archive-navigation-state`（含 1,176 view/return/parent 案例）、`verify-collection-route`，活动/摄影目录导航（`--experimental-vm-modules`）、`verify-portal-directory-navigation`（候选根 `rm-release-20261022`），以及外壳纯检查。

验证工具的两处既有问题已修复：

1. 外壳 verifier 原来用整个 HTML 的 `/portal/index.json` 子串判断 Portal 预载；inline bootstrap 也带该 URL，导致真实 `--dist` 误报。现在检查实际预载标签，仍由同一个 `PORTAL_PRELOAD` 规则约束；纯模板及真实 1,209 外壳检查通过。
2. 门户目录 verifier 提取生产 `openDomainCatalog` 函数后未向 VM 注入 `COLLECTION_KINDS`，运行报 ReferenceError。现在注入真实导出，未替换生产函数或降低断言。

初次 `npm run gate:source` **116/116 全通过**（base `36743743`；执行时 HEAD `2778bd9a` 加 R1-2/3，随后提交为 `88224982`）。其中完整 source-only verifier batch 用时 193.3 秒，`build:check` 用时 25.9 秒，当前构建审计用时 2.0 秒。该精确提交的远端 Source-only contract 也通过（run `40546581794`）。后续活动返回和招募搜索变更另跑门禁，结果见下方补验记录。构建只含代码产物，不含 public 语料，输出复用 `.analysis/build-check`。台账新增记录是本任务主动补充的证据，不是 gate 生成结果；其证据-only diff、`verify:cutover-routes` 与文档链接另行通过检查。第一次调用误选系统 WSL bash，Windows `.git` worktree 路径不能在 WSL 解析；已停止本次 runner 的进程树，以任务进程 PATH 前置 Git Bash 重跑。未改仓库 gate runner 或关闭其他 dev 服务。

## 变异测试

所有变异均恢复，日志保存在 `.analysis/deep-links/mutation-*.log`。

| 变异 | 预期失败证据 |
|---|---|
| 卡片 pattern 的两位数字改为三位 | path locator：`http://x/cards/001tom_ssr01/` |
| R1-1 删除 cards 裁剪例外 | `cards: public address requires enforced schema` |
| R1-2 移除 cards enforcement | 旧卡片链接 URL 断言失败；Browser P47 也重新出现生日参数 |
| 删除歌曲、活动的 idol/q | 对应 `/songs/?idol=001tom&q=x`、`/events/?idol=001tom&q=x&event_kind=theater` 往返断言失败 |
| 删除剧情 story_section、图鉴 q、摄影 q | 对应 `/stories/`、`/items/`、`/photos/` 往返断言失败 |
| 去掉注册表 implied 键保留 | `/idols/` 往返断言失败 |
| about 前缀改为 broken | `Section broken has no head shell`，缺外壳拒绝新地址 |
| 临时组件写入 `?view=cards` | 组件导航 guard 失败；临时文件已删除 |
| 删除冷活动返回的 history 提交 | 活动导航回归的冷返回目标地址断言失败 |
| 删除冷返回 appliedRevision 校验 | 新导航发生后，晚到返回错误提交 history 的断言失败 |
| 删除招募目录 `q` | `/gashas/?gasha_type=growing_fes&q=x` 往返断言失败 |

## Browser 实测

直接使用 Codex In-app Browser（cua_repl），服务 `http://localhost:5240`：Vite 6.4.3，当前专用 worktree；候选自动绑定 `rm-release-20261022`，bootstrap release `1accd9d0`。服务默认监听 localhost；`127.0.0.1:5240` 曾拒绝连接，后续统一使用实际可达的 localhost。

| 旅程 | 结果与边界 |
|---|---|
| P47 修前 | 阿斯兰生日合集 → 侧栏卡片，实测 `/cards/?story_type=birthday&story_section=029ass` |
| P47 修后及变异 | 修后为 `/cards/`；临时移除 cards enforcement 后复现修前 URL；恢复后再测为 `/cards/` |
| P48 | `/songs/?idol=001tom` 刷新后地址保留，但主体因基线 `techCount is not defined` 报错，**未通过渲染验收**；错误调用已在输入 HEAD 的 `ArchiveSongCatalog.vue:177` 确认存在 |
| P49 | `/events/?idol=001tom&q=315` 刷新后显示“天濑冬马”筛选和搜索框 315，结果为空时仍显示正常的无匹配内容 |
| P50 | 旧 `/?view=cards&story_type=main&rarity=SSR` 改写 `/cards/?rarity=SSR`，SSR 124 被选中；一次 Browser back 回到原活动筛选页。Browser API 的只读页面作用域未暴露 history.length，未声称直接读到数值 |
| P41 扩展 | LIVE、摄影工作台、关于本站从现有侧栏进入，均写 `/live/`、`/studio/`、`/about/`，刷新后标题和实际内容正确；`/status/` 冷打开与刷新后为资源标题及资源状态表，独立标签页控制台无 error/warn。现有侧栏未暴露资源按钮，没有新增 UI |
| 手机断点 | 390×844 直接打开旧卡片链接，改写后 SSR 筛选可见、列表正常；桌面为 1280×900。截图已在本次对话 Browser 输出中展示；手机 documentElement 宽度与 scrollWidth 均为 390，独立标签控制台无 error/warn。不属于真机证据 |

`verify-portal-path-locator-browser.mjs` 已移植 headless-shell 优先选择、更新 about 路径预期，补 P41 工具入口和 P47–P50。**未另起缓存 Chromium 跑完整 P1–P50**：本轮遵照用户要求直接使用 Browser。补验覆盖见下表；未将新增脚本或源回归等同于完整 Browser 通过。

### 直接 Browser 补验

活动冷返回和招募搜索补丁再次执行完整 `npm run gate:source`，**116/116 通过**（运行时 HEAD `88224982` 加这两个补丁）；source-only 汇总回归 196.0 秒、`build:check` 27.0 秒、当前构建审计 2.0 秒。该次构建后重新生成并核验 1,213 个真实外壳通过。日志 `.analysis/deep-links/gate-source-followup.log`；报告列出的两份文档是执行期间手工编辑，并非 gate 生成，只有 `config/resource-audit.json` 是需恢复的构建输出。

仍为 5240 的地址线工作树，桌面 1280×900；每条检查实际主体内容及地址，tab 4 的 error/warn 另读记录。

| 旅程 | 已观察到的结果 |
|---|---|
| P1–P5 | 偶像目录 → 天濑冬马 → 页面返回、Browser 后退/前进、详情刷新、旧 query 改写；目标内容加载 |
| P6–P8、P14 | 偶像关联卡片、Jupiter → 成员 → 返回组合来源与目录；旧 W 链接改写且标题正确 |
| P16–P19 | SSR 冷开标题和实际卡名；冷返回偶像范围卡片；SSR 范围 → 详情 → 返回及历史；旧普通卡链接规范化且单次后退回关于页。未采样加载过程瞬时标题、未读到 history.length |
| P20–P24 | 歌曲冷开/冷返回；分轨筛选与详情/历史返回；偶像 → 歌曲 → 刷新 → 回偶像；旧歌曲链接规范化。旧 query 的 parent=unit_detail 不是歌曲身份参数，未将额外冷返回称为保留该来源 |
| P25–P30 | THEATER/CARNIVAL 冷开；活动筛选/详情/历史；组合 → 活动 → 刷新 → 返回。冷旧链接 parent=unit_detail/card_detail 两类修后均返回实际归属内容并写 `/units/01jup/` 或 `/cards/001tom_n01/` |
| P31–P36 | 活动 → 实际剧情播放器（对话/场景加载）→ 活动 → 组合；首发和复刻活动与歌曲双向；Growing Smiles！解锁章节；歌曲/活动互转刷新后保留来源 |
| P37 | Reader 实际译文 → 播放本段 → 刷新播放器；默认不带 reading_rev；显式当前 SHA-256 revision 仍留在 Reader URL |
| P38–P40 | 招募冷开与冷返回、票券旧链接；类型 growing_fes + 顶部搜索 FES → 4 个结果 → 光彩的肖像详情 → 返回保留两个条件；搜索 FES 冷刷新仍在。该旅程促成补 `gashas.q` |
| P42–P43、P45 部分 | 皮埃尔事务所和通信冷开、旧 query 改写并加载真实台词/聊天/电话；电话模式保留。通信下拉切换天濑冬马并冷刷新，路径和标题均跟随；尚未覆盖 P45 担当侧栏入口前半段 |
| P13 手机补验 | 390×844 的偶像目录 → 天濑冬马 → 页面返回 → Browser 两次后退，目标内容和地址一致；详情 documentElement 宽度与 scrollWidth 均为 390；截图在对话中展示，非真机 |

tab 4 的控制台复核没有 error，但有 Pixi Spine `update`/`tint` 的既有 deprecation 栈警告；不将其写成整个补验过程零 warning。fix 工作树变异期间，仍打开的 tab 5 收到了有意恢复缺陷的 HMR，产生 `techCount` 错误及后续 Vue 错误；这是受控变异证据，最终修复另用干净标签页复核。

### 后续偏好与异常路径补验（提交 82adc192）

会话续接时旧 5240/5242 进程已不存在；确认端口未监听后，仅重新启动地址线 5240（PID 13696，当前工作树、相同候选 release）。新 Browser tab 3 补验：

- P10/P46：`/office/010PIE/`、`/mobile/`、`/idols/xyz/` 正常回到门户；设置担当 002sht 后裸入口及缺失通信身份地址同为 `/?view=portal&portal_scope=002sht`。事务所启动偏好下 `/office/xyz/` 则打开翔太事务所，实际人物控件及台词加载。
- P11：事务所启动偏好下，显式 `/idols/001tom/` 仍加载冬马资料并保持路径。
- P44：侧栏事务所打开 `/office/002sht/`，标题正确，Browser 后退回 `/idols/`。
- P45：侧栏通信打开 `/mobile/002sht/?unit=01jup`，下拉改冬马并冷刷新后为 `/mobile/001tom/?unit=01jup`，实际个人聊天和标题匹配。
- P15：W、冬马实体标题正确；明确进入冬马个人剧情页后回到通用站点标题，主体两话剧情已加载。脚本原来选首个关联域（如今是已发布路径的卡片目录）再等根 query，已改为明确选择 `idol-domain:001tom:stories`；保持原本“未发布路径页回通用标题”的检查目的。未声称采样到了加载全程标题。

本轮 tab 3 error 日志为空。临时担当、事务所默认偶像、启动偏好均通过设置界面恢复到验收前的“无担当 / 打开时选择 / 资料馆”。配置未导出或重置。P15 脚本做语法检查及对应直接 Browser 旅程，不为仅测试选择器/文档改动重跑应用构建。

尚未形成完整矩阵：P9/P19/P50 数值 history、P12 完整同源请求清单/失败状态及 P16 加载全程标题采样仍未被当前 Browser 能力证明。集成 P48 等独立修复合入；已完成的宽度模拟不等于真机验收。

## 尚未完成与范围

- P48 既有组件错误已获用户授权独立修复：`3142c10e` / [PR #122](https://github.com/windmet/GS_Archive/pull/122)。fix 工作树 5242 的真实 SFC 回归、build:check 与 Browser 冷开/筛选/详情返回/刷新均通过，详见该 PR 记录。组件修复未合入地址线，集成 P48 仍待其合入。
- R1 保持可审阅状态；不自行合并。R2、R3、R4 未动，分别遵守交接前置条件。
- 没有 R2 上传、read-model 绑定、正式/测试站部署、sitemap/noindex/origin 决定，也未创建 public 全库副本。
- 本批产生的代码构建只复用当前 checkout `.analysis/build-check`，`copyPublicDir:false`。日志、审计与变异证据在 `.analysis/deep-links/`；生成的 `config/resource-audit.json` 不提交。
