# 三方向滑键 blur 与 Auto 黑底修复 V8

输入 `chart/20261024-autoplay-timeline` / `3971c304`，工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。继续处理用户发现的滑键异常红条、Auto 特效底部发黑，并单独复查黄色左滑。仅开发分支修复，无部署。

## 根因与接线修正

**箭头存在两个连续漏接。** [V7](CHART_ARROW_COMBO_TIMING_V7_20261025.md) 关于填色/描边叠层的修正仍有效，但“原UV没有串格”只适用于 Texture630，不能扩大到 blur 的 Texture876。本批撤回该扩大结论。

1. Texture630 是2×2的描边/填色图；Texture876的原生 UVModule 是 **2×1**。V6导出 blur 时硬编码了2×2与4格，导致半截图被拉伸，形成条状块。现从来源每个系统的 tilesX/Y 导出完整512×1024单元，替换错误的512×512 `blur-2.png` 为 `blur-0.png`、`blur-1.png`（共220863字节）。
2. 用户继续指出黄色残留后，逐个重读49615/48366/47728的原生 ParticleSystem。侧滑 blur 的 `frameOverTime` 是 Curve 模式、常量曲线1×scalar0.9998999834，起始帧0.5；按整表循环，合计1.4998999834，取模后选择第0格。上滑的 frameOverTime=0，选择第1格。仅修正分格而仍只读startFrame，会让侧滑误用上向形状。本批完整输出和消费来源UVModule，在粒子年龄上求值后选格。

| 独立检查 | 实际选择 | 方向变换 | 验收 |
| --- | --- | --- | --- |
| 蓝色右滑 | blur-0，全高度单元 | 0° | 正式App与四个粒子年龄检查通过 |
| 红色上滑 | blur-1，全高度单元 | 0° | 正式App与四个粒子年龄检查通过 |
| 黄色左滑 | blur-0，全高度单元 | 约180° | 正式App tick39156近景无异形条块；四年龄检查通过 |

保留原生各方向的 startColor 与渐变，包括黄色 blur 偏橙的颜色；修正的是选格和形状，不用统一颜色、删掉 blur 或降低全局透明度遮掩。三方向填色/描边排序继续保持1→2，blur为3。

**Auto 黑底来自透明中间层的合成，不是本批把原贴图 alpha 改黑。** 重新沿renderer→material→shader检查默认7类合计58个粒子系统，全部是 `Mobile/Particles/Additive`、SrcAlpha(5)/One(1)。GPU缓冲已保存供Canvas2D复制的预乘颜色/覆盖率，但外层foreignObject此前按source-over覆盖实际轨道：颜色较暗且覆盖率高的部分会扣掉背景，呈现暗底。加色应保留背景再加上光色，不能把普通透明合成当作最终步骤。

现在粒子foreignObject直接以plus-lighter和SVG轨道背景混合。Auto UI拆为独立SVG消费者：EvaluationImage正文仍为普通透明合成，EvaluationEffectImage/2按来源绑定做加色。三层继续使用同一 `sampleAutoEvaluationFrame`、原生RectTransform和动画曲线；没有改原PNG、startColor、alpha曲线、GL颜色乘法或打击音时钟。箭头也移除透明隔离组，让加色层能接触实际背景。

## 验证

本地小型回执在 `.analysis/chart-native/`；构建复用 `.analysis/build-check`，不复制public语料。

- 来源：固定IPA data SHA `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`。`flick-raw-v8.json`保存三方向原始PS/renderer；`hit-blends-v8.json`保存58个系统的material/shader/blend跟踪。
- 专项：flick motion verifier新增三方向UV与完整PNG尺寸检查、年龄0/.05/.25/.499实际选帧/消费者URL检查；hit-effect renderer、native effects、combo/timing verifier均通过，原162组ARM64 root/486 emitter与244谱面689 glyph检查保留。
- 合成专项：新增 `song-chart-compositing-browser.html`。不透明黑、半透明红、暗灰的GPU缓冲在背景(20,40,60)上分别应得(20,40,60)、(120,40,60)、(60,80,100)，直接Canvas lighter参考通过；Browser实际SVG里黑色块不遮住背景。原生flick粒子在亮灰背景上的新旧合成截图见 `compositing-v8-correct.png` / `compositing-v8-old.png`，Auto正文与两层闪光分别为normal/plus-lighter/plus-lighter。该色块验证不是Unity同帧GPU像素等价声明。
- 最终构建：`npm run build:check`，**3024 modules / 20.95秒**，`compositing-v8-build.log`；保留既有大chunk警告。最终构建后仅修改验证页和文档，没有再修改产品代码。
- 最终组件整曲：cfprde816与remasq695事件通过，`compositing-v8-browser.json`。新增实际foreignObject加色、Auto正文单独普通合成、Auto三层暂停/恢复一致检查；原Combo、±时机、缓冲、seek、切难度和ended清场仍通过。粒子Canvas暂停恢复最大通道差≤1/255；Auto移至SVG后，其像素不再计入粒子Canvas数量。
- 正式App：knwonl EX，tick36700同画面核对蓝/红/黄；tick39156单独核对黄左滑，`compositing-v8-three-arrows.png` / `compositing-v8-yellow.png`。随后真实媒体37.65→44.520768秒，暂停时粒子3组、hold1组、assetsPending/Failed均0，实际加色foreignObject与Auto图层已进入DOM。
- 窄屏：390×844，scrollWidth390；实播后暂停，Auto与环形光效无矩形黑底，`compositing-v8-narrow.png/json`。这是Browser模拟，不是实体手机。
- 开销：cfprde Auto+SE1+Combo，媒体12.5→32.423053秒，20.0022秒内1141次轨道更新；CPU median/P95 **5.5/9.1ms**，max71.3ms，4次rAF间隔>50ms、0次>250ms，无缓冲或焦点警告。`compositing-v8-performance.json`。rAF113.94Hz仅为回调频率，不宣称GPU稳定60FPS，也不宣称较V7性能提升。

新public单元的Vite索引需要重启，同端口5231、同candidate `rm-release-20261022`、同主checkout public fallback，最终服务PID35204。开发期更新 sampler 早于生成带uv的JSON时，11:25:07 UTC热更新曾出现startFrame undefined，生成配置及重启后恢复；不能把历史错误当作最终版本错误，也不声称开发日志从未报错。专项页曾因runtime-only Vue不支持template选项而告警，已改成render函数。

最终11:32:26 UTC冷刷新后重新选择EX、定位黄色左滑并开启Auto实播至44.219901秒；readyState4、Combo199、WebGL与最终加色宿主均正常，刷新后无新增error/warn，见 `compositing-v8-cold.json`。

## 未扩大验收的边界

源纹理分格、UV曲线、排序和blend已分别接线；Unity对象池相位、随机序列、billboard与真实设备GPU颜色空间仍未证明逐帧相同。Canvas2D fallback沿用同一最终加色宿主，但本批浏览器实际走WebGL路径，未强制禁用WebGL重验fallback。315特殊Combo效果与设备音频校准仍是V7中列出的后续项。

原有 `config/resource-audit.json` 改动保留，不纳入本批提交。
