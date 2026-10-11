# GS UI Foundation 首批验收

输入 HEAD `89f61110`，分支 `codex/chibi-stage-reconstruction-20261002`。前一轮门户审计末批 `89278976`。本轮规则见 [GS_UI_CONSTITUTION.md](GS_UI_CONSTITUTION.md)，生产代码迁移四个试点与原生Terminal dialog的基础变量作用域，另批修复其首次Escape关闭。

## 基线与问题模式

| 模式 | 实际观察/源码边界 | 处理 |
| --- | --- | --- |
| 尺度由页面自行决定 | Portal 26px/850、Discovery 搜索13px/40px；目录间距9/13/14/15等重复决定 | 以语义角色接入统一字号、字重和spacing；品牌尺寸另有alias |
| 手机操作尺度不一致 | 320px Browser 藏品搜索实测约38px、12px字；源码中属性按钮宽28、chips32、select36 | 试点手机/coarse操作44px；输入16px；实际几何和新增占用需Browser验收 |
| 详情文字层级依赖挂载位置 | 1440px Browser 藏品实体25px、章节h3默认16.38px、字体Noto Sans SC；QuickView有domain-page祖先，详情Teleport没有 | 显式目录font/实体title22/章节section18/正文14/meta12，保持17px窗口题、580宽和当前density |
| 作用域丢失 | Terminal dialog在Solo消费者中离开archive-terminal根，safe/font/palette变量不能依赖其祖先 | dialog显式alias接root基础变量；Solo字体与480px宽实测正确，非零safe-area仍未知 |
| 搜索框吞掉首次Escape | 原生选择窗输入查询后，第一次Escape只清空search，第二次才关闭 | 独立行为批：阻止search默认清空，只关闭最内层dialog，恢复其trigger焦点 |
| 父级插槽控件漏接规则 | 首次新UI验收发现Story筛选中的3个父级select仍为12px/34px | 使用局部deep selector接入，最终320px实测5个select均16px/44px |

上述继承与safe-area问题不等于已证明真机刘海遮挡。旧基线预览是5199已运行的生产代码QA服务，pinned code时间`2026-10-02T19:34:17.356Z`；不把新chibi HEAD称为已在旧预览中验收。

## 验证记录

- `npm run verify:portal-navigation`：通过；返回上下文、深链、刷新及旧关闭抑制。
- `node scripts/terminal/verify-terminal-contracts.mjs`：40项通过；纯JS/源码保护/SFC脚本syntax，不能代替Vue编译与真机。
- `npm run verify:collection-catalog-session`：通过；加载/错误分离、重试、过期请求、typed identity及中日检索。
- `node scripts/verify-collection-route.mjs`：通过；kind、entity关闭/刷新、筛选/分页与返回。
- `node scripts/verify-story-catalog.mjs`：通过；1394条故事目录、投影与边界数据保持一致。

`npm run build:check`两次通过：首次13.77s；发现上述Escape和slot问题并修复后，最终13.93s。最终输入HEAD为`6f59dea3`加本轮源码修改；编译之后本轮生产源码未再变动。输出为本checkout固定`.analysis/build-check`，只有代码、audit和index，没有public/corpus复制。已有大chunk警告仍在，未把它报告成无警告构建。最终日志为`.analysis/ui-foundation-20261003/build-check-final.log`。

Browser使用5199代码QA服务，最终进程17964，只固定当前`index.html`和`_app`到内存，其他窗口重建不会替换这份已验收bundle。最终代码收据为`.analysis/ui-foundation-20261003/pinned-code.json`，固定时间`2026-10-02T20:32:46.448Z`。外部read-model原位映射版本为`d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`，无资源包复制；请求证据在同目录`http-requests.jsonl`。5198/5200等其他窗口服务未停止。

## Browser实际覆盖

| 旅程 | 视口 | 实际结果与证据 |
| --- | --- | --- |
| 主门户与入口 | 1440、320 | 标题26/23px、800；core90/82px；320无横向溢出。`portal-after-1440.jpg`、`portal-after-320.jpg` |
| 我的工作台→偶像选择 | 320 | 查询阿斯兰得1条长名称；无匹配查询得0；有查询时一次Escape只关闭内窗、焦点回到偶像trigger，再次关闭外窗回到工作台trigger。`escape-nested-focus-320.jpg` |
| 故事搜索与筛选 | 1440、1280、390、320 | 手机search16px/44px、5个select16px/44px；清空按钮44px；320/390无横向溢出。查询Multiple Entertainment Show得1、无匹配得0；折叠保留query，刷新URL query恢复1条。桌面slot select13px/36px。`discovery-filters-final-320.jpg`、`discovery-final-390.jpg`、`discovery-final-1280.jpg` |
| 藏品搜索与种类 | 1440、320 | 320 search16px/44px、tab44px、属性按钮44×44px、select16px/44px；四列道具保持；无横向溢出。中文/日文长名检索、0/1结果均核实。`collection-after-1440.jpg`、`collection-after-320.jpg`、`honor-long-320.jpg` |
| 藏品详情 | 1440、320 | 桌面外宽580、上限84dvh；实体22、章节18、正文14/meta12；手机长称号换行和关闭按钮44px。URL刷新恢复item303398；关闭清除entity且保留query。UI打开时背景inert、Tab首尾循环、关闭恢复所选卡片焦点。`detail-after-1440.jpg`、`honor-detail-320.jpg` |
| Solo选择窗 | 1280 | DRIVE A LIVE→49位Solo名单；480px宽、root字体与safe变量在terminal祖先外可解析。查询阿斯兰后一次Escape关闭，回到原Solo入口。未播放音频。`solo-alias-1280.jpg` |

生产页面上述旅程的Browser console warning/error读取为空。`detail-after-refresh-320.jpg`截于异步加载阶段，不用它证明详情已加载；后续DOM核实实际303398条目已经显示。通过URL刷新打开的详情没有原点击trigger，关闭焦点落到BODY；这是已记录的后续行为问题，不能称为已验证刷新后的trigger恢复。

本轮未实际点击生产/原型遮罩；背景关闭只核对已有实现，未记作Browser旅程通过。故事table视图、Reader往返、所有筛选的完整URL恢复也未在本轮Browser复测。称号2022/VDCP与阿斯兰组合曾返回0，未把单次结果推断成来源数据完整性的结论。

## 密度对照与后续

[详情密度原型](prototypes/gs-ui-surfaces/index.html)独立于生产App，包含9条真实GS记录与来源收据。Compact用紧凑资料账目、Balanced用正文/资料分栏、Reading-heavy用单栏正文与原文并读。默认编号1只是picker默认值，未选中或推广任何方案；选择后另批接入Dialog M。

当前535道具、1613称号。压力样本`item:303398`、`honor:30025116`以及长说明/多来源/来源未知均来自现有资料，不造获取条件。原型只保留每条至多6条原始来源样本，明确展示样本/本地记录口径，不宣称完整可获得状态。

原型三个版本分别在1280和320实际截图，见同证据目录`prototype-{compact,balanced,reading}-{1280,320}.jpg`。三种外宽均580px；320时单栏、无横向溢出、关闭44px，长内容在body内滚动。搜索0/1结果、长票券未知来源、101252长说明、10401多来源及样本口径6/208、来源筛选、单条原始记录和原始资料展开、语言切换、关闭/Escape/返回后的焦点、Tab在详情和picker内首尾循环、数字键1/3及R重播均通过；console warning/error为空。未执行真实390px原型或200% zoom验证。最终恢复Browser默认viewport并保留可操作预览tab供选择。

## 提交记录

| 提交 | 范围 | 验证依据 |
| --- | --- | --- |
| `9431ab99eb86f4cb9f63a5dd52758786e5d33c2f` | 语义token与main入口导入 | 最终整轮build:check；所有新增GS变量引用可解析 |
| `c554c31776de0777271c984721ee71e70464767e` | Portal/StoryDiscovery样式 | Portal/Story回归与Browser；template/script块未改 |
| `3d646fc2311fe702ce392b0f38f936402e3649c4` | Collection控件/详情与Terminal surface alias | Collection session/route回归与Browser；Detail template/script块未改 |
| `bb26c939e3f0d807e9f84a265e49f9bea08c5d5c` | native dialog首次Escape | 最终编译、Terminal40项回归；嵌套选择窗及Solo实际Escape/焦点旅程 |
| 本文所在文档/原型批 | Foundation规则、验收记录、三个独立密度原型 | 链接/内容/diff、静态语法与数据收据、三个版本Browser验收；无需再次构建App |

前四批均已推送origin同名分支；文档/原型批随后独立提交推送。源代码、原型与文档使用显式路径；其他窗口的Chibi文件、resource-audit与无关未跟踪文件均未纳入本轮提交。最终验收的本轮源码SHA-256另存于`.analysis/ui-foundation-20261003/scoped-source-receipt.json`。

本轮未覆盖真实200% Browser zoom、真实手机/coarse设备、非零safe-area与完整媒体打包/部署。Reader正文、Player HUD、Studio、QuickView的后续迁移仍未覆盖，Chibi由另一窗口负责。
