# Foot_Color：原版单位、脚部梯度与清除接线

输入 HEAD：c1c51c79。继续舞台图层和人物着色反查。此前未启用Foot梯度，本批找到原版局部坐标单位后接入实际材质。

## 单位证据与事实更正

五个 RAW live_costume_setup_1..5.unity3d 的 SkeletonDataAsset.scale 均为 `0.003333332948386669`（约1/300）。每个asset的PPtr、bundle/asset哈希、scale和骨骼payload哈希保存在 scripts/fixtures/chibi-native-skeleton-units.json；五个网页body-N.skel与其指向的RAW TextAsset payload逐字节相等。不是用画面大小反推比例。

LiveIdolFactory._PrepareAsset_d__5.c 将原SkeletonDataAsset +0x20 的scale传给CreateRuntimeInstance；GenerateSkeletonAnimation把生成对象Transform归一。网页SkeletonBinary.scale为1（本地runtime-3.8/lib/core/SkeletonBinary.mjs），Bone按settings.yDown反射Y。因此原版shader局部Y=网页骨骼局部上向Y×该scale。人物预览缩放、镜头和屏幕尺寸不参与这一步。

Livechara_Foot_ColorLiveEffectTypeExecuter.PlayEffect 0x1f331a4：value1为HTML色，value2/1000写alpha，value3/1000为渐变秒数，value4为几何cutoff。原ELF 0x317a3bc 的float为1000，传入ChangeFootColor的rate为1000/value4。网页shader使用的RCP因此为 `scale×1000/cutoff`。cutoff1000对应网页骨骼高度约300，而不是1000。

纠正此前“Foot_Color不应影响整个脸/身体”的过强判断：MOON NIGHT开场cutoff=999999，对应网页高度约300000，原版会近似给整个人物染暗。应保留这个作者指令，不能一律禁用整身效果。

另审计全部costume_*.unity3d中的549个cos_Material，初始_RcpHeightCutOff均为0.5；回执 .analysis/native-chibi-wiring-audit/all-costume-foot-defaults.json。RuntimeAtlasAsset.CreateInstance将Src/Dst/Body颜色设为白色alpha0，未改变RCP；新采样沿用该初始值。

## 接线

- 导出器新增命名Foot控制：cutoff、hide；恢复26条此前漏掉的value101清除。`verify-live-chibi-foot-controls.py --write`仅重写本地characterLightEvents，不导出媒体。2161指令/112编排，非hide的cutoff均为正，opacity均在0..1000。
- ChangeFootColor 0x221b678将SrcColor设为RGBA，DstColor同RGB/alpha0，并独立插值_RcpHeightCutOff。网页采样保留RGBA与倒数高度，采用默认OutQuad；不插值“高度”替代倒数。
- ClearFootColor 0x221ba90即时清Src/Dst，不重置RCP，也未Kill已有DG.Tweening.To。26个实际clear均在此前tween结束后；实现同时保留一般并存writer语义。语料10组重叠中有4组新tween先结束，旧tween随后继续写入，不能按新指令永久覆盖旧轨道。
- shader按实际顺序执行 Body替色→Foot梯度→槽位颜色/alpha。Foot梯度alpha为 `srcAlpha×(1-clamp(localY×RCP,0,1))`。保留纹理alpha。
- 在人物单个绘制部件内处理，取消舞台消费者的旧整Spine滤镜。批渲染逐顶点附带脚色与局部高度；大mesh用同一公式的独立材质。每次绘制从当前世界矩阵恢复人物局部高度，镜头旋转/缩放/移动不会把梯度留在屏幕上。

本地choreography/index.json是被Git忽略的语料产物，正式发布时必须重新生成并发布，才能携带26条hide与命名cutoff。代码兼容旧depth字段作为非hide的cutoff，但不从旧数据猜测丢失的erase标志。本批未部署。

## 验证

RAW核对2161指令、26清除、五组scale/哈希/payload；验证列重排仍得到相同控制。native-foot-colors覆盖倒数高度插值、RGBA、clear、短tween先结束时旧writer恢复、clear不Kill、移动/旋转/镜像下的高度，以及全部源指令。native-body-paint、旧Foot诊断隔离、spotlight背景、人物层级和architecture-cleanup通过。

5212现有服务，Edge/Playwright实际加载Growing5.2s、Drive16.4s渐变/19s及390×844、Moon3.8s整身cutoff/4.2s清除/反向seek/播放暂停。72组GPU样本覆盖区域贴图、批mesh、大mesh，在高度0/150/450上叠加Body和Foot，并包含半透明纹理与槽位乘色/透明度；与原版PMA公式比较，最大误差1色阶。Growing启用/关闭材质drawElements均为534，实际人物没有整Spine滤镜；不是FPS或真机性能证明。

上一批Body的72组GPU样本及两人物不同颜色同批测试再次通过，最大误差1色阶，Take绘制调用仍532。图像/回执位于 C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/native-foot-* 与 native-body-*。

build:check完整源码编译通过，固定 .analysis/build-check，未复制public。日志 .analysis/native-chibi-wiring-audit/native-foot-material-build.log。源资源体积/摘要随命名控制更新到resource-audit；没有媒体增量。

本批不宣称完整原版视频、后处理、帧边界时钟或真机一致。连续时间采样的tween完成点与原版离散帧的完成/移除可能相差一帧。背屏整体排序/遮罩、嵌套特效的跨容器排序等仍在本轮图层待办中。
