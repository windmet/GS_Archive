# 开发时间线考证（2026-11-03）

开发手记里的每个时间点，都按证据核对一遍。证据只认三类：Git 提交与 PR（`gh`）、仓库内当天落地的文档、外部公开报道。
站长的回忆和 AI 整理稿（Gemini「SideM 门户开发手记」三轮对话）都只当线索，不当证据。

状态：✓ 有证据 · ⚠ 证据与回忆或 AI 稿不一致 · ？ 还没找到证据，需要站长补充

> 提交日期取作者日期（`git log --all --date=short`）。PR 提交数用 `git rev-list --count <merge>^1..<merge>^2`；
> `gh pr view --json commits` 最多只返回 100，三位数的 PR 不能用它数。

## 外部时间点

| 日期 | 事件 | 证据 | 状态 |
|---|---|---|---|
| 2021-10-06 | 《偶像大师 SideM GROWING STARS》开服 | 电击 Online / KAI-YOU 停服报道 | ✓ |
| 2023-04-04 | 官方公布停服，4 月起缩小运营，5 月起停止活动与剧情更新 | 同上 | ✓ |
| 2023-07-31 | 停服（13:59） | 同上 | ✓ |
| 2023-09 | 官方在 SideM 品牌页「315 PASSION CONTENTS」公开 GS 剧情存档（视频） | Famitsu 2023-09 报道；现为品牌页「サイスタ アーカイブ」栏目 | ✓ |
| 2026-09-13 | SideM 11th STAGE ~EVER EVER@FTER~ DAY2（TOYOTA ARENA TOKYO）公布 Switch 2 / Switch 新作 | Famitsu、inside-games 2026-09-14 报道 | ✓ 站长更正正确；AI 稿初版写错过 |

## 项目时间线

| 日期 | 事件 | 证据 | 状态 |
|---|---|---|---|
| 2026 年初 | 站长入坑 SideM | 站长自述 | ？个人经历，不需要证据 |
| 2026-06（之前） | 从偶然找到的 asset 包出发，用 DeepSeek 搓出第一版剧情播放器骨架，还没有 Git | 首个提交的说明写着已排除 `public/assets/`（5 GB），说明提交前代码和语料已经在本地 | ✓ 间接证据 |
| 2026-06-22 | 首个提交 `ca3a28e1`「Initial commit — SideM Story Viewer」 | Git | ✓ |
| 2026-06-22 | 首个提交是谁建的 | 提交带 `Co-Authored-By: Claude Sonnet 4.6` | ✓ 站长确认：当时用 Claude Code 接 DeepSeek API，trailer 是工具写的，模型实为 DeepSeek。回忆中的「Codex 帮忙建第一个提交」不成立 |
| 2026-07-01 | 口型（lipsync）、子模型嘴型修复，拆分 viewer 逻辑 | `23dbba83`、`1800c7bd` 等 10 个提交 | ✓ |
| 2026-07-03 | Masterdata 进入导航（「7 月初解开数据」） | `e43ebecb` Add masterdata-backed archive navigation | ✓ |
| 2026-07-13 | 定方向：做资料库与回放器，不复刻客户端和抽卡 | `notes/04_refactor/SEKAI_VIEWER_DIRECTION_GUIDANCE_20260713.md`（7-14 提交） | ✓ |
| 2026-07-14 | GitHub 仓库 `windmet/GS_Archive` 建立；当天 36 个提交 | `gh repo view` createdAt 2026-07-14 | ✓ 转公开日期查不到（事件接口只保留最近 300 条，最早 10-27）。站长说明：当初公开是为了让 GPT 读仓库，后来才知道私有仓库也能读 |
| 2026-07-18 → 07-23 | PR #1 剧情运行时重构 + 本地化契约，88 个提交 | `gh pr view 1`；分支 `codex/story-localization-contract` | ✓ Codex 时期的直接证据 |
| 2026-07-23 → 07-29 | PR #2 资源来源迁移到 RAW 与 masterdata，83 个提交 | `gh pr view 2` | ✓ |
| 2026-07-29 → 08-12 | PR #3–#42：关系目录、发布治理、P1/P2 批次（门禁、账本、strict-v2 集中在这段） | `gh pr list` | ✓ |
| 2026-08-13 → 09-07 | 停工：所有分支 26 天没有提交 | 每日提交数：8-13 有 9 个，下一个是 9-08 | ✓ 站长说「半个多月」，实际近四周 |
| 2026-09-08 | 架构重构审计：`App.vue` 2,986 行 | `docs/ARCHITECTURE_REFACTOR_20260908.md`（`611a5efb`）；当天 67 个提交 | ✓ |
| 2026-09-08 → 09-14 | 大重构（「连跑八九个小时」） | 9-08 有 67 个提交，9-09 有 49 个，9-12 有 44 个，9-13 有 60 个 | ✓ 单次时长无法从 Git 证明 |
| 2026-09-11 | Codex 交接给 Claude Code | `docs/SIDEM_CLAUDE_CODE_HANDOFF_20260911.md`：「来源：Codex 完整会话导出整理」 | ✓ |
| 2026-07-01 → 09-14 | `Claude Sonnet 5` trailer 共 37 个提交 | Git trailer | ✓ 站长确认：10 月以前带 Claude 署名的提交都是 Claude Code + DeepSeek API。真正用 Claude 模型从 10-05 开始 |
| 2026-09-13 | 11th LIVE DAY2 当天仍有 60 个提交 | Git | ✓ |
| 2026-09-20 | 电话界面回到原版竖屏手机框；手机横屏沉浸模式 | `6f67d211` restore phone visuals、`7a3ce176`、`38f8c4b4` | ✓ |
| 2026-09-23 | PR #43「收口资料馆、剧情运行时与移动端交互」合并，264 个提交 | rev-list | ✓ |
| 2026-10-03 | 设计令牌第一次进入代码：`GS_UI_TOKENS.css` | `9431ab99` | ⚠ 比 Claude Opus 5.5 trailer 早两天 |
| 2026-10-05 | 节目册设计基础；`Claude Opus 5.5` 与 `Sonnet 5.5` trailer 从这天开始 | `0c974adf`；trailer 首日 | ✓ 对应「10 月初开通 Claude」；令牌推到全站是 10-05 以后的事 |
| 2026-10-09 | 绑定读模型 release，测试部署前置 | `c00599e4`、`b2372398` | ✓ |
| 2026-10-10 | 测试版发给热心制作人内测 | `309ca736` docs: 2026-10-10 test deploy handoff | ✓ |
| 2026-10-11 | 记录内测反馈并部署 | `47d76acc` record test feedback deployment | ✓ |
| 2026-10-14 | PR #48 最后一个大分支合并（108 个提交），此后改成短分支 | rev-list | ⚠ AI 稿写 105，按 rev-list 是 108 |
| 2026-10-20 | PR #56 视觉收敛、#61 导航命名、#63 worktree 共用语料，当天合并 10 个 PR | `gh pr list` | ✓ |
| 2026-10-27 → | 节目册 2.0 门户改造（P0–P7） | `docs/PORTAL_REDESIGN_PROGRESS_20261027.md` | ✓ |

## AI 稿里的技术数字

能在仓库文档里找到出处的，写进文档时注明出处；找不到的要先复测，不能照抄。

| 数字 | 出处 | 状态 |
|---|---|---|
| 单曲读取瘦身 95.9% | `docs/GS_ARCHIVE_R2_RELEASE_20261021.md` | ✓ 有出处 |
| 725 个骨骼模型 | `docs/GS_NATIVE_ADV_PLACEMENT_20261015.md` | ✓ 有出处 |
| 724 个粒子系统 | `docs/NATIVE_*_20261020.md` | ✓ 有出处，写之前再核对口径 |
| 48,268 个只含 wait 的 cut（RAW 共 126,633 个 cut，约 42,000 s） | `docs/STORY_RECOMPILE_CANDIDATE_20261020.md` | ✓ 有出处；口径是「旧编译器丢掉的纯等待 cut」，不是全部 wait |
| 261,812 行 RAW 舞台指令（118 份编排、58 类） | `docs/STAGE_RAW_COMMAND_MATRIX_BATCH_20261015.md`，10-20 `STAGE_FOLLOWUP` 复核 | ✓ 有出处；含 1 行非时序说明，行数不等于执行数，也不是视觉完成率 |
| 10,326 份场景 / 315,124 个快照（另有 175,600 个 cue、48,073 条口型记录） | `docs/SCENARIO_PIPELINE_BOUNDARIES.md` | ✓ 有出处；AI 稿写「31.5 万」是取整 |
| 826 张卡、49 位偶像、16 个组合 | 门户首页统计、Masterdata | ✓ |

## 站长补充（11-03 已答）

- 10 月以前带 Claude 署名的提交：Claude Code 接 DeepSeek API。按署名统计模型时，10-05 以前的 Claude 署名一律算 DeepSeek。
- 仓库转公开：日期不详，原因是想让 GPT 读仓库。
- 「Astra」= ChatGPT 6.0 Astra；「Luna」= ChatGPT 5.6 Luna（前期为省额度用的轻量模型）。
- 项目起点：站长偶然找到的两款停服游戏的 asset 包，不是 IPA。公开文档不写 asset 包的来源。
- 两位朋友（都是女生，文档里用「她」）：
  - **柚子贝汁 P**（担当 円城寺道流）：从最初就一路陪伴，测试每个版本，提产品建议。
  - **shiogi P**（担当 大河タケル / 都築圭）：6 月末到 7 月初提供了关键帮助，对应 7-03 Masterdata 进入导航。公开文档不写她提供了什么。

## 工具时期（按署名和交接文档）

| 时期 | 主力 | 证据 |
|---|---|---|
| 6 月 → 7 月中 | Claude Code + DeepSeek API | 首个提交起的 Claude Sonnet 4.6 / 5 署名；站长确认 |
| 7 月中 → 9-11 | Codex / ChatGPT（5.6 Luna、6.0 Astra） | PR #1 起的 `codex/*` 分支；9-11 交接文档「来源：Codex 完整会话导出」 |
| 9-11 → | Claude Code 接手交接 | `SIDEM_CLAUDE_CODE_HANDOFF_20260911.md` |
| 10-05 → | Claude Opus 5.5 / Sonnet 5.5 | 署名首日 10-05 |
| 翻译 | Gemini（AI Studio）初翻 → GPT、后来 Claude 审查 | 站长自述；翻译批次文档 |
