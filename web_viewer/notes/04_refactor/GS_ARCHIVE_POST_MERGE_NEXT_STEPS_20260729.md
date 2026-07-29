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
| documentation branch | `codex/post-merge-next-guidance`, created from `4e416a6` |
| base HEAD | `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| upstream | `origin/master`，与 HEAD 一致 |
| worktree | clean |
| PR #2 | merged as `bca7042c1d87b261b98f21b5957a36c2eb99f6b1` |
| PR #3 | merged as `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| PR #2 final check | Source-only contract PASS, run `30435933524` |
| PR #3 check | Source-only contract PASS, run `30437147325` |
| local server | `127.0.0.1:5174`, PID 27536 at refresh time |

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

## 2. 尚未完成，按优先级排列

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

### P0-G：修复 publication ledger 的 Windows 换行门禁

合并后的 GitHub Linux gate 通过，但当前 Windows checkout：

```text
core.autocrlf=true
Git attribute: text
```

使第一笔 transaction 的三个 JSON 在 worktree 中使用 CRLF。Ledger 记录的是
canonical Git blob 的 LF bytes：

| Artifact | Ledger/Git blob | Windows worktree | Delta |
| --- | ---: | ---: | ---: |
| `1_4_001_00.json` | 336,694 | 348,594 | 11,900 |
| `1_4_001_00_a.json` | 174,502 | 180,447 | 5,945 |
| `1_4_001_00_b.json` | 162,250 | 168,206 | 5,956 |

每个 delta 恰好等于文件行数；Git status 仍为 clean。因此：

- transaction 内容没有语义漂移；
- Git blob 与 ledger size 一致；
- 本地 `npm run verify:publication-ledger` 当前 FAIL；
- 不能把 ledger bytes/hash 改成某台 Windows 机器的 CRLF 值。

推荐独立比较两种方案：

1. 对 ledger-governed stable JSON 使用精确 `.gitattributes` `eol=lf`；
2. 明确定义 verifier 的 canonical Git-blob identity，同时另做 runtime
   worktree semantic verification。

优先评估方案 1，因为稳定发布 byte identity 应尽量在所有 checkout 相同。
不要对全部历史 JSON 进行无界 `renormalize`；先只覆盖第一笔 transaction
的三个文件，检查 Git diff、Vite 读取和 Linux/Windows verifier。

建议分支：

```text
codex/publication-ledger-windows-eol
```

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

## 3. 推荐执行顺序

```text
master 4e416a6
  |
  +-- Track 1: Story Runtime 2–4h long soak
  |     -> acceptance report only
  |
  +-- Track 2: 18 WAV provenance audit
  |     -> read-only evidence first
  |     -> user approval before move/delete
  |
  +-- Track 3: publication ledger Windows EOL
  |     -> canonical byte identity
  |
  +-- Track 4: GS external-link pilot
  |     -> two exact events
  |     -> 5174
  |     -> THE KOGADO candidates
  |
  +-- Track 5: USM catalog
  |
  +-- Track 6: image bundle catalog
```

优先建议：

1. 先完成长稳，使 Story Runtime 的发布状态有确定结论；
2. 接着审计 WAV，恢复 mounted source 的可信基线；
3. 修复 publication ledger 的 Windows EOL 门禁；
4. 然后做 GS 熟肉两条 exact pilot；
5. USM 和 image 目录继续后置。

如果长稳需要无人值守较长时间，可以在它运行时只读审计 WAV；不要在同一
checkout 同时改运行时代码。

## 4. 每条轨道的 Git 边界

开始前：

```powershell
Set-Location E:\Web_build\SideM_Archived
git switch master
git pull --ff-only
git status -sb
git rev-parse HEAD
```

每条轨道从最新 `master` 单独建分支。不要继续复用：

```text
codex/post-merge-story-handoff
codex/pr2-post-merge-status
```

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
worktree、origin/master、5174，并确认 PR #2=bca7042、PR #3=4e416a6
均已合并。

完整阅读：
1. web_viewer/notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md
2. web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md
3. web_viewer/notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md
4. web_viewer/notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md

先报告事实漂移，再只选择一条有界轨道。默认优先完成 2–4 小时长稳；
如果暂时不能占用浏览器，先修复 publication ledger 的 Windows EOL 门禁，
或只读审计 RAW/audio 的 18 个 WAV。不得删除、移动或静默接受 WAV。GS
熟肉试点只做 Growing Stars，并从两个 exact event 开始。
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
