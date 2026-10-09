# GS Archive 交接 2026-10-09（晚）

本窗口在 `69c5c2a9` 之后做了 9 个提交，截止 `1445c79e`，分支 `codex/portal-architecture-cleanup-20261004`，**全部未推送、未部署**。上午的交接 `GS_ARCHIVE_HANDOFF_20261009.md` 仍然有效（巧克力称号、语言收口、道具联动等未动），本文只写本窗口的变化和接下来要做的事。

收尾时的状态：`npm run build:check` 通过；`npm run verify:source-batch` 122/122；`npm run verify:reading` 通过；`readmodels` 测试 54/54。

---

## 0. 本窗口完成了什么（背景，勿重做）

| 提交 | 内容 |
|---|---|
| 8bce63ec | 谱面：4 张谱面（tibeti/wathon Expert、ldyrdm Pro、mtples Expert）原始数据里有歌曲结束后的残留音符，查看器隐藏它们，Time Before Time Expert 恢复 2:05；默认从 0:00 开始；去掉「截图样式」；判定圈去掉 SVG 模糊；新增「沉浸查看」（全屏、触摸不滚动页面） |
| 7b2eaf06 | 舞台小人：进入时选「轻量 / 完整」加载（轻量关灯光、光束、动态物件，像素密度 1.5×），可记住；画面页可改加载方式和帧率（自动 30→60→跟随屏幕 / 30 / 60）；首次播放提示沉浸观看；触屏帮助不再列键盘、沉浸模式保留截图键、无 F 标签；「按编成偶像演唱」放回编队页，演出编排按 全员 / 按组合演唱 / 单人中心 分组；Take a StuMp 组合徽标等图片随歌曲预载 |
| 11a50f38 | 卡面探索多出的星星和刷新按钮去掉，「换一组」三张一起换；主线第 1、2 章大图改用 object-fit 裁切（针对 iOS 不显示）；html/body 用纸色（针对 iPad 底部白条）；阅读器自动模式下无语音台词按字数停留；摄影工作台默认不放偶像、打开地点菜单 |
| d10264b4 | **故事页统一**：阅读范围只由 `src/core/ReaderViewport.js` 决定（手机单 EP、电脑整话，所有故事类型）；译文时机只由 `src/localization/story/StoryTextReadiness.js` 决定（各故事页读模型加载器取数据时一并取译文，最多等 1.2 秒）；生日合集标题由 `src/presentation/StoryPageTitle.js` 统一 |
| 4b0f0d32 | **季节企划可阅读**：208 组从 RAW 重编译（559 个文件），247 个补了分支证据，新增 306 篇阅读正文；季节企划页有「阅读」入口 |
| 3d52f318 | 读模型的阅读定位改为 256 个哈希分片（文件数 8840 → 6294） |
| a0306990 | 卡面文本翻译包改为 5 批 |
| 1445c79e | 门禁基线随语料更新（AI Studio 行数 30121 → 32760），样式改用令牌 |

---

## 1. 翻译（下一窗口的主线）

### 1.1 卡面文本：直接开始
- 包：`web_viewer/.analysis/general-translation-batches/card-lines-20261009-x4/`，5 批（G-card-lines-001～005），每批约 850 条、5.6 万字符（约 3.5 万 token）。给模型的只有 `glossary.md` 和各批 `input.md`；回答原样存为同目录 `output.md`。
- 旧包已改名 `card-lines-20261009-SUPERSEDED-18x16k`。**两包批次号重叠，不能混用。**
- 编号是三位，一批最多 999 条，所以 4231 条最少 5 批，不能再合并。
- 检查和导入（在 `web_viewer` 下）：
  ```
  node scripts/general-translation-workflow.mjs check <批次>/local/batch-map.json <批次>/output.md
  node scripts/general-translation-workflow.mjs import <批次>/local/batch-map.json <批次>/output.md '模型名'
  node scripts/generate-archive-general-translations.mjs
  node scripts/generate-translation-release.mjs
  node scripts/generate-translation-audit.mjs
  node scripts/generate-story-search-localization.mjs
  ```
  搜索本地化固定了翻译审计文件的哈希，**必须在审计之后生成**，否则 `verify-story-search-localization` 报 stale。
- 通信对话（chats）那一波以后也可以用同样参数导出：`export <新目录> --domains chats --max-chars 56000 --max-rows 999`。

### 1.2 目前仍显示日文的地方（缺译文，不是代码问题）
本窗口用限速浏览器逐页探测过，以下内容在中文模式下还是日文：
- 季节企划：剧情正文和标题（306 篇，只有 3 篇导入有译文）。
- 额外剧情：合集名、说明、篇名（如「2022年エイプリルフール」「22/4エイプリルフールOP」）。
- 生日：制作人生日问候的篇名（如「プロデューサーは……。」）。
- 通信：列表预览句。

### 1.3 季节企划要走 AI Studio 剧情翻译，先补发布登记
`scripts/lib/ai-studio-source.mjs` 的 `releaseRawHash` 要求每篇文档有发布来源；季节企划的编译文件不在发布登记里，导出批次会报 `No publication provenance`。要先给这 208 组补发布记录（参考 `publish-raw-selection-flow.mjs` 生成 release 的方式），再用 `prepare-ai-studio-batches.mjs --documents …` 导出。

---

## 2. 发布前必须做

1. **R2 数据**：季节企划 559 个编译文件已改动（`public/data/compiled/` 下，git 只跟踪其中 457 个阅读来源），另有 306 篇新阅读正文、阅读清单、翻译审计等。下次增量按 `sidem_test_deploy_20261009` 的叠加链补第五层 overlay，把这些都包含进去。
2. **读模型必须和前端一起换**：阅读定位从「每篇一个文件」改成分片，新前端只认分片。已有一个本地候选：`E:\Web_build\GS_Archive_engineering_20261007\rm-seasonal-reading`（由 `3d52f318` 构建，data revision 用的是开发值，**不能直接上线**）。正式发布时按 `GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md` 用已发布的 data revision 重建并 `verify_artifacts.mjs`。
3. 季节企划重编译的备份和哈希账本在 `E:\Web_build\GS_Archive_engineering_20261007\seasonal-reading-20261009-backup\publish-ledger.json`。这次没有走项目的迁移发布门禁：门禁要求音频和文本不变，而这次正是修正了 678 条不存在的语音文件名和 3 处空白台词。

本地预览（季节企划等新数据需要这个候选包）：
```
SIDEM_READMODEL_CANDIDATE=E:/Web_build/GS_Archive_engineering_20261007/rm-seasonal-reading npx vite --configLoader native --port 5175 --strictPort
```

---

## 3. 等用户确认 / 需要真机验证

| 事项 | 现状 |
|---|---|
| iOS 主线第 1、2 章大图 | 改为 object-fit 裁切，Chromium 正常；**未在 iOS 上验证** |
| iPad 底部白条 | html/body 改纸色并补 min-height；**未在 iPad 上验证** |
| 舞台在 iOS 上的流畅度 | 轻量模式 + 30 帧 + 1.5× 密度；**未在真机上量过** |
| 电脑端换人演唱时「闪一下」 | 四种桌面尺寸下画布都没有改变尺寸，没能复现。已把站位栏高亮改为渐变、改尺寸后立即重绘。如果还闪，需要用户提供歌曲名和是否开了「按编成偶像演唱」，最好有录屏 |
| 轻量模式是否也关「图片布景」 | 目前保留（包含 Take a StuMp 组合徽标），等用户决定 |
| 谱面「跟着打」 | 现在的沉浸查看只防误触，不判定。真正的跟打玩法是新功能，用户未决定 |
| 谱面残留音符 | 只在查看器里隐藏，谱面数据文件未改。是否在生成时就去掉，用户未决定 |
| 偶像主页电脑端排版 | 用户之后给设计思路 |

---

## 4. 本窗口新增的规则（新代码要遵守）

- **故事页**：新增一种故事页 = 在 `StoryTextReadiness.js` 的 `PAGE_TEXT` 表里加一行，并把它的读模型加载器结果交给 `withStoryText(kind, detail)`；不要再在组件里各写一套「未翻译先隐藏」。阅读范围不要在页面里传，交给 `ReaderViewport.js`。
- **阅读正文**：只用 `generate-reading-documents.mjs --documents <id,…>` 生成，不要全量重生成（会改动已被审校回执钉住的文档）。语料数量变化时，同步更新 `scripts/lib/ai-studio-source.mjs`（3113）和 `scripts/verify-ai-studio-batches.mjs`（32760）的基线，并写明原因。
- **读模型新增大量实体**：注意 9000 文件上限；按 id 直接查找的领域可以像 `reading-docs` 一样设 `sharded:true`（`readmodels/lib/projections.mjs`），客户端用 `entityShardDescriptor`。
- **重编译剧情**：`compile-story-migration-candidate.py` 的输出目录必须在 `web_viewer` 之外。

## 5. 工作方式与坑（补充上午交接 §7）

- 读模型候选构建会拒绝未提交的源码改动，**先提交再构建**。
- 浏览器验收：本机 Bash 没有 `pkill`，按端口结束进程用 PowerShell 的 `Get-NetTCPConnection -LocalPort <端口>`。模拟触屏要用 `Emulation.setTouchEmulationEnabled`，`setEmulatedMedia` 的 hover 设置不会影响 `matchMedia`。
- 译文闪动可以用限速探测复现：注入一个按 80 ms 采样可见假名文本的脚本，`Network.emulateNetworkConditions` 加 120 ms 延迟，比较「出现过又消失」的日文。
