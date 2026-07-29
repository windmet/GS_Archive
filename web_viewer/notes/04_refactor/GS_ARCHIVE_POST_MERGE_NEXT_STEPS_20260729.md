# GS Archive 合并后下一步指导

状态：当前执行入口
日期：2026-07-29
仓库：`E:\Web_build\SideM_Archived`
应用：`E:\Web_build\SideM_Archived\web_viewer`

## 1. 当前结论

RAW/masterdata 迁移和 P0 governance 已经合并，不应继续按 Draft PR #2
阶段的待办执行。

当前已核验 Git 状态：

| 项 | 当前值 |
| --- | --- |
| merged base branch | `master` |
| merged base HEAD | `724ec9885eee1e782aa5104d0a9809b425e221b3` |
| active track branch | `codex/gasha-skill-exact-relations`, created from `724ec98` |
| active track | P1-H exact gasha-skill relations：12 speakers / 12 bundles |
| upstream | 尚未推送 |
| worktree | P1-H changes present at status refresh |
| open PR | none at status refresh |
| PR #14 | merged as `724ec9885eee1e782aa5104d0a9809b425e221b3` |
| PR #14 final-head check | Source-only contract PASS，run `30474034791` |
| PR #14 post-merge check | `master` push Source-only contract PASS，run `30474109000` |
| PR #13 | merged as `46467c0b050a941ebb8bdf7100d29a8acf5965e5` |
| PR #13 final-head check | Source-only contract PASS，run `30473138598` |
| PR #13 post-merge check | `master` push Source-only contract PASS，run `30473202211` |
| PR #12 | merged as `94a92c96484eea6240aa038e4bceec4e811c55f3` |
| PR #12 final-head check | Source-only contract PASS，run `30472410088` |
| PR #12 post-merge check | `master` push Source-only contract PASS，run `30472488130` |
| PR #11 | merged as `28930e18ba13c230a4d23d4f61f135fd9a9cf1ea` |
| PR #11 final-head check | Source-only contract PASS，run `30471508307` |
| PR #11 post-merge check | `master` push Source-only contract PASS，run `30471575433` |
| PR #10 | merged as `6991015bf513ca27e98acd1fd7e18012c4f3c740` |
| PR #10 final-head check | Source-only contract PASS，run `30471238191` |
| PR #10 post-merge check | `master` push Source-only contract PASS，run `30471307383` |
| PR #9 | merged as `d38c52f1a27f034f6a209993109b626839ec74af` |
| PR #9 final-head check | Source-only contract PASS，runs `30463989933` and `30465221234` |
| PR #9 post-merge check | `master` push Source-only contract PASS，run `30470397679` |
| PR #8 | merged as `579df6188063c4a34c0558cd720273e71401f888` |
| PR #8 final-head check | Source-only contract PASS，run `30462761046` |
| PR #8 post-merge check | `master` push Source-only contract PASS，run `30462843307` |
| PR #7 | merged as `31bac763c4abd01535842452810a75abc4bef40b` |
| PR #7 final-head check | Source-only contract PASS，run `30461240645` |
| PR #7 post-merge check | `master` push Source-only contract PASS，run `30461311887` |
| PR #6 | merged as `fdce87478044bfa1f7c9e8dfffe934dbdd2e14ef` |
| PR #6 final-head check | Source-only contract PASS，run `30460259713` at `35121ed` |
| PR #6 post-merge check | `master` push Source-only contract PASS，run `30460342231` at `fdce874` |
| PR #5 | merged as `9e4fd7d9829979626aae26b4e256e3f97eb19f16` |
| PR #5 final-head check | Source-only contract PASS，run `30458635548` at `4e11510` |
| PR #5 post-merge check | `master` push Source-only contract PASS，run `30458806049` at `9e4fd7d` |
| PR #4 | merged as `2a1e1ec08ae6331b82f7ac9d9719efbb3322e59e` |
| PR #4 final-head check | Source-only contract PASS，run `30450883462` at `9215456` |
| PR #4 post-merge check | `master` push Source-only contract PASS，run `30452463385` at `2a1e1ec` |
| PR #2 | merged as `bca7042c1d87b261b98f21b5957a36c2eb99f6b1` |
| PR #3 | merged as `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| PR #2 final check | Source-only contract PASS, run `30435933524` |
| PR #3 check | Source-only contract PASS, run `30437147325` |
| local server | `127.0.0.1:5174`, PID 27536 at refresh time |
| production build | P1-H local Vite build PASS，2,405 modules / 144.2 seconds |

PR #2 合入了：

- RAW/masterdata source contract；
- 全域或代表性资源审计；
- candidate/parity/publish/rollback 工具；
- birthday 视觉资源，包括 `101ken`；
- event visual；
- live/chibi/static-stage 语义消费者迁移；
- baseline reporter；
- tracked binary inventory；
- publication ledger；
- `1_4_001_00` 第一笔真实多 part transaction；
- Story Runtime 的短时真实音频修复与验收。

PR #3 只修正合并后的状态文档，没有扩大运行时范围。

## 2. 尚未完成，按独立轨道排列

### P0-G：治理一致性与新发布写锁

当前 authoritative v2 实际为：

```text
ledger-governed:
- collection 1_4_001_00 / 3 artifacts

pre-ledger:
- collection 1_4_001_01 / 11 artifacts
- collection 5_01_101_22 / 3 artifacts
- standalone 1_x_001tom_2_1_2_001_12 / 1 artifact

total:
3 collections + 1 standalone / 18 artifacts
```

当前分支已经增加独立机器 registry：

```text
schemas/authoritative-story-publications-v1.schema.json
public/data/authoritative_story_publications.json
```

每项至少记录：

- logical ID；
- `collection` 或 `standalone`；
- aggregate/episode artifact 路径；
- v2 schema/runtime contract；
- authoritative evidence；
- `ledger-governed` 或 `pre-ledger`；
- release ID 或 promotion registry evidence。

Baseline reporter 从这个 registry、publication manifest 和当前验证模式可用的
artifact 交叉验证，输出：

```text
collection_count
standalone_count
artifact_count
ledger_governed
pre_ledger
```

实现边界：

- registry Schema、logical/artifact uniqueness、角色形状和 ledger ownership
  在 source-only 与 mounted 模式都检查；
- ledger-governed 的 3 个 tracked artifact 在两种模式都必须存在并保持
  Runtime v2 身份；
- 15 个 ignored pre-ledger artifact 不属于 source-only checkout，source-only
  只验证它们的声明人口与 ownership；
- mounted 模式才核对这 15 个文件的存在、Runtime v2 contract 和 scenario
  identity；
- `06e71f7` 已在不包含 ignored compiled corpus 的干净 worktree 中通过
  authoritative registry、archive baseline source-only 和 publication ledger。

治理写锁：

- authoritative 数量、EOL canonical identity 和 v1 freeze 已完成；v2
  Schema/verifier 已激活，但本契约分支不新增 ledger release，未来每笔
  transaction 仍须使用独立有界分支和完整证据；
- 不做 PNG backfill；
- 不发布 `003hok` 或第二笔 Story transaction；
- 不修改已合并 v1 release 的 bytes/hash；
- Runtime 长稳和 GS 外链 metadata/UI 不受该写锁阻塞。

### P0-R：Story Runtime 2–4 小时长稳

这是当前唯一仍阻止 Story Runtime 写成 `release-accepted` 的项目。

2026-07-29 用户决定暂缓正式长稳，把当前工作优先级转移到其他 archive
部分。该决定不撤销已有短时真实音频 PASS，也不把 2–4 小时矩阵伪写成完成；
本项保持 `deferred / NOT EXECUTED`，之后仍从明确的 `master` commit 单独执行。

已经通过：

- Chromium first gesture；
- Voice、SE、BGM、Ambient；
- cross-episode；
- Menu pause/resume；
- debug visibility pause/resume；
- Microsoft Edge first click；
- Edge 操作系统最小化暂停和恢复续播；
- 短时人工听感；
- 跨场景 timer receiver 修复。

仍需：

1. 固定一个明确的 `master` commit；
2. 2–4 小时混合执行 Next、Auto、Skip、Backlog、Choice、episode 切换；
3. 记录最后 25% 的资源曲线；
4. 到达安静终点；
5. 判断 AudioContext、MediaElement、active source、cleanup timer、Pixi、
   Spine、stage child 和 heap 是否回到稳定范围；
6. 输出 recorder JSON 和审计结论；
7. 单独提交验收文档，不顺带开发新功能。

详细矩阵：

```text
notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md
```

建议分支：

```text
codex/story-runtime-long-soak
```

通过条件不是“播放两小时没有明显报错”，而是：

- 样本覆盖矩阵完整；
- 资源曲线没有持续单调增长；
- quiet endpoint 收敛；
- console boundary 可解释；
- 浏览器、commit、URL、音频模式和 IDM 状态有记录。

IDM 已由用户确认删除。不要重新引入下载器变量。

### P0-S：解决 mounted RAW 的 18 个 WAV 漂移

状态：**merged in PR #5**。已完成逐文件归因、源缺陷
修复和可恢复 quarantine；没有删除 WAV，也没有更新 recorded baseline。

已记录 RAW 基线：

```text
13,000 files
8,232,049,221 bytes
RAW/audio: 4,098 files
WAV: 0
```

处置前 live tree：

```text
13,018 files
8,645,733,285 bytes
RAW/audio: 4,116 files
WAV: 18
extra bytes: 413,684,064
```

归因结论：

1. 17 个文件逐字节等于 `song3_drvalv.acb` selections 1–17 的 vgmstream
   PCM 解码；
2. 1 个文件逐字节等于 `song3_drv999.acb` selection 1 的解码；
3. 全部为 44.1 kHz、双声道、130.285737 秒、22,982,448 bytes；
4. 创建窗口与 live-chibi audio source regression 精确重合；
5. 根因是 `prepare-live-chibi-audio.py` 用 `-I` 读取 metadata 时遗漏
   `-m`，导致 vgmstream 同时写默认 WAV；
6. `eb44640` 已修复并增加 source gate。

完整证据：

```text
notes/03_audit/RAW_AUDIO_WAV_PROVENANCE_20260729.md
```

已完成处置：

- 18 个文件移动到
  `web_viewer/.analysis/raw-migration/generated-wav-quarantine/`
  `20260729-live-chibi-metadata-inspection/`；
- 独立子目录没有覆盖两个旧同名 quarantine 文件；
- 目标 18/18 SHA-256 与审计清单一致；
- 修复后的真实 metadata 检查覆盖 17 + 1 streams，RAW 未重新产生 WAV；
- 当前 live tree 恢复为 `13,000 files / 8,232,049,221 bytes /
  RAW/audio 4,098 / WAV 0`；
- mounted 与 source-only baseline verifier 均通过；
- quarantine 仍被 `.gitignore` 排除，没有提交派生二进制。

建议分支：

```text
codex/raw-audio-wav-provenance
```

### P0-G2：publication ledger Windows 换行门禁（已完成）

合并后的 GitHub Linux gate 通过，但当前 Windows checkout：

```text
core.autocrlf=true
Git attribute: text
```

曾使第一笔 transaction 的三个 JSON 在 worktree 中使用 CRLF。Ledger 记录的是
canonical Git blob 的 LF bytes：

| Artifact | Ledger/Git blob | Windows worktree | Delta |
| --- | ---: | ---: | ---: |
| `1_4_001_00.json` | 336,694 | 348,594 | 11,900 |
| `1_4_001_00_a.json` | 174,502 | 180,447 | 5,945 |
| `1_4_001_00_b.json` | 162,250 | 168,206 | 5,956 |

每个 delta 恰好等于文件行数；Git status 仍为 clean。`ae287b3` 已完成修复，
没有修改历史 release bytes/hash：

```text
candidate:
deterministic LF output + semantic verification

staged pre-commit:
index blob bytes/hash

committed release:
HEAD blob bytes/hash + index blob bytes/hash

runtime worktree:
file exists + JSON parse + schema + semantic equality + Vite read
```

Verifier 对已提交 artifact 同时核对 HEAD blob 与 index blob；对尚未进入 HEAD
的新 artifact 使用 index blob，并保留 worktree JSON parse 与 semantic
equality。第一笔 transaction 的三个精确路径和 publication metadata JSON 使用
`text eol=lf`。没有对
`public/data/compiled/**/*.json` 全域 renormalize。Windows 当前 checkout 与
`75f9cb1` 干净 checkout 的 publication verifier 均通过。

该修复已随 PR #4 合入 `master`；不要再复用
`codex/post-merge-next-guidance`，也不要创建旧建议分支
`codex/publication-ledger-windows-eol`。

### P0-G3：冻结 v1，激活 v2 与 annotation 契约

状态：**merged in PR #7**。merge commit `31bac763c4abd01535842452810a75abc4bef40b`，
post-merge source gate `30461311887` 通过。

以下文件保持字节不可变：

```text
schemas/publication-release-v1.schema.json
public/data/publication/releases/2026-07-28-story-1-4-001-00-001.json
```

仅保留文件还不足以冻结 v1。Verifier 必须使用历史 v1 release ID allowlist
或版本 cutoff，拒绝新的 v1 release。

v1 freeze 已由以下文件机器化：

```text
policies/publication-ledger-versions.v1.json
schemas/publication-ledger-version-policy-v1.schema.json
public/data/publication/annotations/.gitkeep
```

- v1 为 `frozen`，allowlist 必须与实际 v1 release ID 集合双向完全一致：
  既不能遗漏历史 release，也不能保留没有对应 release 文件的“幽灵 ID”；
- v2 release 与 v1 annotation 已由 `dc5405d` 从 `reserved` 激活为
  `active`；
- verifier 拒绝新增 v1、冻结 allowlist 漂移、未知/保留版本以及不符合独立
  Schema 的 release/annotation JSON；
- 版本策略 Schema 要求 `active` / `reserved` release 版本的 allowlist 为空；
- `active` 表示未来记录可以进入严格校验，不表示已经存在或接受第二笔
  production transaction。

当前分支已新增：

```text
schemas/publication-release-v2.schema.json
schemas/publication-annotation-v1.schema.json
public/data/publication/annotations/
public/data/publication/annotation_index.json
scripts/generate-publication-annotation-index.mjs
```

v2 应支持：

- `previous_state.kind`: `absent`、`governed-release`、
  `unmanaged-existing`；
- accepted browser evidence 的 commit、browser name/version/environment、
  非空 URL/time/evidence；
- publish/replace/republish 的非空 `published`；
- RAW 子资源发布的非空 `source.objects`；
- backup manifest path、SHA-256、format/version。

Annotation 必须：

- 有唯一 annotation ID 和 target release ID；
- append-only；
- 只解释历史语义，不覆盖 release 字段；
- 不改变 `manifest.by_logical_id` 的稳定状态重放；
- 由独立 Schema、verifier 和审计索引管理；
- 不提供原地删除或修改已合并 annotation 的捷径。

当前验证：

- 真实历史保持 `1 release / 1 stable logical ID`；
- annotation 历史和索引均为空；
- v2 正向 fixture 覆盖 absent publish、unmanaged-existing backfill、
  governed rollback 与 backup-manifest identity；
- 反例覆盖空 `published`、空 `source.objects`、缺浏览器环境、空 unmanaged
  artifacts、缺 backup identity 和 annotation 越权字段；
- CI 将 base SHA 传给 verifier，历史 release/annotation 的 modify、delete、
  rename 均失败，新文件允许进入后续 Schema/关系校验；
- annotation index 可重复生成，annotation 不参与
  `manifest.by_logical_id` replay。

### P1-A：GS-only 社区熟肉外链试点

状态：**merged in PR #6**。merge commit `fdce874`，post-merge source gate
`30460342231` 通过。

已完成：

- `8d3d582`：v1 Schema、两条 exact event registry、离线 verifier 和 CI；
- `09ded27`：`ArchiveEventDetail` / `ArchiveStoryDetail` UI、精确匹配器和
  UI source gate；
- 5174 实测两个活动页分别只命中自己的 BVID 和 uploader；
- 剧情详情保留内部 Play，同时显示同一 exact 外链；
- 外链为 canonical Bilibili URL，使用
  `target="_blank"` 与 `rel="noopener noreferrer external"`；
- 390px viewport 无横向溢出；
- 页面没有远程图片请求；
- 无映射活动不显示外链；
- `externalStoryResources` 没有加载错误。

完整 Vite build 在 183 秒达到本地有界执行上限并终止，因此本分支不能写成
build PASS；独立数据/UI/route verifier 均通过。

产品边界：

- `idol-master.top` 仅是灵感参照；
- 不依赖其数据、页面或封面；
- Bilibili 收藏夹只用于发现候选；
- 直接链接原始 Bilibili 视频；
- 署名原视频 uploader；
- 只收录 GROWING STARS；
- 排除 Mobage、CD/song drama、live、clip 和 unknown；
- 不镜像视频、封面、头像或字幕；
- 不把第三方视频写入本地 publication ledger；
- 不创建 GS masterdata 中不存在的“单卡剧情”分类。

当前试点只做两个 exact event：

| BVID | 本地关系 |
| --- | --- |
| `BV1ac411S7KB` | event `10008` / story `1_3_10008_01` |
| `BV1od4y1x7X6` | event `30014` / story `1_3_30014_01` |

THE 虎牙道 Episode 0 三条仍是候选：

| BVID | 候选 collection |
| --- | --- |
| `BV1LL411G7LD` | `1_1_013the_01` |
| `BV1xA4y1S7Cb` | `1_1_013the_02` |
| `BV16u4y187tH` | `1_1_013the_03` |

必须观看或检查实际内容边界后，才能将候选提升为：

- `exact-story`；
- `exact-collection`；
- `partial-story`；
- 或继续保持 `candidate`。

建议分支：

```text
codex/external-story-links-pilot
```

已执行顺序：

1. Schema + registry + 两条 exact event + verifier：完成；
2. `ArchiveEventDetail` / `ArchiveStoryDetail` UI：完成；
3. 5174 内部 Play 保留与外部链接呈现回归：完成；
4. 三条 Episode 0 覆盖核对：未开始；
5. 只有精确关系才进入内部详情页：已由 matcher 和 verifier 固定。

详细契约：

```text
notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md
```

### P1-B：260 USM 关系目录

状态：**merged in PR #8**。merge commit `579df6188063c4a34c0558cd720273e71401f888`，
post-merge source gate `30462843307` 通过。

当前目录已经记录：

- 260 个 USM / `2,143,803,200` bytes；
- 77 个精确 BackMonitor 消费关系，其中 73 个 movie、4 个 transition；
- 183 个语义未解决；
- 260 个 SHA-256、CRID magic 和 ffprobe header；
- 52 个文件命中 22 个精确 `music_catalog.songs` filename token；
- 260 条 RAW relative path、媒体信息、consumer candidate、mapping state 和
  evidence。

机器入口：

```text
schemas/usm-relation-catalog-v1.schema.json
public/data/usm_relation_catalog.json
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
notes/03_audit/RAW_USM_RELATION_CATALOG_20260729.md
```

source-only 与 mounted verifier 均通过 `260 / 77 / 183`；mounted 模式还逐文件
复核 bytes、CRID 和 SHA-256。Archive baseline 已改为从 committed catalog
读取 USM 与 BackMonitor 关系，因此 source-only 不再依赖某次 mounted 快照。

本批没有批量转 MP4、没有发布、没有加入 Git 媒体。下一批若继续 USM，必须从
183 个 unresolved 中选择有界 family，不能把 filename candidate 提升成精确关系。

### P1-C：1,271 个 `image_*` bundle 关系目录

状态：**merged in PR #9**。

当前目录已经记录：

- 1,271 bundles / `263,071,090` bytes；
- 9,157 Unity objects / 7,826 container entries；
- 7,816 image objects，其中 3,928 Sprite、3,888 Texture2D；
- 3,885 个 direct Sprite-to-Texture2D PathID；
- 310 个 bundle 中的 865 个 exact delimiter-bounded masterdata token；
- 52 个 bundle / 136 个 image object 的 tracked-PNG basename parity
  candidate；
- bundle path/hash、object type/name、container path、十进制字符串 PathID、
  dimensions、consumer candidate、mapping state 和 evidence。

机器入口：

```text
schemas/image-bundle-relation-catalog-v1.schema.json
public/data/image_bundle_relation_catalog.json
scripts/generate-image-bundle-relation-catalog.py
scripts/verify-image-bundle-relation-catalog.mjs
notes/03_audit/RAW_IMAGE_BUNDLE_RELATION_CATALOG_20260729.md
```

source-only 与 mounted verifier 均通过 `1,271 bundles / 7,816 image
objects`；mounted 模式还逐文件复核 bytes、UnityFS 和 SHA-256。Archive
baseline 已接入 committed relation summary。

本批没有导出 PNG、没有替换 `public/assets`、没有把 basename 或 filename
candidate 写成 stable relation。

### P1-D：角色图片 stable-promotion 关系细化

状态：**merged in PR #10**。

P1-C 合并后的去重审计确认：57 个 `chara` bundle 中，50 个物理 bundle
已由既有 `raw_character_image_promotions.json` 提供 52 条完整 stable
promotion 证据；P1-C 目录此前仍把这些 bundle 降格记录为
`organizer-export-candidate`。当前分支将它们升级为
`stable-promotion`，逐项交叉核对：

- RAW relative path、bytes 和 SHA-256；
- Unity object PathID、type、name 和 container path；
- stable PNG URL、bytes、dimensions 和 SHA-256；
- promotion kind 与 idol code；
- promotion registry 52/52 覆盖。

剩余 7 个合辑型 `chara` bundle 保持 `masterdata-candidate`，没有新导出
PNG、没有替换资产、没有新增 publication transaction。全目录的新
mapping 分布为：

```text
50 stable-promotion
2 organizer-export-candidate
260 masterdata-candidate
959 filename-candidate
```

### P1-E：gasha banner/logo exact relations

状态：**merged in PR #12**。

只读分层确认 433 个 `gasha` bundle 包含 195 banner、195 logo、25 bg、
12 skill、4 balloon 和 2 button。当前 committed `gasha_index` 有 61 个
unique code，其中 49 个 code 在 RAW 中各自严格命中一对完整文件名：

```text
image_gasha_banner_<code>
image_gasha_logo_<code>
```

因此当前分支只为这 49 个 code 写入 98 条
`exact_bundle_filename_gasha_code` 关系。verifier 独立重建并要求：

- code 在 gasha index 中唯一；
- bundle ID 完整匹配，不接受子串或近似匹配；
- 每条关系仍有 `gasha_index.gashas.code` token evidence；
- 每个覆盖 code 恰好是一条 banner + 一条 logo；
- 总边界固定为 49 codes / 98 bundles。

其余 335 个 gasha bundle 不升级。12 条 index code 在当前 RAW image
population 中没有 banner/logo，明确保持未覆盖。没有导出 PNG、没有替换
资产、没有新增 ledger transaction。

### P1-F：event item-icon exact relations

状态：**merged in PR #13**。

当前分支只处理完整匹配
`image_item_icon_event_<code>[_n|_r]` 的 bundle。committed event index
有 59 个 unique code，其中 19 个出现在该有界 RAW 子族：

```text
10001–10018: 18 base variants
20001: n + r variants
```

因此新增 20 条 `exact_bundle_filename_event_code` 关系。每条记录保留
event code、name、type/type label、固定 role `item-icon` 和原始 variant
code。`n/r` 不展开解释，避免把文件名缩写升级成未经证明的语义。

verifier 独立从 bundle ID 与 event index 重建关系，并要求 20 relations /
19 codes、对应 token evidence，以及 `20001` 严格只有 `n/r`。其余 172 个
item bundle 不变；没有导出或替换 PNG。

### P1-G：honor-event exact relations

状态：**merged in PR #14**。

当前分支只处理完整匹配 `image_honor_event_<code>` 的 bundle。当前 RAW
子族共有 41 个 bundle，其中 40 个 code 同时满足：

- committed event index 中有唯一记录；
- bundle ID 完整匹配，不接受子串或近似匹配；
- 已有 `event_index.events` delimiter-bounded token evidence。

覆盖范围为 `10001–10020`、`30001–30018` 和 `40001–40002`，共 40
codes / 40 bundles。关系固定记录 role `honor`、variant `base` 和
`exact_bundle_filename_event_code`。

`image_honor_event_30026001` 在 event index 中没有记录或 token，因此明确
保持 `filename-candidate`。本批只证明 bundle 属于哪个 event，不解释
bundle 内各 Sprite/Texture2D 对象的用途，也不导出 PNG。

### P1-H：gasha-skill exact speaker relations

状态：**implemented on branch / pending review**。

当前分支只处理完整匹配
`image_gasha_skill_<speaker-id>_<ssr02|ssr03>` 的 12 个 bundle。每个 bundle
均只有一组同名 Sprite/Texture2D，每个 speaker ID 在 committed speaker
dictionary 中唯一且类型为 `idol`，并已有 delimiter-bounded token
evidence。

因此新增 12 条 `exact_bundle_filename_speaker_code` 关系，覆盖 7 个
`ssr02` 和 5 个 `ssr03`。关系只证明 bundle 与 idol speaker 的归属；
不把后缀解释成具体卡片、技能或 gasha release。

升级后 mapping 分布为：

```text
50 stable-promotion
170 exact-masterdata-relation
2 organizer-export-candidate
90 masterdata-candidate
959 filename-candidate
```

剩余 90 个 masterdata candidate 为聚合多 speaker bundle、event/seasonal
数字命名空间碰撞或其他非一对一关系，不能仅凭 token 批量升级。

## 3. 三轨依赖图

```text
master 724ec98
  |
  +-- completed Track S: PR #5
  |     18 WAV provenance complete
  |     -> generator fixed
  |     -> recoverable quarantine complete
  |     -> mounted baseline PASS
  |
  +-- completed Track G: PR #7
  |     3+1 / 18
  |     -> v2 + annotation contracts active
  |     -> no new production record
  |
  +-- deferred Track R: Runtime acceptance
  |     fixed Runtime commit
  |     -> 2–4h soak
  |     -> quiet endpoint
  |     -> PASS / FAIL
  |
  +-- Track P
        completed pilot: PR #6, two exact GS event links + UI
        completed P1-B: PR #8, 260 USM relation catalog
        completed P1-C: PR #9, 1,271 image bundle relation catalog
        completed P1-D: PR #10, 50 bundles / 52 exact character promotions
        completed P1-E: PR #12, 49 codes / 98 exact gasha banner-logo relations
        completed P1-F: PR #13, 19 codes / 20 exact event item-icon relations
        completed P1-G: PR #14, 40 codes / 40 exact honor-event relations
        active P1-H: 12 speakers / 12 exact gasha-skill relations
```

PR #4 已通过 merge commit `2a1e1ec` 合入 `master`，post-merge gate
`30452463385` 通过。PR #5 已通过 merge commit `9e4fd7d` 合入 `master`，
post-merge gate `30458806049` 通过。Track R 已由用户暂缓；Track S 已完成；
Track P 的首个 exact GS pilot 已由 PR #6 合并，post-merge gate
`30460342231` 通过。Track G 已由 PR #7 合并，post-merge gate
`30461311887` 通过；它只激活 Schema/verifier，不包含新的
release/annotation。P1-B 已由 PR #8 合并，post-merge gate `30462843307`
通过。PR #9 已通过 merge commit `d38c52f` 合入 `master`，post-merge gate
`30470397679` 通过。PR #10 已通过 merge commit `6991015` 合入
`master`，post-merge gate `30471307383` 通过。PR #11 已通过 merge
commit `28930e1` 合入 `master`，post-merge gate `30471575433` 通过。
PR #12 已通过 merge commit `94a92c9` 合入 `master`，post-merge gate
`30472488130` 通过。PR #13 已通过 merge commit `46467c0` 合入
`master`，post-merge gate `30473202211` 通过。PR #14 已通过 merge
commit `724ec98` 合入 `master`，post-merge gate `30474109000` 通过。
Track R 继续 deferred；P1-H 当前独立收口，不要把 rarity 后缀升级成
未经证明的卡片或技能语义。

## 4. 每条轨道的 Git 边界

开始前：

```powershell
Set-Location E:\Web_build\SideM_Archived
git switch master
git pull --ff-only
git status -sb
git rev-parse HEAD
```

当前 active 功能分支是：

```text
codex/gasha-skill-exact-relations
```

它只承载 12 个 committed idol speaker 与 12 个 gasha-skill bundle 的
exact relation、Schema/verifier、baseline 和审计文档；不导出或提交 PNG，
不混入 Runtime 长稳、publication transaction、USM promotion 或 Episode
0 候选。PR #4 到 PR #14 的分支已经完成；不要继续复用：

```text
codex/post-merge-next-guidance
codex/post-merge-story-handoff
codex/pr2-post-merge-status
```

以下分支均已合入 `master`，不再承载新工作；可按用户决定删除本地/远端引用：

```text
codex/story-localization-contract
codex/post-merge-story-handoff
codex/pr2-post-merge-status
codex/post-merge-next-guidance
codex/image-bundle-relation-catalog
codex/chara-image-relation-refinement
codex/post-p1d-handoff
codex/gasha-image-exact-relations
codex/event-item-icon-exact-relations
codex/honor-event-exact-relations
```

Codex 管理目录中指向初始提交 `ca3a28e` 的 detached worktree 不是项目开发
分支，不作为基线，也不要在其他任务仍可能使用时手动删除。

每个提交前：

```powershell
git status -sb
git diff --stat
git diff --check
git diff --cached --stat
git diff --cached --check
```

不要在一个提交中混合：

- 长稳验收与功能开发；
- WAV 审计与删除/迁移；
- 熟肉 registry 与 USM；
- Schema 与大批二进制；
- candidate 与全量 stable replacement。

## 5. 5174 规则

当前端口在刷新时由 PID 27536 监听。新窗口仍需重新核对，不要把 PID 当成
长期事实。

所有页面改动保持小批验证：

1. 记录 branch/commit；
2. 使用自然入口；
3. 记录完整 URL；
4. 检查 console；
5. 检查内部 Play；
6. 检查外部按钮时确认新标签和 canonical URL；
7. 检查 mobile layout；
8. 明确 sample/item/collection/domain scope。

`noAudio=1`、Node verifier、source-only CI 和短 recorder 都不能替代真实音频
长稳。

## 6. 新窗口启动指令

```text
请先只读核验 E:\Web_build\SideM_Archived 的 branch、HEAD、upstream、
worktree、origin/master，并确认当前 active branch 为
codex/gasha-skill-exact-relations、base master=724ec98，PR #14
post-merge run 30474109000 通过。

完整阅读：
1. web_viewer/notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md
2. web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md
3. web_viewer/notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md
4. web_viewer/notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md
5. web_viewer/notes/03_audit/RAW_USM_RELATION_CATALOG_20260729.md
6. web_viewer/notes/03_audit/RAW_IMAGE_BUNDLE_RELATION_CATALOG_20260729.md
7. web_viewer/notes/03_audit/GASHA_IMAGE_EXACT_RELATIONS_20260730.md
8. web_viewer/notes/03_audit/EVENT_ITEM_ICON_EXACT_RELATIONS_20260730.md
9. web_viewer/notes/03_audit/HONOR_EVENT_EXACT_RELATIONS_20260730.md
10. web_viewer/notes/03_audit/GASHA_SKILL_EXACT_RELATIONS_20260730.md

先确认当前分支的 image catalog 为 1,271 bundles / 263,071,090 bytes /
9,157 Unity objects / 7,816 image objects，source-only 与 mounted verifier
均通过。
真实 ledger 仍为 1 release / 1 stable logical ID，没有新增 production record。
Story Runtime 2–4 小时长稳由用户暂缓，仍保持 NOT EXECUTED。P1-D 已把
promotion registry 已证明的 50 bundles / 52 relations 升级为
stable-promotion，其余 7 个 chara 合辑仍为 candidate。P1-E 已完成
`gasha` 有界子族的只读审计，只把 gasha index
唯一证明的 49 banner/logo pairs（98 bundles）升级为
exact-masterdata-relation，其余 335 个 gasha bundle 保持原状态；不得
顺带扩充。P1-F 只把 event index 唯一证明的 19 codes / 20 item-icon
bundles 升级为 exact-masterdata-relation，其余 172 个 item bundle 不变；
P1-G 只把 event index 唯一证明的 40 codes / 40 honor-event bundle
升级为 exact-masterdata-relation；`image_honor_event_30026001` 明确保留为
candidate，且不推断内部对象语义；
P1-H 只把 speaker dictionary 唯一证明的 12 speakers / 12 gasha-skill
bundle 升级为 exact-masterdata-relation，保留 `ssr02`/`ssr03` 原始后缀但
不推断卡片或技能语义；其余 90 个 masterdata candidate 不得按 token
存在性批量升级；
不得批量导出 PNG、替换 `public/assets`、新增 ledger release 或回填其他
二进制。
```

## 7. 完成定义

Story Runtime：

- 2–4 小时混合矩阵完成；
- 最后 25% 资源曲线完整；
- quiet endpoint 收敛；
- audit 明确 PASS/FAIL；
- 才能评估 `release-accepted`。

RAW WAV 漂移：

- 18 条逐文件来源已判定；
- recorded/live 差异有明确处置；
- destructive action 已另获授权；
- mounted verifier 得到可信结论。

Publication ledger：

- Linux 与 Windows 使用同一 canonical byte identity；
- 三个 stable JSON 的 ledger size/hash 在两端通过；
- 没有无界 renormalize 历史 JSON；
- runtime 仍能读取三个产物；
- release history 没有被改写。

Authoritative registry：

- mounted 模式验证 3 collections + 1 standalone / 18 artifacts；
- source-only 模式不依赖 15 个 ignored pre-ledger artifact；
- ledger-governed 3 artifacts 在两种模式均验证；
- clean checkout registry、baseline 与 publication ledger 全部通过。

GS 熟肉 pilot：

- Schema/verifier 通过；
- 两条 exact event relation 存在；
- 不含 Mobage/drama；
- 不含 remote thumbnail；
- 5174 内部与外部动作均通过；
- Episode 0 候选没有被误写成 exact。

USM/image：

- USM machine-readable relation catalog 已覆盖 260/260；
- 77 个 BackMonitor 精确关系由 RAW choreography 与现有 index 双重证明；
- 183 个 unresolved 保持未解决，不把 filename candidate 写成 exact；
- source-only 与 mounted verifier 通过；
- 未进行批量解码或稳定发布；
- image relation catalog 已覆盖 1,271/1,271 bundles 和 7,816 image
  objects；
- image source-only 与 mounted verifier 通过；
- 未导出 PNG 或替换 stable assets。
