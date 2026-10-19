# Take 结尾 Logo：用 RotateSprite 实际网格替换固定透视公式

输入 HEAD `f7c92a39`，工作树 `stage-native-fidelity-20261014`。用户询问此前多次修改的 315/M 标志是否已经原版实现；当前答案仍是部分还原。本批修正其中的几何消费缺口，不把资源选择与 Animator 时钟一起宣布完成。

## 新反查与旧实现差异

解密 IL2CPP SHA `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`：

- `RotateSprite.Rotate 0x243595c` 与 `OnDidApplyAnimationProperties 0x24364d0` 使用同一套网格算法。
- `CalcAngles 0x24362e0` 对旋转角归一化，按四象限在 `[0,perspective,0,-perspective,0]` 间插值；不是整圈恒定的 tan(perspective)。
- `SetSprite 0x2435e38` 建立该五项角度表、原始与工作 MeshGeometry；`CreateMeshFromSprite 0x2436000` 使用 Sprite 原始顶点、UV、三角形。
- 顶点 X 为原始 X×cos(旋转角)，Y 为原始 Y×cos(透视角)+原始 X×sin(透视角)×sign(Y)。`CalcRotatedMeshCenter 0x2436418` 求对角线交点，Rotate 最后从顶点 X 减去交点 X。
- UV3 的齐次权重按每个顶点到交点的距离与对角顶点的距离之和/对角距离计算。它与顶点变形一起保持纹理中心轴；不能只搬动外接框中心。

此前 Web 用 `q=1/(1-x*sin(angle)*tan(10°))`，再缩放顶点与 UV。它能保持中心轴，但不是上述函数的数值实现。45° 时，原生局部 Unity 顶点左右 X 约 -3.685866 /4.799415，上边 Y 约 3.461844 /4.507713，旧固定透视公式不相同。

## 实际消费修正

`logoProjectiveQuad` 改用上述象限插值、顶点、对角线中心与 UV3 权重，按 float32 运算顺序保留关键舍入。输出从 Unity Y-up/UV 转为 Pixi Y-down/PNG UV，沿用现有网格与 Shader，不改 Logo 大小或加入视觉倍率。保留真实 float32 cos(pi/2) 的极小有符号宽度，不强制侧面严格为零。

源 Sprite 1832 的 RAW 顶点顺序实际为 TL/TR/BL/BR，坐标 ±6、±4。重放器从 APK 重新读取顶点、uvTransform、原始对象哈希与 unity data 哈希，不凭四角顺序猜测。模型自身 0.35 缩放仍来自现有 RAW 绑定。

## 原生执行与边界

新增 `prepare-chibi-logo-kernel-fixture.py`。Unicorn 直接执行 Rotate、CalcAngles、CalcRotatedMeshCenter、Math.Sign、Vector3 magnitude；在 MeshGeometry.Apply 入口收取输出，未替换顶点/UV 运算。初始化必要的托管对象布局与 metadata 标志，不启动整个托管运行时。

**外部数学 ABI 尚有证据边界**：当前解密 ELF 丢失原 PLT 重定位映射；按调用语义给 0xcd8910 /0xcda6e0 /0xcd93b0 提供 fmodf/cosf/sinf adapter，宿主 libm 结果舍入为 float32。不得把这项 adapter 假设写成已独立核实的导入名称，或声称完整真机浮点等价。fixture 明确保存此边界。

18 组角度包含 0、15、45、75、89/90/91、105、135、165、180、225、270、315、345、360、负角及跨圈。JS 实际消费者逐顶点/UV 对照通过；位置容差 1e-4 参考像素、UVQ 2e-6。保留独立纹理中心插值回归，不以重放一致替代固定轴检查。

## 验证

- fixture 写入后，无 `--write` 重读 ELF/APK 重放一致；18 组。
- `verify-chibi-backmonitor-logo.mjs --published-assets` 通过，包括原有渐变、中断、回拖、几何中心检查与新增原生顶点/UV 对照。
- 源码门禁 147/147 通过，日志 `.analysis/logo-native-geometry-source-batch.log`。
- `build:check` 通过，16.20 秒；固定 `.analysis/build-check`、copyPublicDir:false。保留既有 chunk 提示，生成的无关 audit/translation 变化已恢复；没有完整媒体包。

5212 Browser 插件使用原服务。构建生成/恢复期间页面发生重载，早期截图与操作不作为最终证据；随后重新冷加载验收：

| 旅程 | 结果 |
| --- | --- |
| Take01 冷载、完整模式、1280×720、110.1s | 45°、alpha0.8，实际标志可见；保存最终桌面截图 |
| 从110.1s预载后实播到118.1s曲末 | 自动暂停；回拖110.1s恢复45°和alpha0.8 |
| 同帧390×844 | innerWidth=scrollWidth=390，保存完整手机截图 |
| 回到桌面、110.9s | 189°背面相位；时间轴步长100ms，110350请求被控件取整并导致fill超时，未把该请求当90°成功证据 |
| 同页切Take02，110.1s | 45°、alpha0.8；随后切Change to Chance，angle空、alpha0 |

最终页 console error 空。AX 将页签按钮转述为 checkbox，初次按该角色点击未命中；读取 DOM 后用真实 button 完成切歌。临时视口恢复，临时标签关闭。

截图 `.analysis/logo-native-take-110100.png`、`.analysis/logo-native-take-mobile.png`。它们证明当前 Web 呈现与生命周期，不是原片同帧或真机验收。

## 仍需继续

previewSongs/指定视频白名单仍在；value9 资源选择、Passion override、Animator 的实际启停/相位与异步电影完成时钟仍待打通。原版 `SetLogoSpriteIfNeeded` 对空名、字典未命中、同名均不换图；本批只取得其代码证据，未把它接成新的换图消费。前述非平面粒子、全库无消费者及其它舞台指令缺口仍保留；未部署、未合主线。
