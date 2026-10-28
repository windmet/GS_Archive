# 深链接 R2 执行记录

日期：2026-10-28。输入 master `b1065a8f`（#121 merge）；分支 `portal/20261028-story-owner-paths`。复用 `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer` 专用 LF 工作树，未改主 checkout。

用户已授权 #122、#121 按顺序以 merge commit 合入：`dd7b28de`、`b1065a8f`，并继续 R2。R2 的路径采用已确认的方案 A：读模型 domain/section 原样。范围见 [交接 §5](GS_ARCHIVE_HANDOFF_20261028_DEEP_LINKS.md)。源码提交 `9fb612bda719a51f22caa65656776de4aca6d7c5` 的 [PR #123](https://github.com/windmet/GS_Archive/pull/123) 已按用户授权在 [远端 CI 40647673729](https://github.com/windmet/GS_Archive/actions/runs/40647673729) 成功后，以 merge commit `11e7418c60333f2473c15b53f07b8ea04f87f91e` 合入 master。用户随后明确本任务后续不再逐次询问授权，按既有门禁直接推进。

## 实现与来源

- 注册表增加多段 segments，并由共享匹配/生成函数消费；旧实体地址、query 优先和非法路径回退保持。域落地页仅在 portal 模式使用路径，目录 search 模式仍保留查询筛选。
- 合集公开地址保留当前 `story`，parent/song/idol/unit/category 及 source frame 移入既有版本化 history。unit 身份仅在从组合打开合集时保留；其他页面不继承。
- 个人/工作剧情保留现有选择参数，季节企划保留参与者 query；不改 StoryOwner 归属规则、页面模板、样式或数据加载职责。
- App 改动仅限标签页标题 computed 和其共享 helper import；新增个人/工作标题与页面同源，合集使用 StoryPageTitle，季节标题使用既有 ReadingCatalog 的季节名称。外壳和运行时共享标题函数。
- 外壳从与受跟踪 bootstrap 同 release 的候选读取 collections/seasonal，逐描述符核对 SHA-256、envelope 和页面身份；个人/工作索引还核对 bootstrap 偶像集合。CI 使用小型 fixture，不依赖候选包或 compiled 语料。

候选 `rm-release-20261022`，release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。实际 80 个合集、4 个季节企划、49 个个人页、49 个工作页、1 个社区根，加五个域落地页，共新增 188 个外壳：1,213 → 1,401。原计划表的 183 未包含五个域落地根。

## 已完成的源验证

- 路径回归：旧地址、各域新地址、生日 staff/producer 特例、选择参数、query 优先、非法多段路径、旧目录别名、合集来源 history 与分享清理通过。
- route schema 与 1,176 个导航状态用例通过。新增的组合 → 合集 unit 来源断言独立于冻结旧 oracle；schema 测试补足有效合集身份后验证裁剪。
- `verify-story-owner.mjs`：实际 1,394 条故事全部经既有 StoryOwner 求归属，归属页实际列有故事，并能从公开路径往返恢复相同页面/选择；电话也核对既有 owner 和真实记录 id。没有新增归属规则。
- head 纯检查与 CI fixture 通过；fixture 核对多域标题/escaping、完整小型候选加载、release 错配和内容校验失败。真实候选加载的数量为 80/4，初步渲染 1,401 个外壳。

`npm run build:check` 通过（26.18 秒）；只复用本工作树 `.analysis/build-check`，无 public 复制。真实候选生成及 `verify-entity-head-shells --dist` 核验 1,401 个外壳通过。`check_cutover_routes.mjs --progress` 与 `verify-archive-build-audit.mjs --progress` 通过，不代表全站 cutover/device final。旧 Browser 脚本 P15 改用通用设置页检查站点标题（个人剧情如今也有路径），P34 使用主线合集路径；相同语义已用直接 Browser 验证，未另起缓存 Chromium。

## Browser P51–P66

直接 Codex In-app Browser，5240，PID 13696；确认该进程和实际 HTTP 注册表来自本工作树新分支，候选 release 如上；未换服务或消费绑定。新 tab 5 的 error 日志为空。

| 编号 | 实际观察 |
|---|---|
| P51 | 冷开 `/stories/main/101/`，标题第1章，主体 11 话 / 102 段剧情 |
| P52 | 冷开 `/stories/unit_story/1/`，标题 Jupiter，已加载前传章节及始动，Jupiter！ |
| P53 | 冷开 `/stories/extra/601/`，标题謹賀新年2022，实际新年的抱负 |
| P54 | 旧生日 query 改写 `/stories/birthday/029ass/`，阿斯兰标题和 3 篇生日剧情；另冷开 producer 公共篇与 101ken 职员特例，内容和标题实际加载 |
| P55 | 冷开 `/stories/idol_story/001tom/`，冬马个人剧情标题、2 话 / 13 段与值得依靠的成年人 |
| P56 | 冷开 `/stories/work/001tom/`，4 短剧情 / 9 场景台词 / 39 语音；切台词后 `?work_mode=lines` 冷刷新仍显示真实台词列表 |
| P57 | 冷开 `valentine_2022` 季节路径，2022 情人节标题，2 届 4 期 / 306 段 / 49 偶像 / 2 职员 |
| P58 | `/stories/external/` 显示社区剧情标题和既有站外视频暂时关闭提示；不视为外部资源播放验收 |
| P59 | 主线选第1话，地址 `?story=1_4_001_01.json`；Reader 已载入译文，页面返回同一合集路径和同一展开章节 |
| P60 | 冬马、翔太参与者抽屉选择只改变 `idol` query；等待地址落定后冷刷新仍为翔太抽屉，路径与活动标题不变 |
| P61 | Growing Smiles！解锁入口 → `/stories/main/101/` → 冷刷新 → 页面返回 `/songs/grwsml/`，实际歌曲详情和解锁按钮加载，URL 没有 parent/song 来源参数 |
| P62 | 个人剧情 → 生日档案 → 刷新 → 返回个人剧情路径，标题匹配 |
| P63 | 目录“全部检索”输入始動、Jupiter，实际一个结果 → 前传合集路径，`story` 为 `1_1_001jup_02_1_1_001_02.json`，第2话展开 |
| P64 | 五个域落地页冷开：主线 3 章/22 话/204 段，extra 7 作品/47 章，生日 51 角色/181 篇，组合前传 16 组/54 篇，活动 36 部/396 话；全部标题匹配。unit/event 的最早 0/占位读数未记作通过，均等实际行加载后复核 |
| P65 | 旧 `files + episode_zero + group` 链接，经既有 StoryOwner 打开同一前传合集/第2话；未给 story_detail 或文件创建路径 |
| P66 | 变异恢复后，独立新标签冷开主线合集带 `story`，第1话展开；页面返回主线域落地页，没有继承此前歌曲来源，error 日志为空 |

P60 第一次切人后过早刷新，尚未等待地址写入；重新等待确切 URL 后复验通过。社区提示本身使用 role=status，不能用“全部 status 隐藏”作为加载完成条件。以上为 dev 桌面旅程；本轮没有新增真机或生产 bundle 证据，也未扩大到 R1 的本地技能海报媒体缺口。

## 变异与剩余检查

13 个坏版本均被新断言拒绝并恢复：producer 生日 pattern、域默认模式、合集 story、季节 idol、个人 episode、工作 work_mode、合集 history 写入、history song 读取、分享来源清理、组合 unit 来源、候选 release、候选 checksum、季节标题年份。每个都有独立失败日志和 `mutation-summary.json`；不是把 verifier 自身改坏。对应正向检查随后通过。

完整 `npm run gate:source` **116/116 通过**（输入 HEAD/base `b1065a8f` 加本 R2 patch；运行期间仅补写本记录）。汇总回归 196.3 秒、门禁内编译 26.5 秒、构建审计 2.1 秒。最终构建重新生成 1,401 个外壳并通过 `--dist` 核验；cutover 与 build audit 的 progress 模式再次通过，sourceRevision 明确为运行时的 `b1065a8f`，不冒充后续提交 HEAD 的构建。新增执行记录、台账和当前状态是手工维护，不是门禁生成。

所有本轮日志复用 `.analysis/deep-links-r2/`，不创建 public 语料包。`prepare-readmodel-preview.mjs` 只在外壳段传入它已有的 models 目录，本轮未执行完整预览包/发布验证。不部署、不上传资源，不改变 read-model 绑定。已合入的 #122 临时工作树已通过应用工具归档，其三份小日志保留在 `merged-fix-logs/`；已删除两个完成的本地分支，R1/小修提交均保留于 master。

R3/R4 继续遵守原交接的门户/语料/决策前置条件。当前 master 的已合入门户批次没有 P3、P4、P7；本批没有擅自实现这些后续路径。

收口时 R2 实现分支已完成；后续依赖核对见 [交接最新记录](GS_ARCHIVE_HANDOFF_20261028_DEEP_LINKS.md#后续前置核对2026-10-28)。收口只更新文档，不改变前述代码验证的输入或证据等级。
