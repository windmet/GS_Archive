# GS Archive 合并后下一步指导

状态：当前执行入口
日期：2026-07-29
仓库：`E:\Web_build\SideM_Archived`
应用：`E:\Web_build\SideM_Archived\web_viewer`

> 2026-07-30 优先级覆盖：Story Runtime 2–4 小时长稳由历史 Track R 降为
> **P2-B**。它仍是宣称 Runtime `release-accepted` 的必要证据，但不再
> 阻塞 P0 架构文档收口或 P1 用户可见门户/有界内容批次。本文更早章节中的
> P0/P1 标签同时承担历史实施编号；与当前优先级冲突时，以本段和
> `notes/03_audit/GS_ARCHIVE_PRODUCT_HISTORY_RECONCILIATION_20260730.md`
> 为准。

## 1. 当前结论

RAW/masterdata 迁移和 P0 governance 已经合并，不应继续按 Draft PR #2
阶段的待办执行。

当前已核验 Git 状态：

| 项 | 当前值 |
| --- | --- |
| merged base branch | `master` |
| current functional baseline | `master` includes PR #30 merge `721c58b29e0eb953e8ba6138521d825d98e1cc63` |
| active functional branch | `codex/reconcile-product-history-p2`；documentation-only |
| active track | P0 current-architecture documentation reconciliation |
| upstream | `origin/codex/reconcile-product-history-p2` |
| worktree | recheck live checkout；P0 branch contains no P1 implementation |
| P0 closeout PR | PR #31；recheck live state |
| PR #30 | merged as `721c58b29e0eb953e8ba6138521d825d98e1cc63` |
| PR #28 | merged as `5c21658ac63ac5d158024a83cdaeb086b7dcc30a` |
| PR #28 final-head check | Source-only contract PASS，run `30513723245` |
| PR #28 post-merge check | `master` push Source-only contract PASS，run `30513761773` |
| PR #26 | merged as `52eb37d19082e979f5132357845626b73e4e5940` |
| PR #26 final-head check | Source-only contract PASS，run `30512461712` |
| PR #26 post-merge check | `master` push Source-only contract PASS，run `30512491644` |
| PR #24 | merged as `66a0e1dd41fe560388e0ff408619c8f3a2c15c56` |
| PR #24 final-head check | Source-only contract PASS，run `30511853325` |
| PR #24 post-merge check | `master` push Source-only contract PASS，run `30511892344` |
| PR #22 | merged as `0f858d036a377d4013a3345c85e8fba6acaf73fe` |
| PR #22 final-head check | Source-only contract PASS，run `30511081519` |
| PR #22 post-merge check | `master` push Source-only contract PASS，run `30511111063` |
| PR #20 | merged as `19e5fc570c1684eb8410effdd1b6cf32ac2759f6` |
| PR #20 final-head check | Source-only contract PASS，run `30479911302` |
| PR #20 post-merge check | `master` push Source-only contract PASS，run `30479973771` |
| PR #18 | merged as `7342f5a5bf3c6d3e2ea2eef35cfdfc95c530e44a` |
| PR #18 final-head check | Source-only contract PASS，run `30478115572` |
| PR #18 post-merge check | `master` push Source-only contract PASS，run `30478199856` |
| PR #17 | merged as `b62e050b626a11e4c5edfeba5ae2b74b125f44ca` |
| PR #17 final-head check | Source-only contract PASS，run `30475298501` |
| PR #17 post-merge check | `master` push Source-only contract PASS，run `30475414245` |
| PR #16 | merged as `139b9b0eef0a10df23fe3e122458c9ab13b70574` |
| PR #16 final-head check | Source-only contract PASS，run `30475072475` |
| PR #16 post-merge check | `master` push Source-only contract PASS，run `30475143673` |
| PR #15 | merged as `a9ea2012e1e55c158050424c146b743f17e87700` |
| PR #15 final-head check | Source-only contract PASS，run `30474769111` |
| PR #15 post-merge check | `master` push Source-only contract PASS，run `30474870836` |
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
| production build | P1-H local Vite build PASS，2,405 modules / 144.2 seconds；closeout docs-only |

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

## 2. 当前与历史轨道

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

PR #4 已增加独立机器 registry：

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

### P2-B：Story Runtime 2–4 小时长稳（历史 Track R）

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

PR #7 已新增：

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

### P1-UI：门户统一面包屑

状态：**implemented locally on `codex/archive-breadcrumb-p1-ui`；尚未提交或合并**。

产品目标：

- 在 `ArchiveShell` 中表达稳定的“资料馆域 → 列表/集合 → 当前实体”层级；
- 让直接深链、刷新恢复和跨域跳转后的当前位置可理解；
- 补充而不是替代现有 Back、`parent` 和 `return` 行为。

实现边界：

- breadcrumb model 必须从 `archiveRoute.js` 和当前 entity 派生；
- 不读取或序列化浏览器 history stack；
- 不建立第二套路由表，不在每个详情组件手写 URL；
- 当前项不可点击，其余层级使用既有 route navigation；
- canonical hierarchy 与“用户从哪里点进来”分离，避免把关联实体伪造成父子；
- 最多四层；移动端可折叠中间层；
- 使用 `<nav aria-label="面包屑">`、有序列表和
  `aria-current="page"`；
- `player`、`spine_lab`、`chibi_stage` 保持全屏，不添加 archive
  breadcrumb。

首批建议覆盖：

```text
idol_detail
unit_detail
card_detail
gasha_detail
event_detail
story_collection
story_detail
external_story_resources
```

验收必须同时覆盖自然入口、复制深链、刷新恢复、浏览器 Back、窄屏和标题缺失
fallback。5174 最少抽查 Idol、Card、Event、Story collection、External
resource 五类页面。该批只新增 breadcrumb model/component 与必要样式，不
顺带重写搜索、关系数据、Back stack 或播放器导航。

完整产品理由与代表路径见：

```text
notes/03_audit/GS_ARCHIVE_PRODUCT_HISTORY_RECONCILIATION_20260730.md
```

### P1-Story-IA：剧情分类正式入口与 masterdata 建档

状态：**approved as a bounded follow-up P1 track；不得混入 P1-UI breadcrumb
首批**。

#### 问题定义

P1-UI 实测暴露出 breadcrumb 层级与现有剧情产品面的断层：

- `view=story_collection&story_type=main&story_section=101` 已是有效的第 1 章
  collection；缺失的是 `story_type=main` 的正式 domain landing；
- `view=story_catalog&story_type=main` 当前仍渲染整个故事门户，不能视为主线剧情
  专属页面；
- `story_type=birthday` 与 `story_type=extra` 当前进入
  `story_mode=search`，只是预选分类的搜索结果，不是正式剧情档案；
- 在 domain landing 实现前，breadcrumb 不得把不存在的页面伪装成 canonical
  上级；domain 项应暂时返回真实故事门户。

#### 已核对的 masterdata 边界

语义身份与父子关系以 masterdata 为准，编译 JSON 仅作为可共享的播放载体：

| domain | masterdata 事实 | 当前产品风险 |
| --- | --- | --- |
| `main` | table 4 / 5 / 6；3 groups、22 chapters、204 episode rows | 已有 collection model，但没有 domain landing；第 3 group 当前没有 chapter |
| `birthday` | table 78；181 episode rows、181 distinct compiled files | 29 个文件同时属于 `idol_story` 与 `birthday`，全局按文件去重会把生日域压成 152 条 |
| `extra` | table 144 / 145；47 groups、47 episode rows、45 resource IDs、44 compiled files | 一个播放文件可承载多条 master 关系，不能用 `compiled_file` 代替档案 ID |

因此后续模型必须区分：

1. master 逻辑条目和 collection 身份；
2. domain membership；
3. 可共享的 resource / compiled playback target。

不得从文件名或 `compiled_summary.characters` 单独推定生日剧情归属；需要通过
master row、偶像索引和已验证的资源关系建立可审计映射。

#### 推荐小批顺序

1. **P1-Story-IA-A：只读审计与 index/verifier**
   - 固化 main / birthday / extra 的逻辑条目、父子关系、共享播放文件和计数口径；
   - 输出独立 Schema / generator / verifier；
   - 不扫描未索引 RAW，不创建 publication transaction。
2. **P1-Story-IA-B：main domain landing**
   - 复用 `story_catalog` 与既有 route builder；
   - `view=story_catalog&story_type=main` 才在本批后成为真实 canonical landing；
   - 继续复用现有 `story_collection` 页面，不重写播放器。
3. **P1-Story-IA-C：extra 正式档案**
   - 以 table 144 group 和 table 145 episode 的 master ID 为档案身份；
   - 明确显示逻辑条目数与共享播放载体数，不把 44 个文件伪写成 47 个独立文件。
   - 正式入口以 table 178 的 7 个 `ExtraStoryChapterData` 为准；table 143
     中未进入 table 178 的 `602 / 603 / 610` 保留为
     `special_home_story` 补充记录。
   - table 178 的 `ResourceId` / `LogoResourceId` 是视觉关系权威；特别注意
     entry `1010050` 明确使用视觉资源 `1010070`，不得按条目 ID 猜图。
   - 从 RAW 小批发布 7 张 banner 与 7 张 KV；logo 仍为 `catalog_only`。
4. **P1-Story-IA-D：birthday 正式档案**
   - 建立按偶像进入的 collection，并在页面内部表达制作人生日、偶像生日和批次；
   - 29 个 `idol_story` / `birthday` 共享文件必须保留双重 domain membership；
   - 不在 breadcrumb 中增加超过四层的批次节点。

建议沿用现有 view，而不是新增第二套路由：

```text
view=story_catalog
  -> 故事总入口

view=story_catalog&story_type=main|birthday|extra
  -> domain landing

view=story_catalog&story_type=...&story_mode=search
  -> 传统检索面

view=story_collection&story_type=...&story_section=...
  -> 正式 collection
```

#### 验收和非目标

- breadcrumb 最多四层，domain landing 完成后再把 domain crumb 指向该 landing；
- 稳定保留 `q`、`unit_filter`、`event_scope`、`rarity` 等既有筛选；
- 验收自然入口、深链、刷新、浏览器 Back、现有返回按钮、桌面、窄屏和无障碍语义；
- legacy 搜索的全局去重问题记录为已知债务，不在 landing 小批中顺带重写全局搜索；
- 不重写关系数据总线、播放器、publication、strict-v2 promotion 或 Runtime 长稳。

#### P1-Song：歌曲档案提前

歌曲档案提升为 P1 的相邻内容轨，但不混入 Extra 页面提交。现有 table 46
已经给出 61 个正式 song code，RAW 的 61 个 `song_*.unity3d` 提供编舞，
`song3_<code>` 提供音频实体。模型必须分成：

```text
歌曲作品
  -> 演唱 / 演出版本
    -> 完整混音 / 伴奏层 / 偶像声部层
    -> 编舞 / 口型 / MV
```

`DRIVE A LIVE` 的 `drvalv`、49 个偶像声部、`drvalv_bgm` 与愚人节
`drv999` 不得平铺为互不相关的歌曲。`Beyond The Dream` 的组合版本也应
作为同一作品的 performance variant。文件名只能发现候选；“solo 声部与伴奏
由游戏同步叠加”必须由 ACB Cue/Sequence 或运行时行为另行证明。

执行顺序：

1. **P1-Song-A**：身份、版本、音频层、编舞、口型、MV exact relation 审计；
2. **P1-Song-B**：61 首歌曲的 metadata-only 目录与详情；
3. **P1-Song-C**：只有通过关系和 publication gate 后，才增加版本切换或
   分层播放。

2026-08-01 Song-B closeout：

- 当前模型为 60 个歌曲作品 / 61 个 song entity；`drv999` 已归入
  `drvalv` 的 2022 愚人节特殊版本，不再作为无关作品平铺；
- table-46 初始/隐藏时间哨兵已与真实 JST 开放日期分开显示；
- `song_scope` 与 `q` 已进入 route，组合、偶像声部及 Extra 602 使用正式
  关联入口；
- 后续核验修正了“table 46 无演唱者字段”的旧结论：字段 7 覆盖 61 首，
  其中类别 2 的 47 首可正式映射 table 24 组合；类别 3 的 14 首统一为
  `collective_or_special` selector，不解释为 Unit ID，也不自动解释为 49 人
  同时合唱。字段 30–34 在 20/99 行出现，去重后是 13 首歌曲，
  不能误写成 20 首；歌曲、组合和偶像详情现已建立双向资料入口；
- 61 张 RAW 封面发布为 365x360 导航派生图，保留 bundle、Texture2D、
  PathID、原尺寸与 published hash，owner release 为
  `2026-08-01-song-jackets-001`；
- 播放器、solo+伴奏同步、MV 播放和 Chibi Stage 预选仍属于 Song-C，状态
  为 **NOT EXECUTED**，等待下一步产品与音频同步讨论。

2026-08-01 supplied package metadata checkpoint（只读）：

- 提供的 2.6.10 IPA/XAPK 可作为 Song-C 的 Unity/CRI 参照样本；IPA 内的
  `TutorialAssets` 含 `song3_drvalv_bgm`、5 个偶像声部和一个含 16 个组合
  cue 的 `song3_grwsml`。`drvalv` BGM 为 `master/song_option/song_submix`，
  偶像声部为 `master/vocal_option/vocal_prog/vocal_submix`；两类音频同为
  44.1 kHz、130.285 s，但 ACB sequence selector 不同，不能只按文件名判断；
- `glowing.acf` 解出 19 张 CRI UTF 表、23 个 category、7 个 stage snapshot、
  9 个 bus，并包含 limiter、reverb、bandpass、32-band EQ 等 DSP。`song_submix`
  与 `vocal_submix` 走不同 category，但共享一组 submix command；这证明存在
  CRI mixer 边界，不足以单独证明浏览器端应如何重建其参数；
- iOS IL2CPP metadata v27 命中 `SwitchSingerUtil.SwitchSingers`、
  `SetCategoryVolumeForParallelSong`、`SingerNumVolumeList`、
  `singerCountPanDict`，以及 `SoundManager.ReserveTracks/PlaySong`、
  `LiveSoundDirector.songPlaybacks/SetMuteSong/SetPan3dAngleSong`、
  `SongData` 的 singer/cue/BGM 字段和 `VocalSettingPopupContent` 的切换控件；
  因此 solo 可能是多 track、音量、声像和 category 控制的组合，当前实验只能
  作为听感原型，不能写成官方运行时等价实现；
- 当前只保留证据与哈希，不复制或修改原始 IPA/XAPK；下一步应先把 Unity
  data/metadata 字段与 track index、pan、volume、cue-sheet 选择做可复核映射，
  再决定播放器是否支持可选声部与伴奏叠加。Song-C 仍为 **NOT EXECUTED**。

同日 RAW 全量 ACB 交叉核验：

- `song3_*.acb` 共 313 个：63 个 base/special、245 个偶像声部、5 个独立
  伴奏；61 首正式歌曲的主 ACB 均出现 `song_option/song_submix` 与
  `bgm_option/bgm_submix`，245 个偶像声部均出现
  `vocal_option/vocal_prog/vocal_submix`；
- 同时具备 49 个偶像声部文件和独立 `_bgm.acb` 的歌曲只有
  `byndtd`、`drvalv`、`grwsml`、`tkstp1`、`tkstp2` 五首。实验 manifest
  的边界不得被解释为其余 56 首已具备可直接播放的 solo+伴奏素材；
- 全量 ACB 形成 83 个 sequence/track-event 签名；命令 payload 继续按 opaque
  证据保存，未把 `0x0041`、`0x0057` 或 `0x07d0` 擅自解释为音量、声像或
  时间参数；播放器仍不得据此宣称已重建官方混音。
- 供应包与 RAW 的逐文件 hash 对照已固化为
  `scripts/audit-song-package-raw-match.py`（`npm run audit:song-package-match --
  --ipa <path> --xapk <path> --raw-audio ..\\RAW\\audio --output <report>`）；
  当前样本的 7 个 `song3_*.acb` 均存在于 RAW 且 SHA-256 全部一致。

#### P1-Mobile-Nav：应用启动器

移动端底栏后续收敛为少量稳定入口，并新增 route-backed 的“应用启动器”
门户。建议使用 `view=portal_hub`，不得复用已有游戏内通信语义
`mobile_archive`。

- 移动底栏目标为“首页 / 故事 / 偶像 / 应用”四项；
- 应用页以游戏手机桌面式图标网格承载卡牌、活动、歌曲、Chibi Stage、
  外部资源等门户；
- 视觉可以模拟弹出的手机 UI，但必须是可深链、可刷新、支持浏览器 Back 的
  正式 route；
- 使用既有 route builder，不复制 history，也不改变桌面端主导航；
- 使用 `<nav>` / 列表语义、可见焦点和至少 44 px 触控目标。

推荐后续次序为：完成 Extra 视觉小批 → P1-Song-A → P1-Mobile-Nav →
P1-Song-B。歌曲与移动导航各自保持独立提交边界。

该轨属于 P1 门户信息架构，不改变以下状态：

- strict-v2 promotion 仍属于 P2-A；
- 2–4 小时长稳仍属于 P2-B，状态仍为 **NOT EXECUTED**。

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

THE 虎牙道 Episode 0 三条已完成内容边界核对并提升为精确 unit-story：

| BVID | uploader | exact collection |
| --- | --- | --- |
| `BV1LL411G7LD` | HaaNaaaP (`14496860`) | `1_1_013the_01_1_1_013_01` |
| `BV1xA4y1S7Cb` | HaaNaaaP (`14496860`) | `1_1_013the_02_1_1_013_02` |
| `BV16u4y187tH` | 死扛桑 (`8798195`) | `1_1_013the_03_1_1_013_03` |

三条均检查了开头/标题卡与 `j` part 最终对白，覆盖各自完整十个
parts，登记为 `exact-unit-story + complete-collection`。注册表现为
PR #20 时点为 `5 GS records / 5 exact mappings / 5 unique BVIDs`；PR #30
个人剧情小批合并后，当前基线为 8/8/8。

`ArchiveStoryCollection` 已按展开 chapter 呈现各自唯一外链；生产 build
在 2,405 modules 通过，最新 `dist` preview 的 exact link、安全 anchor、
无远程图片、无横向溢出和无 console error 门禁通过。

五条 exact relation 已达到详细契约中的独立导航门槛。PR #20 已增加：

- stories section 稳定路由 `external_story_resources`；
- PR #20 时点的故事目录 `社区中文剧情 5 条` 入口；当前 PR #30 基线显示
  8 条；
- exact-only 资源卡片和 original-uploader attribution；
- 活动详情与 unit-story exact chapter 内部深链；
- event/collection 返回独立导航的 parent route；
- 390px、无远程图片、safe anchor 和 console-error 浏览器门禁。

详细审计：

```text
notes/03_audit/EXTERNAL_GS_RESOURCE_NAVIGATION_20260730.md
```

建议分支：

```text
codex/external-story-links-the-kogado
```

已执行顺序：

1. Schema + registry + 两条 exact event + verifier：完成；
2. `ArchiveEventDetail` / `ArchiveStoryDetail` UI：完成；
3. 5174 内部 Play 保留与外部链接呈现回归：完成；
4. 三条 Episode 0 覆盖核对：完成；
5. 只有精确关系才进入内部详情页：已由 matcher 和 verifier 固定。

详细契约：

```text
notes/04_refactor/EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md
```

### P1-B：260 USM 关系目录

状态：基础目录 **merged in PR #8**；30 条 MovieAnnounce v2 细化
**merged in PR #22**，merge commit `0f858d0`，post-merge source gate
`30511111063` 通过。

当前目录已经记录：

- 260 个 USM / `2,143,803,200` bytes；
- 77 个精确 BackMonitor 消费关系，其中 73 个 movie、4 个 transition；
- 30 个精确 MovieAnnounce masterdata 关系；
- 153 个语义未解决（PR #22 时点；P1-B2 完成后降至 29）；
- 260 个 SHA-256、CRID magic 和 ffprobe header；
- 52 个文件命中 22 个精确 `music_catalog.songs` filename token；
- 260 条 RAW relative path、媒体信息、consumer candidate、mapping state 和
  evidence。

机器入口：

```text
schemas/usm-relation-catalog-v2.schema.json
public/data/usm_relation_catalog.json
public/data/masterdata/movie_announce_index.json
scripts/generate-usm-relation-catalog.py
scripts/verify-movie-announce-index.py
scripts/verify-usm-relation-catalog.mjs
notes/03_audit/RAW_USM_RELATION_CATALOG_20260729.md
notes/03_audit/RAW_USM_MOVIE_ANNOUNCE_EXACT_RELATIONS_20260730.md
```

masterdata table 175 含 30 个唯一 `MovieAnnounceData.ResourceId`，与 30 个
`movie_home_announce_<ResourceId>` USM 严格一一对应。source-only 与 mounted
verifier 均通过 `260 / 77 / 30 / 153`；mounted 模式还重解析 table 175，并
逐文件复核 bytes、CRID 和 SHA-256。Archive baseline 从 committed catalog
读取三种人口，因此 source-only 不依赖某次 mounted 快照。

本批没有批量转 MP4、没有发布、没有加入 Git 媒体。该批结束时剩余 153 个 unresolved
若继续细化，仍须选择有独立 authority 的有界 family；11 个 `3dmv_*` 与
`mvlive_reason` 只有 song-code filename token，本批明确不升级。

### P1-B2：CardData skill-movie 精确关系

状态：**merged in PR #24**。merge commit `66a0e1d`，final-head gate
`30511853325` 与 post-merge gate `30511892344` 均通过。

CardData table 1 的字段 14 `ResourceId` 与字段 31
`HasSkillCutinResource` 共同提供独立 authority。124 个 field 31 为 true 的
唯一 ResourceId 与 124 个 `skill_movie_<ResourceId>` RAW USM 完整双向相等。
其中三个 ResourceId 同时被普通卡与教程卡共享，索引保留全部 127 条 card
record，不任意选择单一卡片。

机器入口：

```text
schemas/usm-relation-catalog-v3.schema.json
public/data/masterdata/card_skill_movie_index.json
public/data/usm_relation_catalog.json
scripts/verify-card-skill-movie-index.py
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
notes/03_audit/RAW_USM_CARD_SKILL_EXACT_RELATIONS_20260730.md
```

当前边界为 `260 / 77 / 154 / 29`。本批不声明浏览器 consumer，不生成或发布
衍生媒体，也不改 publication ledger。

### P1-B3：SongData 3dmv / mvlive 精确关系

状态：**merged in PR #26**。merge commit `52eb37d`，final-head gate
`30512461712` 与 post-merge gate `30512491644` 均通过。

SongData table 46 的 `ResourceId`、`MovieOffset` 与 `MvliveOpenAt` 提供独立
authority。11 个具有具体 MovieOffset 的唯一 ResourceId 与全部 11 个
`3dmv_*` 完整相等；唯一早于 2100-01-01 disabled sentinel 的 MvliveOpenAt
记录为 `reason`，与唯一 `mvlive_reason` 相等。索引保留 13 条 SongData
record，其中 `pl1gdd` 被两条记录共享。

机器入口：

```text
schemas/usm-relation-catalog-v4.schema.json
public/data/masterdata/song_movie_index.json
public/data/usm_relation_catalog.json
scripts/verify-song-movie-index.py
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
notes/03_audit/RAW_USM_SONG_MOVIE_EXACT_RELATIONS_20260730.md
```

当前边界为 `260 / 77 / 166 / 17`。本批不声明浏览器 consumer，不生成或发布
衍生媒体，也不改 publication ledger。

### P1-B4：GashaAnimationMovieManager 客户端精确关系

状态：**merged in PR #28**。merge commit `5c21658`，final-head gate
`30513723245` 与 post-merge gate `30513761773` 均通过。

归档客户端 IL2CPP metadata v27 独立提供
`Growing.Theater.GashaAnimationMovieManager`、`_startMovieList`、
`_ssrMovie`、对应播放方法，以及 `c0{0}_{1}.usm` 与
`ssr_motion.usm` 精确字面量。再生成契约覆盖全部 11 个 card-rarity
start movie 与一个固定 SSR movie，和 mounted RAW population 双向相等。

机器入口：

```text
schemas/usm-relation-catalog-v5.schema.json
public/data/client/gasha_movie_contract.json
public/data/usm_relation_catalog.json
scripts/generate-gasha-movie-client-contract.py
scripts/verify-gasha-movie-client-contract.py
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
notes/03_audit/RAW_USM_GASHA_CLIENT_EXACT_RELATIONS_20260730.md
```

当前边界为 `260 / 89 / 166 / 5`。剩余五项均为无 119 份编舞脚本引用、
且没有其他独立 consumer contract 的 BackMonitor 物理变体，保持
unresolved。本批未解码、转码、复制或发布媒体，也未执行已后置的 Runtime
长稳验收。

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
`organizer-export-candidate`。PR #10 将它们升级为
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

因此 PR #12 只为这 49 个 code 写入 98 条
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

PR #13 只处理完整匹配
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

PR #14 只处理完整匹配 `image_honor_event_<code>` 的 bundle。当前 RAW
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

状态：**merged in PR #15**。

PR #15 只处理完整匹配
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

### P1 image relation closeout

状态：**automatic exact refinement closed at current authority boundary**。

PR #9 到 PR #15 已依次建立物理目录与 170 个 exact-masterdata bundle。
剩余 90 个 masterdata candidate 的分类为：

```text
7 chara aggregate
68 gasha banner/logo namespace collisions
8 gasha background event-token candidates
2 mobile aggregate
1 picturestudio aggregate
4 shop event/seasonal collisions
```

这些记录没有一对一 authority。后续只有在获得新的独立 mapping source 或
consumer contract 时，才能另开有界分支；不得继续按 token presence 自动
升级。完整收口见
`notes/03_audit/IMAGE_RELATION_REFINEMENT_CLOSEOUT_20260730.md`。

## 3. 三轨依赖图

```text
master 721c58b
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
  +-- deferred P2-B (historical Track R): Runtime acceptance
  |     fixed Runtime commit
  |     -> 2–4h soak
  |     -> quiet endpoint
  |     -> PASS / FAIL
  |
  +-- Track P
        completed pilot: PR #6, two exact GS event links + UI
        completed P1-A expansion: PR #18, three exact THE KOGADO unit-story links
        completed P1-A navigation: PR #20, exact-only community Chinese story view
        completed P1-B base: PR #8, 260 USM relation catalog
        completed P1-B refinement: PR #22, 30 MovieAnnounce exact-masterdata relations
        completed P1-B2: PR #24, 124 skill-movie exact-masterdata relations
        completed P1-B3: PR #26, 12 SongData movie exact-masterdata relations
        completed P1-B4: PR #28, 12 gasha exact-client relations
        bounded remainder: 5 unreferenced BackMonitor variants stay unresolved
        completed P1-C: PR #9, 1,271 image bundle relation catalog
        completed P1-D: PR #10, 50 bundles / 52 exact character promotions
        completed P1-E: PR #12, 49 codes / 98 exact gasha banner-logo relations
        completed P1-F: PR #13, 19 codes / 20 exact event item-icon relations
        completed P1-G: PR #14, 40 codes / 40 exact honor-event relations
        completed P1-H: PR #15, 12 speakers / 12 exact gasha-skill relations
        closed: automatic exact-relation refinement at 90 ambiguous candidates
```

PR #4 已通过 merge commit `2a1e1ec` 合入 `master`，post-merge gate
`30452463385` 通过。PR #5 已通过 merge commit `9e4fd7d` 合入 `master`，
post-merge gate `30458806049` 通过。Track R 已由用户暂缓，并在
2026-07-30 降为 P2；Track S 已完成；
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
PR #15 已通过 merge commit `a9ea201` 合入 `master`，post-merge gate
`30474870836` 通过。Track R 继续 deferred；P1 exact relation 自动细化
已经收口，不要把剩余聚合或命名空间碰撞记录升级为 exact。
P1-A 独立导航已由 PR #20 以 merge commit `19e5fc5` 合入 `master`，
final-head run `30479911302` 与 post-merge run `30479973771` 均通过。
USM gasha client 精确关系已由 PR #28 以 merge commit `5c21658` 合入
`master`，final-head run `30513723245` 与 post-merge run `30513761773`
均通过；12 条 client relation 已提升，5 条无编舞引用的 BackMonitor
物理变体继续保持 unresolved。

## 4. 每条轨道的 Git 边界

开始前：

```powershell
Set-Location E:\Web_build\SideM_Archived
git switch master
git pull --ff-only
git status -sb
git rev-parse HEAD
```

当前没有 active 功能分支。`codex/usm-song-movie-exact-relations` 已通过
PR #26 合入 `master`。
`codex/usm-gasha-client-exact-relations` 已通过 PR #28 合入 `master`。
`codex/usm-skill-movie-exact-relations` 已通过
PR #24 合入 `master`。
`codex/usm-movie-announce-exact-relations` 已通过
PR #22 合入 `master`。table 175 独立证明的 30 条
`movie_home_announce_*` 已提升为 exact-masterdata；后续不得把 `3dmv`、
`mvlive` 或其他 filename candidate 顺带升级，不创建衍生媒体或 publication
transaction，也不把已后置的 Runtime 长稳验收写成完成。

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
codex/gasha-skill-exact-relations
codex/post-p1h-relation-closeout
codex/external-story-resource-navigation
codex/usm-movie-announce-exact-relations
codex/usm-skill-movie-exact-relations
codex/usm-song-movie-exact-relations
codex/usm-gasha-client-exact-relations
codex/external-story-links-personal
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
worktree、origin/master。P0 合并基线必须包含
`GS_ARCHIVE_P0_ARCHITECTURE_CLOSEOUT_20260730.md`；若 checkout 已继续前移，
以实时 Git 事实为准，不复用旧 branch/PID。

P1 门户批次只需先完整阅读：
1. web_viewer/docs/AGENT_START_HERE.md
2. web_viewer/docs/PROJECT_MAP.md
3. web_viewer/notes/03_audit/GS_ARCHIVE_P0_ARCHITECTURE_CLOSEOUT_20260730.md
4. web_viewer/notes/03_audit/GS_ARCHIVE_PRODUCT_HISTORY_RECONCILIATION_20260730.md
5. web_viewer/notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md

首批 P1-UI 只实现由 archiveRoute.js 和当前 entity 派生的 breadcrumb
model/component/style；保留筛选、parent/return 和现有 Back，不重写搜索、
关系数据或播放器。player、spine_lab、chibi_stage 不显示 breadcrumb。
5174 覆盖 Idol、Card、Event、Story collection、External resource 的自然入口、
深链、刷新、Back、窄屏和无障碍语义。

strict-v2 promotion 属于 P2-A；2–4 小时长稳属于 P2-B，仍为 NOT EXECUTED。
P1 分支不得新增 publication transaction、批量资源或长稳结论。只有任务明确
进入某个资源证据域时，才从 notes/INDEX.md 选择对应历史审计，不要默认通读
全部 relation note。
```

## 7. P2-B 长稳验收的完成定义

以下条件只定义未来何时可以称为 Story Runtime `release-accepted`。它们不是
当前 P0 架构文档或 P1 门户产品批次的完成条件。

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
- 两条 exact event、三条 exact unit-story 与三条 exact idol-story relation 存在；
- 不含 Mobage/drama；
- 不含 remote thumbnail；
- 5174 内部与外部动作均通过；
- Episode 0 三条已由开头/标题卡和最终对白边界证据提升为 exact，
  不是按标题或收藏夹成员关系直接推断。
- 大河タケル第1話、円城寺道流第1話与牙崎漣第1話已由
  `idol_episode_index` 和编译对白边界提升为 exact；大河タケル第2話仍因
  本地 3 个 small talk + 5 个 main episode 的边界未完成可靠解码而延期。
- 个人故事扩展的 source verifier、UI verifier、idol-story interface、
  routes、home 与完整 Vite build 均通过；5174 直接路由显示 8 条，円城寺
  道流站内跳转、canonical 外链和 390 × 844 单列布局通过。控制台仍只有
  已知的 ignored `raw_character_image_promotions.json` 挂载缺失。

USM/image：

- USM machine-readable relation catalog 已覆盖 260/260；
- 77 个 BackMonitor 精确关系由 RAW choreography 与现有 index 双重证明；
- 30 个 MovieAnnounce 关系由 table 175 ResourceId 独立证明；
- 124 个 skill-movie 关系由 CardData table 1 ResourceId 与
  HasSkillCutinResource 独立证明，并保留 3 个共享资源的一对多 card IDs；
- 11 个 3dmv 与 1 个 mvlive 关系由 SongData table 46 的 MovieOffset 与
  enabled MvliveOpenAt 独立证明，并保留 `pl1gdd` 的两条 song IDs；
- 11 个 gasha start movie 与 `ssr_motion` 由 IL2CPP v27 的类、字段、方法
  与精确 filename literal 共同证明；
- 5 个无编舞引用的 BackMonitor 变体保持 unresolved，不把 filename
  candidate 写成 exact；
- source-only 与 mounted verifier 通过；
- 未进行批量解码或稳定发布；
- image relation catalog 已覆盖 1,271/1,271 bundles 和 7,816 image
  objects；
- image source-only 与 mounted verifier 通过；
- 未导出 PNG 或替换 stable assets。
