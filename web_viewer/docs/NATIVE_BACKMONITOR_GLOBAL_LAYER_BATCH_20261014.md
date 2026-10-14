# 背屏与舞台全局分层修正

输入 HEAD：`7fe927f5`，分支 `codex/stage-chibi-wiring-20261013`。延续人物/Body/Foot 材质批次，本批不调整舞蹈，不部署。用户尚不能准确描述的其他灯光差异继续保留待办。

## 原版证据与修正

原版 `LiveStageNormalBackground.Init` 给三个固定 SpriteRenderer 赋予 stage_01/02/03，资源内排序分别为 1100、1300、1500。原 Web 合成整张背景置于 -20000、背屏父容器置于 -30000，无法表达背屏与静态前景的穿插。

`LiveObjectBackmonitor.PlayEffect` 将 value7 赋给 GrowSprite alpha、value8 传给 `SetSortOrder`（0x2218938）、value9 传给 Logo 设置。value8 零/空每次重置为 1000，并非沿用上一条。Movie 使用基准值，Back/Logo/Noise/Grow 分别为 -5/+1/+5/+110。932条 RAW 指令中，870条空值、43条1000、19条1250；现在解析并回放这些字段。同一 Movie 的重复命令不重置视频阶段起点，切换 Movie 才更新；这不证明异步加载时钟已与原版完全一致。

拆开55首原静态合成背景，155张原始 Sprite 的重合成像素与旧合成图逐张一致，PPU=100、中心pivot。54首能绑定三层模板；`syksai` 含未确认的第四层，整首保留旧排序，避免混合一半新旧层级。背屏使用共享 camera 的直接子节点，通过独立可见性所有者管理开关，使各层可以插入舞台前景之间。组件延迟到达时保留可用合成图，全部成功后原子替换；失败或过期加载不清空当前舞台。

从 resources.assets 的明确渲染器/材质/纹理引用导出 Back、Noise、Grow 三张 PNG。Noise 采用原片元公式 `1 + a * (texture * vertexColor - 1)`，RGB与alpha均 `Zero / SrcColor`；Grow 采用 `texture * vertexColor`，RGB与alpha均 `SrcAlpha / One`。普通 Pixi 加亮模式对alpha使用不同因子，GPU对照暴露并修正了该差异。原顶点着色器会把 COLOR0 钳制至0～1，因此脚本1.1不会被当作额外亮度直接传入片元。原始着色器摘要和可执行片元尾部保存在 [fixture](../scripts/fixtures/chibi-backmonitor-renderers.json)，验证器每次从 XAPK 重新提取，不能用手写公式自证。

暂停时 Logo/Noise/Glow 异步就绪、视频 loadeddata/seeked 会请求合并补画；回调核验 app 生命周期和当前视频归属。仅数据完成不应留下旧帧。

## 验证与产物

- `python scripts/verify-chibi-backmonitor-layers.py`：重新提取原版模板、渲染器引用、Shader混合状态/颜色钳制，核对3张PNG及源摘要。`--write` 可重建该小批派生资产及对应索引字段，保持紧凑JSON以符合12MiB传输上限。
- `node scripts/verify-chibi-stage-layer-order.mjs`：实际 SFC 异步消费者的原子升级/失败回退/旧owner丢弃、未知排序回退、可见性归属、排序重置/视频阶段及暂停补画生命周期。
- parser、backmonitor-controls/logo、image-colors（2177条命令、55首背景）、camera-reset、architecture-cleanup、native-body-paint、native-foot-colors 回归通过。
- `npm run build:check` 通过，26.56秒，固定 `.analysis/build-check`，未复制public。仅有既有chunk大小提示。
- 5212 Edge/SwiftShader 实际 Browser：DRIVE A LIVE 16.4s 的背屏1000和舞台1100/1300/1500；LEADING YOUR DREAM 0s 的背屏1250、噪点1255、辉光1360，均直接挂共享camera。390×844截图已查看。故意阻塞Noise PNG，暂停后释放，未强制render便观察到补画和画面变化。高级设置关闭/恢复背景屏幕不会隐藏静态舞台；播放、暂停、倒退到0后排序仍正确。
- 30组GPU对照：使用重新提取的原片元程序及原混合因子，对照当前材质的原始8位 framebuffer RGBA，包含透明/半透明/不透明纹理和alpha0/.5/.8/1/1.1，最大通道差0。不能据此推定Unity HDR framebuffer或真机一致。
- Browser当时记录3条 SongReadModel/StageReadModel `Expected JSON, possibly received SPA fallback`，未计作舞台层级通过。后续已确认是本批重启5212时丢失SIDEM_READMODEL_CANDIDATE造成，不能归为既有错误；已恢复原路径，见 [启动配置修复记录](STAGE_SONG_CATALOG_RESTORE_20261014.md)。Spine既有deprecated tint/update和ReadPixels性能提示仍存在。

截图/小型receipt位于 `C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/backmonitor-global-*`。构建/Browser日志位于当前checkout `.analysis/native-chibi-wiring-audit/`。

新增静态分层图保存在E盘既有public下；155张总计135,005,680字节，包含替代已有30张，新文件净增另见resource-audit。未在C盘创建媒体包。原5212进程的静态清单不认识新增PNG，已仅重启核验过归属的5212服务，端口不变，随后通过真实HTTP资源验证。未改其他端口。public派生资产被Git忽略，源码提交不代表在线已发布这些资源。

## 保留边界

背屏几何沿用现有有界注册。Base RectTransform localPosition与anchoredPosition的运行时关系、520×270原面片与272×144编码视频有效画面的关系尚未证实，本批不猜新偏移。原Base背景Sprite的纹理引用未确认，不新造整屏颜色。3条Passion Logo名称虽已解析，实际Logo override仍待接入。嵌套粒子、蒙版及透明深度/HDR链路继续反查，不宣称所有舞台图层或灯光已还原。
