# PR #1 / Story Runtime 发布收口指导（2026-07-23）

> **合并后状态：** PR #1 已于 2026-07-23 合入 `master`，merge commit 为 `ef804fcb2b258979723fcf8ce62f317671b4d701`。本文保留为合并前评估、发布 gate 和 soak 规程的历史证据；新窗口应先读 `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`，不要再把本文的 draft/合并步骤当成当前待办。

## 目的

本文是 `88969a18` 之后的短期执行基线。旧的 Runtime 设计、Localization contract 与 next-window audit 继续保留为架构和历史证据；后续窗口先读本文，避免把已经完成的迁移步骤再次列为“下一步”。

## 对外部评估的判断

评估的主结论中肯：

- Runtime、音频所有权、结构化本地化 UI、strict compiler/publisher 已形成工程闭环；
- “基础设施完成”不能等同于“全库迁移、全量翻译、公开站点完成”；
- PR 过大、无 GitHub Actions、真实 Edge/后台/长时间有声音频验收不足，是当前最重要的发布风险；
- 不应一次迁移全库，也不应在当前 PR 继续加入 Chibi、门户扩张或 compiler 大改。

需要校正的部分：

1. `97%–99% Runtime/Localization 基础架构` 是范围内的主观成熟度，不是 release readiness。未完成真实环境矩阵、CI 和合并验收时，不宜对外宣称“99% 完成”。
2. `播放器核心约 94%` 可作为内部排序参考，但没有统一分母；不能替代 release matrix。
3. `可公开演示 82%–88%` 偏乐观。稳定部署、错误页/缺资源体验、完整可读双语 episode、真实音频长测均未闭环。
4. `完整中文化约 5% 以下` 方向正确，但当前仓库只证明 formal overlay 3 个 valid unit、24 个 fallback unit，以及少量实体 fixture；没有足够统计支持精确百分比。
5. 评估建议“冻结 PR”同时又把第二 collection 放在 P2。两者不能并行无限扩张：第二 collection 作为既定小批验证已完成，之后应冻结 feature scope。
6. 第二 collection 不应只追求“结构不同”，还要先满足最小可恢复发布、raw 完整、voice relink、跨语言 parity 和正式旧文件 hash 可验证。本轮 `5_01_101_22` 满足这些门槛，但仍未覆盖 Phone/Mobile/Choice 等新形状。

## 当前确认事实

评估基线 `88969a18` 的 GitHub PR #1 元数据已只读核对：

- 80 commits；
- 131 changed files；
- +18,514 / -838；
- draft、mergeable；
- `statusCheckRollup` 为空；
- 仓库根目录不存在 `.github/workflows`。

第二个 strict collection `5_01_101_22` 已在本机 mounted corpus 原子发布：

- 3 files / 2 episodes；
- 9 unique steps；
- 6/6 voice refs resolved；
- formal→compat non-text differences 0；
- Python native→JavaScript oracle recursive differences 0；
- 精确旧文件备份与 backup manifest 已保留。

mounted corpus 默认不由 Git 跟踪，所以远端 PR 只会记录发布工具、验证器和文档；不能用 PR 文件列表推断本机 strict corpus 数量。

## 立即冻结边界

本 PR 后续只允许：

- blocking bug；
- release verifier / CI；
- release report、PR body 与合并准备；
- 不改变产品语义的小型诊断或回归修复。

暂不加入：

- 新门户页面或大规模视觉重做；
- 新翻译系统、批量翻译或协作后台；
- 新 Chibi/粒子功能；
- compiler 大改或全库 strict 批量发布；
- Vue/Pixi/TypeScript 技术栈迁移。

## 执行顺序

### P0：提交并锁定第二批 strict 发布工具

1. publisher/candidate verifier 全绿；
2. mounted schema、text、voice、episode、playback、presentation 回归；
3. production build；
4. 文档记录 exact hashes、backup path 与剩余边界；
5. 提交并推送，核对 local/remote SHA。

### P0.5：建立 source-only GitHub Actions

状态：已实现，GitHub PR run 已通过。

最小 CI：

```text
npm ci
git diff --check
npm run verify:story-schema
npm run verify:story-localization
npm run verify:story-translations
npm run verify:story-text
npm run verify:story-audio
node scripts/verify-story-runtime-foundation.mjs
npm run build
```

实际 workflow：`.github/workflows/web-viewer-source-gate.yml`。除上述最小矩阵外，还执行 strict collection publisher 与 compiled migration verifier；只在 `data_pipeline/**`、`web_viewer/**` 或 workflow 自身变化时触发。权限固定为 `contents: read`，同一 PR 的旧 run 自动取消，job timeout 为 20 分钟。

`git diff --check` 不使用对干净 checkout 无效的裸命令：PR 按 base/head SHA 检查完整 patch，push 按 before/current SHA 检查；checkout 使用完整 history。workflow 经 `actionlint v1.7.12` 校验。

本机 detached source-only checkout 已逐条模拟 workflow：

- `npm ci`：108 packages，0 vulnerabilities；
- schema：2 tracked scenarios / 24 snapshots / 7 cues，mounted anchor 明确 skip；
- localization、translations、text、100-cycle audio、Runtime foundation、authoritative publisher、compiled migration：全部 PASS；
- production build：2401 modules，PASS；
- 两条未挂载媒体路径保留为 runtime URL 的提示符合 source-only 边界。

远端首次 run `29976181433` 正确发现本 PR 历史中的 5 个 whitespace 问题，因此在 patch gate 失败并跳过后续步骤；这些 EOF 空行/Markdown 尾随空格已机械清理。后续 run `29976275109` 于 25 秒内完成全部 15 个 job steps，结论为 success。该结果证明 CI 实际检查完整 PR patch，而不是只检查干净 checkout。

CI 必须明确区分：

- source-only：GitHub 必跑；
- mounted corpus：本机发布前必跑；
- 真实媒体/浏览器：人工 release acceptance。

### P1：真实环境发布验收

只使用一个浏览器标签。由于 IDM 会嗅探音频，普通画面调试继续使用 `noAudio=1`；该模式只证明网络隔离，不是音频验收。真实音频验收由用户明确安排后再进行。

安全可执行部分已追加完成：strict episode a 的 Choice→Backlog restore→Auto→Choice→Skip All→episode complete→episode b，以及 simulated hidden/visible 均通过。过程中发现并修复 manager teardown 重复销毁 debug marker；含 Spine 的下一话退出后 marker warning 为 0。短曲线 heap 回落、AudioContext 未初始化、active source/timer 为 0。详见 release matrix。

已知缺失 Spine 的 `102sha_001_00` 也已完成小型发布修复：它现在是唯一有审计证据的 silhouette-only 显式契约，进入场景时直接加载 PNG，不再先请求不存在的 Spine/atlas。新增 `verify:silhouette` 并纳入 source-only CI；单标签 `noAudio` 定点复核确认剪影可见且相关失败日志为 0。这是既有 fallback 的确定性与降噪修复，不扩展 feature scope。

必须补齐：

- Edge 首次用户手势解锁；
- 真实 `document.hidden` / 恢复；
- 跨 episode 的手动、Auto、Skip、Backlog、Choice 混合曲线；
- BGM/Ambient 淡入淡出与恢复；
- 2–4 小时 heap、Spine instance、active source、timer、overlay 收敛。

#### 2–4 小时 release soak 操作规程

`runtimeDebug=1` 现在提供 `START SOAK`、`STOP SOAK`、`EXPORT SOAK` 三个按钮。记录器默认不运行；启动后每 30 秒采样一次，最多保留 481 条（起始样本 + 4 小时），不会创建额外浏览器标签或主动请求媒体。页面右侧瞬时诊断的刷新频率也由 500ms 降为 2 秒，减少长测自身的 CPU 干扰。

执行顺序：

1. 只保留一个应用内标签。IDM 未关闭时必须保留 `noAudio=1&runtimeDebug=1`，只能验收 heap、Spine、silhouette、Runtime cue 和 overlay；不得写成真实音频通过。
2. 点击 `START SOAK`，按发布矩阵执行正常 Next / Auto / Skip / Backlog / Choice / episode 切换。SPA 内 StoryViewer 卸载/重挂载会继续同一记录；硬刷新、关闭标签或整个站点重新加载会清空本次内存记录。
3. 在 2–4 小时终点停在无进行中转场、无 voice 的普通 ADV/Choice 页，等待至少 30 秒，再点击 `STOP SOAK`。
4. 点击 `EXPORT SOAK`。左下角只读文本框给出 `story-release-soak-v1` JSON；复制后保存在工作区外，和浏览器/系统版本、是否 `noAudio`、起止 episode、实际操作曲线一起归档。
5. 检查 `summary` 和最后 25% 样本，而不是只看单个末值：
   - heap 应至少出现回落，且稳定场景基线不能持续单调上升；
   - quiet endpoint 的 `active_runtime_cues`、`audio_cleanup_timers`、`active_screen_overlays`、`silhouette_pending`、`silhouette_relayout_jobs` 应为 0；
   - `spine_instances` / `silhouette_instances` / `spine_container_children` / `debug_markers` 应与终点画面一致，`stage_children` 不应随 episode 单调累加；
   - 有声验收时 active source 应与当时 BGM/Ambient/voice 实际所有权一致，不能机械要求全程为 0。
6. warning/error 只统计本次 `START SOAK` 之后的新记录。正常的 Spine spawn 与 StoryViewer unmount 已降为 debug；任何新的资源失败、动画缺失、Runtime cue target unavailable、marker teardown 或未处理异常仍应判为问题。

记录器只产生观察证据，不自动把曲线判为 PASS。若 IDM 未关闭，先执行无音频 2–4 小时曲线，真实 Edge autoplay、后台听感及 BGM/Ambient 验收仍保持未完成。

### P2：PR 收口与合并

1. 更新最终 release report 与 PR body；
2. 核对工作区无无关文件；
3. CI 通过；
4. 标记 ready for review；
5. 选择保留逻辑提交的 merge 策略；
6. 合并后从干净 master 运行 source-only build。

不要为了缩短历史而无条件 squash；当前 channel/publisher 提交仍有明确回滚价值。

### P3：合并后的产品化

合并后另开分支：

- 播放器 UI 精修；
- 一个完整、人工可读的双语 episode；
- 部署、错误页、缺资源体验与演示入口；
- 再按 1→3→10→按类型抽样的节奏继续 strict collection。

下一批 strict 样本要补本轮未覆盖的形状，例如 Phone/Mobile/Choice 或无 Spine 剧情；不得因为前两个 collection 通过就全库替换。

## 完成判定

当前 PR 可以从 draft 转为 review 的最低条件：

- source-only CI 存在，本机 detached 模拟与 GitHub PR run 均通过；
- mounted 发布后矩阵通过；
- Edge/后台/长时间音频的未完成项被实测关闭，或被明确列为不阻塞且有负责人/后续 issue；
- PR body 说明两个 strict collection 与全库仍低于 1% 的边界；
- 最终工作区和远端 SHA 一致；
- 不再有新功能继续进入该 PR。
