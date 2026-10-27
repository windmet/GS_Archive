# 深链接 R1 执行记录

日期：2026-10-28。输入 HEAD：`36743743`（#117），执行分支：`portal/20261028-deep-links`。
工作目录：`E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`，LF 检出。
任务边界与排期见 [交接文档](GS_ARCHIVE_HANDOFF_20261028_DEEP_LINKS.md)。本批只做 R1，R2 等 R1 合入。

## 实现

- R1-1：`publicRoutes.js` 统一 8 类实体/地点与 14 个目录的地址事实；locator、标题和外壳共享注册表。提交 `2778bd9a`。
- R1-2：按页面 props 校正 8 个目录的参数白名单并启用裁剪；目录隐含身份键从注册表派生。清空全部公开地址的裁剪例外，组件新增手写 `?view=` 会触发 guard。
- R1-3：用户确认 D1 推荐命名，新增 `/live/`、`/studio/`、`/about/`、`/status/` 及对应栏目标题和 head 外壳。D2 也已确认方案 A，本批尚未实现剧情路径。
- 保留内部 query 规范、旧 query 优先、未知路径启动偏好、来源 history 及恢复键。无 App、composable、模板、样式或面包屑实现改动。
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

全表在旧审计口径下，emitted 250 → 156、survives 474 → 312（以输入 HEAD 的审计脚本对最终运行时代码重跑）；补正实际 view 与隐含参数的统计口径后为 138 / 298。统计口径校正与运行时裁剪收益分开记录；未审核的剧情/播放器等仍保留后续批次，不把全表当作零泄漏。

## 回归与门禁

已通过：`verify:routes`、`verify:route-schema`、`verify:archive-navigation-state`（含 1,176 view/return/parent 案例）、`verify-collection-route`，活动/摄影目录导航（`--experimental-vm-modules`）、`verify-portal-directory-navigation`（候选根 `rm-release-20261022`），以及外壳纯检查。

验证工具的两处既有问题已修复：

1. 外壳 verifier 原来用整个 HTML 的 `/portal/index.json` 子串判断 Portal 预载；inline bootstrap 也带该 URL，导致真实 `--dist` 误报。现在检查实际预载标签，仍由同一个 `PORTAL_PRELOAD` 规则约束；纯模板及真实 1,209 外壳检查通过。
2. 门户目录 verifier 提取生产 `openDomainCatalog` 函数后未向 VM 注入 `COLLECTION_KINDS`，运行报 ReferenceError。现在注入真实导出，未替换生产函数或降低断言。

`npm run gate:source` **116/116 全通过**（base `36743743`；执行时 HEAD `2778bd9a` 加本批未提交的 R1-2/3；最终代码即本 PR 内容）。其中完整 source-only verifier batch 用时 193.3 秒，`build:check` 用时 25.9 秒，当前构建审计用时 2.0 秒。构建只含代码产物，不含 public 语料，输出复用 `.analysis/build-check`。台账新增记录是本任务主动补充的证据，不是 gate 生成结果；其证据-only diff、`verify:cutover-routes` 与文档链接另行通过检查。第一次调用误选系统 WSL bash，Windows `.git` worktree 路径不能在 WSL 解析；已停止本次 runner 的进程树，以任务进程 PATH 前置 Git Bash 重跑。未改仓库 gate runner 或关闭其他 dev 服务。

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

`verify-portal-path-locator-browser.mjs` 已移植 headless-shell 优先选择、更新 about 路径预期，补 P41 工具入口和 P47–P50。**未另起缓存 Chromium 跑完整 P1–P50**：本轮遵照用户要求直接使用 Browser；P1–P46 全矩阵和 P50 数值 history.length 留待补验。未将新增脚本或源回归等同于完整 Browser 通过。

## 尚未完成与范围

- P48 歌曲目录既有渲染错误交回门户线，已登记到交接 §8；修复合入后重跑 P48 和完整矩阵。
- R1 保持可审阅状态；不自行合并。R2、R3、R4 未动，分别遵守交接前置条件。
- 没有 R2 上传、read-model 绑定、正式/测试站部署、sitemap/noindex/origin 决定，也未创建 public 全库副本。
- 本批产生的代码构建只复用当前 checkout `.analysis/build-check`，`copyPublicDir:false`。日志、审计与变异证据在 `.analysis/deep-links/`；生成的 `config/resource-audit.json` 不提交。
