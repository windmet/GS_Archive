# 原版关联修正实施记录

- 日期：2026-10-13；分支 `claude/native-runtime-fidelity-20261013`；输入 HEAD `5ff5c0b2`。
- 依据：[原版链路反查与关联、数据修正交接](NATIVE_RELATION_DATA_HANDOFF_20261013.md)。
- 本地提交：`713af203`（数据管线与数据）、`54fbaf2c`（消费端）、`6ad32ccb`（抽选记录时机）。未推送、未部署、未更新 `readmodels/bootstrap.inline.json`。

## 已实施

| 项 | 内容 | 主要位置 |
| --- | --- | --- |
| 首页通用语音投影 | 新增 `--home-system-voice-only`。table 90 HomeStand 1,029 条全部按 ScriptName 定位到唯一 compiled 文件，按 ScriptLabel 定位跳转点；跳转点的值是 step_id，不是数组下标。table 91 HomeStand 2,356 行保留月份、时间、Param1、Param2 与 override。 | `data_pipeline/sidem_masterdata/home_system_voice.py`、`public/data/masterdata/home_system_voice_index.json` |
| 首页消费 | 每位偶像先列 21 条通用语音，再列卡面语音；卡面语音与此前 2,356 条完全一致。目录分开计数，通用语音按全天/时段/季节分组并显示条件，可按来源筛选。新增默认台词切换「原版」。 | `src/data/archiveHomeState.js`、`src/data/homeVoiceDecider.js`、`ArchiveImmersiveHome.vue` |
| 原版抽选 | 候选池为当前卡片和偶像通用语音。卡面模式取所选壁纸卡及其觉醒状态，立绘模式取最近一条卡面语音所属卡片（视为已觉醒）。未觉醒时排除 Param2 行；card override 排除对应偶像行；Param1 为 0 不入池。时间按日本时间当天判断：起点包含、终点不包含，跨午夜区间在当天的凌晨段不生效（与 IsInTerm 一致）。按权重累计抽取；候选多于最近记录时跳过最近 4 条；台词显示即记入最近队列。 | 同上 |
| 工作字段 | JobData 改读字段 6 为 SortOrder，另存 IdolType（10）与 Term（9）；JobStory/Appendix 保留 Term。正式索引只迁入这些字段。 | `work.py`、`scripts/apply-work-story-native-fields.mjs` |
| 生日与个人故事 | 生日标签由「第N期」改为 PlayYearCount「第N年」；生日故事行带「第N年 · 制作人/偶像生日」，共享 Small Talk 带生日别名供搜索。偶像统计拆为话数、Episode、Small Talk。 | `storyCollections.js`、`storyDomainIdentityIndex.js`、`idolPage.js`、`checkout_adapter.mjs` |
| 门户投影 v2 | 偶像视角「进入主页」显示通用/卡面语音数；生日入口显示 181 篇及 29 篇共享；门户搜索覆盖共享别名。投影版本 1→2，生成器与前端校验同步。 | `portal_projection.mjs`、`PortalRepository.js`、`StoryGateways.js`、`ArchivePortalOverview.vue` |
| 卡池告知视频 | 仅当 MovieAnnounce.ResourceId 等于公告卡池编号，且 Term 开始时间等于公告开始时间，才挂为推定关联：27 条。3 条 GROWING FES 只有开始时间吻合，不挂。页面标明尚未转为可播放媒体。 | `gashaCatalog.js`、`ArchiveGashaDetail.vue` |

## 已知边界与遗留

- 工作剧本已迁到 runtime-v2 快照格式，旧工作投影读不出标题、背景和预览。这是既有问题。完整重生 `work_story_index.json` 会丢失这些字段，因此本批只做字段迁移，并断言其余内容不变。
- 原版时钟为服务器时间。本档案按日本时间计算，没有用历史响应核实服务器时区。
- 立绘模式无法得知玩家的觉醒状态，视为已觉醒，因此觉醒后语音（826 条卡面行）可被抽到。
- 告知视频未解封装、未转码、未上传，不可播放。转码需要 CRI 密钥与 wannacri；上传 R2 属于发布动作，需另行确认。
- 通用语音没有中文译文，界面显示日文原文。
- `home_system_voice` 只登记为 selected job，没有加入 `generate_full`，以免改变 full 模式的公开产物清单。
- 交接文档第五节的 trackTime 回填、空表情继承与 cue 去重本批未处理。

## 验证

- `npm run verify:source-batch`：130/130 通过；`verify-verifier-coverage` 通过（406 个脚本）。
- Source Gate 中与本批相关的 32 个 npm 步骤通过，包括 readmodels `test:source`、engineering、cutover-routes、story-catalog、archive-data、portal/idol/gasha、masterdata-*、archive-sources/assets、baseline source-only。`verify-idol-page` 的历史投影哈希保持 `0a961f02…` 不变。
- 新增 `verify-home-system-voice.mjs`（并入 `verify:home`）与 `verify-masterdata-home-system-voice.py`（并入 `verify:masterdata-interactions`）。
- `npm run build:check` 通过（固定输出 `.analysis/build-check`，未复制 public）。
- read-model 候选：`E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-20261013`，release `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`，共 6,347 个产物，`verify_artifacts` 通过。候选由 `54fbaf2c` 生成；`6ad32ccb` 只改组件和一处注释，没有重建候选。
- 浏览器：5177 候选服务，headless Chromium，日本时区。脚本与截图在 `.analysis/native-relation-candidates/browser/`。
  - 首页：百々人「1 / 67」，目录「21 句通用 · 46 句卡面」，分组和条件正确；选冬季语音后显示「通用语音 · 12–2月」。
  - 原版抽选：10 次点舞台均抽到当时在条件内的语音，最近 4 条内无重复，含 1 次卡面语音。
  - 门户：神谷幸広「通用 21 · 卡面 49 句语音」；生日入口「181 篇 · 其中 29 篇与个人故事共享」；搜索「第2年 · 偶像生日」命中 29 条。
  - 页面：偶像详情显示「2 话 · 10 Episode · 5 Small Talk」；天濑冬马生日页显示第1年/第2年及共享入口；卡池 10029 显示告知视频推定关联；工作页正常；390 宽首页目录无横向溢出。
  - 未验证：真实音频听感、iPad 与实体设备、5212 服务（未触碰）。
