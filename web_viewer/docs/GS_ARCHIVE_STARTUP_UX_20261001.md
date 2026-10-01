# 资料馆入口与首次引导优化

本批响应 2026-10-01 的优化请求，结合本轮 Browser 黑盒审计与用户提供的 `GS_Archive_UX_Audit_Repair_Guide_584c837.md`。指南是审阅参考，本批按用户指定的并行边界选择入口与选人体验，不修改乐曲、谱面、播放时钟或歌曲详情。

开始检查时 HEAD 为 `223b97253819e755ed1e679b528af4c07140cf23`，分支 `codex/story-interaction-v2-before-b002`。同时进行的歌曲工作继续提交到 `bc78f6e7`、`40d67e7f`；本批没有回退这些提交。最终代码编译基于 `40d67e7f` 加本批未提交改动，审计文件如实记录 `sourceDirty:true`。

## 行为与范围

- 首次从根地址进入仍显示引导。新增明确的“资料馆”选项，与“卡牌首页”“人物互动首页”区分用途。
- 完成任一选择，或点击“先浏览资料馆，下次直接打开”后，本浏览器会记住选择。修复原先跳过设置没有记录 `onboardingComplete`，再次从根地址进入又出现引导的问题。
- 已完成引导且 `homeMode:unset` 的偏好也直接进入资料馆。显式 Reader、Home 等链接仍优先于默认页；显式 `view=welcome` 仍可打开设置。未完成选择的引导不自动标记完成。
- 沿用版本 2 的偏好及存储失败提示，增加 `homeMode:portal` 取值。旧版卡牌/人物首页偏好继续兼容。手动重置后恢复首次引导，不删除收藏、阅读位置或壁纸。
- 从设置返回来源页不写入新默认。从资料馆临时选首页偶像，只更新偶像，不把资料馆默认页改成人物首页；通信等临时选人也不覆盖启动方式。
- 卡牌/人物首页都有“打开资料馆”文字按钮，通过既有导航保存返回上下文。手机底栏“门户”改称“资料馆”。专注模式隐藏该按钮，沿用退出专注入口。
- 手机选人页把名单与确认区分开：名单独立滚动，底部显示已选姓名、具体目的地、随机与确认按钮。未选择有效偶像时禁用确认，不在点选头像时立即跳转。矮屏横屏时改为名单与确认区并排。

对应本轮审计 UX-01 的入口识别部分、UX-06 的手机确认操作。未处理 UX-01 中所有图标含义，也未宣称完整修复整份指南；Reader/Player 语言桥接、摄影模式、技术标签、占位日期及加载状态留待后续独立批次。

## 验证

通过：

- `npm run verify:archive-startup-route`：首次/已完成引导、资料馆偏好持久化、旧版迁移、显式链接优先、设置取消、临时首页选人的默认页保护、存储不可用，以及既有异步启动归属回归。
- `npm run verify:archive-navigation-state`：导航状态、历史恢复、来源关系。
- `node scripts/verify-home-experience.mjs`：首页偏好隔离、卡面选择、舞台和场景握手。
- `npm run build:check`：完整 Vite 代码编译，固定输出 `.analysis/build-check`，`copyPublicDir:false`。修改横屏样式后重新编译通过；没有生成完整媒体发布包。
- 相关路径 `git diff --check`。

额外尝试的两项旧检查失败，并以 `bc78f6e7` 的原始源码复现了相同失败：`verify-portal-navigation.mjs` 仍要求桌面导航数为 8，当前基线是 11；`verify-song-domain-landing.mjs` 仍要求已移除的旧 `songCatalogData.value = data.songCatalog` 接线。这些不是本批造成的新回归，旧歌曲检查未纳入本批修改。复现辅助脚本保留在 QA 目录。

## Browser 证据

使用 Browser 插件的 Codex In-app Browser。1440×900、390×844、320×740、844×390 的 DOM 尺寸已实测；截图工具在部分桌面截图中只输出可见裁切区域，不把其像素尺寸等同于完整视口。

实际旅程包括：通过界面重置后首次进入；点击“先浏览”后第二次根地址进入、第三次进入及刷新直接到资料馆；明确保存资料馆默认；选择卡牌首页后重新从根地址进入；取消尚未确认的首页设置保留资料馆默认；首页到资料馆再返回；搜索 Legenders 并选中古論クリス；390/320px 底栏确认；御手洗翔太的通信选人及目标档案；资料馆默认下临时首页选人，随后根地址仍打开资料馆；横屏列表及确认区可用。末尾已通过界面恢复开始时的冬馬人物互动首页与空“我的偶像”偏好。

证据位于 [QA 目录](../.analysis/ux-startup-20261001/)，关键截图：

| 证据 | 观察 |
| --- | --- |
| `01-desktop-first-visit.jpg` | 首次引导三种页面选择 |
| `02-second-root-visit.jpg`、`03-third-refresh-portal.jpg` | 先浏览之后不重复引导 |
| `07-narrow-picker-last-idol.jpg` | 320px 搜索、选择与目的地确认 |
| `09-narrow-home-ready.jpg` | 首页文字入口与原有控制 |
| `12-mobile-communication-picker.jpg`、`13-communication-destination.jpg` | 确认后打开对应偶像通信 |
| `14-card-home-default.jpg` | 卡牌首页默认持久化 |
| `16-landscape-picker-fixed.jpg` | 844×390 列表与确认区并排 |
| `17-final-mobile-confirmation.jpg` | 最终 390px 常驻确认栏 |
| `18-final-desktop-home.jpg` | 最终桌面首页入口 |

`08` 是舞台尚未完成载入的中间截图，`15` 是改造前矮屏问题及视口切换瞬间截图，不作为最终验收通过证据。Browser 控制台错误检查为空；这是上述短旅程的检查，不代表全站或长稳验收。

原 5198 服务已断开，普通 Vite 本地启动后根请求超时，因此只停止了本批启动的 Vite，改用仓库既有 `serve-player-qa-preview.mjs`。最终服务映射如下，未复制资源：

```text
http://127.0.0.1:5198/
code: E:/Web_build/SideM_Archived/web_viewer/.analysis/build-check
models: E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001
release: 17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907
media: 当前工作区 public 与既有 archive asset resolver 映射
```

服务启动时检查了构建 bootstrap 与候选的一致性；请求日志记录 release、状态与文件哈希。Browser 验收为上述生产代码 bundle 加本地资源映射，未部署、未做真机或冷缓存性能验收。临时视口覆盖已 reset，最终保留首页供查看。

## 独立推送分支与最终复验

主工作区的本批提交为 `3932a22f`。推送发现远端 `928c4a6b` 的长谱面 PNG 导出工作与本地已提交的谱面控制工作分叉；只读 `git merge-tree` 检查报告 `ArchiveSongChartPreview.vue` 内容冲突。遵守本轮不重叠边界，没有把冲突写入主工作区，也没有替双方解决谱面代码。

最终交付分支 `codex/archive-startup-ux-20261001` 基于远端 `928c4a6b`，只 cherry-pick 本批 11 个文件，接线无冲突。隔离的稀疏工作区是 `E:/Web_build/GS_Archive_Domain_Work/archive-startup-ux-20261001/web_viewer`；`public`、`node_modules` 与本轮证据目录通过 junction 复用主工作区，没有复制媒体库。

独立分支的代码提交 `d3f656f6` 重新通过 startup、navigation-state、home-experience 与 `build:check`。首次因稀疏检出缺少 config/fixtures 的环境错误，在补齐这两个代码目录后恢复；不是代码修复。最终证据服务使用空闲端口 [5212](http://127.0.0.1:5212/)，代码映射为独立工作区自己的 `.analysis/build-check`，模型 release 沿用上节，资源配置明确绑定主工作区 `config/archive_sources.local.json`。

在 5212 独立复验首次引导、先浏览后第二/第三次进入与刷新、390px 选人确认、首页到资料馆再返回，控制台错误检查为空。直接绑定该标签保存的 `22-branch-mobile-confirmation.jpg` 与 `23-branch-home-entry.jpg` 是最终分支截图；`20`、`21` 因旧截图辅助函数仍绑定前一标签，排除出证据，已重新捕获。详情见 QA 目录的 `branch-evidence-index.json`。末尾 reset 临时视口并保留 5212 首页。

本记录随后只补充文档，没有再次修改入口代码或重跑媒体构建。主工作区保留原本的 `3932a22f` 与双方各自的谱面历史；同名共享分支的谱面合并不属于本批完成范围。
