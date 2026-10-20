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
