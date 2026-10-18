# 舞台对象粒子：全库消费者与剖面缺口

输入 HEAD `baeebc18`；工作树 `stage-native-fidelity-20261014`。本记录区分运行时消费者、可解析资源与原生视觉等价；三者不互相代替。

## 消费者核对

新增 `node scripts/audit-chibi-object-consumption.mjs`。它调用实际 attach 验证器，合并通用对象粒子、旧 particle layers、floor 和 Bloom 索引；消费者优先顺序与 `loadObjectLayerRuntime` 一致。`--json` 输出逐资源的消费者、partial 标记、deferred 数、事件数、编排 ID 和全部输入 SHA-256。

118 份编排引用 135 个 particle 资源：

| 实际选中消费者 | 资源数 |
| --- | ---: |
| nativeParticleAnimation | 44 |
| floorAnimation | 19 |
| bloomAnimation | 3 |
| particleAnimation | 2 |
| 无消费者 | 67 |

67 个无消费者资源涉及 561 次 Object_layer 事件、75 份编排。事件包含显示和隐藏，不能当成缺失的可见帧数。另有 4 个源索引缺失资源：`fx_in_tibeti_overlight_1/2`、`fx_in_tibeti_water_1/2`。

早期文档的“FLASH LIGHT 四个资源未接”不适用于所有消费者合并后的现状：`fx_in_flslgt_bloom_1..3` 已走 Bloom，`fx_in_flslgt_panel_1` 已走 floor；这些旧路径仍须校准，不能写成全无消费者。44 资源的 `deferred=0` 也只限通用目录，不能推广成全库完成。

覆盖统计发现并修复了另一个漏接：`stageVfxCoverage` 没有识别 `nativeParticleAnimation`，会把已渲染的资源报成未实现。现按渲染器优先顺序分类；`objectParticleUnimplemented` 仅指无消费者，`objectParticlePartial` 单列已绑定但显式省略/近似的资源。已绑定且无标记仍是 `mapped_unverified`，不是原生验收通过。旧 floor 的 deferred 元数据不能覆盖优先使用的通用消费者。

## 全量 RAW 试解析

运行以下只读命令，没有写入正式数据或纹理：

```text
python scripts/prepare-chibi-object-emitters.py --mode all-particles --consume-deferred --report
```

报告现在始终带逐资源详情和 partial 汇总，避免只报“可解析”而隐藏 preview。

- 135 资源 / 992 系统；841 可进入当前剖面，151 被明确拒绝。
- 841 中有 131 个显式 partial：109 noise_preview、22 stretch_omitted。其余 710 只表示通过当前提取合同，不表示逐帧等价。
- 149 张纹理是试解析结果，未复制到 public，也没有扩大发布素材范围。

| 首个拒绝原因 | 系统数 |
| --- | ---: |
| Initial curve requires birth-time sampling | 80 |
| Nonplanar emitter transform | 20 |
| Unsupported velocity limit | 14 |
| Unsupported lifetime color mode | 12 |
| Missing core particle modules | 9 |
| Velocity curve requires integration | 8 |
| Unsupported native particle mask tint | 6 |
| Unsupported shape | 2 |

这是验证顺序中的首个拒绝原因；解决一项后可能显露其它边界，不能当成互相独立的完整模块清单。

## 下一批接线顺序

1. 67 个缺消费者资源中，30 个 / 155 系统 / 128 次事件已通过当前剖面且没有显式 partial，优先把它们按 RAW 来源正式建表、检查纹理体积与二进制策略，再做 Browser 验收。代表资源包括 `brndnf_ring`、`byndtd_wing`、`hrkzbn_bubble_l/r`、`grwsml_panel`、`stofft_string`（实际资源键见报告）。
2. 按系统源码补出生时刻的起始曲线采样，而非直接取曲线起点；80 个拒绝系统是当前最大共同边界。同步核对其随机值是否按系统时间或粒子出生时间取得。
3. 继续原生 stretch 顶点求解器和 Noise damping/remap。正式目录 394 个系统中的 28 个 preview 仍未收口，详见 [stretch 记录](NATIVE_STRETCH_RENDERER_TRACE_20261017.md) 与 [Noise 记录](NATIVE_NOISE_PERLIN_20261017.md)。对象 Noise 的新实现尚未推广到 Whole_screen。
4. 继续独立指令族：Underlight 四族 2116 条、Smoke 5 条、单人脚光 241 条；同时保留 Whole_screen type 6、4 个缺失源资源、静态 Sprite 逐实例动画的未完成状态。

## 验证与产物

- `node scripts/audit-chibi-object-consumption.mjs --json > .analysis/stage-object-consumption.json`：实际 attach 验证通过，得到上述消费者统计。
- 全量 RAW 报告：`.analysis/object-emitter-all-current.json`，含 135 个资源详情；仅小型 JSON，无素材副本。
- `node scripts/verify-stage-vfx-coverage.mjs`：118 编排通过，新增 native 消费识别、preview 独立分类、旧 floor 元数据优先顺序与 deferred-only 回归。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets`：44 资源 / 394 系统 / 28 preview / 0 deferred，通过。
- `npm run build:check`：2956 模块，16.92 秒，通过；`copyPublicDir:false`，输出固定 `.analysis/build-check`。没有完整媒体打包。
- `node scripts/run-verifier-batch.mjs`：147/147，通过。
- 5212 Browser 插件新标签冷启动 Take，选完整加载并回拖到 70 秒：9 个对象层 / 444 对象粒子 / 23 Searchlight / 56 全屏粒子；对象 unsupported 为空、lightingIncompleteFrames=0、无 Vite 遮罩、console error 0。此项是本批运行回归，不是对所有效果或所有原片帧的视觉验收。

本批未扩大运行时粒子资源目录，未部署，未合并主线。后续数据变化后应重跑报告，不能继续沿用本页静态计数。
