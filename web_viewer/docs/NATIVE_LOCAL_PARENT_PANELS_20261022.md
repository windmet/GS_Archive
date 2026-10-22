# 倾斜父链面板：運命光年与 VIVA!!ファミリーリズム

输入 `origin/master` / `aa987f40`，包含 #76 舞台前轮、#77 状态整理与 #78 剧情语料晋升。新分支 `stage/20261022-particle-gaps` 直接从该 master 切出，没有继续使用已合入的旧舞台分支；无关删除及未跟踪文件保留。未部署或上传 R2。

## 缺口与修复

重新执行动态覆盖清单，起点仍为 10 种资源 / 128 次事件 / 7 份编排。逐一从 RAW 重提取后确认：`fx_in_unmikn_panel_3` 两系统及 `fx_in_vvfmrm_panel_1` 八系统的粒子自身不含三维旋转，但父节点绕 X 倾斜。球形发射器的局部出生点/速度含 Z，旧二维矩阵丢掉了其对世界 XY 的贡献；直接解除提取器的“非平面父链”拒绝会继续画错位置。

新增 `emitterSpatialMatrix`，先组合完整 XYZ 父矩阵，再投影世界 XY；Local billboard 的纹理平面取完整矩阵前两列。只有带 `native-local-orthographic-v1` 来源证明的系统进入新路径；旧二维路径保留，原 102 组模型及 113 份纹理描述逐项不变。

准入绑定 bundle SHA、精确 serialized file / 字符串 PathID、参数树 SHA、完整父链、alignment 及原生 fixture SHA。只允许 Local/普通 billboard、统一粒子尺寸、无三维粒子旋转、Noise、Velocity/Limit 或重力的来源组合。没有放宽全部非平面系统，也未改 RAW 角度或添加逐曲视觉系数。

## 原生证据

`prepare-chibi-local-parent-fixture.py` 从实际 bundle 重新读取两个资源的十系统，沿已绑定 Unity ELF 的层级构造 `0x6cf028`、renderer context `0x6c505c` 和二维顶点 writer `0x81e2e0` 执行。每系统三种受控粒子角 × 三组局部 XYZ 位置，共 90 例；输出完整世界矩阵、顶点和 UV。

消费者在相同来源父链下用固定出生点采样，90/90 原生角点相符，阈值 0.003 px；旧二维路径有 54/90 例不符，均暴露非零局部 Z 的丢失。原有 62 例普通粒子旋转/父链及 17 份三维粒子来源覆盖继续通过。新生成器不带 `--write` 的原生重放也通过。

证据是静态父链、单位正交相机、无 pivot/flip、统一尺寸的受控粒子顶点；不等于原生随机出生、时钟、动态父节点、透视、遮挡或原片整场景验证。

## 资源与验证

晋升两组 / 10 系统，新增四张 RAW RGBA PNG；提取结果 104 资源 / 840 系统 / 117 纹理，deferred 0。105 个既有 partial 系统没有减少或重新标记。四张纹理仅增加 61,173 bytes，423 张 PNG 共 74,863,959 bytes；台账 211 releases / 1,388 stable IDs。

- 不写入模式的 RAW 来源重提取、PNG 像素、生命周期、冷定位/回拖与停止后回收验证通过。
- consumer 分片来源/hash/完整性通过：目录 72,095 bytes，共用输入 250,937 bytes，emitter 3,361,343 bytes；总发布闭包 4 个目录 + 460 个分片，共 464 文件 / 33,519,712 bytes。未发布。
- `npm run build:check`：2,974 modules / 23.83 秒，固定 `.analysis/build-check`，不复制 public；构建改写的审计元数据已还原。
- `npm run verify:source-batch`：167/167 通过；source-only 总基线、tracked binary inventory 和 publication ledger 单独验证通过。

本地日志：`.analysis/local-parent-build-20261022.log`、`.analysis/local-parent-source-20261022.log`；覆盖报告 `.analysis/local-parent-coverage-20261022.json`。缺口降为 **8 种 / 124 次事件 / 5 编排**，不表示全部原生还原完成。

## Browser

Codex In-app Browser，主 checkout 5213 / PID 58104，`rm-release-20261015`，完整加载；沿用手工成员，不作为原曲成员验收。桌面 1280×720、手机 390×844；页面内容和截图非空，未见框架错误覆盖层。

| 旅程 | 实际状态 |
|---|---|
| 運命光年 10 秒 | panel_3 在对象列表，总对象粒子 64 |
| 運命光年 16.2 秒 | panel_3 按命令移除，总对象粒子 11 |
| 運命光年 60 秒 | panel_3 再次出现，总对象粒子 63 |
| 回拖 / 冷重载至 10 秒 | 恢复 64 |
| 舞台内切至 VIVA | 旧对象先清空，随后 VIVA 正常就绪 |
| VIVA 0 / 10 秒 | 含负 2 秒启动的面板正常加载，总对象粒子 876 |
| VIVA 实播 / 暂停 / 回拖 | 从 10 秒起播，观测至 51.4 秒；暂停后时间轴 60.8 秒且显示已暂停；回拖 10 秒恢复 876 |
| 手机尺寸 | 两首均检查，document/scrollWidth 均 390 |
| VIVA 冷重载 | 重新定位 10 秒恢复 876，ready=true 且 unsupported/deferred 为空 |

采样窗口 unsupported/deferred 为空，console error=0；不宣称 warn=0。截图在本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`local-parent-unmikn-10s-desktop.png`、`local-parent-unmikn-10s-mobile.png`、`local-parent-vvfmrm-0s-desktop.png`、`local-parent-vvfmrm-10s-desktop.png`、`local-parent-vvfmrm-10s-mobile.png`。

## 剩余接线路线

| 资源 | 仍需处理 |
|---|---|
| jfhtmk_panel_1 | 同类倾斜父链之外，还有两个非等比粒子尺寸系统。初次 native 探针未正确构造该尺寸输入，未用于准入，也未据此改写原生期望值；继续定位原生输入合同 |
| pavetl_panel | 两个 shape=17 系统；需核对发射形状的原生 worker |
| pcuslv_bloom_1..4 | Velocity limit 的独立轴/拖曳组合，以及部分非平面 Local 系统 |
| tktkkt_electric | 寿命颜色模式、无发射模块的容器系统需明确处理 |
| bnckgy_fire | 容器系统、多个 Noise/Clamp 组合与 Stretch，不能直接套用 pfofos 的来源绑定 |

以上保留为缺口；没有为追求缺口计数将不完整资源登记成已接入。
