# GO FOR IT!!：单人脚光接线

2026-10-23，输入 HEAD `be16cd4c`，`stage/20261022-particle-gaps`，主 checkout。延续 Center 嘴型的目标映射复查，发现 `Livechara_foot_color_solo` 仍标 missing；RAW census 共241行，全部属于 `gofrit_live_effect`。

## 原生依据

- `Livechara_foot_color_solo.PlayEffect 0x1f333c8`：value1 取原生角色列表目标（0为全部1…5），value2 HTML颜色，value3/1000透明度，value4/1000秒数，倒数高度为1000/value5。回调 `0x225927c` 调用同一个 `LiveObjectIdol.ChangeFootColor 0x221b678`。
- `EraseEffect 0x1f3353c` 与回调 `0x22592ac`：不是全员脚光的立即 Clear，而是白色、alpha0、倒数高度0，以 eraseDuration 再次调用 ChangeFootColor。GO FOR IT!! 的241行均为Show；Erase仅有原生函数和受控行为回归，不冒称有真实Erase行覆盖。
- 共用材质/OutQuad/并存 tween writer 使用既有原生 FootColor 求解器；未增加新的画面拟合参数。body替换色后再应用脚光。没有为接线改写曲目、骨架或纹理。

## 数据与消费者

新增 `public/data/stage-foot-solo.json`，31,424 bytes，工作树 SHA256 `e9c94260ecc013adcda0d361e5366f64e0d1c2013386c7b9478025a57cb38423`（Windows检出换行可不同，producer按JSON内容复核）。绑定 choreography 索引、曲目身份、原始TextAsset SHA256 `4a15f0c9137dd17d8838c418392f09f7963c87a217aa416ee0a5eaedb6390b4d`、bundle SHA256 `10d5949a224703620a2561f1834024196791ac454112ad435719db3473ee84a8`，保留源码行号与同时间行序。

producer检查全部118编排，只发布存在solo行的曲目。该曲没有全员脚光行；解析器仍按源码顺序合并两类，供同材质写入。普通曲目继续读取现有全员脚光，不被新表替换。

Viewer按原生槽位分别重放，再用 `stagePositionMap` 分配到各人的原生材质；不把solo光套到整个舞台或全员。可选数据晚到后在暂停状态重绘，绑定/HTTP/取消失败不安装成功。新增只读 `data-foot-solo-state` 诊断；灯光开关关闭时同时禁用材质效果并清空诊断。命令矩阵仅从missing改为partial，不宣称原机画面等价。

## 核对范围

同类目标审计确认：BodyColor和Spotlight/Pinspotlight在导出端已映射，Searchlight取位置回调使用原生槽→画面位置转换，动作/位置读取则反向转换画面位→原生槽。全员 FootColor 与 Offset 没有单人目标。本批补solo FootColor；上一批已修 MouthFix。

## 验证

- RAW verifier重新读取241行，重排列列名结果一致；包含2161条旧全员脚光和五套骨架单位/哈希回归。producer无写入重放一致。
- JS遍历241行的起点/中点/终点、5个原生目标，确认画面映射；受控混合全员/单人写入、独立Erase补间、倒拖、错版/取消/404，及实际SFC逐人材质传参通过。
- 首轮源码门禁166/167，失败来自 `verify-stage-initial-loading` 的旧替身没有新加载器，已补齐并定点通过；完整复跑结果补记于下。最终 `build:check` 24.93s，通过，仅固定E盘代码产物，不复制public。
- 原5213/PID25568的静态数据快照对新增URL返回HTML；核对监听和进程后仅重启此服务，现5213/PID72060、主checkout、候选 `rm-release-20261015`。新URL真实返回application/json/241行。没有改端口、部署或R2上传。
- Browser沿用手动5人编队，不作为原曲成员验收。1.9s原生槽4→画面1为灰色alpha.35，其余四人.6；2.3s画面2也变.35。桌面图 `foot-solo-gofrit-1900.png` 保存在本任务visualizations目录。播放按钮尝试未进入播放，不写成实播通过；启动/准备链路保留待查。

原生帧内DOTween时序、设备与原片逐帧验收仍开放。

最终补记：整批源码门禁复跑167/167通过；构建后审计元数据已恢复。最终代码冷重载后1.9s仍得到相同逐人状态，390×844下clientWidth/scrollWidth均390、材质状态一致，小图 `foot-solo-gofrit-mobile-1900.png`。3.6s颜色已向金色渐变至约RGB(.809,.691,.059)，中心alpha.3、其余约.237；回拖1.9s恢复。切FLASH LIGHT时独立脚光状态清空；console error结果另按实际日志核定，不将已知库warning描述为全会话无日志。

该Browser会话所查error为空。功能提交 `da9daac3`；随后以正常merge `9291a0f2` 接入 master `8e748036`（#85/#86门户批次）。上游未修改本批舞台消费者和求解器；合并后代码构建16.21s通过，完整源码门禁继续核对，不将合并前的结果冒称合并后结果。

合并后最终结果：源码门禁167/167通过，审计元数据恢复；仅重启已核实的本舞台服务以加载更新后的bootstrap插件，5213现PID62484、候选不变。独立冷入口动作预载88%后正常进入播放，观察10.7s，手动暂停18.4s，回拖1.9s恢复画面1 alpha.35/其余.6，ready=true。截图 `foot-solo-gofrit-master-1900.png`，该冷入口所查error为空。先前热更新期间的未启动现象未在此冷入口复现，根因仍不据此宣称已解决；不能把此次短片段实播扩大成全曲或原机帧步验收。
