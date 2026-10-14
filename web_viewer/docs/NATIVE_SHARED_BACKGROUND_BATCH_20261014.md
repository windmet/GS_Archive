# 共享遮光层颜色、显隐计数与渐变

输入 HEAD：60594beb。继续图层反查；尚不能明确描述的剩余灯光差异继续暂缓，不据截图调参数。

## 反编译证据

`.analysis/ghidra-il2cpp/decompiled_pass3_annotated/Growing.Live.SpotlightBackground.c`：

- get_showingCount 0x1da2e30：LiveObjectContainer.GetComponentList<LiveObjectSpotlightBase> 后统计 visible。dump.cs 572705–572707 确认泛型参数；SpotlightBackground.__c.c 的回调 0x1cdabdc 读取 +0x20 visible 字段，两类灯继承同一基类。
- UpdateIfNeeded 0x1da3068：计数为1调用 Show，为0调用 Hide，大于1不改背景 tween。关闭一灯使计数从2变1也会调用 Show。
- Show 0x1da30d4 / Hide 0x1da3218：Kill 共享背景已有 tween，从当前透明度渐变到 _targetAlpha / 0。现有原始 DOTweenSettings 默认 ease=6（OutQuad）；本层 DOFade 未覆盖 easing。
- SetColor 0x1da2f98：只改变 RGB 和目标透明度。Ghidra 因分支跳板 0x1daa7a8 截断了函数，额外检查原始 ARM64：0x1da3000 保存 SpriteRenderer 当前 alpha；0x1da301c–0x1da3034 将新 RGB、旧 alpha 传入 UtilOhashi.AlphaSet（0x237d2e4）；0x1da3044 写回颜色，0x1da3048 写入 targetAlpha。不会自动把当前 alpha 改为新目标。

LiveObjectSpotlight.PlayEffect 0x222673c：普通 Show 的 duration 固定0.5秒，不是当前 Web event.duration（旧解析将 CSV value4 自由 Y 存入了 duration）。LiveObjectPinspotlight.PlayEffect 0x2223fec 使用 value4AsFloat；Hide 使用 eraseDuration。保留两类灯不同的背景渐变时长。原 prefab SpriteRenderer 为黑色/alpha0，_targetAlpha 为0.8，见 chibi-spotlight-background.json 源绑定。

## 修正

旧版从“最后一盏仍有 alpha 的灯”取背景颜色并乘该灯 alpha，因而会回退到旧灯颜色、错误绑定单灯退场、跳过独立背景渐变。

现在独立回放共享颜色、目标 alpha、每个灯对象 visible 和背景 tween；多灯仍共享同一背景，灯的视觉渐隐与 visible 标志分开。无效颜色（真实来源有 `800`）不覆盖已有颜色/目标。灯具排序和人物 offset 同样使用保留的 RAW 指令顺序。

准备脚本新增 spotlightCommandOrder，引用现有两组事件索引，不修改原事件。使用 `python scripts/verify-live-chibi-spotlight-order.py --write` 仅补写本地 choreography/index.json 的这个字段；非写入模式重新读取 RAW 并校验。118编排、9484指令的原事件与既有索引完全相等，指令顺序另对照直接 CSV 行序，避免用类型/ID排序代替原行序。

本地 index 属于被 Git 忽略的语料产物，需在后续正式资源发布时生成并发布；本批提交生成器与校验器，未部署。旧索引无此字段时兼容按时间合并，但不保证跨家族同时指令的 RAW 顺序。build:check 同步更新 config/resource-audit.json 的本地语料体积/摘要（新增约350KB元数据，无媒体增量）。

## 验证

通过 RAW 顺序核对、spotlight-background（含共享颜色、OutQuad、2→1/1→0、相同ID跨家族、相同时刻顺序、无效颜色、反向seek及实际SFC渲染消费者）、character-layers、placement-shadows、pinspotlight-sprites、spotlight-sprites、spotlight-targets、camera-reset、foot-lighting、body-colors、architecture-cleanup 与 resource-audit 回归。

build:check 完整代码编译通过，输出 .analysis/build-check，未复制 public。日志：.analysis/native-chibi-wiring-audit/shared-background-build.log。

5212现有服务、实际Edge/Playwright：Drive 16s alpha0.4，16.4s alpha0.2419753086，17.2s背景隐藏，31.2s alpha0.448/目标人物1950/背景1900，31.5s alpha0.7；回退与390×844同值。Study 13.2s alpha0.536，13.7s三灯时0.5，15.2s末灯开始关闭仍0.5，15.3s隐藏，回退复原；4.8s三个Pin掩模，播放/暂停后背景保持0.7。错误0。

截图与回执：C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/shared-background-*。这些是本地渲染与源码数值的对应证据，不是完整原版视频/真机验收。负时间初始化的完整原版调度仍未证明；当前发布的负时间Pin show时长均小于距0的时间，常规Spotlight固定0.5秒在起播前已收敛。背屏、嵌套容器、人物材质/Foot高度映射仍待反查。
