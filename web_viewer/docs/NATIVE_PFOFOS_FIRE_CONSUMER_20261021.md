# PROOF OF ONESELF：八路火焰空间拉伸接入

输入 HEAD `dfa496db`，分支 `stage/20261020-native-followup`。接续空间求解器、RAW 场景坐标及原生 Camera getter 的证据批次，本批把已验证数学接到实际舞台消费者，再晋升八组 `fx_in_pfofos_fire_1..8`。未部署、未上传 R2。

## 来源与消费者

来源 `song_pfofos.unity3d` SHA-256 `df476e543d448a3bd79faafa5431c0534d2d7f3e3019e815d5a1122052401a46`。八组各七系统：四份 Noise 预览、一份空间 Stretch 预览、两份普通系统，共 56 系统。新增三张 RAW RGBA PNG，其余纹理复用；原有 94 组模型和 110 份纹理描述逐项结构比较不变。

新 `chibiObjectSpatialContext.js` 从当前舞台相机、对象位置/尺度和来源坐标绑定构造原生空间输入；保留父链 XYZ、右侧 Y180 反射产生的深度符号、Stage 的 XY 缩放以及 Base/Camera 深度。原生四角转换回原来的局部模型单位后交给现有 Pixi 容器，避免重复应用舞台缩放。相机播放与 seek 共用 `currentCameraState`；环境缩放和视图缩放继续作为展示控制。

`chibiObjectSpatialBinding.json` 由实际 APK/managed 指令来源 fixture 派生，源码验证绑定其 SHA。只准入这八组、相同来源/父链/renderer 参数及 `pfofos_live_effect` 编排；该编排 152 条相机命令均为自由相机。未扩张为所有歌曲或任意相机的通用准入。

这八份 Stretch 是 1° cone、常量速度/尺寸，无 Noise、额外速度/重力、尺寸曲线或三维粒子旋转；同资源的其他 Noise 系统仍标记 `noise_preview`。晋升项锁定 RAW 系统来源及各系统 partial 集合，不能以资源级一个标记掩盖混合系统。

## 原生与资源验证

- 不带 `--write` 的来源重提取：102 资源 / 830 系统 / 113 纹理，deferred 0，PNG 与 RAW 像素相同。
- Native Stretch：92 顶点/UV 例及 16 份来源 renderer 重放一致；cone 2,304 例、真实 Show 位置与 Camera 目标姿势组合 1,664 例重放一致。
- 实际前端桥接重建上述 1,664 组原生世界角点，误差低于 `2e-5` 世界单位。八组共 104 个 Show，生命周期/延迟/回拖/冷定位与其他预览资源一起校验。
- 全局 partial 系统 105：89 `noise_preview`、7 `stretch_omitted`、9 `stretch_preview`。这不是 105 份全部原生等价的系统。
- Consumer 分片与目录来源/hash 校验通过；完整依赖闭包 4 个目录 + 458 分片，共 462 文件 / 33,468,397 bytes。后续发布必须包含这个闭包；本次没有发布。
- 无 consumer 缺口 18→10 资源、328→128 事件、8→7 编排。
- `npm run verify:source-batch`：167/167；`npm run build:check`：2,974 modules / 16.73 秒，固定 `.analysis/build-check`，未复制 public 语料。构建生成审计元数据已还原。
- 三张 PNG 的登记使台账为 209 releases / 1,384 stable IDs；419 PNG / 74,802,786 bytes。历史离线统计仅更新 PNG 两项，没有重生成覆盖其余统计。

日志在本 checkout `.analysis/pfofos-fire-source-20261021.log`、`.analysis/pfofos-fire-build-20261021.log`，缺口报告 `.analysis/pfofos-fire-coverage-20261021.json`。

独立的默认 mounted 总基线检查遇到已有剧情文件 `public/data/compiled/5_01_101_22.json` 非 Runtime v2 而失败；`--source-only` 基线通过。未修改剧情语料，也未把源码门禁通过表述为 mounted 总语料验收。

## Browser

Codex In-app Browser，本地 5213 / PID 70704、主 checkout、`rm-release-20261015` 候选、完整加载模式。沿用手工编队，不是原曲成员验收。

| 检查 | 实测 |
|---|---|
| 60,000 ms | 八组火焰可见，总对象粒子 457 |
| 60,100 ms | 八组火焰退场，其余对象粒子 165 |
| 60,900 ms | 八组重启并出现烟雾，总对象粒子 732 |
| 回拖 / 冷重载 | 60,000 ms 恢复 457 |
| 实播 / 暂停 | 从 60 秒实际播放，观测至 85.4 秒；暂停操作成功，DOM 为已暂停 |
| 实际舞台内切歌 | remasq→pfofos，60 秒 457；切回 remasq，旧对象清空 / 粒子 0 |
| 桌面 / 手机尺寸 | 1280×720、390×844；手机 document/scrollWidth 均 390 |

采样窗口 ready=true、unsupported/deferred 为空，console errors=0；不宣称 warnings=0。页面身份、非空内容及截图未见框架错误覆盖层。截图位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`pfofos-fire-60s-desktop.png`、`pfofos-fire-60s-mobile.png`、`pfofos-fire-60900-desktop.png`。

## 保留边界

批次提交 `d202c521` 后，普通合并 `origin/master` / `fc4baf45`（#75）为 `904e00d1`。该更新仅有 R2 历史记录与导出器 linked compiled 读取修正；没有在本舞台任务部署。合并后 emitter、发布台账、source-only 总基线、分片闭包与 preview transform 门禁补跑通过。

来源组合证明的是 Camera 命令目标姿势，不是原生 tween 中间帧历史。消费者继续采用明确的 Web 参考时钟；原生随机出生/Noise、设备帧调度、实际遮挡和原片整场景等价均未证明。还有十种未接入资源，不能据本批标记舞台还原完成。
