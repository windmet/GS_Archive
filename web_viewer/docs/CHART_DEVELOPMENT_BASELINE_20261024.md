# 谱面开发基线与 PR 交接

2026-10-24；这是谱面分支提 PR 时的开发快照，不是部署记录。

## Git 与消费边界

- 分支：`chart/20261023-native-projection`，从master `2bdd3de4`开始；功能/性能证据收束于`0972a349`。
- 提PR前同步master `084dcedb`（PR #97）的普通merge为`28d870d5`。本批谱面改动尚未进入master，当前发布状态不由本文件推定。
- 开发消费：release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`，data revision `2688ad94abf9bd93277ec844a6ada160131e6f0856e5fad891ceb69de72f83bc`，media epoch `voice64-gzip-all-20260924`；与受跟踪bootstrap一致。
- 本地5231服务此worktree；端口和候选绑定不变。没有R2上传、站点部署或新的master基线tag。

## 已落地

1. 原生配速设置、逐音符speed及Special共用读取时长，按分段BPM换算可见窗口。
2. 原生坐标曲线/默认面板锚点、三皮肤音符quad与packed Sprite UV、给定平面点的hold mesh和路径长度UV。长条WebGL消费者及按需SVG退路共用同一原生几何。
3. VariableHold内部poly索引生成middle；核实判定核心谓词，但不实现游戏输入/分数。移除275个非hold正duration对象的伪尾点/伪hold。
4. flick根节点的lane/首尾时钟/缩放、默认第2套prefab发射器锚点及两层静态轮廓/填色。四张512×512来源PNG合计40,876字节；不是完整ParticleSystem效果。
5. 桌面和手机尺寸默认透视。轨道目标60Hz，控制台10Hz，长轨30Hz；静态时钟/同时线/middle/速度分组预计算，暂停/seek/前后音符/tick编辑/视图切换精确同步媒体时间。

完整来源和边界见[原生审计](CHART_ASSUMPTION_AUDIT_20261023.md)；性能和Browser证据见[帧率记录](CHART_FRAME_RATE_20261024.md)。

## 验证基线

- 244档来源谱面回归、732个presentation窗口、976个renderer复用/seek/皮肤窗口通过；原生timing、Special、projection、quad、hold、middle/判定回执和flick根节点的共享消费者回归通过。
- 受控Browser挂载实际组件，60/120Hz回调输入的10秒轨道更新599次、父组件120次；Reversed Masquerade跨160→196 BPM窗口保持逐音符位置一致。
- 真实音频/真实rAF的20秒观察：桌面Café Parade!、桌面K.now O.nly、390×844 Café Parade!分别59.00/59.28/59.90次轨道更新每秒，轨道更新CPU P95为5.9/5.6/5.6ms。均为visible/focused，无waiting/stalled；不是GPU呈现帧数或物理手机证明。
- `scripts/fixtures/song-chart-playback-browser.html`为受控回放；`scripts/fixtures/song-chart-live-performance.html`为真实媒体采样。两者仅用于本地诊断，不进入产品bundle。
- 本次提PR前给10个新增verifier补齐`config/verifier-coverage.json`的CI batch登记；原生producer仍是需要本地ELF/IPA的独立来源核对工具，不伪称CI执行了原生提取。

提PR前最后的build/source-batch结果及CI状态在下方补记；旧批次的通过不代替合并新master后的检查。日常构建只使用`build:check`的固定`.analysis/build-check`，不复制public。

## 下一批入口

先读[Autoplay准备度](CHART_AUTOPLAY_READINESS_20261024.md)。帧率修复已有当前Browser持续播放证据，下一步可以预计算head/middle/tail演示事件表，并按音频时间驱动；seek、暂停、缓冲、倍速和generation重置必须共享媒体时钟。

尚未实现Autoplay、触点/评分/技能状态机、原生nextFlickNote连线、完整hold按压/已删middle调度、完整flick粒子/预热/随机/blur/shader、原生命中/持续效果。若接原生命中特效，先补类型选择、prefab/材质、创建/停止/回收证据；不要将默认flick静态提示或其他游戏示意图升级为原生完整效果。物理手机、原机GPU对照和全曲长稳仍单独验收。

只提PR，不自动合并或部署；合入必须使用merge commit，禁止squash/rebase/force-push。

## 提 PR 前最终检查

- 最新master已同步为`084dcedb`；merge `28d870d5`无冲突。
- `npm run verify:source-batch`：178/178通过，包含本次补登记的10个谱面verifier。覆盖检查为485个脚本全部有CI路径或明确local-only原因。日志`.analysis/chart-native/pr-source-batch.log`。
- `npm run build:check`：24.45秒、3004模块，通过；固定`.analysis/build-check`且不复制public，保留已有背景未解析/大chunk warning。日志`pr-build-check.log`。生成的resource-audit未提交。
- master同步后的实际Browser：5231/PID67724；桌面1440×900冷加载Café Parade! EXPERT tick22000播放，暂停时audio44.645021秒、轨道78575.14896、控制台78575。手机尺寸390×844倒退tick22000、长轨图Combo816加载、返回`/songs/cfprde/`后新歌曲详情与难度卡片实际加载。控制台error/warn为空，视口已恢复；截图`.analysis/chart-native/pr-baseline-mobile.png`。该检查验证新master的集成旅程，不把前一批三轮20秒持续采样冒充本次重新测量。
- 三份本轮基线/入口文档的本地Markdown链接与`git diff --check`通过。
- GitHub完整Source Gate由PR触发；本地178项批次与构建不冒充GitHub CI已通过。当前PR进度以本分支关联的GitHub PR为准。

## PR #98 首轮 CI 修正

首轮Source Gate运行`40073740740`，输入`52ccbc8e`，失败项只有两处：

- `Check patch whitespace`发现`audit-song-track-native-hold-geometry.py:28`的空白行带尾随空格。提PR前的工作区`git diff --check`未覆盖早先提交的整条PR差异。现移除该空格，并改用CI同范围的`git diff --check origin/master...HEAD`检查整个PR。
- `Verify current archive baseline report`报`tracked_binaries drifted`。新增四张flick来源PNG共40,876字节已进入tracked-binary inventory，但`archive_baseline_report.json`仍是437张/77,157,611字节。现通过既有source-only collector读取Git跟踪集合，只同步该报告的`tracked_binaries`段为441张/77,198,487字节；没有刷新其他语料、发布记录或原始来源状态。

修复后`npm run verify:archive-baseline:source-only`通过：10,420个compiled JSON、441张PNG；Python源码内存语法编译及PR完整diff whitespace检查通过。该修正不改变播放器或原生算法，不重新打包public、不部署。GitHub复跑结果仍以PR当前head的Source Gate为准。
