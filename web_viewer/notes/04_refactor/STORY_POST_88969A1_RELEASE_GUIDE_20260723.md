# PR #1 / Story Runtime 发布收口指导（2026-07-23）

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

必须补齐：

- Edge 首次用户手势解锁；
- 真实 `document.hidden` / 恢复；
- 跨 episode 的手动、Auto、Skip、Backlog、Choice 混合曲线；
- BGM/Ambient 淡入淡出与恢复；
- 2–4 小时 heap、Spine instance、active source、timer、overlay 收敛。

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
