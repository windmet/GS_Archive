# 人物、聚光灯与遮光层：第一批反查修复

输入 HEAD：307355dd，分支 codex/stage-chibi-wiring-20261013。用户要求暂存难以描述的剩余灯光差异，优先调查舞台图层和人物变色。本批从反编译定位排序和重复染色，不调整动作或猜测灯光参数。

## 原版链路和当前错误

反编译位于本工程 .analysis/ghidra-il2cpp：

| 原版方法 | 直接行为 | 修复前 Web |
| --- | --- | --- |
| pass1_annotated/Growing.Live.LiveObjectIdol.c，UpdateSortOrder 0x221ab58 | 人物 base + offset；影子 -10，另一关联 renderer +10 | 只应用 base，漏掉 offset |
| pass3_annotated/Growing.Live.LiveObjectSpotlight.c，Show 0x22262c0 / Hide 0x22265ac | Show 清旧目标后设置新目标 offset=250；Hide 立即清零，不等待灯束渐隐 | 没有对应排序状态，仅按目标对人物 tint 染色 |
| 同文件 SetSortOrder 0x22261b4，及 LiveObjectSpotlight.__c__DisplayClass3_0.c 回调 0x1c9ee44 | 写共享遮光层 depth，灯贴图 depth+1 | 遮光层固定 prefab 1900，灯 depth 少了 +1 |
| pass3_annotated/Growing.Live.LiveObjectPinspotlight.c，SetSortOrder 0x2223b40 / Show 0x2223ba8 | 同样写共享背景深度，灯贴图 +1；利用 mask，不提人物 offset | 掩模区间按固定背景深度判断，且额外给人物整体染暗色 |

Show/Hide、SetSortOrder 未修改人物颜色；人物着色另走 ChangeBodyColor 的材质属性。Web 已有遮光平面，却再次把环境色乘到人物上，会重复变暗，也绕过 Pin 掩模。

## 修复

- 增加纯时间轴排序回放，保留原版共享 offset 字段的写入语义：同一人物被两灯指向时，一灯 Hide 仍直接清零，不自行发明引用计数。换目标、自由目标、反向 seek 均重建状态。
- 人物和影子共同更新排序；异步动作完成后的 layout 也保留当前 offset，避免短暂退回基础层。
- 共享遮光层采用最近一次 Show 指令深度；Hide 不回退深度。初始 Clear 深度 1900；显式 0 有效。聚光灯贴图使用 depth+1。
- Pin 掩模区间判断使用实际背景深度，去除人物额外环境 tint；现有独立 Body_Color 继续生效。

当前发布索引中，两灯具家族没有“同一时刻不同背景深度”的冲突。若未来来源出现这种情况，需保留跨家族原始行序，不能用数组合并顺序替代。

## 验证和边界

行为回归：verify-chibi-character-layers、placement-shadows --published-assets、foot-lighting --published-assets、body-colors --published-assets、spotlight-background、spotlight-targets。覆盖基础深度变化、+250/恢复、共享目标直接写字段、影子、灯光开关、异步 layout、显式零、反向 seek、背景与掩模区间。

5212 现有 Vite 服务，实际 Edge/Playwright：Study 13.7s 三人分别 1950/2000/1950，背景1800、灯1801；15.2s Hide 恢复基础层，回退13.7s完全恢复；4.8s Pin 三个 mask，人物保持基础层、背景1850。Drive 31s 目标1950、背景1900，37.9s换目标后旧目标恢复1700。另验证390×844与播放/暂停；页面错误0。截图及回执位于 C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/stage-layer-*。

build:check 只编译源码，输出 .analysis/build-check，不复制 public，不部署。本批未证明所有舞台图层或原版视频一致。共享背景显隐计数/颜色/渐变、背屏层级、嵌套特效容器、材质深度测试、Body_Color/Foot_Color shader 映射仍在待办中。
