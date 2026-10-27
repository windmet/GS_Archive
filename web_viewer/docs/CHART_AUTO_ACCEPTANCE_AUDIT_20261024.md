# Auto Canvas 工作区验收与第二份审计交接

2026-10-24；输入为 `chart/20261024-autoplay-timeline` / `ad6808e1` 后的未提交 Canvas 改动，实查工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。本页接续[资源反查交接](CHART_AUTO_RESOURCE_HANDOFF_20261024.md)，不覆盖前一份的历史状态。

## 验收结论

**来源贴图接线和基础运行可以验收；原生 Auto 视觉还原仍不通过。** 当前已从 SVG 手画效果转为 Canvas2D 读取真实 PNG，但 sampler 仍为手写近似公式，没有消费原生模块树。配置含 9 个系统不代表实际按 9 个系统生成粒子；绿色测试输出不能提升为原版录屏视觉通过。

本轮任务是验证工作区并记录缺漏，不扩展实现完整原生粒子引擎。已修复若干可复现性／运行问题，剩余 P1 项需要下一批按来源恢复，不能继续围绕当前近似公式做自证测试。

## 本批新增内容与修正

工作区新增 `ArchiveSongHitEffectPreview.vue`、`SongChartHitEffectRenderer.js`，轨道通过 foreignObject 挂载 Canvas；config 新增默认资源／简化模块／Auto 动画关键点，池的 Auto 时长从 0.6 秒改为 1 秒。静态 flick 方向提示、原生长条网格及音符投影仍是已有独立消费者。

验收过程中修正：

1. **资源未跟踪**：开始时 10 张 PNG 均存在本地，但被 `.gitignore` 的 public/assets 规则忽略，`git ls-files` 为空。现显式纳入这 10 张来源哈希已核实的 PNG，共 **1,834,769 B**；不改全库 ignore 规则、不复制全量 public。
2. **源基线统计**：source-only collector 读取 Git 跟踪集合，仅将 `archive_baseline_report.json.tracked_binaries` 从 441/77,198,487 改为 **451/79,033,256**。未刷新其他语料或发布状态。`verify:archive-baseline:source-only` 通过。
3. **HTTP 假绿**：原 asset verifier 用 broad catch 吞掉 HTTP 断言，且无服务时静默跳过。现默认只做文件／Git 跟踪／来源回执验证；显式 `--origin=` 时对 10 个响应核对状态、image/png 和实际字节 SHA256，任何错误均失败。错误 origin 的返回 HTML 负例已实际失败。
4. **长条备用分支被错误关联**：轨道前部重复插入的空效果 g 使 `v-else` 绑定到 hit 条件，而非 holdCanvasUnavailable；另有重复 `data-hit-fx`／`data-hold-fx` 节点。现移除前一份占位节点，恢复相邻的 WebGL／SVG 长条分支。未新增模拟 WebGL context lost 的专项 Browser 验收。
5. **Canvas 生命周期**：图片加载完成后补绘，加载失败计数可从 Canvas data 属性读取；draw 前要求 naturalWidth>0，避免失败图片 complete=true 时仍 drawImage；瞬时命中由连续 hit.lane 改为取整后的 targetLane，hold 继续使用连续轨位。
6. 清理 EOF 空白；两个 verifier 的成功文案改为明确“素材／合同头校验”和“近似 sampler 冒烟”，不再把它们称作原生粒子渲染通过。

## 已实际运行的验证

| 范围 | 本轮证据 | 边界 |
| --- | --- | --- |
| 代码构建 | 修正后 `build:check` 18.51 秒，3011 模块；`.analysis/chart-native/acceptance-v2-build-final.log` | 固定 `.analysis/build-check`，copyPublicDir=false；不是发布包 |
| Source batch | **183/183**；`acceptance-v2-source-batch.log` | 包括两个新增 verifier；私有 ELF／IPA 不在 CI 重提取 |
| 事件／选择 | 244 playable 档、80,141 事件、2,722,796 采样／26,817 seek；96 ARM64 选择回执、224 prefab 查询及池回归通过 | 时间／选择，不是原生粒子仿真证明 |
| PNG | 10 张 Git 跟踪文件与上一份 IPA 导出清单哈希一致；5231 HTTP 状态、类型、字节哈希通过 | 仅 dev 服务，不是线上验收 |
| HTTP 负例 | `--origin=http://127.0.0.1:5231/not-a-real-origin` 因 HTML MIME 而失败 | 证明不再吞掉断言／静默假绿 |
| 实际 Vue + Canvas | Café Parade! EX 816、Reversed Masquerade EX 695 的受控整曲通过；暂停恢复、buffer、seek、切视图、切难度及已加载 hold 像素补绘通过 | 媒体／rAF 是替身，不是设备 FPS |
| 真实完整音频 | 当前 Canvas 实现的 DRIVE A LIVE PASSION 从 0 播至 ended，**130.285011 秒、445/445**，hits=0、holds=0；`acceptance-v2-real-song.json` | 最初冷加载错误日志保留，恢复后的稳定整曲没有新增错误；不能写成整个会话无 error |
| 实际倍速／暂停／倒退 | EXPERT 1.5×，暂停读到音频56.219412秒、效果56.219319秒，差93微秒；再回 tick9600 为8.571428秒、9/430、2条hold，PNG pending/failed 均0；`acceptance-v2-rate-pause.json` | 非长期倍速性能采样；检查后恢复1× |
| 原生视觉 | 下方源码与采样反例明确失败 | 不能以运行通过替代视觉验收 |

组件回归使用 [song-chart-demonstration-browser.html](../scripts/fixtures/song-chart-demonstration-browser.html)。旧版只比较空效果 g 的 outerHTML，无法证明 Canvas 有像素；现加入图片 pending/failed、非透明像素和冻结状态像素比较。

初次严格 hash 比较报告失败，经逐通道量化，最大差为 **1/255**，平均差分别约 0.0000290／0.0000225（0–255 通道单位），没有大于 2 的差值，与 Canvas 重绘／读回的微小量化差异一致，未定位具体底层舍入机制；采用最大单通道差 ≤1 的容差，而不是跳过画面检查。最终两首暂停画面非透明像素分别 **35,685／30,586**。完整结果 `acceptance-v2-component-result.json`，回归页 console 保留前两次预期诊断失败日志，不冒充始终无错误。

## 仍未通过的 P1 项

### P1-1：原生合同只是声明，没有进入采样器

`SongChartHitEffectRenderer.js` 读取 `contract` 后未使用，按 hitType 固定纹理、大小、alpha、旋转和时间。对 `sampleHitEffectFrame({hitType:0,pathId:14650}, .15)`，把第三参数换成空对象，输出完全相同。将 Auto 配置中主图全部 alpha 关键点改为 0，`sampleAutoEvaluationFrame(.5, mutatedAnimation)` 仍输出原来的可见主图。

反例已写入本地 `acceptance-v2-fidelity-probe.json`。下一批必须建立**同一个来源合同驱动真实 sampler**，并要求删除／改变关键来源字段的变异导致正确的输出变化或验收失败；不能只验配置字段存在、输出包含某名字。

### P1-2：图集裁切仍错误

| 分支 | 来源 UV | 当前 sampler | 结果 |
| --- | --- | --- | --- |
| flick line，纹理 935 | **2×8** 图集 | sw=2048、sh=2048，整张纹理 | 多个图集 cell 一起缩进一个长条，非单粒子 line |
| Special M_mark，346 | **2×2** | sw=1024、sh=1024 | 四种 M_mark 状态被整张叠到一块 |
| P 技能 starframe，720／889 | **4×4** | sw=1024、sh=1024 | 整张星形阵列参与绘制，而非单格／正确帧 |

普通分支虽然有 2×2／4×4 crop，frame= floor(age/lifetime×16) 和 startFrame→cell 的规则仍为手写选择，未按完整 UV 曲线／原生 frame writer 回执证明。必须处理坐标翻转、row/cycle、startFrame、frameOverTime，不能只把几张 atlas 固定裁第一格。

### P1-3：系统数、burst、运动与颜色不等价

- 默认 ordinary PERFECT 来源有两层独立 circleframe_3（节点 26448、23264），当前只有一个 `circle-339`。来源 speedline 在 0 秒出生 **20** 个；当前循环只有 **12** 条。
- glitter 的四方向匀速散射、speedline 的均匀放射和常量速度为手写公式，未消费 Shape、Velocity、ClampVelocity、随机范围与 renderer 的 stretched billboard 参数。
- hold 用正弦脉冲／旋转星芒／四个轨道点替代原生 rate=3/2/2/20/10 的五个循环系统；没有 ForceModule 和速度限制，不能称持续粒子已恢复。
- 配置 layer 缺 Initial startColor／ColorModule／SizeModule 完整曲线和 TRS 层级；渲染白色原贴图加 alpha，没有恢复录屏中的青白／黄绿叠层。
- Canvas 的 lighter 仅在透明效果 buffer 内叠加，再经 foreignObject 与 SVG 合成，不自动等同于 Unity 对场景颜色的 Additive。需要单独验证颜色空间、顶点色、层级顺序、材质参数和目标背景。

### P1-4：Auto 三层 UI 只是关键点近似

黄色原 Sprite 已接入，这是本批真实进展。仍未使用配置的曲线采样：scale／alpha 手写线性公式，舍弃 Hermite 切线；第二效果层 colorTint 由 sampler 给出，但 Canvas draw 没有消费它。三个目标统一使用 Sprite2068 和固定中心／偏移，原生两个 effect image 的初始 Sprite、材质、RectTransform 和 animation speed 尚未完整绑定。

下一批需从 prefab 和 AnimationClip 建立精确目标绑定，恢复颜色和缩放曲线，不能把黄色主 Sprite 可见当作整个 Auto UI 通过。

## P2 与未覆盖项

- 图片错误计数已有，但 Canvas2D context 不可用／单张贴图失败时没有用户可见退路；可观测 data 属性不等于完整降级 UX。
- 组件按效果是否存在反复挂载，图片 Map 属于每个实例；尚未验证冷解码、缓存复用和密集场景的分配／CPU 成本。原先约 60Hz 的证据属于上一轮轨道实现，**未给当前 Canvas 做新的 20 秒 CPU P95／GPU 呈现／物理手机性能验收**。
- 第 1 套为当前消费范围；选择模块可查四套，不等于 renderer 支持四套或与音符皮肤正确联动。
- WebGL 长条 fallback 条件已修，但本轮未模拟 context lost；未验证后台恢复、完整录屏逐帧、音频自然缓冲、真机和原机 GPU 等价。
- 两张原版截图没有提供完整帧序列与设置，能对照层次，不能断言已完成时间曲线逐帧复现。
- `CURRENT_STATE.md` 仍保留 master #97／旧谱面分支待合入的历史描述，与 #98／#99 已合入的基线事实不符；下一条 PR 需同步维护，不据此推断生产部署。

## 本轮 Browser 环境记录

最初 5231 / PID62676 的 App 冷加载出现 `Failed to fetch dynamically imported module ... ArchiveChartLab.vue`，独立组件页停在加载。模块 HTTP 抽查返回 200；这不足以证明客户端可运行。核对端口／命令后，仅重启此 worktree 的 5231 Vite 服务，保持端口与候选不变；候选 `rm-release-20261022`，public fallback 为主 checkout。随后逐个导入 Vue、renderer、Canvas 组件、Chart 组件均通过，App 与回放入口恢复。

新增 [song-chart-import-audit.html](../scripts/fixtures/song-chart-import-audit.html) 保留可见的逐模块进度／异常。没有证据把最初问题定性为 Canvas 源码错误或断言重启消除了所有冷加载问题；后续应复查默认 noDiscovery 依赖加载和启动耗时。

实际 App 截图 `acceptance-v2-live-canvas.png`：DRIVE A LIVE PASSION，播放约 1:04、249/445，黄色 Auto 可见，仍呈白色环，不能对应原录屏的完整多色层次。实际视口为 481 宽，未声称本轮 1440 桌面／物理手机验收。

## 下一批验收入口

1. 先替换 sampler 的硬编码分支，消费完整来源模块和 UV writer，并补能拒绝旧估计实现的原生检查点／变异测试。
2. 以 ordinary PERFECT 两个 circleframe_3、20 speedline、分批 glitter 为第一组闭环，验证纹理、颜色、出生、位置、寿命和混合；再扩 hold Force／Velocity 及 flick／P／SP 图集。
3. 独立闭合 Auto prefab 三个图层、曲线和材质绑定。
4. 复用受控像素旅程做行为回归，再对同一录屏时刻和完整真实播放做视觉／性能验收。不得用当前 sampler 的自选期望反向定义“原生正确”。

本页记录的通过项仅适用本轮实际执行范围。没有部署、R2 上传或 master 合并；`config/resource-audit.json` 的生成差异保留且不提交。
