# K.now O.nly 激光专项复查

输入 `0d3a1472`，分支 `stage/20261014-native-fidelity`。本批重新读取本地 APK、解密 ELF 和 RAW，检查用户记忆中的曲目特例。没有新增前端调参；公共链路修正在 `315e8876`，本批补齐专项来源检查和实际验收。

## 特例与旧猜测

当前激光状态归约、粒子采样、父平面、Shader消费者没有 `knwonl` 歌名判断。源码中的 `knwonl-masked-fire-flipbook-v1` 对应 `fx_in_knwonl_panel` 火焰面板，是另一种原始资源，不能当成激光特例删除。

历史 `4bebf276` 的激光消费者有录屏指导的 style 分支：style7旋转基角0，其余π/2；width/value10缩横轴；length/value6缩纵轴；X反向。后续还曾把转动粒子的Animator角度锁在出生时刻。它们虽不按歌名判断，仍会影响K.now O.nly等曲目；不能因没有歌名字符串就判定从未猜测。当前这些分支已被来源父链矩阵、独立时钟、整体缩放和透明度语义替代，详见[公共激光来源链](NATIVE_LASER_PARTICLE_CHAIN_20261016.md)。

## 该曲实际接线

`song_knwonl.unity3d` 的 `knwonl_live_effect` 有72条Laserlight Show，全部style3。LiveObjectLaserlight数组第三项绑定 `resources.assets:127084`、`fx_in_laserlight_randam_front`，不是专属歌曲prefab。四个ParticleSystem依原脚本数组顺序为48810、48145、49578、47957；使用texture885 `laserlight_3`、Shader950。

- 四系统原始period均1秒，lifetime约0.15秒；root保留30°，两子系统有±20°，startRotation约−π，renderer pivot Y约0.485。由原始四元数父链投影，不另写style3或歌名角度。
- PlayEffect `0x221d9bc`：value6控制整体scale，value10是颜色alpha，value4是Z角，非right方向父节点X180，value7/8走ScriptPosToStagePos。该曲scale输入800、alpha输入600，因此整体0.8、出生alpha约0.6；不是宽0.6、长0.8。
- LightParticleEffect.SetSpeed `0x221e04c`逐系统以duration/value3设置simulationSpeed。该曲首组含1200和3000ms两个时长，不可统一成一个经验转速。
- Show与Erase按原ID和时间归约，Erase即时销毁。3.6秒先移除id1..8，再有id10..13新Show；此时新系统尚无可见粒子不代表旧灯仍在。30秒原始激光空档必须为空；87.85秒再次清空。

## 本批验证

`python scripts/verify-chibi-laser-parser.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so`重新读取APK全部60系统、Animator、Shader实际程序及ELF窗口。118份RAW编排的1,089条Show字段逐项一致。本批新增全库977条Erase的ID/时间一致性检查，防止仅验Show遗漏销毁接线。

`node scripts/verify-chibi-laser-particles.mjs --published-assets`新增该曲72条style3断言，用生产状态归约器检查1.8、2.5、3.6、30、86、87.85秒及倒退2.5秒；复用公共plane/scale/alpha/Shader模型，既有60平面、1,440顶点和1,083条粒子命令回归均通过。

5212复用本分支既有Vite，Browser插件独立冷页完整加载：

| 旅程 | 实际结果 |
| --- | --- |
| 2.5秒桌面 | id1..8、8可见粒子、unresolved为空，红色柔光与原生贴图束可见 |
| 30秒 | 激光ID空、粒子0，无前段残留 |
| 86秒 | id30..37、8可见粒子、unresolved为空 |
| 390×844回拖2.5秒 | id1..8与8粒子恢复；页面宽390，无横向溢出 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，歌曲详情及难度表载入 |

该冷页console无error，临时viewport恢复。截图 `knwonl-common-laser-2500.png` / `knwonl-common-laser-mobile-2500.png`保存在本聊天visualizations目录。没有替用户当前String of Fate标签页导航。

本批仅回归脚本和文档，未改前端或共享public媒体，因此不重复Vite构建；前一批 `0d3a1472` 的代码构建与144项门禁已通过。无部署。Unity内部粒子首帧调度、Color32字节量化、真实设备色彩与录屏逐帧仍未证实；9份旧悬灯非有限时间边界也没有因本次激光验收而解除。
