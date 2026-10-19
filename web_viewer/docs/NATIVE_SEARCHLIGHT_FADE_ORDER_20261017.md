# Searchlight fade 顺序与 Take 星星层

用户对照原片指出 Take a StuMp! 1:10 附近应有斜向上轨道运动的大四角星。输入 HEAD `b89ca618`；工作树 `stage-native-fidelity-20261014`。

## 一、星星是哪一层

不是对象粒子。`stage-searchlights.json` 在 67.85–71.55s 之间对 30–59 号连续下发：

```text
67850 Searchlight_fade  30..32  200ms → 600
67950 Searchlight_show_2 30..59  fx_in_grwsml_pinspotlight  #cc66cc / #90ee90 / ...
67950 Searchlight_ovalmove 30..59  mode 5（单程斜向椭圆）
67950 Searchlight_rotateanim ...
71550 Searchlight_show_2 30..59  hide
```

`fx_in_grwsml_pinspotlight` 就是 ROUTE77 里那批“移动星星”的四角星贴图；30 个不同颜色/半径的 Searchlight 沿椭圆轨道斜向上运动，正是参考帧里的大星。

## 二、根因：fade 早于 show 被丢弃

原状态机只处理“已有状态”的非 show 指令：

```js
} else if (s) { if (command === 'Searchlight_fade') ... }
```

Take 的 CSV 把 `Fade` 排在 `Show_2` 前 100ms。fade 到达时状态尚不存在，被直接忽略；随后 show 按 `values[3]/1000 = 0` 把 alpha 设为 0，整批 30 个 Searchlight 从此不可见，直到 71.55s 隐藏。

修复：fade 在没有状态时也建立待定通道（带有限的初始字段），show 展开旧状态时继承该 tween。这样 70s 时 30 号 alpha=0.6，30–59 号全部按椭圆轨道可见。

## 三、验证

- 离线状态机（同一 `chibiSearchlights.js`）：70s 49 个状态、23 个可见，其中 6 个落在画面内（id 47–52，与参考帧数量一致）；修复前全部 alpha=0。
- `verify-chibi-searchlights.mjs` 新增“fade 先于 show”回归：`[preFade, lateShow]` 在 50ms alpha>0、500ms alpha=0.6；两种模式通过。
- 用户已在 5212 实际画面确认该帧正确。
- `npm run build:check` 与 `node scripts/run-verifier-batch.mjs`：见提交说明。

## 四、ROUTE77 剩余漏接

BFCache 干扰排除后，49s 现场：6 个对象层可见（fire_1/2/3、meter、turbo_1/2）、14 个对象粒子、6 个 Searchlight、`unsupported` 为空。

仍缺的消费者全部是同一个剖面问题：

| 资源 | 已消费 | deferred | 原因 |
| --- | --- | --- | --- |
| fire_1/2/3 | 6 | 12 | 9 noise + 3 stretched billboard |
| turbo_1/2 | 4 | 8 | 6 noise + 2 stretched billboard |
| swyrlv_leaf | 0 | 2 | 2 noise（整层不显示） |

合计 22 个系统（17 noise + 5 stretch）。这与全量目录里的 20 noise / 8 stretch 是同一批缺口；下一步按 libunity 反编译实现 Noise 位移与 Stretched Billboard，先把 ROUTE77 的火焰/尾焰/叶子补齐。

## 五、边界

- Searchlight 修复只改 fade 应用顺序，不改变椭圆/旋转/颜色语义。
- 本批未实现 noise 与 stretch；fire/turbo 仍是 partial，leaf 仍不可见。
- 随机种子仍为 Web 确定性种子；不宣称逐像素等价。
