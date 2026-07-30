# GS Archive 产品历程复核与当前优先级

状态：当前产品史复核入口
日期：2026-07-30
核对基线：`master@721c58b29e0eb953e8ba6138521d825d98e1cc63`

## 1. 结论

《GS Archive／GROWING STARS 门户产品开发历程梳理》的总体判断成立：

```text
剧情演示器
-> masterdata 驱动的可检索门户
-> 确定性 Story Runtime
-> RAW/masterdata 证据链和发布治理
-> bounded resource/product batches
```

当前项目应称为 GROWING STARS 档案门户与重建平台，而不是单纯的剧情
播放器。其成熟度仍是多维的：广覆盖、可播放、strict-v2 publication、
翻译覆盖、外部熟肉覆盖和长时验收不能合并成一个“完成百分比”。

## 2. 已由本地仓库复现的事实

| 报告表述 | 本地证据 | 结论 |
| --- | --- | --- |
| 初始提交为 `ca3a28e` | `ca3a28e16c94d369f850afe693cef08cb66673b5`，2026-06-22 | 成立 |
| 初始提交之后 385 个可达提交 | `git rev-list --count ca3a28e..HEAD` = 385 | 成立 |
| 当前 master 为 PR #30 | `721c58b`，Merge pull request #30 | 成立 |
| PR #2 有 83 个分支提交 | `ef804fc..6a2a14e` = 83 | 成立 |
| PR #2 修改 164 个文件 | parent diff = 164 files | 成立 |
| PR #2 约 `+52,090/-627` | parent diff shortstat | 成立 |
| 3,398 logical groups / 4,939 parts | `archive_baseline_report.json` | 成立 |
| 10,329 compiled JSON 不是剧情数 | report 将其定义为 recursive artifacts | 成立 |
| strict v2 为 3+1 / 18 | authoritative registry 与 baseline report | 成立 |
| RAW 为 13,000 files / 8,232,049,221 bytes | baseline report | 成立 |
| image catalog 为 1,271 bundles / 9,157 objects / 7,816 images | baseline report | 成立 |
| USM 为 260，89 consumer / 166 masterdata / 5 unresolved | baseline report | 成立 |
| external exact GS mappings 为 8 条 | `external_story_resources.json` | 成立 |
| tracked PNG 为 108，约 26.4 MB | baseline report | 成立 |

## 3. 需要修正或限定的表述

### 3.1 “正式 Runtime v2 发布较低”

这个判断成立，但必须使用准确术语：

- 3+1 / 18 是 authoritative Runtime-v2 registry 范围；
- 其中只有 `1_4_001_00` 为 ledger-governed；
- 其余 3 个 logical object / 15 artifacts 为 pre-ledger；
- publication ledger 仍只有 1 release / 1 stable logical ID。

因此不能把 3+1 全部称为“已经进入 ledger 的正式交易”。

### 3.2 Publication v2 已不再只是待设计

PR #7（merge `31bac76`）已经激活：

```text
schemas/publication-release-v2.schema.json
schemas/publication-annotation-v1.schema.json
public/data/publication/annotation_index.json
```

v1 release 已冻结，v2 release 和 annotation v1 已 active；但尚未创建第二笔
production release，也没有历史 annotation。应写为“契约已激活、生产记录未
扩张”，而不是“v2/annotation 尚待设计”。

### 3.3 旧入口文档确有时代错位

复核前的 `docs/PROJECT_MAP.md`：

- 把已不存在的 `useTimelineRunner.js` 列为核心；
- 把 `SpineStage.vue` 写成整个 step 编排入口；
- 没有列出 `useStoryRuntimeCues.js`、`StoryAudioSession.js`；
- 没有覆盖当前门户的 26 个 `VALID_VIEWS`。

`docs/AGENT_START_HERE.md` 仍把项目称为“本地 SideM 剧情浏览器”。这会让新
Agent 把当前档案门户误读成早期播放器。两份文档已在本批按当前源码修正。

### 3.4 “版本名称”是分析标签

`GS Viewer 0.x`、`GS Archive 1.0-alpha`、`Story Runtime 2.0-alpha` 和
`Evidence Platform 1.0` 适合作为产品史分期，但它们不是当前仓库已发布的
SemVer tag。对外使用前应明确标注为 retrospective phase labels。

### 3.5 长时验收状态与优先级必须分开

2–4 小时混合运行、最后 25% 资源曲线和 quiet endpoint 仍未执行。短时真实
音频、cross-episode、暂停恢复和 source-only gate 不能替代这些证据。

但从 2026-07-30 起，用户将长时验收降为 **P2**：

- 它仍阻止 `Story Runtime release-accepted` 宣称；
- 它不再阻塞 P0 架构认知收口；
- 它不再阻塞 P1 门户产品开发、external exact-link 小批或代表性 strict-v2
  promotion；
- 不得因为优先级降低而伪写为 PASS。

## 4. 当前优先级

### P0：当前架构认知收口

- 修正 `PROJECT_MAP.md` 和 `AGENT_START_HERE.md`；
- 明确 Runtime owner、active adapter、deprecated/debug-only 边界；
- 以 `archiveRoute.js` 建立当前页面/route 事实；
- 让新窗口从少数现行入口开始，而不是通读全部历史 note。

### P1：用户可见门户与有界内容整合

- 全局或跨域搜索；
- 角色、组合、卡牌、卡池、活动、剧情之间的明确跳转；
- 原文、内置翻译、外部熟肉三种覆盖状态；
- 阅读历史、继续观看和移动端信息密度；
- strict-v2 只选代表性 collection 小批推进，不做全量一键迁移。

P1 产品批次和资源证据批次仍应分支隔离，不能为了 UI 便利降低 exact relation
门槛。

### P2：Runtime 长时验收与扩大代表性 v2 覆盖

P2-A 可选取多 Episode Main、Unit、Idol、Event、Mobile/Call 和复杂
Choice/多音频场景，逐类完成 strict-v2 小批。

P2-B 在固定 commit 上独立执行 2–4 小时长稳，记录资源曲线和 quiet endpoint。
长稳不得与功能开发混在同一提交或浏览器会话中。

### P3：产品史和能力矩阵产品化

只有当现行架构入口稳定后，再考虑自动生成 development timeline 或公开的
capability matrix。Git commit 数不能直接当成功能数量。

## 5. 下一批入口

```text
P0 文档完成
  -> 选择一个 P1 用户可见产品批次
  -> 固定输入、自然入口和 5174 验收 URL
  -> 小提交、独立 verifier/browser evidence

P2 长稳
  -> 保持 NOT EXECUTED
  -> 等用户重新选择该轨道
```

本报告不修改 Runtime、资源、publication release、external mapping 或
baseline 数字。
