# 深链接主干集成与组合章节定位修复

日期：2026-10-29。输入 master `7c7312c1`（含 #118/#119/#120/#125）。分支 `portal/20261029-deep-links-integration`，专用 LF 工作树 `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`。主 checkout 的已有修改未动。

## 问题与修复

Browser 从 Jupiter 详情点击“始動、Jupiter！ 查看剧情”，实际进入 `/stories/unit_story/1/`，默认展开第1话，而非所选第2话。`useUnitNavigation.js` 的 `openUnitStory()` 已传合集和来源，但漏传已有的 `story.file`。修复只补 `storyFile: story.file || ''` 给现有 `openProjectedCollection()`；不改模板、样式、加载流程、StoryOwner 或读模型。

回归通过 App 的真实工厂绑定调用导航函数，核对所选故事文件和无章节的合集总入口。删除新增参数的变异被拒绝，日志保留于 `.analysis/deep-links-integration/unit-chapter-mutation.log`，随后恢复正向通过。

## 直接 Browser 证据

Codex In-app Browser，localhost:5240，Node PID 8684，明确进程参数 `node_modules/vite/bin/vite.js --configLoader native --port 5240 --strictPort`。此前端口无监听，本轮在上述专用工作树恢复服务。候选 `rm-release-20261022`，受跟踪 bootstrap release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。采用桌面 1280×900 与手机视口 390×844，临时视口已恢复。以下是 dev 渲染证据，不是设备或生产包验收。

| 编号 | 观察 |
|---|---|
| P67 | 冷开 `/songs/?idol=001tom&song_scope=movie`，冬马统计 4/1/0/0，仅 Inner Dignity；进入详情，再页面返回恢复完整筛选地址与结果 |
| P68 | 歌曲关联活动 → `/events/410011/`，实际日期、11话、报酬卡加载；活动面包屑 → `/events/`，浏览器后退回相同活动主体 |
| P69 | 活动 Jupiter → `/units/01jup/`；修复前点击第2话落合集无 story 且第1话展开，明确作为失败证据 |
| P70 | 修复后桌面点击第2话，地址 `/stories/unit_story/1/?story=1_1_001jup_02_1_1_001_02.json`，冷刷新第2话 aria-expanded=true、简介与 EP 列表加载；页面返回 `/units/01jup/` |
| P71 | 390px 点击第3话，地址包含 `1_1_001jup_03_1_1_001_03.json`，冷刷新仍展开第3话，页面返回组合；点击“阅读 Jupiter 的组合前传”进入无 story 的合集并默认展开第1话 |
| P72 | 手机组合 → 冬马偶像资料 → 卡片，保留 `idol=001tom`；筛选 SSR → `/cards/001tom_ssr01/` → 下一张 `/cards/001tom_ssr02/`，实际标题更新，页面返回恢复 `/cards/?idol=001tom&rarity=SSR` |
| P73 | 手机卡片筛选对话框打开后 Escape，待关闭动画结束实际消失，SSR/偶像筛选地址保持 |

P70/P71 截图已在本任务直接展示。测试 tab 的 error/warn 日志为空。一次 P70 前测试误等第2话地址超时暴露了 P69；P71 初次定位器沿用桌面统计文字，手机隐藏统计导致超时，按手机实际名称复验通过。不把过渡状态或定位器失败当成成功。手机“搜索目录”点击未观察到展开，本轮不据此认定搜索或 #101 搜索 Escape 已通过；该专项仍待门户验收。

## 源验证与边界

- 路径、archive routes、route schema 和全部 1,394 条 StoryOwner 往返回归通过。
- `verify-unit-readmodel-navigation.mjs` 正向与移除参数的变异检查通过。
- 修复后 `npm run build:check` 通过（15.31秒），输出复用 `.analysis/build-check`，没有 public 复制；早先输入 master 的集成编译为19.35秒。
- 完整 `npm run gate:source` **116/116 通过**（输入 HEAD/base `7c7312c1` 加本修复，运行期间仅补执行文档）；日志复用 `.analysis/deep-links-integration/gate.log`。本机首次调用 bash 被解析为 WSL，在第三步启动停留；停止该次门禁进程后，仅在命令 PATH 前置 Git Bash 重跑，未修改仓库工具配置。

本轮是地址来源和章节选择的集成修复，未完成 P6 所有详情页的桌面/手机整页视觉矩阵，未新增 Android Edge、iOS Safari、Player、Reader、媒体播放或 Cloudflare 冷启动证据。R1 已记录的本地技能海报资源缺口仍保留，console 空不等于全网请求成功。R3/R4 的门户结构、语料晋升和 D3/D4 技术前置继续生效；未部署、未上传 R2、未改变 read-model 绑定。PR #126 是独立的门户状态文档，本轮没有接管或合并它。
