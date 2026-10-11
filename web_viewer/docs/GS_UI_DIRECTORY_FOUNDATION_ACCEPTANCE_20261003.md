# GS 目录基础规则迁移验收

2026-10-03。基线`d0b6fc24`，分支`codex/chibi-stage-reconstruction-20261002`；最终构建输入`40ea551a`加本批五个组件的工作区修改。遵循[GS UI规则](GS_UI_CONSTITUTION.md)与[构建政策](BUILD_ACCEPTANCE_POLICY.md)。本批只迁移Shell搜索、人物/组合、歌曲和活动目录，不涉及Chibi、Reader正文、歌曲播放或详情密度选择。

## 观察与改动

| 模式 | Browser Before | After与理由 |
| --- | --- | --- |
| 移动搜索过小 | Shell人物搜索12.8px、外框36px；歌曲12.48px、外框38px | 输入16px、外框44px；桌面13px/36px。Shell展开行按44px+8px留位，顶栏100px，收起仍48px |
| 人物操作尺度不一致 | 320切换11px/36px、定位12px/36px、名册select12px/36px | 操作600；手机/coarse44px，短定位按钮也至少44宽；select16px。两列与48/38头像保持 |
| 字体和小字继承不一致 | 组合按钮Arial、metadata桌面10.56/手机10px；人物卡片按钮也缺显式继承 | 显式目录字体；组合名称14/600、metadata12/500；人物手机长名完整换行 |
| 英文计数与口径不清 | 组合目录members/cards/events | 位成员/张卡片/次团活。计数表达式不变；团活由`readmodels/lib/checkout_adapter.mjs`的`team_events.length`投影，未把属性/混合出演计入 |
| 新字号挤压统计 | 第一次新构建320出现“团活”拆词，卡片107px | 统计移到完整底行，三段各不拆词；最终Jupiter/High×Joker/Café Parade约85.42px，统计18px一行 |
| 活动表单/分页与目录角色不同 | 320输入/select12px/36px，分页UA13.333px/41.4px | 输入16px/44px、分页13px/600/44px；桌面输入13px/36px，明确字体继承 |

歌曲筛选桌面13px/600/32px、手机44px；演唱者12px、辅助文字和badge11px。保留手机72px歌曲行、52px封面、15px标题与单行省略，长标题可进入详情查看。活动保留178/126px横幅、430px堆叠和原始图像比例。人物定位的scroll margin随44px定位栏推导，避免标题被sticky栏遮挡。没有修改共享`archive-domains.css`或媒体图片组件。

五个组件script及所有模板数据表达式逐一与HEAD核对不变；除组合统计静态标签及包裹span外，模板未变。GS变量引用可解析；最终源码SHA-256在`.analysis/ui-foundation-domains-20261003/scoped-source-receipt.json`。

## 编译、代码和资源身份

- `npm run build:check`通过两次，13.52s与12.91s；第二次针对Browser发现的组合统计拆词修复。最终编译后本批源码哈希未变。
- 复用固定`.analysis/build-check`，输出只有`_app`、`audit`、`index.html`，未复制public/corpus。已有大chunk警告仍在。
- Browser验证生产bundle，5199最终QA进程42844；仅固定代码到内存，其他窗口重建不会替换正在验收的bundle。启动前核实旧进程归属，只重启自己的5199；其他服务未停止。
- 代码收据`.analysis/ui-foundation-domains-20261003/pinned-code.json`固定于`2026-10-02T21:07:45.496Z`，190份代码文件；`baseline-pinned-code.json`和`initial-pinned-code.json`保留前两版身份。
- 外部read-model继续原位映射`E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`，release为`d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`；HTTP路径、status、hash和release见同目录`http-requests.jsonl`。

## 回归记录

| 命令 | 结果与边界 |
| --- | --- |
| `npm run verify:portal-navigation` | 通过，返回上下文/深链/刷新/旧关闭抑制 |
| `node scripts/verify-archive-navigation-state.mjs` | 通过，57个scoped ref及1792个投影/URL用例；不是Browser实测数量 |
| `node scripts/verify-idol-unit-groups.mjs` | 通过，49身份/16组合、子集、同名与未知成员 |
| `node scripts/verify-idol-navigation-ux.mjs` | 通过，有无偏好偶像均进入同一人物目录 |
| `node scripts/verify-event-readmodel-navigation.mjs` | 通过，最新选择/路由超越/重试 |
| `node scripts/verify-domain-navigation.mjs` | 通过，共享URL/有界返回/typed选择与不完整日期 |
| `node scripts/verify-song-catalog.mjs` | 通过，默认命令，未带source-only；61首记录/12条MV关系。UI筛选展示其中60首primary作品；不等于逐首播放验收 |
| `node scripts/verify-event-index.mjs` | 通过，59项；不是全部活动媒体验收 |
| `node scripts/verify-song-domain-landing.mjs` | 既有断言失败：239行仍要求`:reference="entry.reference"`，未改动的详情现用`performerReference(entry.reference)`。用git show读取基线HEAD，确认同一正则也为false；未声称在HEAD另跑完整回归。没有扩改详情或测试 |

另做SFC style编译、脚本/数据表达式不变、变量绑定与diff检查。上述既有验证器不匹配仍需后续修复，不能称为全套回归全部绿色。

## Browser实际旅程

| 目录 | 覆盖 | 结果 |
| --- | --- | --- |
| 人物/Shell | 1280、320、390 | 49偶像/16组合；移动search16px/44外框、switch/rail44，W44宽，名册select16/44。320长名完整换行，0结果正确；Café Parade筛选5人。打开029ass实际资料后返回unit_filter=10，5条保留且焦点回`idol:029ass`；详情仍显示原文姓名，本批未迁移详情本体 |
| 人物定位 | 320 | S.E.M快速定位后，动画完成时栏底109.82、组合顶118.12，标题不被遮；不是使用点击后动画第一帧判断 |
| 组合 | 1280、320、390 | 16组合，目录字体取代Arial、metadata12；320/390统计18px一行，三段完整。Café Parade入口实际资料显示5成员、83卡片、2固定组合团活；计数口径一致 |
| 歌曲 | 1280、320 | 手机外框44/input16；筛选13/600/44；DRIVE A LIVE两badge均在72px行内，封面52。0结果正确；特殊版本1首，打开详情并返回恢复该筛选与`song:drvalv`焦点。Multiple Entertainment Show检索1首、详情完整标题、返回query与URL保持。桌面input13/36，筛选13/32 |
| 活动 | 1280、320 | 手机input/select16/44、分页13/44；59条分页1→2→3，末页11条且下一页禁用。无匹配0，query10012→1，THEATER/最早优先可操作；打开实际event410012详情并返回保留query与`event:410012`焦点。活动形式与sort恢复默认，未声称二者保留。桌面input/select13/36 |

以上已测视口无页面横向溢出。Browser warning/error读取为空。截图在`.analysis/ui-foundation-domains-20261003`，包括各域`*-before/after-1280.jpg`、`*-before/after-320.jpg`、`idols-long-after-320.jpg`、`idols-sticky-after-320.jpg`、`songs-long-after-320.jpg`、`events-long-after-320.jpg`、`units-final-320.jpg`及人物/组合390记录。最终恢复默认viewport，保留密度原型和目录验收tab供后续。

## 待续问题与边界

- 歌曲桌面顶栏和hero仍重复“歌曲档案”；已实际观察，应在下一小批合并页面身份与简介层级。
- 活动加载时全库统计暂显0；首次加载DOM已实际观察，尚未修复未知/真实零的区别。错误/延迟注入本批未做。
- 活动形式、排序和分页为局部状态，详情往返会重置；完整URL恢复后续独立行为批处理。歌曲搜索focus反馈也需单独复核。
- 藏品详情三个密度尚未选定；原型不导入生产App。卡池/摄影等剩余域、各详情本体、QuickView/Solo合同后续继续。
- 真实coarse设备、200% Browser zoom、非零safe-area、实际歌曲播放、完整媒体打包及部署未覆盖。320不冒充真机或zoom；Chibi由另一窗口负责。

## 提交记录

| 提交 | 范围 | 推送 |
| --- | --- | --- |
| `3588caa8e1787f9f87a82356626e752c61fc4940` | Shell搜索控件角色与移动展开高度 | 已推送 |
| `34758b31f26af4664a375817761350a24f8d1983` | 人物/组合目录字体、触控与窄屏统计排布 | 已推送 |
| `28e7697c023c317ab0bef60b41ebeba06ac01ab3` | 歌曲/活动目录输入、筛选与元信息角色 | 已推送 |

规范与本记录另以`docs: record directory foundation acceptance and next consistency batches`提交。各批只stage本任务的显式路径；Chibi、resource-audit、workflow及其他未跟踪文件保留。以上源码在最终build/Browser之后没有再修改，不为分批提交重复生成构建输出。
