# GS Archive

《偶像大师 SideM GROWING STARS》非官方资料馆。游戏服务期 2021.10.06 – 2023.07.31。

[English](README.en.md)

本站整理游戏中已经公开的剧情、通信、卡片、歌曲、活动与卡池等内容，提供中文译文、剧情阅读与回看，以及谱面、2D 舞台和摄影工作台。

## 能看到什么

- **剧情**：主线、活动、卡片、偶像、组合、季节企划等剧情，既能当文字读，也能按原作演出回放（立绘、语音、口型、背景、BGM、特效）。
- **通信**：电话与聊天。
- **偶像与组合**：资料、所属卡片、相关剧情和歌曲。
- **卡片、卡池、活动**：关系从游戏的 masterdata 推出，不靠人工猜。
- **歌曲**：封面、试听、演唱者。
- **谱面、2D 舞台、摄影工作台**：在网页里复原游戏的谱面、Live 小人舞台和摄影功能。

剧情默认显示中文译文，还没翻译的段落显示日文原文；阅读器和播放器里可以随时切换原文或双语。译文主要由 Gemini 3.8 Flash 翻译，GPT 6.1 Sol、Claude Sonnet 5.5 和 Claude Opus 5.5 负责整体审阅和专有名词核对，一切以游戏原文为准。

## 声明

本项目是个人运营的非官方粉丝项目，与 BANDAI NAMCO Entertainment Inc. 及其他权利方没有任何关联，也没有获得授权或认可。
游戏中的文字、图片、音频、视频等素材的权利归原权利方所有。本项目不以营利为目的，不提供游戏资源下载。

权利方如认为内容有不妥，请发邮件至 windmet@outlook.com，我会尽快处理。

## 仓库里有什么

仓库只放代码、数据规则、验证报告和开发文档。**不放**游戏客户端文件、RAW 与 masterdata 原文件、语音、卡面、Spine 模型等大体积媒体；
少量例外（门户用的小图、测试夹具）由 [二进制与发布策略](web_viewer/notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md) 逐项登记。

| 路径 | 内容 |
|---|---|
| `data_pipeline/` | Python：剧情编译、索引生成、资源目录 |
| `web_viewer/src/` | Vue 3 + PixiJS 7 + Spine 3.8 的网页与剧情播放器 |
| `web_viewer/readmodels/` | 读模型生成器、客户端与装配验证 |
| `web_viewer/scripts/` | 生成、审计、发布用的 Node 脚本和各项 verifier |
| `web_viewer/translation/` | 译文工程（术语、校对、批次） |
| `web_viewer/docs/`、`web_viewer/notes/` | 开发文档、决策记录、审计报告 |

数据流向：RAW（剧情脚本、图片、音频、模型）+ masterdata（谁是哪张卡、哪个活动）→ 离线管道 → 生成的索引、compiled 剧情、读模型 → 浏览器只读这些生成产物。

## 本地开发

需要 Node.js 24 和 Python 3。

```powershell
git clone https://github.com/windmet/GS_Archive.git
cd GS_Archive\web_viewer
npm ci
npm run dev
```

只有代码的检出能跑源码检查，但页面基本没有数据。要看到完整内容，需要自己准备从客户端提取的数据：
把 `web_viewer/config/archive_sources.example.json` 复制成 `archive_sources.local.json`（已被 gitignore），在里面填本机的 RAW、masterdata 和工作目录路径。

## 检查

在 `web_viewer/` 下：

```powershell
npm run gate:source   # 源码门禁，CI 跑的是同一套
npm run build:check   # 只编译源码，不复制本地媒体
```

不要直接运行 `vite build` 或 `npm run build` 来检查代码：它会把整个 `public/`（本地语料可达数 GB）复制进输出目录。
前端改动还要在真实浏览器里看桌面、平板和 390 px 手机宽度。

## 文档入口

- [项目地图](web_viewer/docs/PROJECT_MAP.md)：模块分工和数据层次
- [当前状态](web_viewer/docs/CURRENT_STATE.md)：已完成、未验收、下一步
- [数据基线](web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE.md)：剧情、卡片等数量的核对口径
<!-- 下面两行由 web_viewer/scripts/verify-current-archive-baseline.mjs 核对，数据变了随基线一起改 -->
<!-- authoritative-v2-summary collections=4 standalone=1170 artifacts=1199 -->
<!-- publication-ledger-summary releases=216 stable_logical_ids=1400 -->
- [开发者 / Agent 起步](web_viewer/docs/AGENT_START_HERE.md)、[Git 工作流](web_viewer/docs/GIT_WORKFLOW.md)
- [笔记索引](web_viewer/notes/INDEX.md)

## 反馈

- 发现 bug、翻译问题或页面故障：[GitHub Issues](https://github.com/windmet/GS_Archive/issues)
- 邮件：windmet@outlook.com
- QQ 测试群：1130533021

## 致谢

- 柚子贝汁 P：从最初就一直陪着我，测试每一个版本，也提了很多产品上的建议。
- shiogi P：六月末七月初项目刚起步时，给了关键的帮助。
- 参加 10 月内测的各位制作人。
- Wiki 的维护者们：卡池信息来自 Wiki 的记录。

## 许可

- 本项目自己写的代码和文档：[MIT](LICENSE)。
- 游戏内容及由它生成的数据：不在许可范围内，不授予任何权利。
- 站内译文：不适用开源许可；转载请注明出处。
- 第三方组件按各自许可，全文见 [THIRD_PARTY_NOTICES.txt](web_viewer/THIRD_PARTY_NOTICES.txt)。其中 Spine Runtimes 要求每个把它集成进自己项目的开发者持有 Spine 许可；fork 后自行部署的话需要自己购买。

详细说明见 [许可评议](web_viewer/docs/LICENSING_20261103.md)。
