# GS Archive 主门户 UI 审计与分批验收

日期：2026-10-03。初始 HEAD：`aa0ba5b1`，分支：`codex/chibi-stage-reconstruction-20261002`。

## 范围与约束

本轮按用户附件指导安装 [emilkowalski/skills](https://github.com/emilkowalski/skills)，审计主门户、栏目导航、启动设置和偶像选择路径。chibi 舞台由另一窗口负责，本轮不编辑、不暂存其组件、坐标工具、package.json、工作流或工作记录。沿用共享分支，提交前重新检查 HEAD 和暂存区。

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
| UI-06 / P1 候选 / 源码风险 | 门户小屏 padding 覆盖共享左右 safe-area，且没有顶部安全区 | 第二批：局部补安全区，并检查短横屏弹窗 | `env()` 接线能做源码验证，刘海/地址栏/键盘仍待真机 |
| UI-07 / P2 候选 / Browser 链接 + 源码 | 卡片目录“资料馆”面包屑实际链接首页 | 后续导航批：检查根面包屑与已有门户目的地一致性 | 不以侧栏修复掩盖另一条路径的含义冲突 |

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
| 资料馆门户 | 1440×900、390×844、320×740 | 栏目/设置/选择器/语言/返回/刷新 | 壁纸缺图与网络错误注入 |
| 启动设置 | 1440×900、390×844 | 从门户进入并返回 | 修改启动方式后的所有启动组合 |
| 偶像选择器 | 320×740、390×844 | 中文/日文/空结果/49 人分页 | 真机键盘、超大文字设置 |
| 故事目录 | 1440×900、390×844 | 进入、返回门户 | Reader/Player 正文与媒体 |
| 卡片目录 | 1440×900、390×844 | SSR、门户返回 | 全卡详情、资源错误恢复 |
| 其他栏目 | 未逐页验收 | — | 歌曲、偶像、卡池、活动、互动、藏品、摄影、实验室、资源 |
| chibi 舞台 | 不属本轮 | — | 交由另一窗口 |

本表只说明实际覆盖，不能据此声称全站、200% 缩放或真机完成。后续批次按已观察问题推进，并补充此记录。

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
