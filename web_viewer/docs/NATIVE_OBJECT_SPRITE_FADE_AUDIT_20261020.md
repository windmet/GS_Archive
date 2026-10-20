# Object_layer Sprite 透明度诊断（2026-10-20）

输入 HEAD `666caf3846d07084a4cbc86182f1eb29f22cdd5d`，分支 `stage/20261020-native-followup`。这是来源和消费者差异诊断，没有修改渲染器，也没有关闭 Sprite 淡入待办。RED HOT BEAT 烟雾接入保留。

## 已确认的问题

当前 `ChibiStageViewer.vue` 的 `objectLayerStatesAt` 把首次透明度设为 0，`sampleObjectLayerAlpha` 做线性插值，随后把结果放到父 Container。各 Sprite 自身又固定乘以序列化的 `instance.alpha`。

原生链与此不同：

- `ObjectLayer.PlaySprite`（`0x1c9e288`）激活子 GameObject，再对 SpriteRenderer 调用 `DOFade(1, duration)`，没有先把颜色 alpha 清零，也没有取消旧 tween。
- `Sprite.DOFade`（`0x18fc1e0`）绑定该 renderer 的颜色 getter/setter，走 `DOTween.ToAlpha`（`0x13f1a6c`）的 alpha-only 选项。它修改 Sprite 自身 alpha，不是给整组再乘一个公共因子。
- APK `resources.assets` PathID `106549` 的 DOTweenSettings 默认 ease 为 `6 / OutQuad`，RAW SHA `8d3f9175321a1d928661ae86b00359c65a13883539adffb10bcf8807f0ba15d4`。本轮重跑已有 APK/ELF 绑定校验，结果一致。`EaseManager.Evaluate`（`0x13eed70`）对应公式为 `-p * (p - 2)`。
- `EraseSprite`（`0x1c9def4`）调用 `DOFade(0, duration)`，完成回调 `0x1c9e114` 再停用子 GameObject。旧 tween 不会因新命令自动取消。旧 show tween 即使继续写颜色，也不能据此把已停用的 GameObject 自动显示出来。
- Container 预载先停用根 GameObject；已检查的创建/预载路径不清空 SpriteRenderer 颜色。所有 423 个来源 renderer 本身均 enabled，子 GameObject 的序列化 activeSelf 均为 true。根节点预载停用与子颜色初值是两件事。

二进制身份 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`；18 个相关原生函数范围及 SHA、46 组资源 bundle SHA、423 个 renderer 的 serialized file / PathID / RAW SHA / 初始颜色保存在 `scripts/fixtures/chibi-object-sprite-sources.json`。这份 fixture 不含纹理副本或运行时放行标记。

## 确定反例

| 曲目 / 对象 | 时间 | 原生链约束 | 当前 Web sampler |
|---|---:|---|---|
| `cfprde_live_effect` / `fx_in_cfprde_overlight_1` | 首次 show 8700，采样 9200 ms | renderer 初始 alpha=1，目标=1，所以无论缓动和首帧对齐都保持 1 | 父 alpha=0.5，子 alpha=1，最终 0.5 |
| `cfprde_live_effect` / `fx_in_cfprde_overlight_2` | show 完成后 9800 ms | 初始约 0.5882353，完成目标=1 | 子 alpha 永久乘 0.588235，最终仍约 0.588235 |

这些反例来自实际 SFC 状态函数和已核对的 RAW renderer，而非另写一个 Web sampler 代替消费者。`song_cfprde.unity3d` 与 `song_grwsml.unity3d` 的 Object_layer 原始命令重新解析后与当前编舞索引逐值相等；TextAsset 身份、payload SHA 和原始命令也进入 fixture。

## 范围与重叠普查

本轮范围为公共 object index 中的 sprite/mixed 条目，实际 46 组、423 个 renderer、129 条歌曲/对象轨道、2757 条事件。排除独立 APK built-in 消费者，不把这些数量当全舞台覆盖。

- RAW 初始 alpha：397 个为 1，8 个约 0.5882353，14 个约 0.7058824，4 个约 0.3921569；半透明初值来自 7 组资源。
- 50 条轨道能隔离出首次 show 的 alpha=1→1 反例；23 个歌曲/renderer 样本能隔离出渐变完成后仍被初始 alpha 限制的反例。它们是差异样本数，不是视觉失败率。
- 同一对象相邻命令有 544 次时间区间重叠；若计算全部未结束旧命令与新命令的配对，共 2824 对。两个统计口径不可混用。
- 没有 hide 尚未结束就收到下一次 show 的配对。现有重叠为旧 show→新 show 和旧 show→hide；这不意味着旧 show 可以丢弃，尤其是较短的新 tween 完成后，较长旧 tween 仍可能继续写颜色。

新反编译的 `TweenManager.AddActiveTween`（`0x18062e4`）、`Update`（`0x1807be8`）和 `ReorganizeActiveTweens`（`0x18077d0`）显示：按活动数组顺序更新，新 tween 追加；压缩空位按序向前搬移。静态控制流已经定位，但没有把它冒充完整原生逐帧执行结果。

## 下一步修复的证据门槛

1. 在固定 ELF 上获得颜色 getter 首次读取相对脚本派发、TweenManager.Update 的原生执行样本；至少覆盖首次 show、正常 hide、show→hide→show 时旧 show 尚未结束、短新 tween 完成后旧 tween 继续，以及活动数组压缩。
2. 根据上述样本实现每个 renderer 的颜色/active 状态。不能只换 OutQuad，不能把初始 alpha 永久乘在父层结果上，也不能默认“新命令取消旧 tween”。
3. 保持粒子 Play/StopEmitting 链和 APK built-in 分支的能力边界，分别验证；不能用本轮纯 Sprite 来源推断 CanvasGroup 或混合资源完整语义。
4. 修复后再做实际 Browser 的首次出现、退场、倒回、跨越重叠指令、切歌及刷新验收，保留原片/设备对照边界。

本轮没有应用半套透明度修复，也没有 Browser/原片视觉验收结论。

## 复跑与结果

```powershell
python scripts/audit-chibi-object-sprite-sources.py --native-elf <本机解密后的libil2cpp.so>
node scripts/audit-chibi-object-sprite-fades.mjs
node scripts/audit-chibi-object-sprite-fades.mjs --json
python scripts/verify-chibi-pinspotlight-prefab.py --native-elf <同一ELF>
node scripts/verify-verifier-coverage.mjs
```

来源收据生成后重新从 RAW/ELF 复核通过；只读差异普查返回上述 46 / 423 / 129 / 2757 / 544 / 2824 / 50 / 23。诊断脚本成功退出只证明诊断完成，不代表渲染通过，其输出明确保持 `open-runtime-discrepancies; native-frame-replay-pending`。

Ghidra 两次只读执行共反编译 16 个相关函数，全部成功；产物在本 checkout `.analysis/object-sprite-fade/`。源码门禁覆盖登记核对通过；本轮只增加独立诊断工具、来源收据和文档，按构建政策不重跑 Vite、不生成媒体包。没有修改 public、端口、候选、发布绑定或部署。
