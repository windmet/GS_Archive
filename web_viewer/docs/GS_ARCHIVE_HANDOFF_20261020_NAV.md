# 导航命名与手机导航改造交接（2026-10-20 夜）

接手 `portal/20261020-nav-naming` 先读本页。现状盘点在 `web_viewer/.analysis/nav-naming-20261020/NAV_NAMING.md`（本地分析目录，不入库；含 19 张截图）。方案来源是用户与外部工具的讨论稿 v2，本页只记**已定结论**和**与代码核对后的修正**。

## 已定结论（用户确认）

| 项 | 决定 |
|---|---|
| 品牌 | 守住 GROWING STARS 边界：中文主名「GS 资料馆」，英文「GS Archive」；`SideM 资料馆`/`SideM Archive` 退役；「315 事务所」只留在引导欢迎语 |
| 沉浸页 `view=home` | 叫 **事务所**（侧栏、底栏、设置、担当主卡「去事务所」） |
| 门户 `view=portal` | 叫 **资料馆**；桌面侧栏补一个显式「资料馆」项（品牌点击仍回门户） |
| 页标题 | 全员去后缀：导航叫什么，h1、面包屑就叫什么（剧情、通信、偶像、组合、卡片、歌曲、活动、卡池、道具…其他语音） |
| 分组 | 「故事」→「剧情与通信」；「收藏」→「图鉴」 |
| 剧情子类 | 个人剧情（替换 个人故事/偶像个人剧情）、工作剧情（替换 工作档案；门户窄按钮可缩「工作」）、社区剧情（导航与面包屑统一） |
| `card_scenarios` | 统一叫「电话通信」——它就是通信 › 电话通信的同一批 342 条，不造新词 |
| 浏览器标签 | 保持 `{名称} · GS Archive`（`presentation/ArchiveDocumentTitle.js`，与 `scripts/generate-entity-head-shells.mjs` 同源，有 verifier）；只改 `SECTION_TITLES` 两处：故事→剧情、其他语音存档→其他语音，生成器同步 |
| 手机底栏 | 外框（高度、贴底、背景）不动，27 处底部留白不改；内部改 2+1：`事务所 | 资料馆 | [第三格]`。第三格在 home/portal 显示「导航」，在其他栏目显示当前栏目图标+名称并高亮（资料馆此时不高亮），抽屉打开时显示「收起」 |
| 全站导航抽屉 | 由第三格打开；内容 1:1 复用门户现有 `destinations`（不写第二份数据、不单独加「组合」）；懒加载；**不做**边缘把手和滑动手势 |
| 手机门户 | 担当视角下把担当主卡挪到 15 格目录上方（手机断点调顺序）；全站视角不变 |
| 启动 JS 预算 | 可以上调；先做完再看，再考虑桌面侧优化回收，不因硬限制砍功能 |

## 与代码核对后的修正（别按讨论稿做）

- **两个首页本来就能分享**（浏览器实测）：门户 `/?view=portal[&portal_scope=…]`，事务所 `/?view=home&home_idol=…&home_cue=…&home_costume=…`；只有裸 `/` 按偏好分流（`archiveStartup.js` 的 `isBareArchiveEntry`）。
- **不要动 `archiveRoute.js:195/205`**：195 是 `ownsArchiveSource`（返回栈来源帧），205 是 `readPortalReturnRoute` 的防递归（注释：*so a shared portal URL cannot recurse*）。
- 唯一缺口：按默认视角进门户时地址不写 `portal_scope`，别人打开落到他自己的默认视角 → 改成总写。
- `/office/<idol>/`、`/mobile/` 这类路径要走静态路由流程（`routeSchema.js` 的 `ENFORCED_ROUTE_VIEWS`、`SECTION_PATH_ROUTES`/`PUBLIC_PATH_ROUTES`、head shell 生成与 verifier、Pages 路由），排在最后，非必需。
- App.vue 的 `archiveTitle` 只喂顶栏 h1 和面包屑末项，不是浏览器标签。

## 施工顺序

1. **文案批 + 单一字典**：在 `core/` 收敛 `{ id, label, shortLabel, icon, groupId }`，侧栏（`archiveNavigationGroups.js`）、`ARCHIVE_NAVIGATION`、面包屑（`archiveRoute.js` ~560–620）、`App.vue` `archiveTitle`、门户 `ArchivePortalPresentation.js`、引导/设置文案都从它读；同时改品牌、去后缀、图鉴、剧情子类、电话通信；`unused` 补图标（现在 `archiveNavigationIcons` 里缺，门户目录格回退成 `ChevronRight`）；摄影工作台面包屑挂根级；`portal_scope` 总写。做完用 `npm run build:check` 量启动 chunk 差值并记录。
2. **桌面侧栏**：加「资料馆」项、分组改名、同组页面快捷切换（剧情|通信、偶像|组合|卡片、活动|卡池），复用侧栏现有二级项数据。
3. **手机**：2+1 底栏、懒加载抽屉、门户顺序；验收 320/390 宽、横屏图标栏、阅读器/LIVE/摄影工作台（这些本来隐藏底栏）。
4. （可选）静态路径。

## 注意

- 改名会碰到的 verifier：head shell（`verify-entity-head-shells.mjs`）、面包屑/路由相关测试；先跑基线再改，见记忆里的 verifier baseline 做法。
- 预算门禁数字在 CI 里，上调要单独一个提交写明原因和新值。
- 舞台线（`stage/20261020-native-followup`）在另一个窗口推进；它合 master 时会带上 #60，启动 JS 合计约 204,777 / 204,800。

## 进度（2026-10-20 深夜）

- 1–3 已完成：`787f7c05` 字典与文案、`379ec5cf` 预算 204,800→215,040、`6996eb8f` 桌面侧栏、`739f3ab7` 手机 2+1 / 懒加载抽屉 / 门户顺序、`b4c5c20f` 视觉二轮。
- 视觉二轮按设计反馈：抽屉去掉 7 个组标题，改成「核心 8 项 4×2 · 一条细线 · 图鉴与工具 7 项 + 关于本站 4×2」，两段仍由侧栏分组切出（`SECONDARY_GROUPS`）；底栏第三格改为横向胶囊 + 箭头（▴ / 收起时 ▾），指向当前栏目时薄荷底，列宽 1:1:1.5 让四字栏目名在 320 宽不截断。
- 启动 JS 205,935 B（≤ 215,040）；抽屉是独立 chunk。验收截图：320/390 门户与抽屉、横屏图标栏、LIVE 落地页、摄影工作台（底栏隐藏）、Esc 收起焦点回第三格。
- 第 4 步静态路径：见文末「第 4 步：静态路径」。

- 三轮（同日）：底栏胶囊造成左右不均衡，回到三等分（`6e13818d`），第三格与两侧同为上图下文，只在标签旁挂一个 ▴/▾ 小箭头。
- 抽屉按讨论稿 v3 的分层改为三段：核心 4×2 大图标 · 图鉴 3×2 左图右文 · 工具条「摄影工作台 · 回到页顶 · 关于本站」（维护者模式多「资源」时 2×2）。「回到页顶」滚动 `[data-archive-scroll-container]` 并收起抽屉，已在页顶时置灰；「回到主页」即底栏的事务所/资料馆两格。讨论稿里的悬浮胶囊坞、右侧边界把手、滚动让位、抽屉内搜索与视角切换、收起门户 15 格、`卡面电话`、`· GS 资料馆` 标签格式均按已定结论不做。

- 四轮（同日，参考外部视觉评审并按真实功能落地）：LIVE 与摄影工作台是播放器/编辑器而非资料列表，抽屉里改为两张工具卡（色底图标 + 名称 + 一行说明），说明写在字典 `blurb`：LIVE「谱面 · 2D舞台」（落地页即谱面预览与 2D舞台；评审稿里的「3D」不符）、摄影工作台「图层拼贴」。读者侧原本没有 Beta/实验标记，不新造。核心目录 7 项留 1 格空位（评审稿同样接受）；「回到页顶 · 关于本站」改成居中弱灰页脚行；维护者模式的「资源」并入页脚行。

- 五轮（同日，466×986 实测与断点）：实测各块左右边距本来对称（12/12），歪斜来自桌面窄窗的经典滚动条只占右侧——手机断点下 `[data-archive-scroll-container]` 改 `scrollbar-gutter: stable both-edges`（触屏叠加滚动条不占位，不影响真机）；门户手机侧边距 12→16 与其他页一致；容器 641–980 的双栏主卡在 665–760 手机宽会变成「左卡右按钮+下方空洞」，手机断点强制单栏；容器 ≥540 时目录 5 列，15 项正好 3 行。粉色悬浮球是用户自己的翻译插件，不处理。抽屉圆角改用 token（`verify-design-tokens` 之前漏扫）。

- 六轮（同日，再次外部评审「第二段歪」）：根因是图鉴名 2–4 字不等、左对齐裸文字让列线参差。采用评审方案 B 的「填充格」：图鉴 3×2 每项放进 `--gs-paper` 底的格子，列线由格子边缘承担，且与下方工具卡共用抽屉左右外沿。未采用：把服装提到核心（抽屉分层取自侧栏分组，服装在侧栏属图鉴，单一字典不能为抽屉单独改组）；其他语音→语音（`unused` 只收剧情/卡面/事务所以外的语音，叫「语音」会误指全部语音）；核心改 4 列以外的方阵（核心 7 项，组合不单列已定，留 1 格空位是图标网格惯例）。

## 第 4 步：静态路径（2026-10-21，`portal/20261020-nav-static-paths`）

- `/office/<idol>/` 是 `view=home` 的偶像事务所，`/mobile/<idol>/` 是 `view=mobile_archive` 的偶像通信；台词与服装（`home_cue`/`home_costume`）、模式/组合/打开的通话（`mobile_mode`/`unit`/`mobile_scenario`）留在查询里。两者进 `ENFORCED_ROUTE_VIEWS`，不属于页面的字段写地址时被剪掉。
- 没选偶像的事务所仍是 `/?view=home`；`/office/`、`/mobile/` 本身不是栏目根。认不出的路径（`/office/010PIE/`、`/idols/xyz/`）现在按裸 `/` 启动：门户偏好进资料馆，事务所偏好进启动偶像的事务所。以前它们不算裸入口，查询里没有 view 就默认落到事务所选人页（`archiveStartup.js` 的 `isBareArchiveEntry` 改用 `isArchiveLocatorPath`，与读路由同一个 `locatorQuery`）。
- 浏览器标签 `{偶像} · 事务所 · GS Archive` / `{偶像} · 通信 · GS Archive`（`archiveIdolPlaceName`，App 与 head shell 同源）；head shell 每位偶像各一份（事务所只给 `home_available` 的偶像）。
- 预览包的 `_headers` 改为按实际生成的 head shell 目录写 `no-cache`，不再手抄目录名（顺带补上漏掉的 `/unused/*`）。
- 验证：`verify-archive-path-locator`（往返、剪枝、负例、认不出的路径按裸入口启动；五个变异全红）、`verify-entity-head-shells`；浏览器旅程 `verify-portal-path-locator-browser.mjs` 新增 P42–P46：冷开路径与标签、旧链接改写（通信保留 mode）、有担当时侧栏直接进担当的事务所/通信路径并能返回、切换偶像与刷新、认不出的路径按偏好启动。
