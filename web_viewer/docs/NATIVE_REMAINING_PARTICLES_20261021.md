# 未消费粒子清单复核

输入 `968ab5a9`，仍在 `stage/20261020-native-followup`。本批修复离线动态覆盖报告的消费者装配，未改运行时、资源或晋升名单。

## 报告纠偏

`audit-chibi-dynamic-coverage.mjs` 原先仅装配旧 particle/floor 数据，未装配新版 native emitter、Bloom和APK内置对象，因此会把已经显示的烟雾、泡泡等错误列作未实现。现在使用实际运行时的绑定函数和优先级，核对 object/choreography SHA，装配全部三类数据后再调用共享覆盖计算。

报告增加逐资源 consumer、partial/deferred 状态，剩余资源的bundle/系统数量/完整编排事件，以及聚合缺口数。`sources`保留输入长度/SHA。consumer存在仍只是`mapped_unverified`，Noise等partial继续列出，不视为原版视觉完成。

复现：`node scripts/audit-chibi-dynamic-coverage.mjs --output .analysis/particle-remaining-20261021.json`。本地结果为118份编排、**21种未消费粒子 / 335条事件 / 10份编排**。独立检查全部已引用native模型均归属native consumer，Time Before Time内置对象及春风泡泡不再误报；总数与此前逐曲清单一致。本批无前端依赖改动，不重复执行Vite。

## RAW候选复核

逐个从原始Unity bundle执行现有提取器，不写public数据：

| 资源 | RAW系统数 | 普通模式结果 | 后续方向 |
|---|---:|---|---|
| jfhtmk_panel_1 | 4 | 4个非平面父链拒绝 | 需补三维父链/投影证据 |
| mainha_panel_1 | 3 | 1个通过，2个Noise拒绝 | 现有预览模式可完整提取3个 |
| mainha_panel_2 | 6 | 2个通过，4个Noise拒绝 | 现有预览模式可完整提取6个 |
| pavetl_panel | 3 | 1个通过，2个shape拒绝 | 核对尚未支持的发射形状 |
| unmikn_panel_3 | 2 | 2个非平面父链拒绝 | 需补三维父链/投影证据 |
| vvfmrm_panel_1 | 8 | 1个通过，7个非平面父链拒绝 | 需补三维父链/投影证据 |

复现普通模式：`python scripts/prepare-chibi-object-emitters.py --report --asset fx_in_jfhtmk_panel_1 --asset fx_in_mainha_panel_1 --asset fx_in_mainha_panel_2 --asset fx_in_pavetl_panel --asset fx_in_unmikn_panel_3 --asset fx_in_vvfmrm_panel_1`。

再以`--report --consume-deferred --asset fx_in_mainha_panel_1 --asset fx_in_mainha_panel_2`独立重放，两组共9系统、4纹理、deferred0，其中6系统明确为`noise_preview`。普通模式理由是当前检查首先命中的拒绝项，不保证未检查字段都已支持。下一批可先完成这两组的来源冻结、RAW像素/生命周期/发布闭包及Browser，保留Noise预览边界；当前尚未晋升，缺口数没有减少。

本机报告位于`.analysis/remaining-panel-profiles-20261021.json`和`.analysis/mainha-preview-profiles-20261021.json`。其余火焰、Bloom、shockwave、电弧仍在21种清单内，没有借本批将其标为完成。没有上传或部署。
