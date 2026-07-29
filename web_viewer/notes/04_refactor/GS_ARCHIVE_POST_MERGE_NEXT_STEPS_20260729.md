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
| active governance branch | `codex/post-merge-next-guidance`, created from `4e416a6` |
| base HEAD | `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| reviewed implementation HEAD | `75f9cb1 fix: verify committed publication identity`；本状态文档提交随后 |
| upstream | `origin/codex/post-merge-next-guidance`，在状态刷新前与 HEAD 一致 |
| worktree | clean at status refresh |
| open PR | none at status refresh |
| PR #2 | merged as `bca7042c1d87b261b98f21b5957a36c2eb99f6b1` |
| PR #3 | merged as `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| PR #2 final check | Source-only contract PASS, run `30435933524` |
| PR #3 check | Source-only contract PASS, run `30437147325` |
| local server | `127.0.0.1:5174`, PID 27536 at refresh time |
| production build | PASS at `a68cd60`，2404 modules，2m30s；后续提交只改 verifier/CI/docs |

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

- authoritative 数量、EOL canonical identity 和 v1 freeze 已完成，但 v2
  仍为 `reserved`；v2 Schema 激活前不新增 ledger release；
- 不做 PNG backfill；
- 不发布 `003hok` 或第二笔 Story transaction；
- 不修改已合并 v1 release 的 bytes/hash；
- Runtime 长稳和 GS 外链 metadata/UI 不受该写锁阻塞。

### P0-R：Story Runtime 2–4 小时长稳

这是当前唯一仍阻止 Story Runtime 写成 `release-accepted` 的项目。

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

已记录 RAW 基线：

```text
13,000 files
8,232,049,221 bytes
RAW/audio: 4,098 files
WAV: 0
```

当前 live tree：

```text
13,018 files
8,645,733,285 bytes
RAW/audio: 4,116 files
WAV: 18
extra bytes: 413,684,064
```

这 18 个 WAV 很可能是后续解码或验收产生的派生文件，但在完成来源核对前
不能直接下结论。

下一步只能先只读审计：

1. 列出 18 个精确路径；
2. 记录 size、SHA-256、创建/修改时间；
3. 检查是否能映射回 ACB/AWB cue；
4. 搜索生成脚本、命令记录和 `.analysis` 证据；
5. 判断它们是原始 RAW、派生 cache、临时验收文件还是未知；
6. 给出保留、迁移到 ignored derived 目录或删除的建议；
7. 涉及移动或删除时重新取得用户授权。

在这一步完成前：

- recorded manifest 仍是权威基线；
- mounted verifier 正确失败；
- 不把 13,018 静默更新成新基线；
- 不删除或移动 WAV；
- 不把 WAV 加入 Git。

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

该修复已包含在当前 `codex/post-merge-next-guidance`，不要再创建旧建议分支
`codex/publication-ledger-windows-eol`。

### P0-G3：冻结 v1（已完成），设计 v2 与 annotation（待独立实现）

以下文件保持字节不可变：

```text
schemas/publication-release-v1.schema.json
public/data/publication/releases/2026-07-28-story-1-4-001-00-001.json
```

仅保留文件还不足以冻结 v1。Verifier 必须使用历史 v1 release ID allowlist
或版本 cutoff，拒绝新的 v1 release。

当前分支已将这一部分机器化：

```text
policies/publication-ledger-versions.v1.json
schemas/publication-ledger-version-policy-v1.schema.json
public/data/publication/annotations/.gitkeep
```

- v1 为 `frozen`，allowlist 仅含既有 release；
- v2 release 与 v1 annotation 均为 `reserved`；
- verifier 拒绝新增 v1、未知/保留 release 版本以及尚未受 Schema 管理的
  annotation JSON；
- `reserved` 只占用版本号和目录，不表示已经允许写入。

后续仍需新增：

```text
schemas/publication-release-v2.schema.json
schemas/publication-annotation-v1.schema.json
public/data/publication/annotations/
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

### P1-A：GS-only 社区熟肉外链试点

这条工作现在可以开始，但不应与长稳或 WAV 处置混在同一分支。

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

第一提交只做两个 exact event：

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

提交顺序：

1. Schema + registry + 两条 exact event + verifier；
2. `ArchiveEventDetail` / `ArchiveStoryDetail` UI；
3. 5174 内部 Play 与外部链接回归；
4. 三条 Episode 0 覆盖核对；
5. 只有精确关系才进入内部详情页。

详细契约：

```text
notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md
```

### P1-B：260 USM 关系目录

现状：

- 260 个 USM；
- 77 个有 BackMonitor 关系；
- 183 个语义未解决。

第一阶段只生成目录：

- RAW relative path；
- hash/bytes；
- 媒体信息；
- masterdata token；
- consumer candidate；
- mapping state；
- evidence。

不要批量转 MP4，不要发布，不要加入 Git 媒体。

### P1-C：1,271 个 `image_*` bundle 关系目录

第一阶段只枚举：

- bundle path/hash；
- Unity object type/name；
- container path；
- PathID；
- texture/sprite dimensions；
- masterdata token；
- consumer candidate；
- organizer-export parity candidate。

不要全量导出 PNG，不要一次性替换 `public/assets`。

## 3. 三轨依赖图

```text
master 4e416a6
  |
  +-- active branch codex/post-merge-next-guidance
  |     registry + EOL + v1 freeze
  |     -> source-only/mounted boundary
  |     -> clean checkout PASS at 75f9cb1
  |     -> documentation / PR / merge
  |
  +-- future Track G: publication evolution
  |     3+1 / 18
  |     -> v2 + annotation
  |
  +-- Track R: Runtime acceptance
  |     fixed Runtime commit
  |     -> 2–4h soak
  |     -> quiet endpoint
  |     -> PASS / FAIL
  |
  +-- Track P: portal/resource discovery
        WAV read-only provenance
        GS external-link pilot
        USM relation catalog
        image relation catalog
```

当前 governance branch 先完成 clean CI、文档和合并，不再从未合并 HEAD
继续分叉。合并后 Track G、R、P 不互相伪装成完成条件，可以使用独立 branch
和 checkout。v2/annotation 激活前禁止新的 ledger 写入；Track R 不依赖 EOL、
WAV 或熟肉；Track P 中只有 metadata/UI 和只读 catalog 可以并行，WAV
move/delete 与任何 stable promotion 仍需另行授权或通过 Track G 门槛。

## 4. 每条轨道的 Git 边界

开始前：

```powershell
Set-Location E:\Web_build\SideM_Archived
git switch master
git pull --ff-only
git status -sb
git rev-parse HEAD
```

当前唯一未合并开发分支是：

```text
codex/post-merge-next-guidance
```

它必须先完成 source-only/mounted 边界、文档、PR 与合并。之后每条轨道从最新
`master` 单独建分支。不要继续复用：

```text
codex/post-merge-story-handoff
codex/pr2-post-merge-status
```

以下分支均已合入 `master`，不再承载新工作；当前 governance PR 合并后可按
用户决定删除本地/远端引用：

```text
codex/story-localization-contract
codex/post-merge-story-handoff
codex/pr2-post-merge-status
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
worktree、origin/master、5174，并确认当前 active branch 为
codex/post-merge-next-guidance、PR #2=bca7042、PR #3=4e416a6 均已合并。

完整阅读：
1. web_viewer/notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md
2. web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md
3. web_viewer/notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md
4. web_viewer/notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md

先确认 `75f9cb1` 之后的状态文档与 clean-checkout gate，再完成当前 governance
branch 的 PR/合并。合并后 Track R 优先执行 2–4 小时长稳；Track G 可独立设计
v2/annotation；Track P 可做 GS external-link metadata/UI 或只读资源目录。
不得新增 ledger release、回填 PNG、删除或移动 WAV。GS 熟肉试点只做
Growing Stars，并从两个 exact event 开始。
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

- 先完成 machine-readable relation catalog；
- 抽样证明关系；
- 未进行批量解码或稳定发布。
