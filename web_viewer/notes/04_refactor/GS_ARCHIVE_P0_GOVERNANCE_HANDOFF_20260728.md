# GS Archive P0 治理与后续执行交接

状态：当前新窗口主交接
日期：2026-07-28
仓库：`E:\Web_build\SideM_Archived`
应用：`E:\Web_build\SideM_Archived\web_viewer`

这份文档把 RAW + masterdata 迁移、Story Runtime 发布验收、二进制发布治理和
GROWING STARS 社区熟肉绑定拆成彼此独立的工作轨道。新窗口应以本文和
`CURRENT_ARCHIVE_BASELINE_20260728.md` 为入口，不要从旧审计的“下一步”
段落重新推断当前状态。

---

## 0. 尚未完成的工作

当前最重要的未完成项按执行顺序如下。

### P0-A：完成当前 Draft PR #2 的治理收口

文档契约已经写完，但以下机器可执行部分还没有实现：

1. 当前事实报告的生成器与漂移校验：**已实现**；source-only
   验证通过，mounted 验证发现 `RAW/audio` 中存在 18 个未登记 WAV，按设计
   阻止基线静默漂移；
2. 已跟踪二进制清单、Schema 和 verifier：**已实现**；108 个 PNG 已逐项登记，
   未修改任何图片 bytes；
3. 发布账本 Schema、生成器和 verifier；
4. 第一笔多 part RAW 剧情发布交易的真实演练；
5. PR #2 的标题、正文、检查结果和审阅顺序收口；
6. PR #2 合并。

本轮文档提交与推送不等于以上实现已经完成，也不等于 PR 已合并。

### P0-B：完成 Story Runtime 真实发布验收

源码门禁和 `noAudio=1` 浏览器门禁不能替代真实媒体验收。仍需：

1. Edge 首次点击与 autoplay；
2. BGM、Ambient、Voice、SE 的真实播放；
3. 隐藏标签页后恢复；
4. 连续切换 episode；
5. 跨 episode 的 BGM/Ambient 生命周期；
6. 2–4 小时混合使用；
7. 安静终点的 AudioContext、MediaElement、Pixi、Spine 和定时器收敛。

IDM 或其他下载接管工具必须在真实音频验收前禁用。`noAudio=1` 测试时不需要
为验证下载器而打开媒体。

### P1-A：发布账本第一笔真实交易

选一个已有 RAW 权威来源、包含多个 part、已有稳定输出和浏览器入口的剧情
collection，执行：

```text
candidate
-> parity
-> release record
-> publish
-> 5174
-> rollback
-> old hash exact match
-> republish
-> 5174
```

这一步用于验证发布账本，不用于扩大全量剧情迁移。

### P1-B：GROWING STARS 熟肉外链小规模试点

只做 GS，不做 Mobage，不做 CD/song drama，不做 live、动画片段和无法确定
产品来源的视频。

第一批只录入已经能与本地 GS event/story 身份精确对应的两个视频：

| BVID | 本地关系 |
| --- | --- |
| `BV1ac411S7KB` | event `10008` / story `1_3_10008_01` |
| `BV1od4y1x7X6` | event `30014` / story `1_3_30014_01` |

THE 虎牙道 Episode 0 的三个候选需要先逐个核实视频覆盖范围，不能仅凭标题
直接标记为完整 collection：

| BVID | 候选 collection |
| --- | --- |
| `BV1LL411G7LD` | `1_1_013the_01` |
| `BV1xA4y1S7Cb` | `1_1_013the_02` |
| `BV16u4y187tH` | `1_1_013the_03` |

`idol-master.top` 只保留为产品灵感，不进入数据、运行、署名或可用性链路。
实际链接指向原始 Bilibili 视频，并以视频原 uploader 为署名对象。

### P1-C：RAW movie/USM 关系域

RAW 有 260 个 USM，目前只有 77 个已映射到 BackMonitor 关系，仍有 183 个
未解决。下一步先做全量目录与消费者关系报告，不做批量转码和发布。

### P1-D：RAW `image_*` Unity bundle 关系域

已知约 1,271 个 `image_*` bundle 尚没有完整的 masterdata/consumer 关系图。
下一步先生成对象级目录和候选关系，不批量导出 PNG。

---

## 1. 新窗口启动时先核验

任何数字、Git 状态和服务状态都可能漂移。新窗口开始时先执行：

```powershell
Set-Location E:\Web_build\SideM_Archived

git status -sb
git branch --show-current
git rev-parse HEAD
git rev-parse '@{u}'
git log -5 --oneline
git diff --check

Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

预期文档提交完成后的分支是：

```text
codex/post-merge-story-handoff
```

本轮文档分批提交：

```text
4b6d3f3 docs: establish current archive baseline
66e1f20 docs: define archive publication governance
<handoff commit> docs: hand off P0 governance and next archive lanes
```

`<handoff commit>` 应由新窗口启动时用 `git log` 读取，不要在文档里猜测自包含
commit 的最终哈希。

如果 worktree 不干净：

1. 列出文件；
2. 区分用户修改、本轮修改和生成器副作用；
3. 不要 reset、checkout 或清理用户修改；
4. 只暂存当前有意提交的精确文件。

---

## 2. 当前事实入口

### 2.1 主入口

| 文档 | 用途 |
| --- | --- |
| `notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md` | 当前事实、统计口径和未解域 |
| 本文 | 下一窗口执行顺序、提交边界和验收 |
| `notes/04_refactor/ARCHIVE_MULTIDIMENSIONAL_STATUS_CONTRACT_20260728.md` | 多维状态定义 |
| `notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md` | 二进制跟踪与发布边界 |
| `notes/04_refactor/PUBLICATION_LEDGER_CONTRACT_20260728.md` | append-only 发布账本设计 |
| `notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md` | GS 熟肉外链范围和 Schema 设计 |
| `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md` | Story Runtime 真实发布验收入口 |

### 2.2 历史材料

以下仍有证据价值，但不是当前状态入口：

- `RAW_MASTERDATA_FULL_AUDIT_20260726.md`；
- `RAW_MASTERDATA_MIGRATION_20260726.md`；
- `RAW_MASTERDATA_V1_NEXT_WINDOW_HANDOFF_20260727.md`。

它们已加历史快照提示。不要从旧 HEAD、旧缺口列表或旧“下一阶段”覆盖
2026-07-28 基线。

---

## 3. 当前权威边界

### 3.1 masterdata

masterdata 负责：

- 剧情、活动、偶像、组合、卡片和音乐的语义身份；
- 标题、分组、顺序、解锁和跨域关系；
- 将 RAW 的物理资源映射到页面和运行时消费者。

原始 XOR 文件：

```text
E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\Container\Documents\client_master_data
```

已解码 PB：

```text
E:\Web_build\SideM_Archived\web_viewer\.analysis\masterdata\
client_master_data.xor_DefaultPassPhrase.pb
```

已核验：

| 项 | 数值 |
| --- | --- |
| 原始/解码文件字节 | 3,053,002 |
| 原始 SHA-256 | `d57f76040c56c5ce0e80910c76328f528d47915c63a040516b470a538cccdc0e` |
| 解码 SHA-256 | `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1` |
| records | 47,204 |
| table IDs | 158 |

这两个文件都不进入 Git。网页实际消费的是
`public/data/masterdata/*.json` 生成产品。

### 3.2 RAW

RAW 负责物理 payload：

```text
E:\Web_build\SideM_Archived\RAW
  asset
  audio
  movie
```

当前全量：

| 项 | 数值 |
| --- | ---: |
| 文件总数 | 13,000 |
| 总字节 | 8,232,049,221 |
| asset / Unity bundles | 8,639 |
| audio | 4,098 |
| ACB | 4,055 |
| AWB | 43 |
| movie / USM | 260 |
| WAV | 0 |

RAW 是从 `RAW.7z.001`、`RAW.7z.002` 解出的原始三分类树。旁边的“所有歌曲”
“所有图片”等压缩包是整理者的派生整理包，只能用于：

- 发现；
- 文件名比对；
- 解码或像素 parity；
- 旧 URL 兼容回归。

它们不是默认 source of truth。

### 3.3 Unity/CRI 子资源

只有 bundle/ACB 文件名通常不足以定位具体内容。证据应尽量记录：

- archive-relative path；
- SHA-256；
- Unity object type/name；
- container path；
- PathID；
- ACB/AWB；
- CueTable、CueName、Waveform、Selector/Sequence 关系。

### 3.4 稳定网页产物

`public/` 是网页运行时和已批准稳定产物，不是源资源权威树。稳定 URL 的存在
只说明它在当前 checkout 中 published，不说明：

- 已合并到 `master`；
- 已部署到公网；
- 已通过真实浏览器和音频发布验收；
- 已覆盖整个资源域。

---

## 4. 当前数字及其正确含义

### 4.1 剧情

| 指标 | 数值 | 含义 |
| --- | ---: | --- |
| RAW logical groups | 3,398 | RAW 剧情逻辑组 |
| valid parts | 4,939 | 组内有效 part |
| public unique match | 3,398 | 每个 RAW 组有唯一 public 对应 |
| public matched parts | 4,939 | part 对应总数 |
| compile errors | 0 | 当前审计编译错误 |
| steps | 70,652 | 编译步骤 |
| voice refs | 26,902 | 剧情语音引用 |
| voice resolved | 26,890 | 已解析 |
| voice dangling | 12 | 悬空 |
| recursive compiled JSON | 10,329 | 所有递归 JSON artifact，不是剧情条数 |
| root compiled JSON | 3,405 | compiled 根目录 JSON |
| direct episode JSON | 1,884 | episodes 直接子文件 |

strict v2 当前正式范围：

- collection `1_4_001_01`；
- collection `5_01_101_22`；
- standalone RAW v2 `1_x_001tom_2_1_2_001_12`。

这不是全量 strict v2。

### 4.2 卡片

| 指标 | 数值 |
| --- | ---: |
| master rows | 836 |
| unique resource IDs | 826 |
| RAW matched | 826 / 826 |
| portal normalized entities | 826 |

GS 页面可以展示卡片实体和相关剧情关系，但不要人为建立 Mobage 式“单卡
剧情”产品分类。只有当 GS masterdata 存在明确 scenario identity 时，才能把
外部视频绑到那个内部剧情身份；不能因为视频标题写了“卡面剧情”就创造一个
本地 category。

### 4.3 已跟踪二进制

在基线 `d8d819d`：

```text
108 PNG
26,384,189 bytes
```

其中包括 birthday/`101ken`、event visual、portal/unit 图、silhouette/fixture、
FX 和文档图片。它们是待分类的 grandfathered baseline，不应为了满足新规则
而删除或重编码。

---

## 5. 本轮已经完成

### 5.1 当前事实基线

`4b6d3f3` 完成：

- 新建权威当前基线；
- 修正 README 的 RAW、剧情、strict v2、卡片、二进制口径；
- 为三份旧审计/交接增加历史快照警告；
- 更新 notes 索引。

### 5.2 治理契约

`66e1f20` 完成四份设计：

1. 多维状态；
2. 二进制和发布政策；
3. append-only 发布账本；
4. GS-only 社区熟肉外链。

文档完成不代表对应 Schema、generator、verifier 和 UI 已经实现。

### 5.3 关键产品决定

已经固定：

- 不依赖 `idol-master.top`；
- 不复制其封面或目录；
- Bilibili 收藏夹只是候选发现队列；
- 直接链接原视频；
- 署名原视频 uploader；
- 只收录 GROWING STARS；
- 排除 Mobage、drama、live、clip 和 unknown；
- 第三方视频不进本地 publication ledger；
- 不把外链覆盖率混入本地剧情完整率。

### 5.4 P0-A 当前事实报告器

当前实现批新增：

```text
scripts/report-current-archive-baseline.mjs
scripts/verify-current-archive-baseline.mjs
scripts/lib/archive-baseline-report.mjs
public/data/archive_baseline_report.json
```

已确认：

- 报告不写入机器绝对路径；
- source-only verifier 不要求挂载 RAW/masterdata；
- 报告生成对相同 capture commit 和输入保持确定性；
- masterdata 原始与解码 SHA-256 均与配置期望一致；
- tracked PNG、剧情、卡片、USM 和 `image_*` 指标由机器证据生成；
- mounted verifier 检出 live RAW 与已记录 manifest 的真实漂移。

当前漂移是 `RAW/audio` 多出 18 个 WAV，共 413,684,064 bytes，使 live RAW
达到 13,018 files / 8,645,733,285 bytes。它们未被删除、移动或接受为权威
RAW；已记录基线仍为 13,000 files / 8,232,049,221 bytes / 0 WAV。

### 5.5 P0-A 已跟踪二进制清单

当前实现批新增：

```text
schemas/tracked-binary-assets-v1.schema.json
policies/tracked-binary-assets.v1.json
scripts/generate-tracked-binary-inventory.mjs
scripts/verify-tracked-binary-inventory.mjs
```

108 个 grandfathered PNG 已全部登记，合计 26,384,189 bytes：

- documentation evidence：3；
- portal asset：17；
- stable promoted asset：83；
- test fixture：5。

generator 对相同 commit 和文件集合保持确定性；verifier 检查 Schema、Git
tracked 集合、hash/size、logical ID、ignore/force-add 边界、本地路径，以及未来
非 grandfathered 文件的 2/5 MiB 单文件和 10/25 MiB owner-release batch 边界。
本批未修改任何 PNG bytes。

---

## 6. P0-A 实现：机器可执行治理

这一阶段建议留在 PR #2，且分成小提交。不要把熟肉 UI、USM 目录或
`image_*` 全域审计塞入 PR #2。

### 6.1 提交 A：当前事实报告器

实现状态：**已实现**。source-only gate
通过；mounted gate 因上述 18 个未登记 WAV 正确失败。解决本地 RAW 漂移前，
不得把 13,018 文件静默提升为新权威基线。

目标：

```text
web_viewer/scripts/report-current-archive-baseline.mjs
web_viewer/public/data/archive_baseline_report.json
```

最低输出：

- 当前 commit（报告字段，不要求与自包含 commit 相同）；
- RAW 文件数/字节/类型；
- masterdata 文件身份、record/table 数；
- story group/part/compiled artifact 指标；
- voice ref/resolved/dangling；
- card row/resource/RAW match；
- tracked binary count/bytes；
- USM mapped/unresolved；
- `image_*` bundle count；
-生成时间和 mounted-source availability。

要求：

- source-only 环境缺 RAW 时明确 `not-mounted`，不能伪造 0；
- mounted 模式对已记录 SHA 和统计漂移失败；
-输出字段名与人类文档使用相同定义；
-生成器结果可重复；
-不要把机器绝对路径写入可提交 JSON。

建议脚本：

```json
"report:archive-baseline": "node scripts/report-current-archive-baseline.mjs",
"verify:archive-baseline": "node scripts/verify-current-archive-baseline.mjs"
```

停止条件：

- 如果现有 `verify:archive` 会改写 mounted-data 报告，先检查 diff；
- 不允许为了得到“干净结果”覆盖现有稳定索引而不记录变化。

### 6.2 提交 B：二进制清单

实现状态：**已实现**。108 个 PNG 全部为 `grandfathered: true`，清单生成可重复，
验证器已与 Git tracked 集合和实际文件内容双向核对。

目标：

```text
web_viewer/schemas/tracked-binary-assets-v1.schema.json
web_viewer/policies/tracked-binary-assets.v1.json
web_viewer/scripts/generate-tracked-binary-inventory.mjs
web_viewer/scripts/verify-tracked-binary-inventory.mjs
```

先把 108 PNG 全部列入 `grandfathered: true`，逐项给出：

- archive-relative path；
- bytes；
- SHA-256；
- category；
- logical ID；
- consumer；
- reason tracked；
- force-add permission；
- owner release（允许 null）；
- grandfathered。

验证器必须检查：

- Git 实际 tracked 集合与清单一致；
- 文件存在且 hash/size 一致；
- logical ID 不重复；
- 新文件遵守 2/5 MiB 单文件和 10/25 MiB batch 边界；
- governed path 下没有未登记 binary；
- remote cover URL 不会伪装成本地 portal asset。

不要在这一提交中改动 108 个 PNG 的 bytes。

### 6.3 提交 C：发布账本骨架

目标：

```text
web_viewer/schemas/publication-release-v1.schema.json
web_viewer/public/data/publication/manifest.json
web_viewer/public/data/publication/releases/
web_viewer/scripts/generate-publication-manifest.mjs
web_viewer/scripts/verify-publication-ledger.mjs
```

首先只实现：

- Schema；
- 空 history 生成空 manifest；
- deterministic generation；
- path/hash/consumer/previous chain 校验；
- source-only CI 不要求 mounted RAW。

不要先 backfill 108 PNG，也不要先录入猜测性的 `master_table: 0`。

### 6.4 提交 D：第一笔多 part story transaction

选择条件：

- 已有 RAW source proof；
- masterdata/story relation 明确；
- 当前 stable artifacts 可枚举；
- 有 candidate/parity 脚本；
- 5174 有自然入口；
- rollback 可恢复旧 hash。

操作顺序：

1. 记录 `prepared_from_commit`；
2. 生成 candidate，不写 stable；
3. 对每个 part 做语义 equality；
4. 生成 release transaction；
5. publish；
6. 检查 stable manifest；
7. 5174 浏览器验收；
8. rollback；
9. 检查每个旧 hash；
10. republish；
11. 再次 5174 验收；
12. 只暂存 release、manifest、必要稳定输出和审计。

候选、备份、rollback 工作区继续 ignored。

---

## 7. P0-B 实现：5174 与 Story Runtime

### 7.1 先确认服务

```powershell
Set-Location E:\Web_build\SideM_Archived\web_viewer
npm run dev -- --host 127.0.0.1 --port 5174
```

如果端口已监听，先识别进程和当前代码，不要重复起服务。

### 7.2 `noAudio=1` 基线

当前已验证范围：

- AudioContext 未初始化；
- audio session disabled；
- audio manager disabled；
- active sources 为 0；
- 没有 null AudioContext 错误。

已知需要重新从自然入口复现的路由：

```text
http://127.0.0.1:5174/?raw_bg_candidate=bg001_315pro_in_01
&noAudio=1
&runtimeDebug=1
&view=player
&scenario=candidate%2F1_4_001_01.json
&start_step=417
&end_step=431
&return=home
```

此前 bounded deep link 出现：

- 2 条 Pixi warning；
- target unavailable `048mom`。

它的状态是 `needs-normal-entry-reproduction`，不是 Story Runtime 全域失败。
从自然 collection/episode 入口走到同一区间，分别记录：

- URL；
- commit；
- 页面入口；
- console；
- visible target；
- active Pixi/Spine；
- quiet endpoint。

### 7.3 真实音频矩阵

真实音频验证前：

1. 禁用 IDM 的浏览器接管；
2. 使用 Edge；
3. 确认未加 `noAudio=1`；
4. 清晰记录第一次用户手势；
5. 不在同一结论中混入 source-only 或 Node test。

最小矩阵：

| Case | 需要观察 |
| --- | --- |
| first gesture | AudioContext 是否在手势后 resume |
| voice only | 单句结束与切句 |
| BGM + voice | ducking/并发/切句 |
| ambient + SE | 生命周期与叠加 |
| hidden/resume | 隐藏后恢复或停止策略 |
| cross episode | BGM/Ambient 是否泄漏或被误停 |
| repeated enter/exit | source、listener、timer 是否累积 |
| 2–4h mixed | 内存、context、media、canvas 长期曲线 |
| quiet endpoint | 全部资源回到预期稳定值 |

通过真实媒体矩阵之前，product acceptance 仍是 `not-accepted`。

---

## 8. P1-B 实现：GS 熟肉绑定

这条轨道在 PR #2 关闭后单独建分支：

```text
codex/external-story-links-pilot
```

### 8.1 不变的范围

允许：

- GS main story；
- Episode 0 / unit story；
- GS idol/personal story；
- GS event story；
- 其他能由 masterdata 明确定位的 GS story。

禁止：

- Mobage card/event story；
- drama/CD/song drama；
- live footage；
- anime clip；
- 无精确范围的 reaction/excerpt；
- unknown product；
- 仅凭组合名或 SideM 标题推断 GS；
- 创建一个本地并不存在的“单卡剧情”分类。

### 8.2 提交 1：Schema、registry、verifier

目标：

```text
web_viewer/schemas/external-story-resource-v1.schema.json
web_viewer/public/data/external_story_resources.json
web_viewer/scripts/verify-external-story-resources.mjs
```

第一批只录入两个 exact event：

- `BV1ac411S7KB`；
- `BV1od4y1x7X6`。

验证：

- `product === "growing_stars"`；
- BVID 与 canonical URL 一致；
- uploader UID/name 存在；
- event/story ID 在本地存在；
- mapping/coverage 枚举合法；
- 不含 remote thumbnail；
- 域名只允许 `www.bilibili.com/video/<BVID>`；
- 普通 CI 不依赖 Bilibili 在线状态。

### 8.3 提交 2：EventDetail/StoryDetail UI

页面：

- `ArchiveEventDetail`；
- `ArchiveStoryDetail`。

UI 必须让用户在跳转前看到：

- “社区中文资源”；
- uploader；
- Bilibili；
- 外部链接性质。

链接：

```html
target="_blank"
rel="noopener noreferrer external"
```

不做 iframe，不热链封面。视觉优先使用：

1. 对应本地 event visual；
2. story presentation visual；
3. unit logo/background；
4. 小型本地 placeholder。

5174 验收：

- 内部 Play 仍正常；
- 外部按钮打开 canonical video；
- 页面没有新增远程图片请求；
- 移动布局不溢出；
- Mobage/drama 不进入 GS count；
- registry 缺失或视频 unavailable 时页面仍可用。

### 8.4 提交 3：THE 虎牙道 Episode 0

逐个视频核对：

1. 视频标题和描述；
2. 视频实际章节/内容边界；
3. 本地 collection 与 episode part；
4. 是完整 collection、单 story、partial 还是 excerpt；
5. uploader；
6. 当前可用性。

只有精确时才显示在内部 Play 旁。`candidate` 和 `partial` 不得伪装成 exact。

### 8.5 后续扩展

收藏夹 UID `313228356` 的全部公开目录可以作为候选队列，但每条仍需独立
分类。即使目录“基本都是相关内容”，仍要排除混放的 Mobage 和 drama。

在已有足够 exact GS 映射之前，不做独立“中文剧情导航”首页入口，也不计算
混合翻译完成率。

---

## 9. P1-C/P1-D：未解资源域

### 9.1 USM

先做：

```text
260 USM inventory
-> 77 known BackMonitor relations
-> 183 unresolved candidates
-> masterdata/consumer hints
-> representative probes
```

报告字段至少包括：

- RAW path/hash/bytes；
- USM 基本媒体信息；
- 已知 bundle/master relation；
- consumer candidate；
- mapping state；
- evidence；
- 是否已被网页消费。

不要在目录阶段批量转 MP4，也不要把视频加入 Git。

### 9.2 `image_*`

先枚举：

- bundle path/hash；
- object type/name；
- container path；
- PathID；
- dimensions；
- sprite/texture relationship；
- masterdata token；
- consumer candidate；
- organizer-export parity candidate。

使用小样本证明提取器，再决定具体 domain。不要一次导出 1,271 个 bundle
的全部 Texture2D/Sprite 到 `public/assets`。

---

## 10. Git 与 PR 边界

### 10.1 提交规则

每批前后执行：

```powershell
git status -sb
git diff --stat
git diff --check
git diff --cached --stat
git diff --cached --check
```

推荐提交：

```text
docs: ...
schema/verifier: ...
candidate/evidence: ...
publish bounded batch: ...
browser acceptance docs: ...
```

不要把以下内容混在一个提交：

- Schema 与大量稳定二进制；
- 真实媒体验收与 source-only test；
- 熟肉 registry 与 USM/image 全域；
- rollback 备份与最终 stable 产物；
- 文档事实修正与无关 UI 重构。

### 10.2 Draft PR #2

PR #2 的真实范围是：

- archive source contract；
- RAW/masterdata 审计和 candidate/promotion 工具；
- 小规模稳定资源 promotion；
- live/chibi/static-stage semantic consumer 迁移；
- Story/RAW 当前事实和治理文档。

PR #2 不应再保持“仅 Story Runtime handoff 文档”的旧标题。

PR 正文应明确：

- base `ef804fcb2b258979723fcf8ce62f317671b4d701`；
- 本地 branch 和最新 HEAD；
- 包含 `101ken`；
- source-only gates；
- mounted RAW/masterdata gates；
- 5174 已验证范围；
- 真实音频仍未 release-accepted；
- USM 183 和 `image_*` 关系仍未解决；
- 熟肉外链只是下一分支设计，不在本 PR 实现。

保持 Draft，直到：

1. checks 通过；
2. PR 正文与真实 diff 一致；
3. reviewer 可按 source contract、data products、runtime consumers、
   stable binary、docs 的顺序审阅；
4. 没有意外生成文件；
5. 用户决定 ready/merge。

不要自动合并。

---

## 11. 验证命令

### 11.1 文档和 Git

```powershell
Set-Location E:\Web_build\SideM_Archived

git status -sb
git diff --check
git log --oneline ef804fcb2b258979723fcf8ce62f317671b4d701..HEAD
```

### 11.2 source-only

```powershell
Set-Location E:\Web_build\SideM_Archived\web_viewer

npm run verify:archive-sources
npm run build
npm run verify:routes
npm run verify:story-schema
npm run verify:story-localization
```

这些命令应根据改动范围选择；不需要每个纯文档提交都重新跑完整 runtime
矩阵。

### 11.3 mounted RAW/masterdata

```powershell
npm run verify:archive
npm run audit:raw-character
npm run audit:live-chibi-semantic-sources
npm run verify:story-raw-promotion
npm run verify:raw-character-promotion
```

注意：`verify:archive` 可能改写 mounted-data report。运行后必须检查：

```powershell
git status --short
git diff --stat
git diff
```

不要把 verifier 副作用当成预先授权的提交。

### 11.4 浏览器

浏览器报告至少记录：

```text
commit:
browser:
tested_at:
URL:
natural entry:
target:
audio mode:
IDM state:
console:
visual result:
resource counters:
quiet endpoint:
status dimension:
remaining boundary:
```

一个 sample 通过只能写 `sample-accepted`，不能写 domain complete。

---

## 12. 明确禁止的捷径

不要：

- 把 10,329 个 compiled JSON 写成 10,329 个故事；
- 把 3,398 个 RAW group 写成全量 strict v2；
- 把 tracked stable PNG 当作 RAW authority；
- 把整理者压缩包重新提升为主源；
- 全量解码 ACB/USM/image bundle 后再想关系；
- 一次性替换所有稳定 URL；
- 递归 `git add -f public/assets`；
- 删除旧资源来“满足”新 policy；
- 把 Bilibili 视频、封面、头像或字幕镜像进仓库；
- 依赖 `idol-master.top` 的页面结构、封面或数据；
- 把 Mobage/drama 混入 GS；
- 把第三方视频记入本地 publication ledger；
- 把 noAudio、Node test 或短时页面测试写成真实音频 release acceptance；
- 看到 PR branch 上 stable-published 就写成 merged。

---

## 13. 每批交付报告模板

```text
未完成：
- ...

Git：
- branch:
- HEAD:
- upstream:
- worktree:
- PR:

本批 scope：
- kind:
- exact IDs/files:
- population:

source：
- authority:
- hashes:
- evidence:

mapping/parity：
- relation:
- comparator:
- result:

publication：
- candidate/stable:
- release ID:
- rollback:

5174：
- URL:
- browser:
- console:
- visible result:
- quiet endpoint:

product acceptance：
- accepted/not accepted:
- missing matrix:

commit：
- hash:
- subject:

下一小步：
- ...
```

---

## 14. 新窗口第一条建议指令

可直接给新窗口：

```text
请先只读核验 E:\Web_build\SideM_Archived 的 branch、HEAD、upstream、
worktree、Draft PR #2、5174，并完整阅读：

1. web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md
2. web_viewer/notes/04_refactor/GS_ARCHIVE_P0_GOVERNANCE_HANDOFF_20260728.md
3. web_viewer/notes/04_refactor/ARCHIVE_MULTIDIMENSIONAL_STATUS_CONTRACT_20260728.md
4. web_viewer/notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md
5. web_viewer/notes/04_refactor/PUBLICATION_LEDGER_CONTRACT_20260728.md
6. web_viewer/notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md

先报告已漂移的事实，再按交接的 P0-A 从最小机器可执行治理提交开始。
保持 5174 小批验证，不批量替换资源，不修改或删除用户未授权的本地数据。
```

---

## 15. 完成定义

### 当前文档治理批

完成条件：

- 当前事实、历史快照、治理契约和本交接都已提交；
- `git diff --check` 通过；
- worktree clean；
- branch 推送；
- Draft PR #2 标题和正文反映真实范围；
- 未把设计 pending 写成已实现。

### P0 总体

只有以下都完成，才能说 P0 governance complete：

- 当前事实报告器；
- binary inventory/schema/verifier；
- publication schema/generator/verifier；
- 第一笔多 part ledger transaction；
- rollback + republish；
- 5174 batch acceptance；
- PR checks 和审阅收口。

只有真实 Edge 音频矩阵、hidden/resume、cross-episode 和 2–4 小时资源曲线
完成，才能说 Story Runtime release-accepted。

熟肉外链、USM 和 `image_*` 是 P0 之后的独立轨道。它们有明确优先级，但不应
阻塞当前 PR #2 的事实治理和安全合并。
