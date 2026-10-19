# Pinspotlight 原生接线与 Study Equal Magic 验收

输入 `stage/20261014-native-fidelity` / `8c774bcb`，沿用5212 / PID61564。用户提供Study同一句「さぁ！始めようぜLessonを！」附近的存档和当前页面对照，优先排查6秒灯圈，不混入尚未接线的随机调度模块。

## 原因及统一修正

| 旧接线 | 本地来源 | 本批行为 |
| --- | --- | --- |
| 跟随灯圈乘`.62`、自由灯圈乘`.7` | APK LiveObjectPinspotlight root/两个子Sprite均scale=1；全部六种pinspotlight Sprite是512×512、100 PPU、中心pivot | 统一使用原生512设计像素与letterbox fit，删除两种经验缩放 |
| 人物地面减135 | `get_targetIdolPos` 0x22239a0调用Base目标父矩阵变换，再加up×150×PixelToCameraPos；ELF常量0x31734d0=150 | 在设计面使用约208.333325像素的原生换算偏移 |
| 自由坐标直接当人物坐标 | `Show` 0x2223ba8无目标时调用ScriptPosToCameraPos，而人物用ScriptPosToStagePos | 自由坐标按设计面stageScale/100换算，不再漏掉stageScale |
| asset替换蒙版和叠加亮光两张Sprite | `PlayEffect` 0x2223fec只给_maskSpriteRenderer（+0x30）set_sprite；flash（+0x38）只改颜色 | 蒙版按指令换图，flash保留prefab的pinspotlight |
| 绑定目标直接跳位置、自由坐标线性移动、线性淡出 | Show明确Ease.OutBack=27；Base.Update 0x22243d8在无Tween后才继续跟随；Hide杀旧Tween再DOFade；APK DOTweenSettings默认Ease=6/OutQuad、overshoot=1.7015800476074219 | 从旧投影位置移动，结束后跟随；隐藏时冻结位置、OutQuad淡出；重显恢复alpha，清空目标能解绑；seek重建 |

`LiveObjectContainer.Create` 0x221a470在SetParent后Identify实例，序列化_container绑定GameObject10178/Base。Base和其祖先初始scale=1，LiveStage.Prepare动态设置stageScale。1280×720设计面stageScale=float32(1000/720)，camera orthoSize=5，因此设计面每Unity unit约100像素；512px贴图显示为512设计像素。偏移150先乘PixelToCameraPos=float32(stageScale/100)，再经相同父层级到像素。不能把150直接当Web像素，也不能忽略父层级后凭截图改大小。

本批沿用固定1280×720舞台的响应式letterbox模型，不声称复原所有原机Screen宽高比。`chibi-pinspotlight-native-chain.json`记录APK/ELF哈希、方法字节窗口、常量、真实父链、全部Sprite及DOTween设置。重读命令：

```
python scripts/verify-chibi-pinspotlight-prefab.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
```

## Study 与影响范围

Study `steqmg_live_effect`：-2s建立离屏id1；2.9s/id2→站位2，4.3s/id3→站位3，5.8s/id4→站位4，均使用`fx_in_psblts_pinspotlight`；8.4s四灯Hide；8.7s开始id50自由灯，换用`fx_in_grwsml_pinspotlight`。背景环境色#221d23、开场alpha=.7来自RAW，本批没有为了画面更亮改环境值。

当前发布索引中20首歌、40份编排、7,146条Pinspotlight指令共用消费者。非Hide资源使用：grwsml 4,982、psblts 330、wchkpr 62、bnckgy 10、pavetl 1。本批修正公共链路，没有给Study增加曲名特判。

## 横查后仍需处理的灯光问题

- Laserlight缺native style时仍走旧Graphics画线；当前索引style1未绑定native模型，`hndmkh_live_effect` 26.55s的六条指令仍使用经验摆幅、三层线宽/alpha与重复衰减。Study的style3/7已走native粒子，不能把这个缺口误归到本次6秒灯圈。
- 旧悬灯仍有曲名能力守卫；Searchlight、Underlight、singlefoot等缺消费者，详见[总审计](STAGE_ASSUMPTION_AUDIT_20261015.md)。
- Spotlight无目标自由位置仍标unresolved；其淡出/中途重显还需按自己的原生Tween链核实。本批只收束Pinspotlight，不宣称所有灯光已原版一致。
- 粒子随机数、Unity积分、HDR/色彩空间与录屏压缩的差异仍保留验证边界；没有通过调环境alpha抵消这些差异。

## 验证

- 本地APK/ELF重读通过：真实_container/Base父链、全部六种灯圈Sprite、DOTweenSettings字段、方法字节窗口及常量一致。
- `verify-chibi-pinspotlight-sprites.mjs`：执行实际SFC的双Sprite消费者；独立Unity父层级换算、绑定/解绑、OutBack越界、初次Show、隐藏中重显、冻结位置、OutQuad、回拖及40编排7,146指令的四个时间点采样通过。
- `verify-chibi-spotlight-background.mjs`、`verify-chibi-spotlight-targets.mjs`通过，保留共享环境蒙版/排序/资源异步销毁回归。
- `npm run verify:source-batch`：144/144；Python py_compile、diff检查通过。
- `npm run build:check`：23.76s，通过；固定`.analysis/build-check`、copyPublicDir:false，仅源码构建，有既有大chunk提示。生成的无关审计与翻译元数据已恢复，未复制完整public库。

5212实际进程PID61564仍为当前stage工作树的Vite。read-model沿用`rm-native-relations-20261013` / release `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。Browser使用Codex In-app Browser/cua_repl；最终冷加载在构建及恢复生成元数据后进行。

| 旅程 | 实际观察 |
| --- | --- |
| Study 6s，1440×900 | 原生蒙版id1..4、alpha=.700；当前歌词与用户参考同句，宽软光覆盖扩大，保留原RAW环境色与亮度 |
| Study 9s → 回拖6s | 9s只剩id50..65的16个自由灯，旧id1..4隐藏；回拖恢复四个蒙版 |
| Study 6s，390×844 | 灯光继续按同一设计面投影；document.scrollWidth=390，无横向溢出 |
| 切Growing Smiles 72s → 切回Study 6s | 16个自由灯、5/5就绪、背景归属grwsml；返回后恢复Study四灯与steqmg背景，无旧背景残留 |
| Study从6s实际播放 | 动作预载完成后推进，35.4s暂停；再拖回6s恢复开场灯组 |
| 返回歌曲 | URL为`/songs/steqmg/?maintainer=1`，无song/stage残留查询参数；歌曲详情、S.E.M三人、试听和谱面表均实际加载 |

最终冷加载控制台无应用error，保留既有两条Spine tint/update警告。临时viewport已恢复。截图/console在`C:/Users/windm/.codex/visualizations/2026/10/15/01a13fa7-14e2-7682-9c89-a485261616a6/pinspot-*`。手机尺寸是Browser模拟；存档图与当前图的角色/服装及录屏条件不同，视觉对照支持宽度/位置问题修正，不宣称原机逐帧或最终HDR等价。

本批不部署、不合master。既有未接线的`src/core/chibiRandomMotion.js`保留未跟踪，不纳入灯光提交。
