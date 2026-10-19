# 舞台续批：现状、第一处修复与检查路线

输入：2026-10-20，`origin/master` / `e6cd9641`（PR #55 merge）。新分支 `stage/20261020-native-followup` 从该提交建立，工作目录 `E:/Web_build/SideM_Archived/web_viewer`。本地 master 原停在 `dc348a9c`，不直接更新或推送 master。本页作为新一代入口，历史审计保留当时的证据，不把旧待办当成当前缺口。

同日续批：[自定义新悬灯 Sprite](NATIVE_NEW_SUSPENSION_SPRITES_20261020.md) 已定位并修复公共资源选择，覆盖7份编排的265条Create；Change to Chance 24.4秒ID1401已能实际显示，normal_show参数无需改动。这里的“自定义prefab”假设由原生共用prefab换Sprite链取代。下一项为Time Before Time内置对象；原片全差异、完整Unity/设备等价继续保留。

再续批：[Time Before Time内置对象](NATIVE_TIBETI_BUILT_IN_OBJECTS_20261020.md) 已补四个APK对象的来源与消费者，包含Sprite材质/几何、water粒子和两套AlphaTex。有效运行时源缺失从4降为0，native emitter为82；无consumer32种仍开放。新确认的下一公共问题是其他NativeLightQuad调用方的ADD_NPM独立alpha因子；本批已纠正object消费者，未外推到所有灯具。

随后 [公共RGBA续批](NATIVE_ADDITIVE_RGBA_20261020.md) 已把所有NativeLightQuad实际构造方接至同一renderer原生模式，256组GPU对照（含真实context恢复）通过，旧模式反例稳定失败。此前这项待办已关闭；仍保留缺家族、32种粒子、Sprite淡入与原片/设备边界。

同日以 `973a89b8` merge 最新 master `5aab5644`，并修复 FLASH LIGHT 空 Sprite 名称阻塞公共 Searchlight 预载的问题；154/154 源码门禁、构建与合并后的 Browser 结果见 [同步与预载续批](STAGE_MASTER_SYNC_20261020.md)。下一轮结合 [加载策略交接](STAGE_LOAD_STRATEGY_20261020.md)推进；下列统计为开线时快照，后续有效运行时对象统计以上述 Time Before Time 续批为准。

## 开线基线（历史快照）

- RAW 矩阵重新验证：118 份编排、58 类原始行、261,812 行，其中一行非时序说明。矩阵存在不代表字段或原片视觉完整。
- VFX 普查：111 份编排存在未支持或缺失层。这是来源状态统计，不是视觉失败率。
- 对象消费者普查：135 种被引用粒子资源，native emitter 80、floor 18、bloom 3、旧 particle 2；无 consumer 32，涉及 427 条事件、18 份编排。另有 11 种 partial、4 种源索引缺失资源，与 [10-19 收尾](NATIVE_STAGE_FORMULA_CLOSEOUT_20261019.md) 一致。
- Penlight、Searchlight、Whole_screen 的受限消费者，人物原生尺度、动作 BPM/mix、音频时钟、背屏 RectTransform、Logo 资源选择已存在，不能重做为“全未接线”。持续随机动作、非有限 Animator 最终输出与完整 Unity 粒子/合成等价仍有边界。
- 旧悬灯 [MOON 续批](NATIVE_MOON_UPLIGHT_RECONNECT_20261016.md) 已把整曲禁用改为活动实例守卫：105 份轨道中 96 supported、9 partial；不是旧表中的 9 份整曲不显示。

## 第一处修复：覆盖矩阵误报旧悬灯整曲禁用

`attachNativeOldSuspension` 与轨道校验器允许 supported / partial 两种能力；正常灯具在 partial 轨道中继续渲染，仅未决实例代次隐藏。此前 `stageCommandCoverage` 只认 supported，导致 MOON 等九份 partial 轨道在高级设置里显示“预览未放行”。

现在保留独立 `guard=partial`，矩阵显示“部分实例受限，正常灯具已放行”；汇总 coverage 继续为 partial，避免误写成完整接线。缺索引仍显示未加载，unsupported、未知能力和缺描述符仍不放行。没有更改灯具渲染、RAW、资源或非有限时间守卫。

回归补充 partial / unsupported / 未知能力分支，以及只有旧悬灯时汇总仍未完成的行为；既有 supported、缺描述符、缺索引断言保留。

## 后续顺序与完成条件

| 顺序 | 工作 | 先查什么 | 完成条件 |
| --- | --- | --- | --- |
| 1 | Change to Chance 24.4–28.25 秒 | ID1401 的 `fx_in_inndgn_suspensionlight`、ID1403 的 `new_suspension_light_sample`，资源绑定与 normal_show 原始时序 | 串通 RAW→prefab/Animator→命名字段→实际消费者；按公共链修复，播放/seek/回拖与桌面、手机尺寸验收；禁止激活注释 `#Spotlight` 凑图 |
| 2 | Time Before Time 四个 APK 内置对象 | keeper 已有来源 fixture；补 APK 来源进入索引、粒子遮罩、Sprite additive 材质和动画、源纹理归属 | 四个对象实际进入消费者，源 hash/材质合同通过，Browser 确认可见与切歌清退；不能仅凭资源存在删除 missing |
| 3 | 其余缺家族和对象 | Underlight、Smoke、单人脚光与 32 种粒子的引用/来源/模块能力逐项列明；Finish 等先区分游戏行为与舞台表现 | 每个小批包含来源、字段、资源绑定、行为回归和覆盖状态；不把注册 consumer 当原版视觉完成 |
| 4 | 公共语义边界 | 随机持续调度、旧悬灯非有限 Transform、非平面 Stretch、Noise/RNG/时钟、静态层排序 | 先查现有续批与实际代码，再做可重放原生证据；不能沿历史猜测添加逐歌系数 |
| 5 | 原片与设备验收 | 选有可靠原片和明确时间点的代表曲 | 分别记录本地 dev、生产包、原片对时与真机结论；HDR/景深/透明深度不能由构建或普通截图代证 |

第 1、2 项最初来源和未完成边界详见 [10-19 收尾](NATIVE_STAGE_FORMULA_CLOSEOUT_20261019.md)。首批 `9f0e42fb` 只完成覆盖状态修复与基线检查；第1、2项的来源接线已由上述续批完成，原片全面对照尚未完成。

## 验证与运行环境

- `node scripts/verify-stage-command-coverage.mjs --published-assets`、`node scripts/verify-stage-vfx-coverage.mjs`、`node scripts/verify-chibi-old-suspension.mjs --published-assets` 通过。
- `node scripts/verify-stage-resource-ownership.mjs`、`node scripts/verify-stage-render-budget.mjs` 通过；对象普查使用 `node scripts/audit-chibi-object-consumption.mjs`，结果见上。
- `npm run build:check` 通过：2,960 modules，Vite 25.74 秒，固定 `.analysis/build-check`，不复制 public。仍有既有大 chunk 提示；不属于发布包验收。
- `npm run verify:source-batch` 通过：150/150。日志 `.analysis/stage-20261020-source-batch.log`；它是源码门禁，不替代 published-assets、Browser 或原片验收。
- 旧 5177、5212 的 HTTP 模块均未包含本次 partial 分支，保留原进程不重启。5213 新进程 PID67272 使用本 checkout；HTTP 模块已核实包含修复，启动日志 `.analysis/stage-20261020-vite.log`。
- 5213 候选 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`；Browser 实际 bootstrap release 为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。没有变更 release 绑定或部署。

Browser 使用 Codex In-app Browser / `cua_repl`，没有使用外部 Playwright 进程。流程：DRIVE → 曲目 → MOON → 高级设置 → RAW 矩阵；冷刷新 MOON 后再播放、暂停、打开矩阵并返回歌曲详情。

| 检查 | 结果 |
| --- | --- |
| 页面身份、非空内容、框架覆盖层 | 5213，MOON 标题、3/3 人就绪，画面和维护面板实际载入；无框架错误覆盖层 |
| 桌面 1280×800 | MOON 四类 Suspensionlight 显示“部分实例受限，正常灯具已放行”，不再是“预览未放行” |
| 冷刷新与播放 | 刷新后预载动作完成，时间轴实际推进到 16,800ms；随后手动暂停。没有宣称全曲稳定性验收 |
| 手机尺寸 390×844 | 四类文案保持正确；页面 scrollWidth=innerWidth=390，宽表内部滚动；不是手机真机验收 |
| 返回歌曲 | URL `/songs/montns/?maintainer=1`，无残留 song/stage/view 参数；标题、DRAMATIC STARS 成员、音频与难度/Combo 表已加载 |
| 控制台 | 无应用 error，保留既有 Pixi/Spine tint/update 弃用 warning；未声称零 warning |

截图与控制台 JSON：`C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/stage-coverage-{desktop,mobile}.png`、`stage-coverage-console.json`。临时 viewport 已恢复。本轮没有原片逐帧、HDR/景深或生产包/真机等价结论。

本轮原有 `../040ren_child.txt` 删除与无关未跟踪 `.analysis/`、交接文档、v9 HTML、terminal 数据及语音评审脚本均保留，不进入提交。构建生成的 resource-audit、翻译审计/manifest/release 差异核对后恢复；仅提交本批明确路径。
