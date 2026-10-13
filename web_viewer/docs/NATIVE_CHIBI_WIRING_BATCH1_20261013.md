# 舞台接线独立开发：第一批

日期：2026-10-13。分支：`codex/stage-chibi-wiring-20261013`。输入 HEAD：`96294431`，开始时与同名 origin 分支一致，已跟踪文件无改动；既有未跟踪文件保留。

## 已完成

1. **站位与基础排序分离**。原版 `LiveObjectIdol.SetPosition`（RVA `0x221bea0`）将第四参数写入 baseSortOrder 并直接设置位置，不修改 scale，也没有 350ms tween。本批移除该平滑过渡，按命令时间即时切换；人物大小只使用原有体型/身高与视口尺度。排序采用脚本值，影子排序为人物减 10，对应 `UpdateSortOrder`（`0x221ab58`）。
2. **兼容现存资源字段**。现有 118 份编排的 1,178 条 positionEvents 仍使用旧名 `scale`，消费者将其作为 sortingOrder 的兼容别名；新导出器使用 `sortingOrder`。本批没有重写或重新打包 public 语料，也没有从错误字段重新推断坐标。
3. **舞台动作按原生模式选片段**。`PlayMotionInner`（`0x221c094`）在模式 2/3 选择 `_4loop_` 并循环，其他模式选择 `_3dance_`，缺失时退回 `_2after_`。舞台显式开启此规则，不再统一排队 dance → loop；找不到所需片段时明确失败，不猜另一个片段。动作实验室仍使用原有 main → loop 演示。
4. **回归与检查属性**。补充原生 loop 的真实 Spine AnimationState 播放/seek、dance/after fallback、缺片段不破坏当前姿势；核对真实 SFC 布局中排序 1700→2600 时人物大小不变。维护属性提供实际动作片段、策略、人物尺度与排序，便于继续核查。

方法体来源为本地 `.analysis/ghidra-il2cpp/decompiled_pass1_annotated/Growing.Live.LiveObjectIdol.c`。本批保留现有录屏校准的 2D 坐标投影，没有宣称恢复 Unity 摄像机投影。

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| `node scripts/verify-chibi-placement-shadows.mjs --published-assets` | 通过：平台坐标、实际 SFC 布局、原生即时排序、命名/旧索引兼容、显式 0、未来指令、后退 seek、影子骨骼跟随。 |
| `node scripts/verify-stage-intent.mjs` | 46 个受控时序/协议用例通过；包含真实 Spine AnimationState 原生 loop 与 seek、默认预览队列和取消/迟到任务保护。 |
| `node scripts/verify-chibi-stage-coordinates.mjs --published-assets` | 当前 118 份编排的 1,178 个位置投影检查通过，不等于 118 首视觉验收。 |
| `node scripts/verify-chibi-native-pose-samples.mjs` | 15 项通过，使用体型 1/2 的真实动作 20012；是资源/姿势诊断，不是真机验收。 |
| 全量动作片段核对 | 五种体型各 1,405 个 motion 文件，共 7,025 文件 / 14,060 animation。逐个以实际 SkeletonBinary 解析，并按当前 118 份脚本所用模式核对所需片段；缺失 0。属于来源兼容性检查，不是逐曲视觉验收。 |
| singer slots / panel presentation / song handoff | 通过，保留表演位与原始成员映射、三人平台站位、实验音频交接合同。 |
| `npm run verify:architecture-cleanup` | 通过，包含舞台资源所有权、迟到纹理与取消/重试保护。 |
| Python 导出器 | AST 语法检查通过；未重新运行全量导出。 |
| `npm run build:check` | 最终源码通过 Vite 编译；固定输出 `.analysis/build-check`，`copyPublicDir:false`。不是完整媒体发布包。 |

## Browser 实际旅程

专用 Browser 插件未提供，使用 Playwright + 本机 Edge（headless）。复用既有 `127.0.0.1:5212`，PID 39228；通过 HTTP 取得真实 SFC 模块并核对本批接线特征，确认服务消费当前源码。没有另起服务或更换端口。

- 页面身份：`GS Archive · SideM GROWING STARS 资料馆`；入口 `/?view=chibi_stage`，切歌后为 `/?view=chibi_stage&song=psblts&stage=psblts_live_effect`。
- 桌面 1440×1000：DRIVE A LIVE 五人加载，初始片段为 `13_4loop_1_wait`；选择轻量模式，实际点击播放/暂停，时钟前进约 3.4 秒。
- 从“曲目”搜索并选择 Possibilities，三人 2/3/4 号位加载完成。通过时间轴键盘从 1.7 秒到 1.8 秒，4 号位排序由 1700 立即改为 1900，缩放均为 `0.1736`；后退一格恢复 1700。
- 切到“画面”的完整加载，时间轴跳到 51.4 秒，三名角色片段均为 `19019_4loop_1_WereTheOne`，仍处于正确的三个平台，没有被动作行的 x/y 覆盖。
- 手机视口 390×844：舞台、人物、时间轴与控制页可见，document 无横向溢出；这是桌面浏览器视口检查，不是真实手机性能证据。
- 最终旅程无 pageerror/console error，无框架错误遮罩。两条既有 Pixi/Spine tint 弃用堆栈来自 `applyStageLighting`；未将其归为本批新增故障。

本轮中途 Browser 捕获过一次误删布景缩放变量造成的 ReferenceError；已恢复该变量，再次构建并完整重跑上述旅程通过。没有将修复前的结果作为验收。

小型截图、脚本与收据保存在本聊天的可写 QA 目录，文件为 `stage-browser-receipt.json`、`native-motion-census.json`、`stage-possibilities-1700.png`、`stage-possibilities-1800.png`、`stage-possibilities-full-51400.png`、`stage-mobile.png`；不提交媒体截图。最终构建日志在本地 `.analysis/native-chibi-wiring-audit/build-check.log`。

## 后续范围

本批完成的是站位基础排序和动作片段选择。原版随机延迟、BPM 基准速度、Spotlight 等对人物 offsetSortOrder 的影响仍需后续接线，不能宣称完整原版动作/排序等价。身体染色与脚光 shader、新悬灯控制、Backmonitor 完整字段、Penlight 和 Searchlight 留待后续独立批次。

本批不部署，不打完整资源包，不改首页/原生关系功能或服务器配置。
