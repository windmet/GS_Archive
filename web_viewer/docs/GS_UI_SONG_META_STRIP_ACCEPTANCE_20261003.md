# GS 长歌名头部与通栏元数据验收（2026-10-03）

用户本轮明确指定方案二：“封面 / 标题上半部 + 通栏元数据底条”。它是本轮头部方案，与[上一轮响应式验收](GS_UI_SONG_RESPONSIVE_ACCEPTANCE_20261003.md)中本批自行选择的试听模式 B 不同；旧验收完整保留历史。沿用[UI 宪章](GS_UI_CONSTITUTION.md)。

**状态：源码、真实Detail SFC、code-only构建与独立tab15的fresh load歌曲目标旅程已通过；代码`05405c97`已独立commit / push。首候选与最终pin分开保存，服务日志中的3个旧hash404原样保留。本文随独立文档批提交。**

## Before / After / Why

| 真实样本 | Before — 实际Browser / 明确来源 | After — 最终实际Browser | Why |
| --- | --- | --- | --- |
| `mtples`，320px | hero183.25 / info156.50px；title75.60px、3行；kana32.99px、2行；meta41.92px、2行。meta仍在title信息列内。 | hero144.58 / info76.58 / cover72px；title16px、两行41.59px；kana11px、两行32.99px；通栏meta257.30×29.25px、单行。 | 长标题与元数据不再争用封面右侧的窄列，元数据改独立全列。 |
| `mtples`，390px | hero141.56 / info114.81px；title50.40px、2行；kana16.49px、1行；meta41.92px、2行。 | hero139.99 / info72 / cover72px；title18px、两行46.80px；kana11px、一行16.49px；meta327.18×29.25px、单行。 | 可用内容宽度变化时自然排列，不按标题字数强制缩字。 |
| `ossshd`及长名桌面 | 真实来源字段见下文；未将源码字段冒充已访问的Before。 | `ossshd`320 / 390同上述几何；两首1280均hero236 / info160 / cover160px，title28px两行72.80px、kana12px一行18px、meta558.74×29.25px；真实credits / breadcrumb / split保留。 | 不以单个短标题或合成日期替代真实样本。 |
| 短名、特殊版与780px | 对应实际After收据独立保存，不补造旧页面测量。 | `drvalv`320 / 390标题与底条各单行；`drv999`320三tags单行、日期自然第二行，44px parent按钮实点回`drvalv`；`mtples`780单列hero236 / info160、title24px两行，无body横向溢出。 | 不能说所有底条单行；更多标记与长内容允许自然增高。 |

## 源码范围与资料

本批只在歌曲Detail消费者中把meta移出title区域，作为header的独立全列：左侧tag、右侧日期，浅分隔线。标题 / 假名仍与封面组成上半部，保留实际图片与元数据含义。

手机heading采用 `clamp(16px, 5.3cqi, 18px)`，只随可用内容宽度变化；这不是按字数或语言判断的缩字逻辑。手机封面 / info基准72px，内容自然增高；kana为11px、较柔和但保留对比，实际字号 / 换行按上表记录。

| 真实code | 完整歌名 | 属性 | history优先的日期 |
| --- | --- | --- | --- |
| `mtples` | Multiple Entertainment Show! | Intelligent | 2022-08-31 |
| `ossshd` | OUR SONG -それは世界でひとつだけ- | Physical | 2021-12-19 |

日期仍优先使用历史资料；配置占位与未知日期沿用原合同。desktop真实credits、160px封面、资料 / 试听split及RO fit-only逻辑不改；不改模式、session、歌词时间轴或共享播放器。没有新增BPM或逐句歌手映射。

## 已有证据与验证边界

Before收据：[mtples320](../.analysis/ui-song-meta-strip-20261003/before-mtples-320.json) / [截图](../.analysis/ui-song-meta-strip-20261003/before-mtples-320.jpg)、[mtples390](../.analysis/ui-song-meta-strip-20261003/before-mtples-390.json) / [截图](../.analysis/ui-song-meta-strip-20261003/before-mtples-390.jpg)。两次实际页面均为旧`5204`版本，Before与新代码bundle分开记录。

首候选在 `.analysis/ui-song-meta-strip-20261003`，code-only构建22.09s / PID43740：320px底条已宽257px、单行容纳Intelligent / 完整混音 / 日期，但标题仍3行、实际字号16.60px、info99.73px高于80px封面。因此继续调整手机基准与clamp；该候选不作为最终版通过。最终证据另存 `.analysis/ui-song-meta-strip-final-20261003`，不能混用pin。

根代理已实际通过[真实Detail SFC回归](../scripts/verify-song-detail-presentation.mjs)；SFC / 来源字段合同与页面几何分别记录。最终代表收据：[mtples320](../.analysis/ui-song-meta-strip-final-20261003/mtples-320.json) / [截图](../.analysis/ui-song-meta-strip-final-20261003/mtples-320.jpg)、[390](../.analysis/ui-song-meta-strip-final-20261003/mtples-390.json) / [截图](../.analysis/ui-song-meta-strip-final-20261003/mtples-390.jpg)、[1280](../.analysis/ui-song-meta-strip-final-20261003/mtples-1280.json) / [截图](../.analysis/ui-song-meta-strip-final-20261003/mtples-1280.jpg)、[780](../.analysis/ui-song-meta-strip-final-20261003/mtples-780.json)；[ossshd320](../.analysis/ui-song-meta-strip-final-20261003/ossshd-320.json) / [截图](../.analysis/ui-song-meta-strip-final-20261003/ossshd-320.jpg)、[390](../.analysis/ui-song-meta-strip-final-20261003/ossshd-390.json)、[1280](../.analysis/ui-song-meta-strip-final-20261003/ossshd-1280.json) / [截图](../.analysis/ui-song-meta-strip-final-20261003/ossshd-1280.jpg)；[短名320](../.analysis/ui-song-meta-strip-final-20261003/drvalv-320.json) / [390](../.analysis/ui-song-meta-strip-final-20261003/drvalv-390.json)、[特殊版320](../.analysis/ui-song-meta-strip-final-20261003/drv999-320.json)。只列实际存在的截图。

## 最终构建、请求与提交

[构建输入](../.analysis/ui-song-meta-strip-final-20261003/build-input.json)为HEAD `aed2c2b2d0c9c6e836b4433c03f7dc50e9b72253`；[code-only构建](../.analysis/ui-song-meta-strip-final-20261003/build-check.log)记录`npm run build:check` exit0 / 17.72s，复用`.analysis/build-check`、public原位。[服务进程](../.analysis/ui-song-meta-strip-final-20261003/server-process.json)为PID54364；[RAM pin](../.analysis/ui-song-meta-strip-final-20261003/pinned-code.json)190代码文件，main `index-hcpuedsB.js` 534681bytes，SHA `d5d0bc4f73e71bc17154c1013bab1671a005029b8f7a567cd3ee9079a3a83e1a`；9个冻结来源 / App unchanged保持稳定。

[完整性收据](../.analysis/ui-song-meta-strip-final-20261003/verification-receipt.json)保留全部请求：68个成功`_app`请求均与pin SHA吻合；首轮所谓mismatch实际为3个不存在此pin的历史hash404（GashaDetail / SourceLink / CollectionText）。后续verifier只对成功code请求做SHA验收，3个failures原样保留、日志未擦除，不能写全服务零错误，也不能从服务日志推论这些请求属于哪个用户tab。独立tab15的fresh load歌曲目标旅程通过，[warning / error](../.analysis/ui-song-meta-strip-final-20261003/browser-warnings-errors.json)为空。

代码`05405c97`已独立commit / push；本批未重验实际播放或Chibi，不从布局 / SFC推论媒体输出。后续独立推进已选Compact的Dialog M与Story主次阅读入口 / 简介折叠 / 主线话级Tabs；原responsive、首次candidate失败及fit-only修正历史不重写。本文随独立文档批提交。
