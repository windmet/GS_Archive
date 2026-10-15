# FLASH LIGHT 灯色、地面上方散射与裁切 Sprite 光池修正

2026-10-15。输入 HEAD `bab6fdfc`，分支 `stage/20261014-native-fidelity`。
工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。

## 修正与推广

1. Stagelight 导出原先固定列号读取擦除标志，且把 value4/colorMode、value5/alphaMode 对调。改为读取 CSV 表头 value101/value102 与独立颜色/透明度字段。新增带 RAW bundle/TextAsset、编排索引和 BPM 来源哈希的独立接线数据，覆盖 118 种编排、29,661 行（17,331 show、12,330 erase）。按编排 ID 消费，不能只取 songCode 的默认编排。
2. 原生静态配色、HSV 全周、双色 Yoyo 渐变，以及 alpha 0…7 的独立补间取代旧录屏近似脉冲；EraseEffect 立即销毁灯而非白色兜底渐退。SetColor 赋值 RGBA，不能再乘一次预制体初色。ID 重用在擦除前保留原预制体；倒拖重建状态，晚到纹理触发暂停重绘。
3. 补接 `fx_in_flslgt_bloom_1/2/3` 的 9 个无地面遮罩发射器。保留原生位置、圆盘形状、速度、延迟、寿命、尺寸/颜色曲线、UV 和排序，使用现存同源纹理，不生成新图。零速度圆盘闪烁与独立径向散射分别采样；同一散射粒子的出生角固定、径向距离增大，不能通过随时间改变角度伪造旋转。移动 burst 的原生半径接近零；有范围的圆盘层原生速度为零，未把它们合成一个虚构的移动圆环。
4. 顶部椭圆来自 `fx_in_ossshd_spotlight_under`，不是悬灯 Y 符号。Unity Sprite 原始 rect=1024×1024、pivot=.5，而 UnityPy 按 tight mesh 导出的 PNG 只有 305×113。旧消费者把裁切图再次居中，丢失 mesh 原生下移。顶点 y 范围 [-5,-3.87]，正确裁切图 anchorY=-387/113≈-3.42478；画布 Y 翻转仅发生一次。新增小型几何修正表，推广到 35 个 RAW bundle、46 个预制体、53 张 Sprite；同时修正未来规范导出器。已安装的物件也响应晚到几何修正，不必切歌。

共享 `public/assets` 索引/纹理均未改写；三个修正表保存在本分支的 tracked `public/data`。

## 反查证据

- `StageLightLiveSpriteEffectDirector.BeginAlpha` 0x1da3ec4、`BeginColor` 0x1da52c8、`BeginColorRainbow` 0x1da58bc、`BeginColorGradient` 0x1da5b30：value5 alpha、value4 color；alpha2 半周期 OutQuad 淡入后 3600 秒 hold，不是颜色插值或一次白闪。mode3 原生打乱 renderer 顺序；mode4 捕获命令时 BPM；mode5 奇偶延迟；mode6/7 原始/反向 renderer 波次。
- `LiveObjectStagelight.PlayEffect` 0x2226ad4；`LiveObjectLightSpriteEffect.SetColor` 0x221e85c：脚本色直接赋给 renderer。
- `LiveEffectData.get_isErase` 0x1d6d034：value101 == "1"。Stagelight 的 EraseEffect 调用对象销毁，不使用擦除 duration。
- `LiveObjectObjectLayer.PlayEffect` 0x2220db8：保留注册 renderer 的原生 Transform/Sprite。已与既有 quaternion 反射链回归一起核对，没有为修光池增加第二次 Y 翻转。
- 新 Sprite 几何导出直接读取 RAW SpriteRenderData Mesh 顶点，绑定 PNG 哈希；bloom 导出重新读取 RAW typed ParticleSystem、renderer/material、Transform 链，未以截图拟合源参数。
- FLASH LIGHT 原始时钟 84.55s 启动持续 HSV；89.0/89.1/…s 逐片红色接管（89.4s Browser 已见黄绿外圈与红色中心并存）；93.3s erase 后 93.4/93.5/…s 是另一轮持久红色渐入，同时启动 bloom。两个时段分别验收，未人为挪动原始时间轴以匹配录屏文件的时间标。

## 验证

- `npm run verify:source-batch`：首轮 140/140 通过；用户补充首次发射对照后增加两项接线回归，最终复跑 142/142 通过。未声称跑完全部 Source Gate workflow。
- `verify-chibi-stagelights.mjs --published-assets`：真实编排绑定、29661 行、HSV/gradient、alpha0…7、立即擦除、红色保持、回拖、native geometry、异步释放通过。
- `verify-chibi-bloom.mjs --published-assets`：9 发射器、原始资源哈希、同一粒子不绕圈/向外扩散、延迟、寿命及结束清退通过。
- `verify-chibi-object-sprite-geometry.mjs --published-assets`：53 张真实 PNG 哈希、负 anchorY、不可变共享索引、晚到修正通过。
- `verify-chibi-object-transforms.py`、`verify-chibi-stagelight-prefabs.py --published-assets`、`verify-chibi-object-light-runtime.mjs`、`verify-chibi-object-renderer-planes.mjs`、`verify-stage-vfx-coverage.mjs`、`verify-chibi-floor.mjs`、`verify-chibi-suspensionlights.mjs`、`verify-stage-resource-ownership.mjs` 通过。
- 最终 `npm run build:check`：21.36s，通过；仅 `.analysis/build-check` 代码产物、copyPublicDir:false，既有大 chunk 提示。生成的资源/翻译审计元数据已恢复。
- Browser 使用原端口 5212/PID61564 的本 worktree Vite，未重启或改绑定。1440×900 FLASH LIGHT：89.4s 彩色外圈+红色中心、93.5/93.6s 新粒子、104s 光池归地；实际播放采样 93.4/93.8/93.9/94.2/94.5s，随后暂停；播放到曲末、再回拖。390×844 验证 104s 光池位置。ANYWHERE 35s 五个共享光池位于脚下。控制台无新增 error/warn。临时 viewport 已恢复。
- 截图小型证据位于 `C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee`：`flash-light-native-color-wave-89400.png`、`flash-light-bloom-playing-93400.png`、`flash-light-bloom-playing-93800.png`、`flash-light-bloom-playing.png`、`flash-light-light-pool-fixed-104000.png`、`flash-light-pool-mobile-104000.png`、`anywhere-shared-light-pool-35000.png`。

## 边界

原生 IListShuffle/ParticleSystem 自动随机种子尚未恢复；bloom 的 LimitVelocity 阻尼使用保留参数的 60Hz 可重播积分，未证明原机帧步一致。正交投影与原机摄像机、其他仍未支持的粒子/指令仍标 partial；本批不能称整场原机等价或真实设备验收。不部署，不修改 master，不创建 PR。

## 首次发射二次核对

用户提供 2 秒开头对照，旧版即使单粒子径向移动，整群仍很整齐。确认了两项额外错接：

- 原 preview RNG 对顺序 seed 只做一次乘法，连续出生角近似固定步进，角度与速度/寿命通道也相关；改成独立混合出生 ID、参数通道并完成 avalanche，仍标注不等于 Unity 原生 RNG。回归检查相邻出生角不是固定步进，同时检查每一存活 burst 粒子径向增长且方向不转。
- `LiveObjectObjectLayer.<PlayEffect>b__0` 0x1c9e17c 对 ParticleSystem 只 SetActive、设置排序并 Play；DOFade 仅在 Sprite callback 0x1c9e288 / Group callback 0x1c9e388。旧整组 alpha 将 1200ms Sprite 渐入错误乘到所有粒子，首次中心光晕被压暗。粒子现直接播放；Erase callback 0x1c9de04 Stop(withChildren:true, StopEmitting)，到 eraseDuration 后才停用 GameObject。把独立粒子启停推广到 bloom、masked floor/fire、UV burst 消费者：停止后不产生新粒子，已出生粒子按其寿命存活到停用时刻，不做 Sprite 式渐退。

散射的原生随机种子、LimitVelocityOverLifetime 求解的原机步长与摄像机投影仍未证明完全等价；不能以“单粒子角度不转”宣称整群外观已与原机逐帧一致。

## 扩散幅度仍待核对

用户最后确认方向正确、扩散范围稍小。本批保留该问题为 **open**，没有把范围对齐写成通过。反查结果：移动 emitter 的 speed=TwoConstants(8,11)、radius≈0.0001、圆盘 emitter radius=1.3/speed=0、shape rotation X=65°、transform scaleY=.8、Object_layer scale=1000，均已接入。

APK TimeManager: Fixed Timestep=0.016599999740719795、Maximum Particle Timestep=0.029999999329447746、TimeScale=1；IL2CPP `0x1f0a598 mov w0,#0x3c` → `0x1f0a5a0 bl Application.set_targetFrameRate(0x2ace494)`，启动目标确为 60fps。LiveEffectListData.IsEffectFire 0x1d6ec20 是 effect.time<=currentTime，未发现人为前瞻偏移。**这些配置不能证明 Unity native LimitVelocityOverLifetime 的内部阻尼算法、更新顺序或实际逐帧步长。** 当前范围余差继续查引擎求解/投影，不凭一个截图增加未标注的扩散倍率。

最终开头首次发射 Browser 2.1/2.6s 快照及回拖正常；对应 `flash-light-first-bloom-2100-final.png` / `flash-light-first-bloom-2600-final.png`。实际执行的额外回归 `verify-chibi-object-particle-lifecycle.mjs` 覆盖真实 SFC show/erase 状态、ParticleSystem 不套 Sprite alpha、StopEmitting 出生截止、保留在世粒子及循环清退。

## 派生表哈希

- `public/data/stage-stagelight-commands.json`: 1b2e1931236f264ce6beb04bbe82f52a5c2b65b5518f802cbabfdcd3253353d6
- `public/data/stage-bloom-particles.json`: 5e90aa519519f6c01347678f64669907c4272a422283a8816a648288e8e29059
- `public/data/stage-object-sprite-geometry.json`: 9f81fbf9f4de6aad55c41b8831bc8d52e3e1e9f8c2b1870cba5c5c4b442c03e0
