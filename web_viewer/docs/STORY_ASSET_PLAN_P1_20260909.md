# P1：资源需求发现首批

## 2026-09-12 当前进展

继续执行补充：通信消息发现已覆盖 legacy text/text_jp、source_text、内联 text_cn 的原文/
译文/双语显示，以及可能被选择后注入聊天的 option 回复。按篇去重新增 14 条 emoji，
204 篇上生产消息函数产生的 78 次图片 URL 对照全部命中计划。选择来源保留 optionIndex；
任意历史和外部翻译覆盖分别以 communication-history-dependent、
communication-translation-overlay-pending 保持 open，不能仅由线性结果推断完整。

当前分支 `codex/p1-effect-texture-deps` 的 `c090425` 已加入真实 handler 的特效纹理映射、
通信 presentation context 扫描与共享 UI URL。详见 [最新审计与交接](SIDEM_NEXT_WINDOW_HANDOFF_20260912.md)。
本轮 204 篇通信来源验证通过，但 204 个计划仍有未闭合依赖；线性 parity 不是所有分支验收。
P1 尚未接入旧预载器，可信执行状态仍待实现。下文是首批历史记录，其中“特效/通信尚未映射”
及旧统计不代表最新成果；特殊模型、配置回退、通信完整性和执行闭包仍需继续。

## 首批历史记录

2026-09-09，基线 `fc182b1`。实现 `shared/story/StoryAssetPlan.js` 与专用 verifier。
本批是纯需求发现，不是新预载执行器；App 仍调用旧 Preloader，加载百分比尚未替换。
后续 atlas 页依赖与实际加载器修复已完成，见 [atlas 页交付记录](SPINE_ATLAS_PAGES_20260909.md)。
下文消费者核对中的第一张纹理限制是修复前证据，当前加载器已逐页加载。

## 输入与输出

输入为 compiled scenario 和经过校验的相对来源文件、SHA-256。legacy 必须先走既有
ScenarioNormalizer；strict-v2 与 compat 使用相同 entry/settled/cue 扫描，保留数组下标与
step_id 的区别。函数不 fetch、不导入 PIXI、不执行 cue、不推演分支。

输出为 source、stepCount、assets、unresolved、dependenciesComplete。每个 asset 按
kind/id 去重，uses 保留 stepIndex/stepId/path/cueId。这里的 dependencyState=complete
仅表示该逻辑资源没有已知待展开依赖，不表示已下载、已解码或可渲染。

本批发现 background、BGM/ambient/SE、Spine bundle/skel/atlas、voice/lipsync、
人物 placement/mouth/body/motion/costume 配置、scene icon、stamp 与逻辑特效。
Spine bundle 明确挂 skel/atlas 依赖，并保持 atlas-pages-and-model-adapter 待解析。
特效纹理映射、mouth 模型回退与通信 UI 依赖也保留 pending/unresolved，不能静默当零需求。
未知 snapshot 字段、未知 cue、normalizer 未映射字段保留来源诊断。
image_icon 的 layer/display_id 规则与当前 SpineStage 消费者一致。

尚未形成执行闭包：atlas 多页与特殊模型 adapter、特效纹理、通信 emoji/background/icon/
unit 资源、配置的实际 URL/回退链等仍需对照消费者展开；没有按 priority 划分或预取网络。

## 实际消费者核对

- `spineSpawnPipeline.js` 当前提取并加载 atlas 第一张 texture；其余页面可能用 fallback。
  后续闭包与执行器必须一起支持所有实际页，不能把一次 skel 下载算 bundle ready。
- BackgroundEffectManager / ScreenEffectManager 使用 `effectTextureCache.js` 的
  `/data/fx_extracted/unity_<name>.png`；不可盲用 AssetResolver 中另一个 frame URL helper。
- SpineStage 除模型外还读取位置、体型、服装等配置；LipSyncController 有模型/人物 mouth 回退。
- 旧 Preloader 仍只尝试 background Image 与 skeleton fetch，并把失败也计入完成百分比。
  本批修正了其“近零延迟必定命中缓存”注释，没有假称已更换行为。

## 验证与下一批

`npm run verify:story-asset-plan` 验证 strict/compat 一致、entry/settled/cue 独有需求、
去重、来源追踪、非连续 step ID、无输入突变、未知类别和未完成依赖。
`npm run verify:story-asset-plan-sources` 验证 204 篇来源 SHA 后运行相同计划。

按篇去重后合计：376 background、305 BGM、272 ambient、818 SE、828 Spine bundle、
2397 voice、2238 lipsync、37 background-effect、2 screen-effect、33 image-icon、5 stamp，
另有 placement/mouth/body/motion/costume 配置需求。这些不是跨篇唯一文件数。
204 篇均存在待展开依赖；通信 UI 与 legacy 未映射字段分别产生 7673、2844 条来源记录。
这一统计没有把未映射字段解释为资源缺失或加载失败。

下一批先闭合 atlas/特殊模型与效果依赖，再逐步补齐通信资产，核对消费者 parity；随后
接入可信任务状态与入口 critical/near/deferred 执行器。旧百分比、失败语义与 ready 兜底
仍待改造，正式长稳仍后移。不能把本批称为 P1 全部完成或 Player 加载优化已经上线。
