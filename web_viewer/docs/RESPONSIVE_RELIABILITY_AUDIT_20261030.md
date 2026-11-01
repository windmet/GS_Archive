# GS Archive Responsive Reliability Audit — 2026-10-30

## 结论与证据边界

审计基线 `c5efb7a0`（最新 origin/master，含 #150），分支 `portal/20261030-responsive-audit`。没有修改正式 UI / CSS、正式数据或 read-model；没有部署。发现两项实际布局缺陷和一项移动平台风险。**本报告不是全站响应式通过证书**：基础路由已采集，完整交互、全组件 worst-case 和物理设备覆盖尚未完成。未执行的项目明确列在后文，不以几何采集的零结果冒充通过。

服务 `http://127.0.0.1:5198`，独立工作树 `C:/Users/windm/.codex/worktrees/responsive-audit-20261030/SideM_Archived/web_viewer`；node_modules 联接主仓。启动日志确认 candidate `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b`，release `bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f`；public fallback 为 E 盘主 checkout。仅源码工作树位于 C，所有截图和测量写在 E 盘；未构建/复制完整媒体包。

证据根：`E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/`。`measurements.json` 为基础采集；`complex/measurements-extra.json` 为十档复杂页面；`boundaries/` 与 `heights/` 为边界样本。每个记录有 URL、标题、可见内容摘要、溢出候选、裁切候选、输入字号、fixed/sticky 元素和损坏图片；同名 PNG 是实际页面截图。

## 1. 工程集成核实

Git fetch 与 GitHub PR 元数据均核实：

| PR | 合入 master 的 merge commit | 状态 |
|---|---|---|
| #140 | 0c48e0ac | merged |
| #146 | 6e9ba24d | merged |
| #147 | 3c7eb354 | merged |
| #148 | 26bec121 | merged |
| #142 | 70562326 | merged |
| #144 | e40516a7 | merged |
| #141 | 97beba48 | merged |
| #145 | df88e6be | merged |
| #143 | e02e6bd3 | merged |
| #149 | e93a1b71 | merged，谱面一屏与 LIVE 返回 |
| #150 | c5efb7a0 | merged，歌曲版本面板与播放控制台 |

另用 `gh pr list --state all --limit 80` 核对近期 portal PR 列表。没有把开放分支里的 CSS 混入审计。用户最初 checkout 是旧 `portal/20261025-costume-filters` 且有其他未提交文件，保持原样。

`CURRENT_STATE.md` 与 `PORTAL_REDESIGN_PROGRESS_20261027.md` 已落后：后者基线仍记 `71012ebf/97b1a1ae`，仍称歌曲旧播放器与 Center select 未完成、活动日期表、组合四项事实条；实际 #140、#145、#148、#150 已替换这些结构。Reader/真机缺口仍不能因 PR merged 自动划掉。报告依据实际代码，不修改历史状态文档。

## 2. 路由与公共组件覆盖

复用 #148 `verify-box-on-line-browser.mjs` 的原 30 路由，未重新发明清单。下表每个基础路由采集 320×720、390×844、1280×688；是静态入口采集，不等于所有操作状态通过。

| 类型 | #148 路由 ID | 入口 / 主要组件 | 本轮范围 |
|---|---|---|---|
| 外壳、首页 | portal | `/?view=portal&portal_scope=all`；ArchiveShell / ArchivePortalOverview / ArchiveDirectoryGrid | 三档；Browser 320 导航抽屉打开 |
| 活动详情 | event, event-orig | `/events/10020/`, `/events/410002/`；ArchiveEventDetail | 三档；另 `/events/410001/` Browser 阅读入口 |
| LIVE | live | `/live/` | 三档＋十档复杂矩阵 |
| 歌曲详情 | song | `/songs/brndnf/`；ArchiveSongVersionPanel / ArchiveSongAuditionConsole | 三档＋十档静态入口；播放/编成完整状态 Pending |
| 卡面、偶像 | card, idol | `/cards/001tom_ssr01/`, `/idols/001tom/` | 三档 |
| 组合详情 | unit-jup, unit-fra | `/units/01jup/`, `/units/06fra/` | 三档 |
| 主目录 | units,idols,cards,songs | 对应同名路径 | 三档 |
| 剧情 | stories,stories-event,story-main | `/stories/`, `/stories/event/`, `/stories/main/101/` | 三档 |
| 活动/卡池 | events,gashas,gasha | `/events/`, `/gashas/`；卡池详情经 data-archive-focus-id 点击 | 三档；弹层全部状态 Pending |
| 图鉴 | items,costumes,honors,currencies,photos,unused | 对应同名路径 | 三档；实体抽屉 Pending |
| 通信 | mobile | `/mobile/001tom/` | 三档；全部电话/聊天状态 Pending |
| 摄影入口 | studio | `/studio/` | 三档 |
| 其他 | about,scores | `/about/`, `/scores/` | 三档 |
| 谱面 | chart | `/live/` 点击首个谱面入口 | 三档＋十档；长轨与所有设置状态 Pending |
| Reader（补充） | reader | `/?view=reader&reading=1_3_10001_01_a&event=410001`；ArchiveStoryReader / ReaderWorkspaceControls | 十档采集；Browser 320 真正文与播放入口 |
| Player（补充） | player | Reader 点击「播放完整剧情」，含 reading/scenario/start_step/end_step/return | 十档初始入口（含方向提示）；Browser 320 继续当前方向后播放控制 |
| 摄影工作台（补充） | studio-edit | `/studio/edit/`；PictureStudio / picture-studio.css | 十档＋关键边界；Browser 空结果搜索 |
| 舞台（补充） | stage | `/?view=chibi_stage`；ChibiStageViewer / GsFilterMenu | Browser 320 轻量加载、编队、衣装弹层；全矩阵 Pending |

## 3. 设备与断点矩阵

- 基础全部 30 路由：320×720 / 390×844 / 1280×688，共 90 次采集。
- LIVE、歌曲、Reader、Player 初始入口、摄影工作台、谱面：320×720、360×800、390×844、430×932、768×1024、1024×768、1280×688、1366×768、1440×900、1920×1080。
- 活动/摄影：719/720/721×660，759/760/761×720，1098/1099/1100×500；1280×880。
- 活动/摄影：320×500/660/720/880，399/400/401×720，1099×599/600/601。
- 提取实际源码全部 259 条 @media（包括重复规则）见证据根 `breakpoints.json`。它是源代码索引，不能视为全部边界已测。摄影关键条件：1099、719、599/600；外壳 760 和高度 720/880。其余全部断点 ±1、200% 缩放 Pending。
- Chromium 自动化为本机缓存 headless shell；交互人工核实使用现有 Browser/IAB。WebKit 未运行。

## 4. P0–P3 问题

本轮未确认 P0。以下 P1/P2 为实际截图复现；P3 为源码与计算样式风险，物理设备尚未复现。

| ID / 级别 | 页面、视口、状态 | 实际问题 / 复现 | 代码 / 根因 | 建议（尚未实施） |
|---|---|---|---|---|
| RR-01 P1 Serious | `/events/410001/`，320×720，默认中文详情 | 冷进入；顶栏长标题 `GROWING SIGN@L -Not Alone-` 延伸进中/日语言控件。Browser 实测 h1 x=53.99..292.18，语言控件 x=261.36..310.46，横向交叠约30.8px | `src/components/archive/ArchiveShell.vue:498` flex-direction:column + align-items:flex-start；`:599` 只限制 heading min-width，`:603` h1 的 ellipsis 没把子项宽度限制在标题列 | 在公共 heading/h1 收缩边界补 max-inline-size/局部 stretch；保留字号、单行、省略策略和原控件布局。先测所有详情顶栏，避免逐页补丁 |
| RR-02 P2 Minor | `/studio/edit/`，320×720，未选择图层 | 冷进入；画布下「未选择图层 / 点选画面中的对象」挤成极窄多行，穿出44px操作条。操作图标仍可见；320×500亦有裁切候选 | `src/styles/picture-studio.css:104`–`:113`：5个固定触控按钮占220px，gap与左右padding后，flex:1 的名字按钮剩余空间过小；small 允许无限换行而父按钮固定高；`PictureStudio.vue:118` | 局部重排所选对象说明与操作按钮、为说明建立明确行/宽度约束；不能缩小触控区或删除必要信息 |
| RR-03 P3 Fragile | `/studio/edit/`，320×720，搜索地点聚焦 | Browser 计算 input font-size=13px；输入无匹配关键词后有「没有匹配的地点」，但 iOS 自动缩放风险无法用桌面证实 | `src/styles/picture-studio.css:27` 使用 --gs-text-ui；`:67` 搜索输入继承；`:189` 数字输入也是较小字号 | 评估仅 coarse pointer 输入达到16px的局部处理；禁止关闭用户缩放。iOS Safari 软键盘/缩放需物理设备验收 |

截图：

- RR-01 精确路由证据：[320px 活动详情](E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/exact/320x720-event-long.png)。矩形数据见正文 Browser 实测。
- RR-02：[320px 摄影](E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/complex/320x720-studio-edit.png)，[短窗口摄影](E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/heights/320x500-studio-edit.png)。
- RR-03 13px 计算字号由 Browser DOM 读取；真实 iOS 缩放截图 Pending。

## 5. 自动检测解释与 Source Gate 建议

新增 `scripts/verify-layout-integrity-browser.mjs` 复用现有 Chromium/CDP 启动方式及 #148 路由。支持 --base、--full、--only、--windows、--output；不更改业务 CSS，不更新历史截图基线。仅允许 overflow-x:auto/scroll 容器内的横向内容作为几何例外。人物幕/故事封面有意裁切以及 visually-hidden 无障碍文本需人工分类，不能一律记为布局错误。

当前工具是**候选采集器**，不是已经覆盖十二项要求的严格 Gate。已采集根水平溢出、视口越界、部分控件横向裁切、输入字号、固定/粘性定位清单和损坏图片。尚未实现可靠的任意父容器裁切、通用重叠、图片比例、滚动到底、焦点遮挡、软键盘及 CLS 断言。首屏等待为固定采样时间，慢加载可能落入中间状态；必须结合 bodyText/截图审阅，不能将这种情况判为 PASS。

建议 Source Gate：先将 route identity + 业务 ready selector + 根水平溢出 + 标题/语言控件交叠加入严格断言，按组件声明 gallery/tab/chart 横滚例外；随后加入真实 scroll container 到底和 focus-visible 的遮挡检查。图片加载布局跳动使用 PerformanceObserver 分离用户输入引发的变化；软键盘留真机门禁。对每条断言做缺失 min-width:0 / 恢复固定宽度的变异验证后再纳入必过项。

## 6. Worst-case 数据与已保持的行为

`script/fixtures` 的实际路径为 `scripts/fixtures/responsive-real-extremes.json`：从本轮候选全部 JSON 提取36类 name/title 字段的前5个最长样本，每条含 source 和 JSON pointer。例：`アンコールスターV付き！Chocolate Night ～魅惑のバレンタインナイト～ガシャ10回チケット`，最长偶像 `アスラン＝ベルゼビュートⅡ世`；这些是实际数据，不是重复字符。提取是按字段名分组，未声称已对所有业务实体分别达到最大值。

开发专用入口 `http://127.0.0.1:5198/scripts/qa/responsive.html?data=Worst%20case`：直接给现有 ArchiveIdolReference 传 bootstrap 数据，Demo / Worst case / Empty / One / Dense 五状态；缺图采用空 imageCandidates，走组件原有回退。Browser 已验证切换及49条 Dense。该 HTML 不在 public、不被生产入口引用，脚本内有 import.meta.env.DEV 检查；没有改正式 read-model。仍缺每类主要页面完整 fixture、缺译文/可选字段、多版本、多出演者的单独边界注入，列为审计待补，不声称五状态覆盖全站。

已实际保持：320导航抽屉的全部栏目可见；Reader 译文正文和 EP 控件可读，阅读到 Player 路径可达；Player 当前方向选择及播放控制可见；摄影空搜索结果有明确反馈；人物引用无图回退和真实长日文名未破坏行布局。三档基础采集未检测到根 document 水平溢出；这不排除内部 overflow:hidden 裁切（RR-02正是反例）。

| Before（现有设计） | After（本轮交付） | Why |
|---|---|---|
| 纸面/墨色/薄荷、原字体字号、无框控件与身份色 | 正式 UI 完全保持；只添加 QA 入口与脚本 | 本轮只审计，修复待确认；不引入视觉改版 |

## 7. Pending 清单与推荐顺序

1. 先修复公共 ArchiveShell 标题收缩（RR-01），再修摄影操作条（RR-02）；正常数据和极端数据同时回归。
2. 扩充各页面类型真实 fixture 与字段来源表；不能以人物组件 fixture 代替歌曲/活动/Reader/舞台/摄影全部边界。
3. 补所有弹层/抽屉、搜索组合、五人编成、歌词/播放、长轨、摄影已选图层和完整滚动末尾；补200%与全部必要断点边界。当前复杂矩阵是初始静态状态，不是所有模式。
4. iOS Safari：首进、冷刷、内部跳转、输入聚焦缩放、软键盘、浏览器栏展开/收起、底部安全区、触摸 hover、横竖屏，全部 Pending。
5. Android Edge/Chrome：同上，尤其键盘与画布/面板手势，全部 Pending。
6. 物理平板横竖屏与 trackpad/touch 混合输入 Pending；WebKit Pending。
7. 未对全站所有滚动容器、焦点遮挡与 CLS 作穷尽验证；未声称全站通过。修复 PR 必须独立建立，本轮停止在审计交付。

验证仅独立工具语法检查、Browser实际交互、截图/几何采集与 git diff --check；未跑前端 build（未变更生产前端依赖或接线），未运行完整 Source Gate，未发布。
