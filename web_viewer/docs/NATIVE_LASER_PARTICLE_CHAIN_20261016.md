# 粒子激光公共字段、层级与时钟

输入`stage/20261014-native-fidelity` / `2b1f7f7b`。继续[Sprite激光批次](NATIVE_SPRITE_LASER_CHAIN_20261016.md)明确的公共链路缺口，覆盖Laserlight style3/4/5/6/7/8/9。沿用5212 / PID61564，保留随机动作草稿。

## 原生调用链与修正

| 旧实现 | 来源反查 | 本批行为 |
| --- | --- | --- |
| width/value10缩横轴，length/value6缩纵轴；Not Alone再乘1.8 | PlayEffect 0x221d9bc中value10AsFloat传SetColor alpha，value6AsFloat写Transform整体scale | 两轴统一value6，value10只调颜色alpha；删除1.8 |
| 全部粒子用prefab.defaultDuration计时 | LightParticleEffect.SetSpeed 0x221e04c逐系统读取main.duration/value3；defaultDuration只用于Animator | 每个系统独立simulationSpeed=float32(period/float32(value3/1000)) |
| effect X反向，忽略部分prefab root角度与方向父节点 | PlayEffect走ScriptPosToStagePos、CSV Z角及direction != right时的父节点X180；Instantiate后仅子prefab root的localPosition被清零 | 按原生X定位，保留root旋转/缩放、子层级、平面反射及粒子初始旋转 |
| 转动粒子锁定出生时的Animator角度 | APK renderer.alignment=2/Local；Animator本身有独立defaultDuration/value3时钟 | 粒子位置仍是world空间，Local billboard朝向随当前Transform更新，不再锁出生角度 |
| 把原生alpha1.2解释成应直接增亮20% | 本批实际导出APK Shader950，三个GLES tier的顶点程序均clamp COLOR0至0..1；片段texture×COLOR0，混合SrcAlpha/One | 明确实现原生clamp和混合边界；更正上一批对alpha>1的过度推论 |

Local对齐含义以[Unity 2020.3 API](https://docs.unity3d.com/jp/2020.3/ScriptReference/ParticleSystemRenderSpace.html)和[Renderer说明](https://docs.unity3d.com/jp/2020.3/Manual/PartSysRendererModule.html)作交叉核对。结合本地alignment=2，按当前本地Transform渲染属于上述来源的推导；不把它宣称为Unity内部模拟器逐帧复现。

60个实际ParticleSystem都绑定world simulation / hierarchy scaling / Local billboard，RGB寿命曲线均白色。生成的`chibiLaserGeometry.json`按serializedFile/pathId及parameterTreeSha256绑定真实父链，拒绝未知来源；保留原始四元数而不是style专用角度公式。实例root的position按PlayEffect清零，不能误把turnlaser prefab的Y=9或Not Alone的Y=-1.3再加回去。

典型差异：style7的系统period约.9，原统一值1；style8/9约1.84，原统一值1；turnlaser粒子period约.15，Animator defaultDuration=3。把这些时钟混用会改变粒子出生间隔和衰减，同时污染画面上对大小/密度的判断。

## Shader边界纠正

`chibi-laser-shader.json`记录Shader950原始哈希、导出源码哈希、三GLES tier的顶点clamp片段、片段输出表达式和实际blend state：RGB及alpha均SrcAlpha(5)/One(1)，ColorMask15。Sprite激光三项renderer也实际绑定950。

NativeLightQuad使用相同四边形/UV、原生颜色限制和`ADD_NPM`混合；对Pixi已预乘的纹理先还原straight RGB，使RGB和alpha两条混合都对应来源，不能把普通PMA ADD的alpha累加冒称原生SrcAlpha/One。Shader在真实Browser中编译并验收。

Particle结构的m_StartColor是Color32；本批限制出生alpha至0..1后应用寿命曲线，保留0..1区间字节量化/Unity内部求解器边界，不声称最终逐像素等价。全库1,089条非Hide激光中124条alpha>1，其中粒子1,083条里118条；“命令输入1.2”与“最终Shader输出1.2”是两件事。上一批记录已补正，原始提交历史保留。

## 现状与验证边界

- 现有RAW使用style1和3..9，均有实际资源链；style2当前无RAW指令，仍未实现。不为未知style画Graphics近似。
- 旧统一时钟、独立横纵字段误读、Not Alone的1.8倍率、反向X、出生角度锁定、忽略root角度及Shader增亮推论均已移除。
- Unity粒子首帧调度、生命周期与startDelay细微边界、Color32量化、真实设备色彩空间/后处理与原录屏压缩仍不是本批CPU数学回放可证明的内容。没有用新经验系数抵消这些差异。
- Spotlight自由目标/淡出重显、旧悬灯曲名守卫、Searchlight/Underlight等缺消费者仍在[总审计](STAGE_ASSUMPTION_AUDIT_20261015.md)，总体目标尚未全部完成。

## 检查

```
python scripts/verify-chibi-laser-parser.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
node scripts/verify-chibi-laser-particles.mjs --published-assets
node scripts/verify-chibi-spotbeam-particles.mjs --published-assets
node scripts/verify-chibi-turnlaser-particles.mjs --published-assets
```

上述均通过：重读APK全部60个系统和Animator/renderer绑定，重读ELF方法窗口/常量及Shader950实际程序；再读60个RAW song bundle的全部118份编排，将1,089条Laserlight Show的Int32字段、映射、时间/ID/颜色/方向与当前公开索引逐项比对，全部一致；60平面×左右方向×4时点×3顶点的1,440个独立三维四元数逐点对照；全库1,083条粒子指令的三个相位、有限几何、资源身份、alpha/scale分离与回放检查。Not Alone保留原生atlas beam/pool接缝回归，撤掉依据旧1.8系数的覆盖率断言。turnlaser测试由“出生角不变”纠正为Local渲染平面按当前动画变化。

Pinspotlight实际SFC/40编排回归通过。最终`npm run verify:source-batch`144/144，`npm run build:check`23.19s通过；固定`.analysis/build-check`、copyPublicDir:false，仅源码构建，有既有大chunk提示。初次构建后导出Shader得到新反证，修正后重新完成最终构建和回归。未执行完整public打包；生成的无关审计与翻译元数据已恢复。Python py_compile与diff检查通过。

## 5212 最终冷加载验收

使用Codex In-app Browser/cua_repl，构建和恢复元数据后新建冷加载标签页。5212进程仍为PID61564，公开HTML bootstrap的release实读为`1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`，沿用`rm-native-relations-20261013`环境。

| 旅程 | 实际观察 |
| --- | --- |
| Not Alone 1.5s，1440×900 | 10个粒子quad，style8/9 beam/pool显示，unresolved为空，GPU Shader正常编译 |
| Not Alone 3.8s | 当前id3..6、24个粒子，按原生命令整体缩放，不再额外1.8 |
| Not Alone 3.8s，390×844 | 同样24粒子；document.scrollWidth=390，无横向溢出 |
| 切Study 6s | Not Alone旧粒子归0，背景归属steqmg、四个Pinspotlight蒙版正常，用户参考时刻没有回归 |
| Study 9.2s / 60.5s | style7为32粒子、id1/2；style3为4粒子、id1..4，均无未绑定灯 |
| Study从60.5s实际播放 | 预载完成后实际推进到1:49曲末并自动暂停；slider109700ms、max109756.09977324263ms，保存末态JSON；未把seek冒称播放 |
| 切hndmkh 2s | style6当前16粒子，源alpha1200经Color32/Shader限制，无应用error |
| hndmkh 29.5s | 上一批style1的18束Sprite正常，粒子归0；Shader限制修正未破坏矩阵/动画链 |
| hndmkh轻量→完整 | 轻量时beam=false、Sprite/粒子均0；完整恢复18束Sprite |
| 返回歌曲 | URL为`/songs/hndmkh/?maintainer=1`，无song/stage查询参数；歌曲详情与谱面表实际加载 |

最终冷页无应用error，保留两条既有Spine tint/update警告。临时viewport已恢复、加载模式恢复完整。截图/console/曲末状态保存在`C:/Users/windm/.codex/visualizations/2026/10/15/01a13fa7-14e2-7682-9c89-a485261616a6/laser-particle-*`。手机尺寸是Browser模拟；没有声称真实设备性能、原录屏逐帧或Unity内部求解器等价。

中间Shader预检曾因重复带入Pixi的SHADER_NAME宏而编译失败，已改为独立vertex source；上述验收使用最终新冷页，不能混入旧HMR标签页的累计错误日志。未部署、未合master，随机动作草稿仍未跟踪。
