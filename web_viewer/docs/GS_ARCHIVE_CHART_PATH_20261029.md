# R3 谱面路径执行记录

日期：2026-10-29。输入 master `78d4b58c`，已含 P3 #127（`2319d31e`）、P6 #128、舞台 logo #130；分支 `portal/20261029-chart-path`。复用干净的专用 LF worktree `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`，从最新 master 开分支，保留前序小型证据、不复制语料。主 checkout 未动。

## 开工条件与改动

#127 已合入，满足 [交接 §10.3](GS_ARCHIVE_HANDOFF_20261028_DEEP_LINKS.md#103-r3--r4-开工条件) 的谱面前置。本批仅做 R3 谱面，不把 #130 的组合 logo 格当成整个 P4 完成，也不提前实现其他 R3/R4。

- `publicRoutes.js` 增加 `/songs/<六位 song_code>/chart/`，与歌曲详情共用歌曲身份规则。旧 query 优先、无尾斜杠、非法路径回退沿用既有 locator。
- 先核对实际 chart 页面 props 与导航，再把 chart_lab 加入强制裁剪；schema 只拥有 song。song_scope 是目录筛选，来源帧走现有版本化 history；不新增历史版本，不改加载、换曲 replace 或返回逻辑。
- 应用依旧不读写难度参数：歌曲详情的难度入口仅为本次初始值，刷新/换曲默认第一难度。无歌曲选择器保留 `/?view=chart_lab`。
- App 只改标题 helper import（:619）和 archiveTabEntityName 的 chart_lab 分支（:1486）。共享标题为“曲名 · 谱面 · GROWING STARS 资料馆”；待歌曲数据时保留已有标题，无歌曲工具显示“谱面预览”。不改模板、样式、面包屑或 loader。
- head 生成器从同一注册表生成谱面路径，并与运行时共用标题 helper。现有 61 首已发布歌曲与 chart manifest 的61首完全相同（含版本），新增61个外壳：1,401 → **1,462**。目录根数量仍24。

## 直接 Browser P74–P83

Codex In-app Browser，localhost:5240，PID8684，进程命令与前轮一致、实际 publicRoutes HTTP 模块已含 chart locator；来源为本专用工作树。候选 rm-release-20261022，bootstrap release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。桌面1280×900、手机视口390×844；临时视口验收后恢复。以下均为 dev证据。

| 编号 | 实际结果 |
|---|---|
| P74 | 独立冷开 `/songs/brndnf/chart/`，BRAND NEW FIELD 标题、EASY Lv8、123 Combo、透视轨道与真实2:10时间轴加载 |
| P75 | 切 EXPERT Lv25 地址不变；冷刷新回 EASY，符合 #116 难度不入地址决定 |
| P76 | 工具切到 Take a StuMp!02，地址 `/songs/tkstp2/chart/`，版本标题、EASY Lv8与111 Combo加载；无来源时关闭回 `/songs/tkstp2/` |
| P77 | 歌曲详情“打开 EXPERT 谱面，Lv25，587 Combo”进入 brndnf/chart，EXPERT选中，URL无难度；冷刷新保留来源、回EASY |
| P78 | 390px 新路径真实画布与“观看/声音/演示”标签加载，点击声音仅显示声音组，地址不变；截图已直接展示 |
| P79 | 有来源的工具切 Inner Dignity → `/songs/inndgn/chart/` →冷刷新→返回来源页，实际回最初 `/songs/brndnf/`，不是当前曲目或目录 |
| P80 | 无歌曲 `/?view=chart_lab` 保持query，标题“谱面预览”，选择器61首实际加载，返回 LIVE |
| P81 | LIVE进入工具，选择DRIVE A LIVE，再换BRAND NEW FIELD，地址分别drvalv/chart、brndnf/chart；浏览器后退直接回 `/live/`，证明换曲未逐次堆叠记录 |
| P82 | 旧 `?view=chart_lab&song=brndnf&song_scope=movie&idol=001tom` 自动改写成纯brndnf/chart路径；最终error/warn日志为空 |
| P83 | 8个变异恢复后独立新标签冷开brndnf/chart，桌面真实透视画布、EASY123 Combo与共享标题匹配，error/warn为空 |

P77第一次定位器把实际587 Combo误写成503，读取DOM后纠正；不将该超时计作页面缺陷或成功。手工附加未知 `difficulty=4` 时，writeArchiveRoute按全站已有规则保留未知参数；应用不读它，仍选EASY，也不会因正常难度选择而生成它。参数裁剪针对已注册路由参数，不借本批改变未知调试参数合同。

## 源检查与证据边界

- 路径回归覆盖全部61曲、旧query与query优先、无歌曲入口、非法多段、已知越权裁剪、独立分享无来源、换曲replace和history来源读取。
- schema、歌曲导航真实App绑定、1,176个导航投影/URL用例通过。标题检查执行App实际computed回调，覆盖已选曲/加载中/无歌曲工具，避免仅证明纯helper。
- `build:check` 通过，25.28秒；复用 `.analysis/build-check`，没有public复制。候选外壳重新生成与 `verify-entity-head-shells --dist` 核对1,462个通过，title/canonical/OG/body保持合同。
- 完整 `npm run gate:source` **116/116通过**（输入HEAD/base `78d4b58c` 加本批patch；运行期间补验收文档、标题computed断言与歌曲pattern共用常量，最终编译及汇总已覆盖）。8个生产代码变异均拒绝并恢复：路径字面量、歌曲身份pattern、强制schema集合、query泄漏、分享来源清理、标题后缀、App标题接线、外壳种类。UTF-8日志已重新完整记录，恢复后的正向路径/schema/head检查通过，最终门禁构建重新生成1,462外壳并通过dist核验。日志复用 `.analysis/chart-path/`。首轮变异日志工具遇默认GBK解码错误，finally已恢复源码，不能把日志错误作为拒绝变异的证据。

本批不宣称加载全过程标题、数值history.length、全网请求或真机等价；直接Browser后退证明的是上述具体旅程。无新增音频播放、原机、Android Edge、iOS Safari或Cloudflare冷启动证据；没有部署、R2上传或read-model绑定变更。routes台账只增本批证据，parity/device状态保持。其他R3/R4继续遵守页面结构、语料和D3/D4前置。
