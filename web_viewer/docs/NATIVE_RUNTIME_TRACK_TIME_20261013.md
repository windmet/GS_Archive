# 原版轨道顺序与动作起播时间

输入 HEAD：`1764611c`；分支：`claude/native-runtime-fidelity-20261013`。

## 已完成的代码

- 共用轨道定义：身体 0、脖子 1、表情 2、闭嘴 3、闭眼 4。角色生成的默认/备用表情、基准姿势、表情切换、脖子清理、cue 完成判定、Studio 预览都使用新编号。唇同步继续由现有骨骼/attachment hook 处理，3 留作原版闭嘴层。
- RAW `idol_animation` / `idol_nobackanimation` 第四列保留为秒数：即时状态 `anim_track_time`，延迟事件/cue `track_time`。延迟动作还会把偏移带到下一步的累计状态。后续零偏移动作或重新生成模型清除旧偏移。
- Python 与 JS 的 settled snapshot 传播一致，严格 v2 schema 接受新增字段；缺字段保持零偏移兼容。
- `PlayMotionInternal` 对目标身体动作设置 `min(trackTime, duration)`，包含 pose/loop 直接播放路径。前置 back 和后续 pose 从零开始；偏移不加到 back 上。真实 AnimationState 回归验证排队后偏移仍在、剩余动作时长缩短。
- neck API 也支持原版 `PlayNeckInternal` 的参数行为：直接播放时偏移 neck；有 back 时偏移 back，随后 neck 从零开始。剧情 `CoPlayAnimation` 明确给 neck 传 0，将合并记录的 trackTime 只传给身体，所以没有把 neck 指令第四列强行用于剧情脖子播放。
- 新增两项偏移回归，并补齐前一批 motion/neck-back/close-eye 检查在 Source Gate 的注册。

本地原版依据：`.analysis/ghidra-il2cpp/scenario_command_columns.json` 的三个动作指令第四列；`decompiled_pass1_annotated/Growing.IdolAnimation.IdolFigureSkeleton.c` 中 `PlayFaceInternal` RVA `0x2248b68`、`PlayNeckInternal` RVA `0x22497a0`、`PlayMotionInternal` RVA `0x2249ddc`；`decompiled_pass5_annotated/IdolCharacter._CoPlayAnimation_.c` RVA `0x21477d4`。

## 验证

- `npm run verify:spine-motion`（含新增 JS/Python 偏移回归）、`npm run verify:spine-blink`。
- `verify-spine-neck-contract.mjs`、`verify-spine-neck-overlay.mjs`、`verify-story-spine-cues.mjs`、`verify-studio-animation-state.mjs`、`verify-story-spine-preload.mjs`。
- `npm run verify:story-runtime-foundation`、`npm run verify:playback-controller`、`verify-shared-scenario-normalizer.mjs`、`verify-authoritative-story-schema.mjs`、`verify-authoritative-runtime-shapes.mjs`、`verify-publication-ledger.mjs`、`verify-verifier-coverage.mjs`。
- `npm run build:check`：完整代码编译，输出固定 `.analysis/build-check`，`copyPublicDir:false`，不含完整静态语料。第一次因 sandbox Git ownership 审计失败；进程内配置 safe.directory 后通过，未修改用户全局 Git 配置。生成路径漏项修正后再次构建。
- Browser 使用 Codex in-app Browser，用户指定 `http://localhost:5212`。进程 48736 的命令为 Vite `--configLoader native --host 127.0.0.1 --port 5212 --strictPort`；HTTP 返回本次 `spineTracks.js`。未重启服务或改端口。
- 主线 `1_1_001jup_01_1_1_001_01.json` 第 31 步：生成后轨道为 0 wait_loop、1 空、2 face_default、4 eye_close；眼球 attachment 隐藏。约 3 秒捕获 1 neck_question 与 2 face_sad 并存。恢复演出后 weight 开始，轨道 1 清空。下一段/上一段使进度 1→2→1。
- 非零偏移 Browser 使用隔离候选 `candidate/__qa_native_track_time.json`：来自真实 RAW `004ter_101/scenario_2_1_004_01_00.json`，只回填两个经动作/步骤身份核对的 `.1` 字段。初始 DOM 诊断为身体 angry `.513` 秒、表情 face_happy `.413` 秒；延迟 body cue 在约 2.7085 秒启动，随后进入 weight_loop。没有改写正式 compiled 文件。
- 桌面 1440×900 与默认移动视口检查页面身份、非空、无框架错误层、画面及交互。最终演出路线无新增应用错误。最初临时样本放 public 时因 Vite 启动时的 public 路径清单返回 HTML，出现一次 JSON 解析错误；改用既有 candidate middleware 后载入成功。已有 Pixi 废弃 API warning 仍存在。首次带语音浏览显示语音未载入；动画验收使用 noAudio/noVoice，未把结果当音频验收。
- 截图位于当前会话 visualization 目录的 `native-tracks-desktop.png` / `native-tracks-mobile.png`。候选为约 4.9KB JSON，位于 `.analysis/raw-migration/__qa_native_track_time/compiled/authoritative/`（该目录名是既有 middleware 约定，样本本身仍是兼容格式）。

## 仍未完成的数据工作

本地旧源扫描：35,929 条 idol_animation、835 条 idol_nobackanimation、5,086 条 idol_neckanimation；其中 381 条身体指令（250 个源文件）有非零第四列；另有 17 条第四列误填表情标记，按 ConvertFloat 默认 0 处理。

已发布 JSON 早先丢弃了第四列。本批修复编译与消费链路，但没有批量回填这 381 条旧记录。试作回填发现集合分片不能按单文件直接映射、部分文件已是权威 v2、另有兼容文件的步骤数与当前编译输出不同，故没有强行覆盖正式数据。完整历史生效仍需要按集合/episode 关系准备候选、逐字段核对，并通过各自的发布与 ledger 流程；本批不是数据发布，也没有部署。隔离样本的 Browser 通过不代表其余 379 条已上线生效。

没有进行原版游戏逐帧画面对照。眼睛淡出时长的既有未知项未改。
