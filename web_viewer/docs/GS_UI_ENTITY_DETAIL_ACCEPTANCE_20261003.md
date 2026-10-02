# GS Archive 卡池 / 歌曲实体详情一致性

2026-10-03。接续[卡池与摄影目录验收](GS_UI_GASHA_PHOTO_ACCEPTANCE_20261003.md)。本批使用[UI Foundation](GS_UI_CONSTITUTION.md)的文字与操作角色，保留卡池公告图、歌曲封面与播放区域各自的布局用途。

## 输入与范围

源码输入 HEAD `7361fcd1`；详情源码相对上一批 `93ca50a2`未改变。Before 使用已有 5199 服务（PID 11248），生产代码 RAM pin 清单在 `.analysis/ui-entity-detail-foundation-20261003/before-pinned-code.json`。该服务沿用上一批代码快照；不能把另一窗口后来重写的 `.analysis/build-check`当成正在预览的代码。

本批只迁移 `ArchiveGashaDetail.vue`、`ArchiveSongDetail.vue`与确实受影响的回归；共享来源、技术详情和关联组件只在这两个域内接入文字角色。Chibi、歌曲播放组件、谱面工具、Dialog M 密度没有迁移。

## 实看 Before

| 旅程 / 样本 | 观察 | 处理方向 |
| --- | --- | --- |
| `13000911`光彩的肖像，1280px | 实体标题18.88、章节14.08、日期10.88、关联说明9.76px，低于已迁移目录的可读尺度 | 接入实体、章节、正文、metadata角色 |
| 同一卡池，900px | 扣除侧栏后详情client729 / scroll752，固定420+280px双栏造成横向溢出 | 按详情实际可用宽度切换单列 |
| 卡池券 → 藏品详情 → 关闭 → Shell返回 | 焦点停在Shell返回按钮，未回到原券入口 | 为券入口提供既有恢复合同使用的稳定focus id |
| `ticket-deb052106f5e8533`，320px | 6thLIVE长名称可换行；无公告图、开放/结束未知及未收录卡片范围有明确说明 | 保留真实缺项，不补假公告或卡片 |
| `tfmvmt`长歌名，1280px | 实体24、章节15.04、说明11.52、组合按钮11.2、专辑链接12.48px；播放器有独立文字规则 | 详情正文接入角色，播放器保持独立 |
| 同一歌曲，320px | 无横向溢出；首次实装日期在三列统计中断为两行 | 窄屏首次日期独占一行 |
| `drv999`特殊版本，320px | 父作品链接11.52px / 高16.55px | 补齐直接操作字号、命中区和焦点 |
| `drvalv`展开声部归档，中文模式 | 49个个人声部姓名仍为日文原名 | 复用演唱成员已用的姓名显示投影 |
| `flslgt`声部的都筑圭 → 偶像 → Shell返回，320px | 主演唱名单与音频名单复用`idol-reference:007kei`；返回落在主演唱名单，音频归档已折叠 | 独立规划折叠内容与焦点恢复；加唯一id本身不够 |

证据目录：`.analysis/ui-entity-detail-foundation-20261003`，包含 `gasha-before-1280.jpg`、`gasha-overflow-before-900.jpg`、`gasha-ticket-before-320.jpg`、`song-before-1280.jpg`、`song-before-320.jpg`、`song-audio-names-before-1280.jpg`及`song-version-before-320.jpg`。中途一次目录输入操作被过渡中的焦点恢复打断；读取稳定DOM后正常完成检索，不作为已确认的应用缺陷。

## 改动与 After

卡池详情显式接入目录字体：实体22/700、章节18/700、正文14、字段12、辅助11px。原文标题是metadata；缺项和歧义说明独立使用正文角色。券入口14/600、至少44px，保留真实身份并提供`gasha-ticket:${ticket.key}`焦点标记。来源入口13/600，手机至少44px。横幅940:510保持，单列判断改用详情内容宽度；900px实测client729 / scroll729，溢出消除。

歌曲详情合并原来的三段scoped样式，接入相同实体/章节/正文/字段角色，窄屏首次日期单独占一行。父作品、专辑和历史来源入口13/600，320px实测高度约43.99px。长歌名可读换行；封面仍为桌面172、手机72px。独立播放器继续继承16px正文，实看其标题18.72、说明16px、手机padding14、桌面padding16×18；播放逻辑和组件文件没有迁移。

声部姓名使用主演唱名单已有的`performerReference`显示投影，标签切换保持既有偶像代码及来源数据。`flslgt`实看主演唱4人、音频49条，中/日切换即时更新已展开列表；原文阿斯兰长名完整显示，320px列表无横溢出。`drvalv`没有因收录49声部而变成49人固定演唱名单。

返回旅程实测：

| 已操作的路径 | After |
| --- | --- |
| `drvalv` → `drv999` → Shell返回 | 焦点回`song-variant:drv999`，外层详情scroll约1308px |
| 光彩的肖像1次券 → 藏品详情 → 关闭 → Shell返回 | 回原券`gasha-ticket:item:303427`，卡池scroll约272px |
| 同一卡池 → 幸福的象征卡片 → Shell返回 | 回`relation:card-011min_ssr03`；卡片自身没有在本批迁移 |
| 6thLIVE长名称 → 展开技术资料 | 无公告图、未知日期、零卡片关系保持；长逻辑id与JSON可换行，展开区无横溢出 |
| `1300036`7thSTAGE复刻详情，320px | 8个券入口、49个关联行；歧义说明与已确认复刻关系分开表达，长名称/徽标无挤柱或横溢出 |

首轮After使用PID32796，代码RAM pin在本证据目录。Browser随后发现来源标签换行及桌面窄摘要列的标题末字孤行，分别作局部修正：来源图标保持在第一行文字旁，站外说明单独一行；实体标题使用平衡换行。最终PID42072实看卡池1280、900、320px，900px仍为单列client729 / scroll729，320px详情client305 / scroll305。最终歌曲在新tab冷进入1280×720px，scroll0、封面已加载；其余行为和歌曲源码保持首轮After内容。

截图：`song-after-1280.jpg`、`song-after-320.jpg`、`song-version-after-320.jpg`、`song-long-audio-name-focus-after-320.jpg`、`song-history-focus-after-320.jpg`、`gasha-after-900.jpg`、`gasha-ticket-return-after-320.jpg`、`gasha-card-return-after-320.jpg`、`gasha-ticket-after-320.jpg`、`gasha-ticket-evidence-after-320.jpg`、`gasha-stage-after-320.jpg`。最终代码截图为`gasha-final-1280.jpg`、`gasha-final-900.jpg`、`gasha-final-320.jpg`及`song-final-1280.jpg`。首次歌曲320px截到正常加载层，随后在该层消失后覆盖为稳定页面；加载层截图不作为稳态验收。

## 验证

已通过相关源码回归：`verify-gasha-catalog`、`verify-gasha-ticket-evidence`、`verify-gasha-readmodel-navigation`、`verify-song-domain-landing`、`verify-archive-view-restoration`及`verify-archive-presentation`。后者覆盖61首歌曲、canonical identity、资料边界及20个模板。

新增`node --experimental-vm-modules scripts/verify-song-detail-presentation.mjs`运行真实详情与身份卡SFC：4人名单与49条音频、动态中日切换、缺译原名回退、点击原偶像代码、来源不可变。它是memory renderer证据；不能替代Browser布局/焦点或音频播放。VM实验提示是该测试运行机制。

`npm run build:check`共三次，均exit0：首轮输入HEAD`057ad87d`，Vite12.02s；Browser发现来源标签换行后修正，14.53s；再修正标题末字孤行后的最终输入HEAD`d041589b`，13.37s。每次重编译都有新的源码修正，复用唯一`.analysis/build-check`，`copyPublicDir:false`，未复制public语料。既有大chunk提示保留。

最终5199服务PID42072从最终构建加载代码RAM pin；`pinned-code.json`记录bundle字节和SHA256，Browser实际加载`/_app/index-BnT6jHRI.js`。`source-before-final-build.json`与`source-final-receipt.json`记录详情、App及tokens的源码SHA256，构建前后一致。HTTP日志同时绑定PID与read-model release，防止另一窗口的构建覆盖被混入本批Browser证据。截至最终复核，该PID的78条请求均为成功状态、绑定一个release；最终歌曲冷进入tab的warn/error日志为空。这仅覆盖已访问旅程。

HTTP静态资源使用本地public及`E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`原位映射，read-model release`d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。未生成完整发布包、未部署。本批未注入网络故障；读取失败/重试没有新增行为，相关覆盖仍以前批及源码请求身份合同为边界。

代码按域提交：卡池`a5b12520`，歌曲及其两份回归`31b49ebc`。验收文档单独提交；同分支另一窗口Chibi工作及无关未跟踪文件不纳入本批。

## 后续顺序与边界

接下来先处理歌曲折叠归档的返回状态，再逐域查看卡片、人物、组合和活动详情；后续处理共享QuickView/Solo与剩余筛选URL合同。每域继续遵循“实看内容 → 最小改动 → 回归/Browser → 独立提交”。不能由这两个详情页推定其他详情已验收。

主演唱名单大于5人的折叠分支在当前61首资料中没有真实样本；49个个人声部属于音频归档，不代表已确认的49人演唱名单。窄viewport不等同于200% Browser zoom或真实手机；这些覆盖仍未知。媒体状态文字或元数据响应不代表本批完成试听、长稳、真机或Chibi验收。

Dialog M三种密度仍待用户选择，保留生产当前密度；本批实体详情不依赖该选择。
