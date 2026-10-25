# 贴图尺寸、粒子透视与滑键长条 V5

输入 `chart/20261024-autoplay-timeline` / `a4c3d7c9`。工作目录为 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`，5231 仍由该 worktree 的 Vite 提供，candidate `rm-release-20261022`。本批针对用户新增的三张原作截图修正几何接线；不把截图中的 combo303/307/359 映射为已知曲目或 tick。

## 发现与修正

1. **运行缩放覆盖 prefab。** 旧消费者读取根节点序列化的 0.65，导致命中圆环偏小。原生 `EffectController.Initialize (0x2046f04)` / `Play (0x2047038)` 重置 TRS；使用透视相机时实际为 `1.5 × noteScale`，否则为 `1 × noteScale`。新增审计脚本用 Unicorn 执行这两个方法，捕获两种分支、三种 noteScale 共六组实际 Transform 调用；Unity 调用使用捕获 stub，并非运行游戏引擎。
2. **hold 使用另一套坐标。** `FloatingTarget.Init (0x205a558)` 的 hold 根缩放常量是 `100 × noteScale`，位于 1/72 世界单位的 TargetCanvas 下，走正交 EffectCamera。100 来自固定 ELF 常量和反编译调用关系，未执行完整 FloatingTarget 初始化；不能与上项六组执行回执混写。
3. **瞬时粒子走透视相机。** 从固定 IPA 读取 PreCamera、LiveTapEffectCamera、EffectCamera 与 TargetCanvas。默认瞬时效果相机 FOV60°、z=-6.650000095367432，目标平面 z=2，深度8.65。消费粒子各顶点的深度，恢复左右圆环相反的倾斜与近大远小。旋转顺序改为 Unity 的 Z→X→Y；View billboard 不再继承发射器的 X/Y 旋转，避免 flick 星光变成侧面细线。billboard 的朝向基底仍是 Web 适配，未获得旧 Unity Shuriken GPU 顶点输出 oracle。
4. **实际渲染保留透视 UV。** 新增共享离屏 WebGL 粒子批次，以 clip.w 保存顶点深度，按贴图合批，RGB/alpha 乘来源颜色；每帧一次复制到现有特效 Canvas，Auto UI 继续使用既有曲线消费者。WebGL 不可用或 context lost 时走两三角 Canvas2D 降级。降级是仿射近似，此次 Browser 只验收正常 WebGL 路径，未执行 context loss 故障注入。
5. **滑键宽度重复减半径。** 执行 `NoteDrawManager..cctor` 的常量存储段得到 baseRadius64；HoldMesh.Create 减20后应为44，旧版把已归一化的44再减20得到24。现在使用已有 native hold metrics 的44，不再二次相减。
6. **连接范围与端点纠正。** 原先将所有同 flickgroup 音符直接相邻连接，普通 hold 也会误接。现在只有 flick 或 END_FLICK 的 hold 尾端可以向后续 flick 连接；hold 从尾 tick 和最终折线轨位开始，纯 flick 使用 end lane。全库实际有连接的109档、2008条，其中249条来自 hold 尾端。V4 的200档/2859条是旧 raw group 算法结果，不再有效。按 group 构建 nextFlick 关系仍是 Web 适配；未在原生 manager 中执行完整对象关联过程。

原始 prefab TRS、hash 与模块证据保留；新 `config/song-hit-projection.v1.json` 绑定同一 ELF/IPA SHA，保存相机、常量与执行结果。没有新贴图生成、资源发布或 public 语料拷贝。

## 对照与验收

本地小型证据位于 `.analysis/chart-native/`，不纳入发布包。

| 检查 | 本批结果 | 边界 |
| --- | --- | --- |
| 原生提取 | `audit-song-hit-projection.py --elf … --ipa …` 两次成功；六组运行缩放、静态半径64、三相机及 Canvas 绑定 | Unity 调用 stub；hold100为常量/反编译证据 |
| 源码回归 | source batch **184/184**，`projection-v5-source-batch.log` | 随后 billboard 朝向调整另跑 renderer/flick 专项，未机械重复184项 |
| 最终专项 | renderer 的缩放/旋转/顶点深度/相反倾斜及旧模块回归通过；flick 的44半径、普通hold排除、hold尾端/poly lane、全库连接回归通过 | 网格与合同验证不替代录屏逐帧 |
| 最终构建 | `npm run build:check`，**3016 modules / 17.29s**，`projection-v5-build-final.log` | copyPublicDir=false；保留既有 >500kB chunk 警告 |
| 固定检查点 | 实际 Track 组件：brndnf EX / tick127790 / 配速11 / 普通命中年龄0.3 / Auto年龄0.1。105881非透明、51652绿色像素；三段滑键中点 alpha均153；左右颜色区协方差-1078.60/+1181.54 | fixture刻意组合三轨同龄普通命中，配速11只用于展开连续滑键；产品仍默认5。不是录屏同一帧，也不是三次真实同刻判定 |
| 环形几何 | 1280×720内部画布，三轨颜色边界约272×157、259×157、273×157；左右倾斜方向相反 | 只作为可重复检查点；截图未知粒子年龄/配速，不能据此宣称逐像素误差 |
| 响应式 | 固定检查点实际390×844，scrollWidth390，像素检查通过；桌面实际内容1265×720，截图 `projection-v5-reference-desktop.png` | Browser 模拟窄屏，非物理手机 |
| 组件整曲 | cfprde816事件、remasq695事件，两首受控整曲及暂停/恢复/seek通过；暂停非透明20630/21189，彩色8829/7995，恢复最大单通道差≤1/255 | `projection-v5-component-result.json`；受控媒体/rAF，不是实际整曲音频回执 |
| 正式 App | brndnf EX，Auto开启，配速5，定位tick127790后实际播放/暂停；WebGL消费者启用、贴图 pending/failed均0，控制台无error/warn | `projection-v5-product.png`；未再跑实际130秒整曲，前批整曲回执不能升格成V5整曲验收 |
| 真实音频性能 | cfprde EX，Auto开启，1280×720，12.5→32.459086秒，前台visible/focused。20.0138秒内1186次轨道更新，CPU median/P95 **4.0/6.6ms**，max68ms；rAF间隔P95 8.5ms，4次>50ms、0次>250ms，无缓冲/速率/焦点警告 | `projection-v5-live-performance.json`。rAF117.22Hz不是GPU FPS；与V4视口不同，不能单独归因量化提升，长帧仍存在 |

新增 fixture 最初使用 runtime-only Vue 的 template 出现一次警告，已改 h() 渲染；记录中保留该旧警告，最终产品页未见错误。不要称所有历史日志零警告。

## 下一份交接保留项

- 几何/贴图大小、左右透视和连续滑键条已可在实际 Browser 重复验收；**原作完整还原仍未通过**。后续需要同曲、同配速、同粒子年龄的录屏连续帧，分别核对普通/flick/hold/P/Special。不能仅凭 combo 数推定这些条件。
- 背景合成、色彩空间、Shuriken billboard/随机序列/积分与材质通道尚无原生GPU对照。离屏 Additive 后复制透明 Canvas 不自动等于 Unity 直接对舞台背景 Additive。四套效果渲染、Auto SetNativeSize/完整 UIBackCanvas runtime 缩放仍沿用V4缺口。
- 后台恢复、context loss/无WebGL降级与物理手机性能未验收；本次有CPU预算改善迹象但仍有>50ms峰值，不宣称稳定60FPS。继续定位峰值应保留视口和窗口一致。
- 本批 scoped commit/push；`config/resource-audit.json` 的已有生成差异保留，不提交。无master推送、合并、部署、R2上传或端口切换。

旋转语义参考 [Unity Quaternion.eulerAngles](https://docs.unity3d.com/ja/current/ScriptReference/Quaternion-eulerAngles.html)，对齐语义参考 [ParticleSystemRenderSpace](https://docs.unity.com/en-us/engine/6000.7/script-reference/unityengine/particlesystemrenderspace)。官方API说明不等于旧游戏引擎执行回执。
