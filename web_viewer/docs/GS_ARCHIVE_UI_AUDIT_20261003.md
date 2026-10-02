# GS Archive 主门户 UI 审计与分批验收

日期：2026-10-03。初始 HEAD：`aa0ba5b1`，分支：`codex/chibi-stage-reconstruction-20261002`。

## 范围与约束

本轮按用户附件指导安装 [emilkowalski/skills](https://github.com/emilkowalski/skills)，审计主门户、11 个栏目入口、栏目导航、启动设置和偶像选择路径，并修复已确认问题。chibi 舞台由另一窗口负责，本轮不编辑、不暂存其组件、坐标工具、package.json、工作流或工作记录。沿用共享分支，提交前重新检查 HEAD 和暂存区。

GS UI 约束：

- 保留游戏式首页、档案正文、薄荷绿身份；真实资料与主路径优先。
- 审计修复只删除、调整、统一、重排和修复；新增功能或信息单列提案。
- 不新增营销副标题、重复 badge、每块的 kicker/title/description、无用途动画或玻璃装饰。
- 技术证据留在折叠区；保留解释真实行为、来源和错误恢复所必需的信息。
- 主观布局方向需要比较时使用隔离 prototype，经用户选择再整合。本轮明确的检索和导航修复无需设计选型。
- 将源码检查、Browser 渲染、模拟视口、真机、媒体播放与发布验收分别记录。

安装使用系统 `skill-installer` 的 GitHub 安装脚本，14 项位于 `C:/Users/windm/.codex/skills/`：emil-design-eng、break-ui、mobile-native、prototype、animate、animate-expo、animation-vocabulary、apple-design、ask-sonner、find-animation-opportunities、improve-animations、pick-ui-library、review-animations、write-swift。下一轮可自动发现；本轮直接读取安装文件。重点应用前三项，动画专项后置。

## 审计发现

Product Taste Review 只读提出候选，Browser 确认后再实现。表中“源码风险”不冒充已复现的真机缺陷。

| ID / 级别 / 证据 | Before | After / 处理 | Why |
| --- | --- | --- | --- |
| UI-01 / P1 / Browser | 中文模式下，门户工作台→选择偶像，搜索“阿斯兰”显示 0；名单仍是日文姓名 | 首批：复用 App 既有名称显示、中文别名与日文原名检索回调，透传到门户、启动页和选择器 | 同一偶像 ID 应可从两种资料语言找到；不新增翻译或改写来源 |
| UI-02 / P2 / Browser | 桌面侧栏仅有首页，门户没有对应选中项；手机有首页/资料馆 | 首批：两种布局复用现有首页/资料馆目的地，保留栏目合同 | 明确当前位置，并可返回原目录筛选 |
| UI-03 / P2 / Browser + 附件约束 | 门户有“故事与音乐，偶像与回忆。”；中英文重复分组标签 | 首批：删除营销副标题及 CORE/RECORDS/TOOLS 镜像标签 | 减少不帮助检索的文字，保留分组与内容范围描述 |
| UI-04 / P2 / Browser 390×844 | 启动设置先显示较大的制作人姓名设置，再显示启动入口 | 第二批：现有姓名设置移到模式选择之后 | 可选个性设置不应挤掉主路径 |
| UI-05 / P2 / 源码风险 | 门户和侧栏 hover 未按输入能力限制；门户已关闭 tap highlight，部分控件缺少按下反馈 | 第二批：hover/fine 查询与局部 active 反馈 | 触摸状态需要在真机检查；不增加装饰动画 |
| UI-06 / P1 候选 / 源码风险 | 门户小屏 padding 覆盖共享左右 safe-area，且没有顶部安全区 | 第二批接入安全区；第四批修复 901–1150px 与目录顶栏后续覆盖 | `env()` 接线能做源码验证，刘海/地址栏/键盘仍待真机 |
| UI-07 / P2 / Browser 链接 + 源码 | 卡片目录“资料馆”面包屑实际链接首页 | 第三批：统一根面包屑到既有资料馆门户 | 不以侧栏修复掩盖另一条路径的含义冲突 |
| UI-08 / P2 / Browser 320×740 | 全员名册搜索唯一长姓名时占半宽，姓名省略；全员模式也仅单行 | 第四批：唯一结果跨满两列；手机 roster 姓名可换行，全员保持两列 | 用已有空间显示真实姓名，不让触屏用户依赖 hover |
| UI-09 / P2 / Browser | 实验室入口有“把视口留给谱面、构图与舞台。” | 第四批：删除这一副标题，保留三项入口及用途说明 | 与门户的文字约束一致 |
| UI-10 / P2 / Browser + 源码 | 互动入口已显示译名，但中文模式通信标题/下拉名单仍为原名 | 第五批：既有名单改为 computed，复用 App 名称显示逻辑 | 保持同一资料语言下的人物身份显示一致；不改原文台词 |
| UI-11 / P1 / Browser 390×844 | 摄影地点详情链接刷新后，详情标题落在约 811px，底栏之前无法看到详情 | 第六批：成功加载清除 busy、等待详情挂载，再定位仍匹配的明确 key | 详情链接应抵达所选资料；保留迟到请求与卸载保护 |
| UI-12 / P1 / Browser | 表情/动作换偶像后 URL 只有 photo_idol，刷新回到地点 | 第六批：新偶像成功加载后保存其首条真实预设 key；自动补 key 不新增跳转 | 分类和人物身份应能随 URL 恢复，不保留旧偶像的预设 |
| UI-13 / P2 / Browser | 中文资料模式下摄影偶像下拉仍显示日文姓名 | 第六批：用真实 idolCode 调用既有姓名显示回调，缺译回原名 | 与门户和通信名单一致；选择值仍为来源数值 ID |
| UI-14 / P2 / Browser 840×820 | 活动 Reader 的深夜主题出现亮白活动条，父文字色仍为亮色 | 第七批：背景、边框和链接复用既有 Reader 主题变量 | 阅读主题应覆盖正文上方的活动上下文，不引入新配色 |
| UI-15 / P2 / Browser AX + 源码 | 故事浏览方式标为 tablist，但按钮没有 tab 或选择状态语义 | 第七批：沿用按钮操作，改为 group 并绑定 aria-pressed | 辅助技术能知道当前模式；原生键盘操作无需新增 tab 模型 |
| UI-16 / P2 / 源码风险 | 主线目录卡 hover 位移 -1px，活动故事卡位移 -2px；主线无 reduce 分支，触屏 hover 未门控 | 第七批：删除两处位移和不再使用的 transform transition，保留边框/阴影与既有 reduce | 高频资料目录无需移动卡片；触屏粘滞未实测，不声称已复现真机故障 |
| UI-17 / P2 / Browser 390×844 | 通信等待回复时“下一段”仍可按，实际不推进 | 第八批：等待 choice 时沿用 dock 的 disabled 状态；回复后恢复 | 控件状态应解释下一步，回看仍可用 |
| UI-18 / P2 / Browser 390×844 | 中文正文的文字消息使用译名，末尾贴图使用原名，标题把同一人列成两名参与者 | 第八批：贴图显示姓名优先使用已有 localization 结果，来源身份继续沿用 stamp/raw | 文字和贴图属于同一人，不改头像、贴图或台词 |

## 首批验收

输入：初始 HEAD 加首批门户修改；共享工作区还包含另一窗口的 chibi 未提交改动。完整代码编译包含当前工作区，不将其写成 chibi 或媒体验收。

- `npm run verify:portal-navigation`：通过，保留返回上下文、刷新和旧导航失效保护。
- `npm run verify:archive-startup-route`：通过。
- `node scripts/terminal/verify-terminal-contracts.mjs`：40 检查通过。
- `node scripts/verify-terminal-idol-localization.mjs`：9 个真实 SFC 渲染场景通过，使用真实来源字典、实体 overlay 和现有 App 回调；覆盖两语言下的原名/译名搜索、摘要、空结果及原文 fallback。
- `npm run build:check`：2771 modules，13.09s；固定 `.analysis/build-check`，`copyPublicDir:false`。保留大 chunk 提示，未复制媒体全库。
- Browser 使用 Codex In-app Browser。先观察既有 5198；独立 5199 预览映射同一固定生产代码、原 public 和已验证 `song-discovery-readmodels-20261002`，release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。
- 新建源码 dev 服务曾 HTTP/Browser 导航超时，已仅停止本轮服务，改用独立生产代码映射；原 5198/5200 未关闭。超时 tab 不计作页面失败证据。
- Browser 320×740：中文“阿斯兰”和日文“アスラン”各找到同一条；长姓名完整可读；无结果显示 0；分页从 12→24→36→48→49。
- 日文显示模式搜索“阿斯兰”仍找到原文 `アスラン＝ベルゼビュートⅡ世`，再切回中文。
- Browser 1440×900：卡片 SSR 筛选→侧栏资料馆，选中项 `aria-current=page`；刷新后返回来源页，保留 `rarity=SSR`。

证据目录：`.analysis/ui-audit-20261003/`。包含桌面门户、移动启动基线、320px 长译名截图及 HTTP 小日志，不提交媒体或构建树。

## 覆盖边界

| 路径 | 已打开 | 已交互 | 未覆盖 |
| --- | --- | --- | --- |
| 人物首页 | 1440×900 | 打开故事栏目 | 长语音、全偶像、真机 |
| 资料馆门户 | 1440×900、1024×600、768×1024、390×844、320×740 | 栏目/设置/选择器/语言/返回/刷新 | 壁纸缺图与网络错误注入 |
| 启动设置 | 1440×900、390×844、844×390 | 入口重排、选偶像、启用确认、返回 | 保存后所有启动组合；本轮没有改保存的启动方式 |
| 偶像选择器 | 320×740、390×844 | 中文/日文/空结果/49 人分页 | 真机键盘、超大文字设置 |
| 故事目录、Reader 与代表 Player | 1440×900、840×820、620/760/840×820、390×844、320×740 | 分类/全部检索键盘切换、主线本话两 EP、中文/篇内查找、Player 短程/中文/菜单/返回、活动 Reader 四主题及档案往返 | 完整音频/长稳/全剧情；集合页 1440px 截图右缘裁剪经 DOM 排除布局溢出 |
| 卡片目录 | 1440×900、390×844 | SSR、门户返回 | 全卡详情、资源错误恢复 |
| 歌曲目录与代表详情 | 1440×900、320×740 | 60 首目录、MV LIVE 唯一结果、Reason!! 详情、面包屑 | 音频、视频、谱面工具与导出 |
| 偶像目录 | 1440×900、320×740 | 49 人/16 组合、全员、两语言、0/1/49、长名与键盘焦点 | 全偶像和组合详情、真机键盘 |
| 卡池目录与代表详情 | 1440×900、320×740 | 82 条目录、全员系列 2 条、PRS 49 张推定关联详情 | 全卡池/公告/道具路径及关联来源复核 |
| 活动目录与代表详情 | 1440×900、320×740 | 59 条、白色情人节 2 条、2023 详情 0 张报酬卡/51 条奖励 | 奖励全部分页、全部活动来源 |
| 互动入口与通信目录、代表 Player | 1440×900、390×844、320×740 | 入口选偶像、不保存快捷、个人/电话/随机分类、中日文姓名、个人通信回复→贴图→完成→同偶像目录返回 | 电话/组合 Player、随机话题预览、全偶像/Connect、完整语音和真机 |
| 藏品目录与详情弹窗 | 1440×900、320×740 | 道具、1,613 称号、空结果、偶像筛选 2 条、长姓名称号弹窗 | 全藏品详情、来源证明与冷加载错误恢复 |
| 摄影资料 | 1440×900、390×844、320×740 | 133 个地点、spots:2 详情/刷新定位、表情/动作换偶像与刷新分类、49 人中日姓名、空结果搜索 | 其他摄影分类、编辑器与导出；手机嵌套滚动待真机评价 |
| 实验室入口 | 1440×900、320×740 | 三项入口与用途说明、删副标题后复查 | 编辑器/谱面运行；舞台归另一窗口 |
| 资源状态页 | 1440×900、320×740 | 当前/历史快照边界可读 | 导出、实时 R2、发布与媒体完整性 |
| chibi 舞台 | 不属本轮 | — | 交由另一窗口 |

本表只说明实际覆盖，不能据此声称全站、200% 缩放或真机完成。页面的目录计数、翻译进度与来源结论来自产品自身展示，本轮不再次证明其底层数据。

## 第二批：启动主路径与移动端平台样式

首批提交并推送为 `472a1f65`。第二批输入 HEAD 为另一窗口随后提交的 `ee98190f`，不覆盖其 chibi 工作。

变更：启动模式列表先于制作人姓名设置；门户/侧栏 hover 仅用于可悬停精细指针；图标、工作台、语言、名单与底栏提供局部 active 反馈；仅控件标签禁止选中，正文保持可复制。门户和启动页接入顶部/左右 safe-area，弹窗根据上下/左右安全区约束尺寸。目录搜索框在 coarse 指针下使用 16px；不禁止页面缩放。

- terminal contracts 40 项、真实 SFC 名称回归 9 场景通过。
- `npm run build:check` 通过，11.76s，固定输出且无 public 复制；日志 `batch2-build.log`。
- Browser 390×844：启动设置第一屏先展示入口；卡牌模式→中文“阿斯兰”→选中摘要与启用确认；返回来源，没有保存新的启动方式。
- Browser 844×390：名单与确认操作分别可滚动；“打开卡牌首页”在可见区域；工作台弹窗高约 342px、顶部约 24px，正文纵向滚动且无横向溢出。
- 门户 1440×900、768×1024、390×844、320×740：页面宽度分别与视口相等，稳定截图复核通过，状态和栏目入口可读。调整视口时的过渡帧不计入证据，已覆盖为稳定截图。
- 当前门户 Browser 控制台 warn/error 为空。初始人物首页的 Pixi 警告归首页舞台，不据此扩大修复范围。
- 安全区在桌面 Browser 中是 0；hover/coarse 查询为源码接线，尚不等于 iPhone/iPad/Android 真机通过。键盘、刘海、地址栏变化和 sticky hover 保持待验。

## 第三批：根面包屑目的地

第二批已提交并推送为 `f6d96c6d`。第三批输入 HEAD 为该提交，只将 `buildArchiveBreadcrumbs` 的“资料馆”根目的地从人物首页改为既有 `portal`。来源、返回路径和目录状态逻辑不变。

- `node scripts/verify-archive-routes.mjs`：通过，新增卡片/活动/歌曲目录及详情 6 个代表场景，根 URL 精确为 `?view=portal`，没有带入详情、筛选或来源字段，原始路由对象不被修改。
- `npm run verify:portal-navigation`：通过。
- `node scripts/verify-archive-navigation-state.mjs`：1792 个场景通过。
- `npm run build:check`：通过，11.74s，固定输出且无 public 复制；日志 `batch3-build.log`。
- Browser 1440×900：卡片目录及通信目录的根链接为 `http://127.0.0.1:5199/?view=portal`，实际点击抵达资料馆。栏目源码回归覆盖其他代表路径；不宣称逐一点击所有详情。

目录扩展审计观察到手机名册长姓名截断及安全区 cascade 遗漏，单列第四批处理；实际覆盖见上表。

## 第四批：长姓名可读性与安全区覆盖

第三批已提交并推送为 `9684e7c0`。本批只改手机名册样式、实验室入口副标题，以及安全区被后续 padding 覆盖的三个声明。901–1150px terminal-scroll、compact 顶栏与 tool 顶栏均保留顶部/左右安全区；原生 dialog 的 top layer 不改变祖先关系，CSS 变量继续继承。

- `node scripts/terminal/verify-terminal-contracts.mjs`：40 项通过。
- `npm run build:check`：通过，14.27s；固定输出，无 public 复制。日志 `batch4-5-build.log`。本次编译包含下一批姓名接线及另一窗口正在编辑的 chibi 源码；本轮只验收主门户/目录。
- Browser 320×740：roster 的 0、1、49 位真实名单；唯一阿斯兰结果宽约 279px，完整中文姓名；49 人仍为两列。通过键盘移到 Café Parade 行，日文长名完整分行，无页面横向溢出。
- Browser 1024×600：门户宽度与视口一致，现有 padding 生效；桌面 `env()` 为 0，不据此确认刘海设备。
- Browser 320×740：实验室副标题消失，三项用途说明与现有入口保留，未进入舞台。
- 共享固定输出被另一窗口重建时，两个未加载模块曾请求旧 chunk 并显示空白；重新加载恢复。本轮预览随后仅将 `index.html` 与 `_app` 代码固定在服务内存中，媒体/public/model 仍读原目录。`pinned-code.json` 记录编译代码哈希，无额外构建树或资产复制。旧 chunk 错误属于本地预览版本切换，不能推广为已复现的发布故障。

## 第五批：通信页姓名随资料语言更新

第四批已提交并推送为 `6613b6d1`。本批仅将 App 的 `mobileIdolOptions` 静态原名数组改为 computed，复用已有 `idolDisplayName`，跟踪资料语言与译名加载。保留偶像 ID、颜色和原文 fallback；不改通信标题、台词、房间说明和播放器数据。

- `node scripts/verify-mobile-archive-identity.mjs`、真实名称 SFC 回归 9 场景通过。
- 补充一次实际通信页 SFC 的 SSR 检查，提取真实 App computed/名称回调及真实 bootstrap/dictionary/overlay；中文→日文→中文及缺译回退通过，49 个 ID/颜色、`029ass` 选择值与原文房间说明保持一致。临时检查没有增加生产控制或测试文件。
- 复用第四/五批同一次 `build:check`（14.27s）；这之后没有新的代码变更，不为文档更新重复编译。
- Browser 1440×900：标题和下拉选中项从“阿斯兰·别西卜II世”切换为 `アスラン＝ベルゼビュートⅡ世` 再切回，select value 始终 `029ass`，49 个选项。个人/电话/随机分类可进入，原文说明和话题仍保留。
- Browser 320×740：姓名完整、页面宽 320px；没有进入 Player 或播放音频。预览固定代码之后的 warn/error 为空。
- 所有栏目入口已打开，具体交互与未覆盖内容分别列于覆盖表。证据 `catalog-tour.json`、`pinned-code.json`、截图和小日志均在 `.analysis/ui-audit-20261003/`；最终预览 `final-portal-390.jpg`。

## 第六批：摄影详情与 URL 状态

第五批已提交并推送为 `abeccf24`。本批输入 HEAD 为另一窗口随后提交的 `9a639371`；只修改摄影组件、App 的姓名接线/选择回调、摄影行为回归及域导航的测试 fixture。

- Browser 390×844 先复现：`spots:2` 点击后能看详情，刷新后标题却在约 811px；`faces` 换到偶像 2 后 URL 丢失 photo，刷新回到地点。
- 加载完成后先清除 busy 再等待挂载，明确 key 仍匹配才定位。换偶像清除旧预设后，只将新偶像的首条真实 faces/poses key 持久化；保留目录位置、现有搜索和分类，不因自动补 key 新增跳转。
- App 的选择回调关闭旧位置恢复，与现有 `commitArchiveSelection` 原则一致。详情链接刷新仍由组件定位，用户返回历史页的目录位置恢复继续由既有机制负责。
- `node --experimental-vm-modules scripts/verify-photo-catalog-navigation.mjs`：真实 SFC 的 setup 与 client template 在 Vue 内存 renderer 运行，覆盖挂载后定位、换人仅一次请求、规范 key/URL 往返、零结果搜索不滚走、译名回退、忽略 abort 的迟到请求、失败/重试及卸载。不是 Browser 或真机替代。
- `verify-domain-navigation.mjs` 原 fixture 在默认 items 状态直接选 honor，早于摄影断言即失败。补明确的 honors kind，并新增 kind 断言，保留原 honor identity 断言；未放宽来源合同。域导航、archive routes 和 view restoration 回归通过。
- Browser 390×844：刷新 `spots:2` 后详情标题约 156px、图片可见；faces 换偶像 2 保存 `faces:10201002`；poses 换偶像 29 保存 `poses:12901`，刷新保留对应分类和人物。中文→日文→中文，49 个 option 的 value 不变，偶像 29 显示译名或原名；零结果搜索可恢复。
- 同批复核暴露“自动补 key 新增跳转”的变化后已删除；最终回归区分明确详情请求和自动 canonical 补全。最终 Browser 空结果换人前后目录 scrollTop 均为 0、选择器顶部均约 299px；明确 key 刷新后详情可见。本批与下一批共享最终 `build:check`（14.49s，`batch6-7-final-build.log`），固定输出、无 public 复制；完整代码输入含另一窗口未提交的 chibi 工作，本轮不验收该部分。

证据仍在 `.analysis/ui-audit-20261003/`，包括 `continuation-photo-reload-final-390.jpg`、`continuation-photo-actor-final-390.jpg` 与最终构建小日志。没有新增“返回目录”控件或工作台功能。

## 第七批：Reader 主题与故事目录反馈

第六批已提交并推送为 `f0de1db4`。本批只改 Reader 的活动上下文样式、故事浏览方式的按钮语义及两处目录卡 hover 位移；采用已安装的 `improve-animations` 做 quick accessibility 只读审计，再按本轮删除/统一原则实施最小修复，没有新增动效或 motion 库。

- 活动 Reader `430018 / 1_3_30018_01_a` 深夜主题先实测：活动条背景为白色 `rgb(255,255,255)`，父文字为亮色。修复后为现有 page 背景 `rgb(15,23,42)`、边框 `rgb(51,65,85)`、链接 `rgb(45,212,191)`；暖阳、冰青、白色也分别跟随已有变量。最终复验 840×820，无横向页面溢出，测试后恢复极简白。
- Browser 320×740 和 1440×900：故事浏览方式显示 group，Space 可在分类/全部检索之间切换，pressed 状态与可见内容同步。没有实现新的键盘 tab 模型。
- 动效审计未发现 P1。Reader 章节定位、查找与 dialog 无位移动画；加载转圈已有 reduce 静态替代，目录 smooth 滚动已有 reduce→auto。只移除两处真实消费者的 hover 位移；旧 `.terminal-app-face` 动画规则已无模板消费者，不作为运行中的问题。
- 最终 Browser 实际 CSS 规则中，主线/活动卡 hover 的 transform 为空，边框/阴影保留，活动卡 reduce 下仍禁用 transition；桌面/320px 的内容与键盘路径正常。没有以桌面 CSS 检查代替真机触摸验收。
- `node scripts/verify-reader-theme.mjs`、`verify-reader-controls.mjs`、`verify-reading-render.mjs` 通过。复用第六/七批最终代码构建（14.49s），不是完整 public 资源包；最终编译后没有新的代码改动。
- 继续实际旅程：主线第1章→PROLOGUE Reader（桌面本话两段）→中文、搜索“制作人”5处/两段、下一处自动关闭查找并定位→下一 EP→来源目录；手机 Reader 按既有 viewport 合同使用单 EP，不能将 URL 的 chapter scope 移除误判为数据丢失。
- Browser 320×740：Reader→播放完整剧情→取消记住方向、继续当前方向→Player 3/26→下一段 7/26→中文正文→播放菜单→返回阅读页→返回第1章，来源目录仍展开 PROLOGUE。仅短程 UI/场景交互，不宣称完整音频、整篇、长稳或真机播放通过。
- 活动 Reader→查看本期活动档案→阅读本期活动剧情→返回来源目录，抵达同一 `event=430018` 详情。最终当前活动详情 warn/error 为空，不推广到所有媒体路径。

两项候选排除：

- 集合页 1440×900 的截图实际只有 1335px 宽，右侧按钮被截图边缘截断；DOM 实测按钮右缘约 1337px、小于 1440px，article scrollWidth 与 clientWidth 一致。620/760/840px 也正常，因此不修改集合页布局。
- 空制作人名称在中文正文仍显示 `プロデューサー`，与既有 resolver、来源回归及 `GS_PLAYER_QA_REPAIR_20260930.md` 的约定一致。本轮不扩写未审文本翻译；自定义制作人名机制保留。

证据：`reader-context-themes.json`、`continuation-reader-event-dark-final-840.jpg`、`continuation-story-mode-after-320.jpg`、Player/菜单短程截图及既有 Reader 查找截图，均在同一小型证据目录。

## 第八批：通信回复等待与贴图姓名

第七批已提交并推送为 `9c463191`。本批输入 HEAD 为该提交，仅修改 StoryViewer 的 dock disabled 条件、MobileChatScene 的显示姓名优先级及对应回归；线程来源与参与者解析没有改动。

- Browser 实际个人通信 `001tom_301_2_3_001_01_09_b.json`：9/11 回复选项出现时 Next disabled、Previous enabled；选择“頑張ってください！”后 10/11 可继续，11/11 出现原贴图并自动进入非阻塞完成状态，可继续回看/返回同一 `001tom` 通信目录。
- 中文正文中，文字与贴图都显示“天濑冬马”，标题仅一名参与者；切换双语及日文后都使用原姓名，原文正文偏好已恢复。没有把未翻译台词补成中文。
- `node scripts/verify-player-communication-ui.mjs`：真实 dock 模板和实际子组件在 Vue 内存 renderer 中验证 choice/回复/贴图/完成；真实个人通信 JSON 和实体词典验证两语言的参与者去重、头像/贴图/source 不变。
- `node scripts/verify-story-localization-runtime.mjs`、`node scripts/verify-story-interaction.mjs` 通过。已有 localization 回归也调用新增的真实贴图身份场景。
- 旧 `verify-story-player-ui-pr2.mjs` 同步 Next 静态断言，但整份脚本在未修改的 line 93 先失败：Jupiter fixture 的 `unitCode=null`，旧断言预期 `01jup`。隔离导入 `9c463191` 的 resolver/两份名称映射并执行该提交的相同 setup/断言，也得到同一失败；解析源码和失败断言均未变，现有个人 talk 分支明确清空 unitCode。本批没有删除或放宽该断言，新的受影响行为回归通过，旧脚本整体验收保持失败边界。compiled fixture 被 Git 忽略，不能证明历史字节；两次隔离统一使用当前 fixture，SHA-256 `c21f7d720fba981be296b76cae6678feee388ce62c99beb2ba8ed4364883af6f`。
- 第八/九批共享 `npm run build:check`，21.09s，固定 `.analysis/build-check`、无 public 复制。编译输入包含另一窗口的 chibi 未提交工作，本轮不验收舞台。预览固定代码时间 `2026-10-02T19:23:35.506Z`，原 public 与已验证 read-model 映射不变。

证据：`communication-choice-after-390.jpg`、`communication-complete-after-390.jpg`、`batch8-9-build.log`。截图复核另发现进度条与聊天标题重叠，单列下一批处理，不混入本批行为修正。

## 下一轮验收顺序

1. 在 iPhone/iPad/Android 检查安全区、键盘、地址栏收放、横屏、触摸反馈和文字缩放；桌面补真实 200% 页面缩放。当前 Browser 视口检查不能替代这些项目。
2. 继续通信 Player、卡片详情语音、歌曲试听与来源往返的代表旅程。摄影手机嵌套滚动需在真机判断，不能仅凭嵌套容器就判为不可用；本轮明确详情刷新与分类状态已修复。
3. 主门户/故事目录/Reader 的 quick 动效审计已做。后续只处理有证据的反馈/切换问题；主观重排先用隔离 prototype 比较，不把新增功能或全站换肤混入修复。

本轮未提交/清理其他窗口的 chibi 变化与无关未跟踪证据，未创建 PR、部署或媒体发布包。
