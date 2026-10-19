# Laserlight style1 原生 Sprite 链路

输入`stage/20261014-native-fidelity` / `160f6384`。继续清理[Pinspotlight批次](NATIVE_PINSPOTLIGHT_CHAIN_20261016.md)查出的hndmkh 26.55s旧Graphics激光。沿用5212 / PID61564，未改共享媒体、未混入随机动作草稿。

## 本地来源

- APK `resources.assets` LiveObjectLaserlight106566的九项数组，第1项PPtr指向115970 / `fx_in_laserlight_side`，实际脚本为LiveObjectLightSpriteEffect，而不是粒子脚本。
- 脚本三项SpriteRenderer绑定52581、52723、56184，三项Animator绑定46085、46086、46087；按数组PPtr解析，不靠树遍历顺序。`_base`绑定RectTransform90083，初始position=0/scale=1；方向设置覆盖其rotation。
- 三束使用`laserlight_1` Sprite2716 / Texture898，512×512、100 PPU、pivot(.5,0)。层级保留root -120°、两侧±5°、动画节点scale(.5,4)、叶节点Y=-.08，不能再用三条线代替。
- AnimatorController1346有两个无转换状态，默认第0项绑定`angle60` Clip1241；另一个angle30没有被本链切入。默认clip是2秒loop，streamed Euler-Z曲线0→60→0；直接解码原始cubic系数，没有用三角波拟合。
- `LiveObjectLaserlight.PlayEffect` 0x221d9bc：value3AsFloat→SetSpeed；value10AsFloat设置颜色alpha；value6AsFloat设置root整体scale；value7/8通过ScriptPosToStagePos定位；value4是Z角，`direction != right`时_base的X角为180°。ARM64 0x221dc34..0x221dc58确认s0为0/180、s1=s2=0，不能把它解释成平面摆幅。
- `LiveObjectLightSpriteEffect.SetSpeed` 0x221e724将每个Animator.speed设为2/value3AsFloat；RAW6000得到6秒整周期。
- 旧索引字段`width`实为value10，`length`实为value6。本批兼容旧字段名，style1消费者按实际原生语义解释。hndmkh六盏灯value10=1200→alpha1.2；value6=150/200/250→横纵统一缩放.15/.2/.25。
- `Laserlight.EraseEffect` 0x221ddac调用当前子效果的Erase，后者Destroy GameObject；没有Tween或eraseDuration分支。因此共享激光状态采样器立即删除，不再套旧线性淡出。

本地源校验：

```
python scripts/verify-chibi-laser-parser.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
```

重读APK绑定、完整controller/clip/hash、实际父节点，核对解密ELF哈希、相关方法窗口及1000/180常量，并从RAW song_hndmkh读取六条指令。小型运行参数在`chibiSpriteLaserModel.json`；完整来源fixture约76KB，未复制APK或媒体。

## 消费方修正

用原生三张Sprite的四边形和层级矩阵，按默认动画曲线采样，保留原贴图软边和颜色，不增加白线内芯、经验线宽或重复衰减。最初批次因命令alpha=1.2而绕过Pixi颜色封顶；随后[粒子公共链路反查](NATIVE_LASER_PARTICLE_CHAIN_20261016.md)实际导出APK Shader950，证明原生顶点程序自身clamp COLOR0至0..1。这推翻了“最终应保留1.2增亮”的推论；当前绘制已按原生限制与SrcAlpha/One混合纠正。

删除旧laserSweepAngle/laserBeamOffsets/drawLaserlight及Graphics回退。style1走上述Sprite链；3..9继续既有粒子路径。未来无已绑定模型的style只报告unresolved，不画猜测光束。增加公开诊断`data-laser-sprite-count`与`data-laserlight-unresolved-ids`；资源仍由带generation的store负责异步安装与释放。

## 横查得到的下一项问题

共享PlayEffect同样控制style3..9，但现有粒子消费者尚未完成以下原生接线，不能称激光全家族已收束：

| 当前旧接线 | 原生反证与下一步 |
| --- | --- |
| `sampleLaserParticles`用width/value10缩横轴，length/value6只缩纵轴；alpha未包含value10 | PlayEffect明确value10→SetColor alpha、value6→Transform整体scale；应统一字段合同，重查所有粒子投影 |
| `laserParticleLayout`反向X，旋转忽略部分prefabRootAngle与direction父矩阵 | PlayEffect走公共ScriptPosToStagePos与明确的X180父旋转；需要连同各prefab的3D粒子对齐一起做矩阵证据，不能孤立改符号 |
| particle统一用model.defaultDuration | `LiveObjectLightParticleEffect.SetSpeed` 0x221e04c逐ParticleSystem取main.duration/value3；defaultDuration只用于Animator。style7实际period约.9，style8/9约1.84，当前global值1会改变实际周期 |
| `spotbeamParticleScale`额外乘1.8 | 源码明确该系数来自录屏覆盖范围修补，不属于原生字段；统一父层级/尺寸链后删除 |

这些是同一公共调用链的新证据，后续优先于继续调画面常数。style2暂无当前RAW指令，仍未实现；旧悬灯守卫、Searchlight/Underlight等缺消费者继续保留总审计状态。

## 验证

- `verify-chibi-laser-parser.py --native-elf ...`通过；三项有序绑定、重排、未知controller/default state/active节点拒绝通过。
- `verify-chibi-laser-particles.mjs --published-assets`通过：独立四元数逐点矩阵与clip解析曲线对照（左右方向×8时间×3灯×3顶点）、float RGBA1.2、实际renderer属性、SFC即时Erase与回拖。
- turnlaser/spotbeam的parser与particle回归、Pinspotlight实际SFC/40编排回归、RAW命令覆盖通过；Python py_compile通过。
- `npm run verify:source-batch`144/144通过；`npm run build:check`13.68s通过，仅固定`.analysis/build-check`、copyPublicDir:false，有既有大chunk提示；无完整public打包。生成的无关审计与翻译元数据已恢复。

5212最终冷加载使用Codex In-app Browser/cua_repl，沿用read-model候选`rm-native-relations-20261013`及release `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。实际验收：

| 旅程 | 实际观察 |
| --- | --- |
| hndmkh 29.5s，1440×900 | ready=true；id201..206，共18束Sprite，unresolved为空；原生贴图软边和周期角度可见，无框架覆盖层 |
| 拖至32.5s | 六组激光在Erase时刻归0；中央Spotlight是另一对象，保留显示，不能把它误计为旧激光残留 |
| 回拖29.5s，390×844 | 恢复18束Sprite；document.scrollWidth=390，无横向溢出 |
| 切Study 6s | 旧激光Sprite归0、背景归属steqmg、四个Pinspotlight蒙版恢复；保留上一批灯圈结果 |
| 返回歌曲 | URL清理为`/songs/steqmg/?maintainer=1`，无song/stage查询参数；歌曲资料与谱面表实际加载 |

最终冷加载控制台无应用error，保留两条既有Spine tint/update警告。临时viewport已恢复。截图和console保存在`C:/Users/windm/.codex/visualizations/2026/10/15/01a13fa7-14e2-7682-9c89-a485261616a6/sprite-laser-*`。Browser验收证明接线/显示/资源生命周期，未声称原机逐帧、Unity Animator首帧调度或最终HDR后处理等价。

本批只收束style1与公共即时Erase；粒子分支的字段/矩阵/时钟问题仍按上表继续。未部署、未合master，保留未跟踪的随机动作草稿。


10-16后续：[粒子公共链路批次](NATIVE_LASER_PARTICLE_CHAIN_20261016.md)已处理上表的字段、父平面、逐系统时钟与Not Alone 1.8倍率，并更正本页原alpha1.2推论。字节量化和Unity内部求解器边界仍明确保留。
