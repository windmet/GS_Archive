# 舞台图层反查与后续待办

2026-10-15现状校正见 [遗留假设审计](STAGE_ASSUMPTION_AUDIT_20261015.md)：粒子独立启停与背屏RectTransform已接入；syksai第四层排序、Logo资源选择、人物经验尺度和动作时基仍需收束。下列旧未勾选项须结合该页读取，避免重复修已解决的问题。

用户反馈：灯光较此前明显改善，但仍有尚不能准确描述的遗漏。先登记，后续结合明确时间点或原始链路处理；本轮不凭印象继续调光。

当前优先：反查图层排序、遮光层与人物的关系，以及灯光叠加与人物自身着色的边界。

- [x] 原版 LiveObjectIdol baseSortOrder + offsetSortOrder；聚光灯 Show 时目标 +250，换目标/Hide 时恢复，影子随人物排序 -10。
- [x] SpotlightBackground 共享脚本排序、聚光灯 depth+1、pinspotlight 掩模排序区间；保留脚本显式 0。
- [x] SpotlightBackground 共享颜色、visible 计数和渐变；已改为独立命令回放，保留 RAW 跨家族指令顺序，见 NATIVE_SHARED_BACKGROUND_BATCH_20261014.md。
- [x] 去除没有原版依据的整个人物环境染色，避免与遮光平面重复叠加、绕过 pinspotlight 掩模。
- [x] Body_Color 原版RGBA替色，接到单个Spine绘制部件并保留槽位颜色、透明度及批渲染；见 NATIVE_BODY_MATERIAL_BATCH_20261014.md。
- [x] Foot_Color：五种原版SkeletonDataAsset.scale约1/300已绑定，cutoff/独立RGBA/并存tween/26条即时清除已接入单部件材质。此前整身效果禁令已纠正，超大cutoff可有意影响整个人物；见 NATIVE_FOOT_MATERIAL_BATCH_20261014.md。
- [x] 背屏恢复全局分层、value8 排序重置、噪点/辉光原版混合及顶点颜色钳制；54首静态背景恢复原版三层，见 [NATIVE_BACKMONITOR_GLOBAL_LAYER_BATCH_20261014.md](NATIVE_BACKMONITOR_GLOBAL_LAYER_BATCH_20261014.md)。
- [x] 已接入动态物件的逐渲染器全局排序：scriptDepth + keepOriginalOrder偏移；保留蒙版/变换及销毁归属，见 [NATIVE_OBJECT_RENDERER_PLANES_BATCH_20261014.md](NATIVE_OBJECT_RENDERER_PLANES_BATCH_20261014.md)。
- [x] 已接入63个地面粒子系统的材质内蒙版与原版RGBA混合，移除组后置蒙版；128组含重叠的原着色器GPU对照通过，见 [NATIVE_PARTICLE_MASK_MATERIAL_BATCH_20261014.md](NATIVE_PARTICLE_MASK_MATERIAL_BATCH_20261014.md)。
- [ ] 未蒙版UV粒子的透明通道、其他特效材质、完整透明深度/HDR及原编码mip层数据仍待核实。
- [ ] ObjectLayer粒子生命周期：原版Play直接启动，Erase StopEmitting后延迟SetActive(false)，不同于Web统一父容器淡入淡出；不要用Sprite DOFade语义替代粒子。
- [ ] syksai 第四层模板、背屏 RectTransform/视频有效画面几何、Passion Logo override，以及原版 HDR/深度缓冲完整链路。
- [x] 背屏 value7 错当 Logo 渐变时长：已反查确认其为 GrowSprite alpha，限定预览 Logo 改为原版固定500ms/显示alpha0.8。
- [ ] 后续处理用户暂无法描述的灯光差异，保留待办，不宣称全部灯光还原完成。

验证边界：反编译、源资源、浏览器合成各自提供证据；源码构建不代表原版视频或真机视觉一致。

第一批证据与验证见 [NATIVE_CHARACTER_LAYER_BATCH_20261014.md](NATIVE_CHARACTER_LAYER_BATCH_20261014.md)。背屏 value8 / SetSortOrder（0x2218938）的 -5、+1、+5、+110 偏移现已接入全局排序；资源缺失或模板未知时保留旧层级回退，不把推测当已恢复。

背屏资源绑定与 Logo 原版透明度修正见 [NATIVE_BACKMONITOR_LAYER_TRACE_20261014.md](NATIVE_BACKMONITOR_LAYER_TRACE_20261014.md)。
