# 舞台同步 master #71–#74

输入`c191c0bf`，当前`stage/20261020-native-followup`；普通merge同步`origin/master` / `5006f6a4`。含原生ADV punch、剧情归属页面、原生黑屏转场及旧剧情页面退役。没有改变舞台资源、编舞、read-model绑定或部署。

## 冲突处理

- `advParticleEffects.json`：用自动合并后的提取器从实际APK重建，保留新punch两系统、锚点、三份纹理和既有RAW顺时针角度。未恢复master旧的负值补偿；结果6prefabs/10systems/3textures。
- `verify-adv-particle-effects.mjs`：同时保留RAW角度一致断言和punch禁用ShapeModule时`shape=null`的验证。
- 图片清单元数据：重新生成清单，保留门户更新后的消费者名称，并补齐近期mainha/remasq五份纹理。首次校验发现这五份仍被默认归入2026-10-17批次，导致旧批次超过10MiB；按现有publication记录分别绑定mainha/remasq owner_release后通过。没有修改容量门槛或新增例外。

## 验证

`npm run verify:source-batch` **167/167**通过；master退役旧剧情页面后检查数减少，舞台检查仍全部通过。APK来源重放、62例原生粒子角点与图片清单单独通过。清单416PNG / 74,080,906 bytes，与已有baseline一致。

`npm run build:check`：2,972modules / 18.35秒；入口gzip203,538 / 215,040 bytes。只输出固定`.analysis/build-check`，未复制public语料；构建生成审计元数据已还原。随后图片清单归属修正只影响独立工具，针对性重跑图片门禁通过，未机械重复Vite或整批门禁。

日志`.analysis/stage-master74-{build,source,binary}-20261021.log`。

## Browser

仍复用主checkout 5213 / PID32788，候选`rm-release-20261015`。实际检查：

1. 独立QA直接调用实际`BackgroundEffectManager.playSingleParticleEffect`，punch100ms显示2粒子，400ms消亡；暴雨8秒155粒子，雨丝可见。console error=0。
2. `remasq_live_effect`完整加载，76700ms唯一对象为冲击波、3粒子，77000ms归零；stage-ready=true，unsupported/deferred为空，console error=0。

本机独立QA页最初走旧的bg入口且未透传新版alphaMode，出现空效果/白色方片；已在QA页修正为single入口和纹理选项透传后重新检查。上述结果只指最终正确接线的QA，不将早期无效结果记为产品缺陷。独立QA不是完整剧情/转场/原片/设备验收；本批没有重新做全部门户页面Browser。

截图在本机既有QA目录：`master74-adv-punch-100ms.png`、`master74-adv-rain-8s.png`、`master74-remasq-stage.png`。没有部署、上传、PR创建或修改其他工作树。

后续仍18种粒子缺口。pfofos八组火焰的1°非平面拉伸、mainha播放暂停响应、原片/设备和原生时钟边界继续开放。
