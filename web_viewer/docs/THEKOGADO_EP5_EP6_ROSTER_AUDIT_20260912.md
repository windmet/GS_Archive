# 虎牙道第三话 ep5 / ep6 人物状态核查

核查基线：`codex/p1-effect-texture-deps`，`9eb5e54`。用户提供的《核查状态机问题.md》是历史对话和观察记录；其中旧分支 SHA 不是本次切换分支的指令。此次以当前分支、磁盘源命令和实际页面为证据。

## 结论

两处缺人由编译器将 `idol_slidein` 误当普通 `idol_slide` 导致。普通移动只更新位置，不能使已隐藏的角色重新可见。`ScenarioState.snapshot()` 只发布 visible 角色，因此漣在淡出后虽然收到新坐标和动作，仍被过滤掉。不是 stage roster 的 replace/merge 错误，也没有依据修改全局坐标比例或 prefab 基线。

| 桥段 | 原始命令（0 基索引） | 修复前 | 修复后 |
|---|---|---|---|
| ep5 `e` 第30→31步 | 124 fadeout 漣；129 position -400,0；132 slidein 漣，delay 0.3、duration 0.2、target -200,0；136 对白 | 少年 +200；漣缺失 | 漣 -200、少年 +200，持续到36步 |
| ep6 `f` 第15→16步 | 64 slide 少年到+200；65 fadein 少年；67 slidein 漣到-200；80 对白 | 漣对白时只有少年 | 漣左、少年右；后续17–19步也保留应有的漣状态 |
| ep6 第26→28步对照 | 少年淡出后，二人分别 fadein | 双人能恢复 | 原人物状态不变，实际页面仍双人 |

## 实现与本地产物

- 分开 dispatch 普通 slide / slidein / slideout。slidein 恢复可见性并撤销待结算的退出；普通 slide 不改变可见性；slideout 保留退出步骤中的人物，在 snapshot 后隐藏，复用既有退出结算机制。
- 没有在渲染器里补 speaker 人像，没有修改模型、坐标系、台词或语音。此批只修复可见性，未调整旧 slide 的 delay、起始坐标、插值或缓动实现，不宣称位移动画逐帧对齐。
- 本地 `public/data/compiled/episodes/1_1_013_03_e.json`、`..._f.json` 以及合并篇 `1_1_013the_03_1_1_013_03.json` 已应用编译器的人物状态差量。e 只改30–36步，f只改15–19步；步数、身份、对白、语音、分段及其他状态保留。
- 这些编译产物按仓库规则被 Git 忽略。可复现脚本 `scripts/repair-thekogado-slide-roster.py` 在写入前对旧编译器行为、当前编译器行为、发布 episode 与 aggregate 做完整人物状态/台词/步数匹配；允许当前已修复值，其他漂移报错。当前编译器新增的开头 synopsis 不引入旧发布步号。
- 旧的独立 `scenario_*_compiled.json` 是不同步数的历史产物，本次未把它们作为门户验收路由，也未混入本次差量更新。

原始来源目录：`E:/BaiduNetdiskDownload/SideM/scripts/scenariodata/1_1_013the_03`。

| 文件 | SHA-256 |
|---|---|
| scenario_1_1_013_03_e.json | 77396cb5c1eb3f562ebe7d2b3d0e33bfce0d771ff6682acbd413870be3cf9a56 |
| scenario_1_1_013_03_f.json | b253ae1ffc3b5285ae1c193ef1877b6bb683b355bcc7c77382fca8e65f758288 |

重建本次差量：

```powershell
python scripts/repair-thekogado-slide-roster.py --raw-dir 'E:/BaiduNetdiskDownload/SideM/scripts/scenariodata/1_1_013the_03' --apply
python scripts/verify-story-slide-visibility.py --published
```

## 验证范围

- 状态机回归：普通移动不复活、淡出后滑入、滑入后持续、滑出后结算隐藏、滑入撤销待退出、其他演员不被替换。
- 发布桥段检查：e30–36、f15–16精确双人/坐标，全部 episode 与 aggregate roster 一致，f27双人 fadein 对照保持。
- 命令 dispatch 73项及 compiler package 10份冻结输出/provenance 检查通过；asset-plan、playback-range 通过。此次没有改前端源码，不需要重建前端 bundle。
- 实际 Browser / 本项目5175：修复前 e31「おい、オマエ！ ちょっと待て！」只有少年；修复后相同台词双人，下一段「ん？ 誰だ……？」双人持续。
- 从 f14进入后到 f16「ちょこまか逃げてねぇで…」实测双人；从 f26进入后到 f28「こら！ そこまでだ、おまえたち！」实测仍双人。1280×800截图可见左漣右少年，日志无应用 error。
- 当前没有取得原始存档视频文件；视频侧以用户记录的观察为线索，未独立完成逐帧位置/时序/音频复核。已证实并修复的是两处人物遗漏及后续状态持续，不能扩写为所有演出状态全面验收。

该具体缺人问题已先行修复。随后继续加载工作的首屏/后台任务生命周期分离；如继续精确位移动画核查，应使用上述 raw delay / duration / 起终坐标作为独立对照，不重新猜测人物集合覆盖。
