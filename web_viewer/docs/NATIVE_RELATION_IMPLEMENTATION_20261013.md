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

## 整合到路径深链接分支（同日追加）

- 新分支 `claude/native-relations-integrated-20261013`（worktree `E:/Web_build/GS_Archive_Domain_Work/native-relations-integrated-20261013`）以 `claude/portal-image-budget-20261013` 为基线，合并了本分支。基线已包含 `/idols/<id>/`、`/units/<code>/` 路径定位、head shell 与门户图片延迟加载。两个实验分支（edge cache、SSG）不并入。
- 唯一冲突在 `ArchivePortalOverview.vue`，两边都保留：一边是延迟加载图片与占位，一边是首页语音数与生日共享说明。
- 首页「原版」抽选撤回，改为待办：它会让通用语音一直在当前时段内循环，很少切到卡面语音。「顺序 / 随机」改在通用 + 卡面的完整列表上切换；曾选过「原版」的偏好退回「顺序」。`homeVoiceDecider.js` 与它的样例测试保留，但没有接入首页。
- 修正基线遗留：显示年龄修复（`16b803cd`）改了 `idol_unit_dictionary.json`，活动资源图记录的来源哈希没有同步，`verify:editorial-source` 在基线上已经失败。现在只更新这一项哈希。

## 偶像自我介绍

- 原版位置：偶像详情页 `IdolProfileView` 的 `_introButton`「自己紹介」，调用 `OnClickVoiceButton`。播放的是该偶像在 IdolSystemScenario 里 Type=4（IdolDetail）的那一行：49 位偶像各一行，Param1=1，全年全天。依据是 dump 中的字段与方法声明、表数据，以及脚本文本与游戏截图一致；方法体尚未反编译。
- 数据：通用语音投影另外输出 `idol_detail`，HomeStand 部分的输出不变。例：天峰秀 `9_2_047` → `3_x_047shu_9_2_047.json`，跳转点 `9_2_047_00` 落在第 2 步，语音 `9_2_047_00.m4a`。
- 页面：资料页在档案下方新增「自我介绍」，显示原文台词，「播放 ADV」用播放器打开该脚本。播放器返回资料页，冷启动的播放器 URL 也能恢复资料页。
- 差异：脚本里的背景是事务所（`bg001_315pro_in_01`），游戏资料页显示的是更衣室，那是资料页自己的背景层，不来自脚本。

## 整合后的验证

- 新 worktree 有两个环境问题，均与代码无关，已处理：一是 `core.autocrlf=true` 把 2,554 个 LF 文件检出成了 CRLF，导致哈希校验失败，已按仓库原字节改写并刷新索引，内容无变化；二是被忽略的语料和素材，已用目录链接和硬链接补齐，未复制。
- `verify:source-batch` 133 项：131 项直接通过；两项 Spine 校验需要本地素材，链接素材后通过。另外 29 个相关 Gate 步骤、`verify-route-schema`、`verify-archive-path-locator` 和 `build:check` 都通过。`build:check` 查出撤回「原版」时残留的一个括号，已修复。它重新生成的 `config/resource-audit.json` 反映的是 worktree 里不完整的素材，已恢复，没有提交。
- read-model 候选：`E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-integrated-20261013`，release `b3c1f13a32f5098e46b5aa793ee3f7f89a25fc65d03e2256c7d47f792bfde32b`，`verify_artifacts` 通过。
- 浏览器（5177，headless Chromium，日本时区）：
  - `/idols/047shu/` 显示自我介绍，播放 ADV 正常。播放器 URL 为 `?view=player&…&scenario=3_x_047shu_9_2_047.json&return=idol_detail`，冷启动后点返回，回到 `/idols/047shu/`。
  - 首页从最后一条通用语音点舞台，顺序进入卡面语音（N · 起跑线）。
  - 生日入口显示「181 篇 · 其中 29 篇与个人故事共享」；神谷幸広资料页的统计和自我介绍正常；390 宽无横向溢出。
  - 截图在 worktree 的 `.analysis/browser/`。
