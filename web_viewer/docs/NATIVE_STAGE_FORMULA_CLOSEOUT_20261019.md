# 本轮舞台公式修复与缺口收尾

输入 HEAD：`f5c9fc27`，分支 `stage/20261014-native-fidelity`。按用户“这轮做完真收尾”的要求，本轮收在公式材质修复、已完成的来源审计和缺口清单，不继续扩展运行时实现。没有合并门户分支、部署或改端口。

## Multiple Entertainment Show! 已修复

`fx_in_mtples_panel_2` 的十个粒子系统中，六个 `fx_in_mtples_formula_add_mask (1..6)` 使用原始 `Alpha Masked/Particles/Additive`，材质 `_TintColor=(1,1,1,.5)`。旧守卫只接受 `(.5,.5,.5,.5)`，因此拒绝这六组公式，整个资源没有进入通用 emitter 消费。

原始 shader 的 fragment 程序保存在 [材质来源 fixture](../scripts/fixtures/chibi-native-particle-masks.json)：先 `2*vertexColor*_TintColor*texture`，再 clamp alpha，最后乘遮罩 alpha。此次把材质乘色保留为浮点 uniform，避免经过八位 Sprite tint 丢失大于 1 的 RGB；切换 batch context 时同时重置乘色，默认材质仍是 `(1,1,1,1)`。

没有新建截图参数或歌曲渲染分支。仅已接入 material uniform 的 emitter 提取入口允许非默认乘色；旧 floor 提取入口继续严格拒绝非默认乘色，避免放宽守卫后丢掉颜色。panel_1/2 共十一系统纳入现有来源目录，panel_3..6 原已进入该目录。此次增加三张源纹理 PNG，共 244,566 bytes。独立归属批次 `2026-10-19-native-mtples-formula-001`；第一次清单校验发现误继承旧批次导致总量超过 10 MiB，修正这三张的归属后通过，没有提高阈值。

## Time Before Time：来源已定位，运行时未接完

原索引 missing 的四个资源都存在于 APK `resources.assets`，歌曲 RAW 包内没有这些 keeper。旧流程只搜索歌曲包，误把内置对象归为源资源缺失。

| 资源 | APK keeper PathID | 引用 |
| --- | --- | --- |
| fx_in_tibeti_overlight_1 | 128792 | 9 SpriteRenderer |
| fx_in_tibeti_overlight_2 | 122706 | 1 SpriteRenderer |
| fx_in_tibeti_water_1 | 123923 | 3 ParticleSystem |
| fx_in_tibeti_water_2 | 108763 | 1 ParticleSystem |

实际 APK 脚本类是 `Growing.Live.LiveObjectObjectLayer`，RAW 中是 RefKeeper。新增解析同时支持 typed RAW 与空名称、固定头布局的 stripped APK，拒绝未知类、截断数组、负数 count 和未知尾部。真实指针类型、原始 keeper bytes、资源 SHA、四个粒子能力结果和十个 SpriteRenderer 材质记录保存在 [内置对象 fixture](../scripts/fixtures/chibi-built-in-object-sources.json)。四个粒子均通过当前模型能力检查，但这不等于已经显示。

后续必须补 APK 来源进入运行时索引、粒子遮罩组件关联、源纹理发布和 Sprite 材质/动画消费，再做 Browser 验收。本轮没有把这四个资源从运行时 missing 中移除。十个 SpriteRenderer 引用 `underlight_add` / `Mobile/Particles/Additive`，不能沿用只看材质名含 add 的旧近似就宣称还原。

## Change to Chance：只完成原指令定位，尚未修复

用户截图歌词对应约 24.45–28.25 秒。`song_cgtocc.unity3d` 的 `cgtocc_live_effect` 在 24.4 秒有被注释的 `#Spotlight`，不能把它激活来凑截图；这里实际有 `NewSuspensionlight_create/normal_show`：ID1401 使用 `fx_in_inndgn_suspensionlight`，ID1403 使用 `new_suspension_light_sample`，并伴随角色/背景颜色和其他舞台灯指令。

后续需要反查自定义 NewSuspensionlight prefab、normal_show 原参数时序和现有 consumer 的绑定覆盖。现在不能把差异归因成已证实的单一根因，也不能标为修复完成。该处没有新增截图特例。

## 当前全库边界

`node scripts/audit-chibi-object-consumption.mjs` 使用实际 attach 验证器及运行时优先级：118 编排、135 个引用到的 particle 资源；native emitter 80、floor 18、bloom 3、旧 particle 2、无 consumer 32。无 consumer 涉及 427 条事件、18 编排；11 个资源带 partial 标记；另有上述四个 APK 资源仍未进入源索引。

这是“存在消费入口”普查，不是原片等价性统计。新的 MV 批次确实仍有遗漏，不能整体标成完成。其余非平面 Stretch、Noise/RNG/时钟等历史边界继续保留，未因公式修复而关闭。

## 本轮验证

- `python scripts/prepare-chibi-object-emitters.py --consume-deferred` 无写入重提取一致：80 resources / 720 systems / 0 deferred / 94 textures；其中 28 systems 保留 preview 标记。
- `python scripts/audit-chibi-built-in-objects.py` 重读真实 APK 与 fixture 一致；四资源、四粒子、十 SpriteRenderer。
- `python scripts/verify-chibi-object-keeper.py`：真实 keeper bytes、typed RAW、坏 count/截断/tail/class 守卫通过。
- `node scripts/verify-chibi-material-tint.mjs`：十系统来源关联、六公式非默认乘色、实际 batch uniform 切换与默认复位、原 shader clamp/mask 顺序通过；没有把该测试称为 GPU 像素等价验证。
- `python scripts/verify-chibi-native-particle-masks.py`：63 原材质绑定与原 shader fixture 不变。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets`、`node scripts/verify-chibi-floor.mjs --published-assets`、`node scripts/verify-stage-resource-ownership.mjs`、`npm run verify:stage-vfx-coverage` 通过。floor 回归原先把已有 partial consumer 同时断言成“无 consumer”，与现行 coverage 的分开统计不符；仅修正该测试断言，保留 partial 断言。
- `npm run build:check` 通过，24.06 秒，固定 `.analysis/build-check`，不复制 public 语料；有既有大 chunk 提示。没有本轮全量 147 项门禁或发布包验收的声明。
- 二进制清单通过：392 PNG / 71,336,980 bytes。

Browser 使用现有本分支 Vite 5212（PID61564），没有重启其他项目。Multiple Entertainment Show! 完整模式：1280×800 桌面 8s/18s、8s→0→8s 回拖，390×844 手机宽度，以及冷刷新后从 8s 实际播放到 125.1s 曲末自动暂停。8s 读取到全部六 panel、无 object-layer-unsupported、无 native deferred，native particles=1069。公式可见，用户也确认公式渲染正常。

截图 `.analysis/mtples-formula-desktop-8s.png`、`.analysis/mtples-formula-mobile-8s.png`。没有白屏或框架错误覆盖；console 无 error，仍有 `missing image-layer asset stage_mtples_04` 和 Pixi/Spine 弃用 warn，未在本轮改动它们。桌面/手机视口验收不是原片逐帧或真机等价。

无关未跟踪 `src/core/chibiRandomMotion.js` 保留，不进入本轮提交。构建生成的翻译/audit 时间戳变动已恢复。
