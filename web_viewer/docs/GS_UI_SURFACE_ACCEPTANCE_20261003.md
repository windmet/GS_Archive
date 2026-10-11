# GS UI QuickView / Solo Surface 验收

2026-10-03，接续[活动详情批次](GS_UI_EVENT_ACCEPTANCE_20261003.md)与[UI Foundation](GS_UI_CONSTITUTION.md)。本批只修改 [CollectionQuickView.vue](../src/components/archive/CollectionQuickView.vue) 和 [ArchiveSongExperimentalPlayer.vue](../src/components/archive/ArchiveSongExperimentalPlayer.vue) 的消费者局部 CSS；两者 template / script 未改，App、共享 TerminalDialog、安全区 root tokens、Player HUD 和 Chibi 不在修改范围内。代码已提交并推送为 `467cbb38`。

用户本轮明确选择 Compact。两个 drawer 的普通间距按该选择整理；正式 Collection Dialog M 尚未迁移，不把原型选择写成生产详情已经完成。

## Before / After / Why

| Browser 实际 Before | After | Why |
| --- | --- | --- |
| QuickView 桌面实体名25px、字段标签14px，字体依赖 Noto Sans SC | 实体名22、字段标签12、字段值 / 正文14；显式 directory 字体，操作13 / 600 | 临时窗口也按实体、正文、metadata和操作区分角色，避免 Teleport 位置决定字体 |
| QuickView 窗口题20px、桌面480px宽；媒体容器高181.839px、宽406.16px | 窗口题20、宽480及上述媒体几何保持 | 迁移文字与安全区，不改变有效媒体比例或扩大详情密度范围 |
| QuickView 旧 sticky offset为−16px；展开原始资料并滚动后，实际 header top0、close top12，没有实测裁切 | 同旅程 header top16、close top28，完整查看按钮 bottom约872，小于900px窗口底部 | 为局部安全区和 header padding建立明确关系；本批不声称修复了旧版零 inset下的裁切 bug |
| Solo 手机根字体16px、Portal字体顺序，body padding18；header padding12×18 | directory字体 / body14，body与header左右基准16；名单内部gap5→4 | Compact普通间距与资料姓名角色一致；不改播放器模式、入口或内部HUD |
| Solo 320px input / select为13px / 44px | 手机 / coarse输入16px / 44px；1280px桌面保持13px / 44px | 表单文字与直接操作命中区分别按既有合同处理 |
| Solo 日文阿斯兰13px已能换行 | 姓名14 / 600自然换行、组合meta12，日文全文可读 | 增强主要姓名的层级；不把已有换行声称为本批新修复 |
| Solo 桌面480×900；320×900底部85dvh，约765px高、顶部约135px；名单两列、行高至少64px | 上述窗口与名单几何保持，窗口题20px保留 | drawer与mobile sheet具有不同内容职责，不套用720px选择窗或Dialog M尺寸 |

Before / After截图与DOM收据集中在本checkout的 [ui-surface-20261003](../.analysis/ui-surface-20261003/)。代表证据为 [QuickView Before](../.analysis/ui-surface-20261003/quick-before-open-320.jpg)、[After](../.analysis/ui-surface-20261003/quick-after-open-320.jpg)、[Solo Before](../.analysis/ui-surface-20261003/solo-before-open-320.jpg)、[After](../.analysis/ui-surface-20261003/solo-after-open-320.jpg)及[日文长名](../.analysis/ui-surface-20261003/solo-after-japanese-320.jpg)。

## 回归、构建与代码映射

以下三个回归已通过；本次文档整理没有重新执行测试或构建。

| 命令 | 覆盖边界 |
| --- | --- |
| `node scripts/verify-reward-presentation.mjs` | reward条件、typed reference、preview切换 / 关闭 / 销毁、重试与身份拒绝；不能替代窗口DOM行为 |
| `node scripts/verify-song-experimental-audio.mjs` | non-mounted实验音频数据 / 选择与同步合同；没有执行`--mounted`资源HTTP检查，也不证明实际播放 |
| `node scripts/verify-terminal-idol-localization.mjs` | 33个真实SFC场景、显示姓名 / 中日检索 / canonical身份等；SSR不证明native焦点、布局或播放 |

`npm run build:check` exit0，`built in 20.74s`。构建输入 HEAD为 `3770316e2d89b849ab2738bca8e0cae1fdcbe629`；这是提交前冻结源码所在的共享分支状态，和最终代码提交是不同事实。输出固定为本checkout `.analysis/build-check`，仅代码、audit与index，不复制public/corpus，不是完整媒体发布包。已有大chunk警告保留，见[构建日志](../.analysis/ui-surface-20261003/build-check.log)。

[build-input.json](../.analysis/ui-surface-20261003/build-input.json)与[build-output.json](../.analysis/ui-surface-20261003/build-output.json)的7个UI文件SHA一致：App、两消费者、ArchiveTerminalDialog、GS_UI_TOKENS、archive-terminal与archive-domains。输入收据已注明4个补充路径在构建期间补录并对照before-state；不能把这7个文件说成7个改动文件。文档整理时再次只读核对当前7个文件均与收据一致。

Browser使用5199代码映射服务，数据release为 `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`，资源原位映射，不复制媒体包。

| 代码映射 | PID / RAM pin | 主bundle与SHA-256 |
| --- | --- | --- |
| Before，沿用Event批旧pin | 19980 / 191文件 | `/_app/index-Cwx9BGd7.js`；`0c1d3cc081ab4b498ffe8e699c46eff770b9bb462906ae6d36bd2f84e5259c42` |
| After，本批代码pin | 63344 / 191文件 | `/_app/index-Dr_MWfA6.js`，534610 bytes；`adf3efe22b572a249823abcafd43c73d10f47f50780dc90e325fe75c005f80c6` |

代码收据见[Before pin](../.analysis/ui-surface-20261003/before-pinned-code.json)与[After pin](../.analysis/ui-surface-20261003/pinned-code.json)。其他窗口随后重建磁盘输出，After服务的RAM pin没有随之替换；不能把后来的磁盘bundle当作本次Browser代码。

## Browser实际覆盖

| 旅程 | 已确认结果与边界 |
| --- | --- |
| `410012`材料`item:41512`、100PT奖励`item:10401`打开QuickView，320px | 窗口仍处于Event URL；Tab / ShiftTab首尾循环、Escape、关闭按钮通过；关闭回到实际材料入口、inert解除。1280px遮罩点击关闭也通过 |
| QuickView展开原始资料并滚动 | sticky header、关闭与完整查看操作可达；Event背景宽 / scrollWidth305、scrollHeight6713、scrollTop2067.126在该开关旅程不变。完整查看按钮可达不等于已验证Collection往返 |
| `drvalv` Solo，320 / 1280px | 49人名单；阿斯兰查询1人，Café Parade筛选5人，无匹配0人；Escape关闭并回到入口，重新打开保留组件内query / unit；日文阿斯兰全文14 / 600换行 |
| Solo选择阿斯兰 | 即时选择并关闭，入口成为“当前 Solo · 阿斯兰·别西卜II世”，焦点回到入口；未点击播放，transport仍为0:00 / 2:10 |
| Solo开关及键盘滚动边缘 | 320px开关旅程背景宽305、scrollHeight2107、scrollTop116.782保持。另一次末端PageDown局部前后收据中body scrollTop1346.207，背景scrollTop119.540、scrollHeight2157保持；这是键盘边界证据，不是wheel / touch滚动验收 |
| Solo native Tab | After关闭按钮Tab进入搜索input；Before ShiftTab从关闭按钮到BODY尚未确证循环，本批不宣称完整native focus trap通过，也没有改共享native modal合同 |

相关收据为[QuickView焦点 / sticky](../.analysis/ui-surface-20261003/quick-after-sticky-320.json)、[关闭与背景](../.analysis/ui-surface-20261003/quick-after-closed-320.json)、[Solo筛选 / 选择](../.analysis/ui-surface-20261003/solo-after-selection-320.json)、[日文姓名与保留筛选](../.analysis/ui-surface-20261003/solo-after-japanese-320.json)及[键盘滚动边缘](../.analysis/ui-surface-20261003/solo-after-scroll-edge-320.json)。

## CSS安全区fixture

After的 [safe-area-after.html](../.analysis/ui-surface-20261003/safe-area-after.html)以`text/html`返回，HTML marker与computed root变量均确认top / right / bottom / left为47 / 24 / 34 / 32px；文件15146 bytes，SHA-256为 `ea5e4c769a422ff2c3178d7a3ff893601df5617d6ad827f4887a58527d1333c5`。这是Browser CSS fixture，不是硬件安全区验收。

| After fixture场景 | 实际padding与可达性 |
| --- | --- |
| QuickView，320×900 | dialog padding16 / 24 / 50 / 32；header顶部padding59；close约75–119px，完整查看bottom约838，小于安全底部866px |
| Solo，1280×900 | header padding59 / 24 / 12 / 32；body padding16 / 24 / 50 / 32，桌面贴顶窗口消费顶部inset |
| Solo，320×900 | sheet已有约135px顶部空隙，header top padding12，无重复安全区留白；左右与body底部仍消费inset |
| Solo，320×240短视窗 | header top padding22.931；关闭按钮约59–103px，top大于47px inset。公式`max(0px, calc(var(--solo-safe-top) - 15dvh))`只补85dvh sheet已有空隙未覆盖的部分 |

见[QuickView fixture DOM](../.analysis/ui-surface-20261003/quick-after-simulated-insets-320.json)、[Solo桌面](../.analysis/ui-surface-20261003/solo-after-simulated-insets-1280.json)、[手机](../.analysis/ui-surface-20261003/solo-after-simulated-insets-320.json)和[短视窗](../.analysis/ui-surface-20261003/solo-after-simulated-insets-short.json)。Before fixture尝试因QA helper把HTML返回为`application/json`而未生效，computed inset仍为0；[inset-fixture-boundary.json](../.analysis/ui-surface-20261003/inset-fixture-boundary.json)已排除它，不用Before截图证明非零安全区。最终After证据以实际HTML、DOM与HTTP收据为准。

## 完整性、剩余边界与下一批

`2026-10-03T02:20:39Z`的[acceptance-integrity.json](../.analysis/ui-surface-20261003/acceptance-integrity.json)记录278请求、0 HTTP失败、0 code pin mismatch、server stderr为0 bytes；[console-after.json](../.analysis/ui-surface-20261003/console-after.json)为`[]`。这些是该次pin与旅程的收据，不推定未访问资源全部可用。其他窗口的Chibi工作、resource-audit及无关dirty / untracked文件保留。

未覆盖真机、软键盘、实际touch / wheel、200% Browser zoom、长音频播放、source error / retry的Browser旅程、完整媒体打包或部署。320×240是短viewport，不能冒充软键盘；已有preview重试回归不能冒充Browser重试验收。QuickView完整查看后的Event焦点返回、RewardTable scope / page恢复和native Tab反向边界仍需独立行为批。

下一批按当前计划推进：Song / Event扁平资料行 → 正式Compact Dialog M → 剧情目录共同行、简介折叠与main-only Tabs → Mobile通讯局部list / header。后两次新增建议已经源码核对，仍是待Browser Before与实施的计划；不把source plan写成完成。Mobile只处理外围资料列表和header，不修改内部播放器；各批继续单独记录真实样本、受影响文件与验收边界。
