# Spotlight 原生字段、自由位置与灯圈缩放（2026-10-16）

输入 HEAD `315e8876`，分支 `stage/20261014-native-fidelity`，工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。5212 复用 PID 61564 的本分支 Vite；未部署、未写共享 public/assets。master ancestry 在提交前重新 fetch 检查通过。

## 已证实的旧问题

`LiveObjectSpotlight.PlayEffect` RVA `0x222673c` 的 value4AsInt 是自由 Y，旧导出却叫 duration；value6AsFloat 是根整体缩放，旧导出却叫 characterDepth，绘制遗漏缩放。Show 的移动时长来自函数常量 0.5 秒，不来自 value4。原生 TryParse 对空整数返回 0；旧默认 1 也不是原始值。

全部 118 编排共有 1,414 条 Show。原生 scale 原字段常见 900/1000/1050/1100/1200/1250；544 条 Show 的目标为 0，另有 3 条空目标。它们必须走自由坐标，不能标成未解析而跳过。Study 的自由 Y=10000 是将灯移出屏幕；32.1 秒 ID2 从绑定位置向自由位置移动，32.15 秒 ID3 在右侧出现。13.0/13.4/13.7 秒灯20/21/22缩放1.1；20.4秒灯2缩放1.2。wathon 93秒空字段灯53缩放0，保留原生默认而不补1。

## 原生链与实现

- Show `0x22262c0`：解除旧目标的+250排序，绑定新目标；隐藏状态第一次出现直接定位并重置alpha1，可见状态从当前位置移动0.5秒。默认Ease6/OutQuad，移动结束后SpotlightBase.Update追随目标。
- Hide `0x22265ac`：立即解除目标排序、取消移动，当前位置冻结，SpriteRenderer alpha使用OutQuad淡出。重现时重置alpha；回拖按完整历史重放。
- GetTargetIdolObj `0x1f29b84`：按target-1检索，目标0或不存在时为空，不绑定当前歌手。
- 自由位置使用原生PixelToCameraPos、原点(0,360)、舞台比例float32(1000/720)及100pixels/unit；Spotlight没有Pinspotlight的150偏移。
- APK prefab11425的两层Sprite/PPtr/局部矩阵保持原资源；材质231/232的Shader PPtr均950。沿用已反查的Mobile/Particles/Additive四边形、COLOR0 clamp和SrcAlpha/One混合。DOTweenSettings106549原始88字节位置为defaultEase6。

`src/core/chibiSpotlightTimeline.js`负责规范化来源绑定、时序与坐标；SFC只同步原生层、位置、scale和alpha。`data-spotlight-count/ids`计数已启用的原生渲染对象，其中可能含离屏灯；`data-spotlight-free-ids`另列自由灯，不能将这个计数理解成画面上灯圈数。

新增 `public/data/stage-spotlight-commands.json` 从60首RAW bundle生成118编排，绑定原choreography实际字节SHA256、bundle/TextAsset哈希和sourceRow。加载器要求此数据存在且来源绑定一致。共享旧index未修改；未来重新导出index时须一并再生成该数据并更新相关来源绑定，旧sidecar会拒绝不匹配的index。`prepare-live-chibi-assets.py`未来导出字段也已纠正，本批未执行媒体导出。

本地可重放：

```
python scripts/verify-chibi-spotlight-prefab.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
python scripts/verify-live-chibi-spotlight-order.py
node scripts/verify-chibi-spotlight-targets.mjs
node scripts/verify-chibi-spotlight-sprites.mjs
node scripts/verify-chibi-spotlight-background.mjs
node scripts/verify-chibi-character-layers.mjs
```

原生receipt记录APK/ELF哈希、方法字节窗口哈希、材质及DOTween设置；窗口不是一律完整函数。验证命令已实际执行，RAW跨家族9,484条排序通过；全库不存在同一物理站位同毫秒的Spotlight Show/Position命令。修复RAW读取编码名为utf-8-sig，保留BOM处理。

## 验收与边界

144/144源码门禁通过；`npm run build:check`完整代码编译23.77秒，copyPublicDir:false，固定.analysis/build-check，无完整媒体包。Spotlight回归覆盖RAW字段、空默认、scale、首显、追随、0.5秒OutQuad、自由离屏、Hide冻结/淡出、中断重显、回拖、开关、资源缺失/迟到销毁、加载器摘要和取消。

Browser插件在5212冷加载Study，检查6秒原Pinspotlight、13.7秒三Spotlight、20.5秒绑定/离屏、32.5秒切灯、49.4秒Hide后零灯；实播从32.1秒到约65秒并暂停，再回拖；390×844手机检查三灯及淡出，1440×900桌面检查右侧切灯。控制台无应用error，保留两条既有Spine tint/update弃用warning。返回歌曲检查URL与实际资料内容。小截图保存在本任务visualizations目录，文件前缀spotlight-native。

6秒用户存档对应Pinspotlight；本批补齐后续Spotlight，不能以不同时间或不同角色服装作逐像素还原证明。移动曲线数值由原生反查和回归证明，Browser实播/定点检查不等于Unity每帧一致性或真机验收。旧悬灯守卫、Searchlight/Underlight等缺家族仍在总审计待办；没有宣称所有灯效完成。
