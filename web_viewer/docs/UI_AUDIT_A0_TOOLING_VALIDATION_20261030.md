# A0 — Audit Infrastructure & Baseline Validation（2026-10-30）

## 结论

可以开始 **A1 的人工监督审计**。当前工具已通过负向控制和 mutation 检查，适合采集、定位和复核；**不能作为全站自动化通过门禁**。实际页面输出 `REVIEW_REQUIRED` 或 `INCONCLUSIVE`，不输出产品 PASS。负向测试的 `testPassed` 仅表示检测器检出了预期控制样本。

## 工程与变更边界

- 输入 HEAD `441780f9d7c0b3100bebfd349048febb1310c541`，分支 `portal/20261030-responsive-audit`，初始 git status 干净。
- fetch 后 origin/master `c5efb7a002b74e62201bae8a10fa22052f6cbdd6`，仍为原审计基线。441780f9 是当前线祖先；相对 master 仅四个原审计文件，没有生产实现漂移。未 reset、清理或覆盖旧证据。
- 复用 PID 10784 的5198 Vite服务；工作树、候选与语料映射沿用[初次报告](RESPONSIVE_RELIABILITY_AUDIT_20261030.md)。独立 Chromium/CDP用于批量测试，现有 Browser/IAB用于五状态实际交互。
- 只修改 scripts 和审计文档；没有修改正式 Vue、CSS、read-model、业务数据、路由或资源加载策略。未部署，未建 UI 修复 PR。
- 读取原报告、采集器、完整180条极端值、五状态HTML、#148脚本、Source Gate runner、shell geometry、chart-one-screen及 verifier coverage 规则。

## 原采集器可信度问题

1. 固定2.5秒可能采到 loading；没有身份、业务 selector、字体/图片或超时状态。
2. 使用 innerWidth；负向用例证实移动模拟的页面溢出可能同时扩大 innerWidth，造成漏报。现用 documentElement.clientWidth。
3. 任意 overflow-x:auto/scroll 祖先都会放行后代，可能掩盖真正越界。现需路由明确声明例外，不自动豁免。
4. 仅 scrollWidth 比较无法区分省略、父容器裁切、无障碍隐藏与图片设计性裁切；原算法也没有重叠、比例、遮挡检测。
5. 固定证据目录会覆盖旧文件；记录缺 routeId/viewport/environment/time/screenshot 映射。
6. 旧证据根目录实际110张PNG但仅90条 measurements，额外20张未索引；其余四子目录分别20/60/1/20条记录与同数截图，但所有旧记录均无 screenshot字段，无法建立可靠manifest。不修改旧文件，不将它们追认成完整逐次记录。

## 新采集器能力

`node scripts/verify-layout-integrity-browser.mjs --base=http://127.0.0.1:5198 --windows=390x844`

- 独立注册表 `scripts/qa/layout-routes.json`，每条包含ID、URL、页面类型、身份（路径/查询）、readySelector、交互前置、横滚例外和timeout。
- 轮询 route-specific selector，检查路径/查询、标题、关键容器可见、loading前缀、字体状态及可见图片状态；连续两次相同结果才READY。运行时异常、Vite overlay、缺图/未载入图片或超时均INCONCLUSIVE。没有用networkidle。
- 仅关键容器内与视口相交的图片参与ready，避免屏幕外lazy图片永久不加载。初次校准中屏外lazy图片导致INCONCLUSIVE，已修正并重跑。
- 泛用几何为候选：document越界、视口越界、父容器clip、标题/按钮横纵向内容溢出、目标对重叠、固定元素遮挡、焦点遮挡、fill图片比例异常、坏图、13px等小输入风险、已声明滚动容器被hidden/clip截断。
- 重叠只检查明确目标对（默认顶栏标题/语言控件），不执行全元素O(n²)碰撞。图片只对object-fit:fill且自然比例不符发候选；cover/contain不据此误判。
- 无障碍1px隐藏文本排除；设计性人物幕通过明确selector及reason列入exceptions；其他画廊、横向标签、谱面须A1–A4按组件加入并验证，不全局放行。
- 每次调用在E盘output下用mkdtemp建立独立run目录；保留routeId、URL、标题、viewport、Browser.getVersion、HEAD、测试状态、ready细节、测量时间、PNG文件名/SHA256、findings及原因。manifest另保留启动参数和采集器/探针/注册表源码hash。中断运行仍保留已采记录。
- CDP命令15秒超时，避免挂起；截图失败不会继续冒充可审阅结果。

## 路由统计与校准

原始30种子的ID和入口全部保留，合同脚本逐条比较#148脚本。补充5条：event-long、Reader、Player、stage、studio-edit，总计35条。详情入口覆盖原卡池点击前置、歌曲/卡片/偶像/组合/活动直达；chart保持从LIVE点击前置，等待谱面独立路径和canvas。

390×844最终全35入口均达到READY，结果均为REVIEW_REQUIRED，不代表布局通过。证据：

`E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a0/run-cLzU9c/`

此全量运行已包含manifest、非空内容检查和stage/player初始状态描述；另外保留了单独stage/player补采。stage可观察到加载方式选择或loaded transport，Player可观察到方向提示或player chrome，**没有把这些状态写成已完成舞台渲染/播放**。注册表描述仅证明默认入口；其他视口和交互要在后续批次逐项校准。

早期试运行 `run-QpG4Yt` 留存了错误selector和lazy图片导致的INCONCLUSIVE；没有删除这些失败证据，也没有将其作为页面缺陷。cards/story-main/unused/reader/scores的selector依据实际组件修正，补采 `run-yenR5D` 与全量运行均READY。

## 负向与mutation测试

`node scripts/verify-layout-integrity-browser.mjs --self-test`

独立页面 `scripts/qa/layout-negative.html`，17条记录、17张截图，最终17/17控制断言通过：

| 控制样本 | 预期 / 实际 |
|---|---|
| 正常布局 | 无findings，满足 |
| 元素越出视口 | viewport-overflow，满足 |
| 父容器裁切 | parent-clipping及父/子selector，满足 |
| 两元素重叠 | overlap含双方rect，满足 |
| 合法横向滚动 | 明确声明#subject例外，零误报，满足 |
| fill图片比例异常 | image-distortion-candidate，满足 |
| 固定底栏遮挡按钮 | fixed-obscured，满足 |
| 长标题溢出 | text-clipping-candidate，满足 |
| 小输入 | small-input-risk（13px），满足；不声称iOS实际缩放 |
| 图片加载失败 | broken-image，满足；ready仍INCONCLUSIVE |
| 延迟1.2秒显示 | 等到业务标志才READY，满足 |
| 尾部不可滚动到达 | unreachable-scroll-end，满足 |
| 原始flex约束 | 零findings |
| 移除min-width:0和换行约束 | viewport-overflow |
| 恢复原约束（重新导航原状态） | 零findings |
| 聚焦被底栏遮挡按钮 | focus-obscured，满足 |
| 100ms timeout vs 1.2秒延迟 | INCONCLUSIVE，满足 |

最终自测证据 `E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a0/run-pwnY9f/`；此前失败迭代也保留。正常/合法横滚/约束恢复的零findings是这些具体控制样本的零误报，不能外推成通用误报率。

## Worst-case与生产隔离

`--fixture-test --windows=390x844` 自动截图及组件计数；Browser逐一点击并读取真实组件DOM，得到：

| 模式 | 实际行数 | 数据差异 |
|---|---:|---|
| Demo | 3 | bootstrap前三位 |
| Worst case | 49 | 按真实姓名长度降序，首位アスラン＝ベルゼビュートⅡ世 |
| Empty | 0 | 完全不渲染人物组件 |
| One | 1 | 第一位人物 |
| Dense | 49 | 完整roster原序，相比Demo增加46条 |

证据 `run-IeX0iE`。Worst case和Dense条数相同，差异是排序；没有增加到超过真实49人的虚构规模。所有模式缺图走组件原有回退。不测试全站、译文、Reader、舞台等复杂数据边界，A2扩展。

合同脚本重新解析候选，180/180 value与source+JSON pointer一致；36字段组，不等于36业务类型。未把测试值写入业务数据。

静态隔离检查：QA HTML都在scripts/qa，均DEV guard；src引用图无scripts/qa入口；Vite未设置多入口rollup input，默认index.html为生产入口。这证明当前生产入口图不会包含QA页；DEV guard本身不能防止将来有人显式配置QA HTML为build入口。未做生产媒体打包，也未宣称验证完整发布包。

## 尚不可靠的部分与后续准备

| 项目 | 状态 / 误报漏报边界 |
|---|---|
| 数据请求完成 | 不统计所有后台请求；以业务selector与内容/字体/可见图片替代。局部数据后到仍可能漏检，需要逐路由更细ready契约 |
| 裁切 | 省略是候选；max-line-clamp、文字Range边界、旋转/transform、嵌套滚动可误报，需人工复核 |
| overlap/fixed | 仅目标对和可见控件中心hit-test；部分遮挡、透明罩、sticky遮挡仍可能漏报 |
| 图片 | 边框/装饰尺寸可能造成比例误报；cover有意裁切不判比例异常 |
| 滚动 | 当前只判声明滚动根hidden/clip；没有逐个滚到底并验证末尾内容，不能证明所有内部滚动可达 |
| 焦点/键盘 | 已证明焦点被固定栏遮挡的控制样本；未逐控件Tab巡检。软键盘、safe-area、iOS缩放必须真机 |
| 动态稳定 | 连续两次ready不等于CLS测试；晚到布局变化/音频/画布/GPU行为独立 |
| 跨浏览器 | 当前Chromium；WebKit、物理iOS/Android/平板仍Pending |

A1：可开始外壳/导航人工审计，工具作证据辅助。A2：现有人物fixture可复用，其他业务fixture待补。A3：目录/详情需加明确横滚/图片设计性裁切例外。A4：Reader/Player/谱面/舞台/摄影需完整状态前置和滚动断言。A5：真机流程尚未执行；不能用模拟结果代替。

## 技能实际应用与Source Gate建议

完整读取安装版break-ui、mobile-native、emil-design-eng及break-ui/CATALOG；执行真实长姓名、缺图、Empty/One/Dense切换和恢复测试。mobile-native的小输入风险仅列待真机确认，未改字号或禁缩放。emil-design-eng仅检查正式视觉保持：

| Before | After | Why |
|---|---|---|
| 现有纸面/字体/身份色/无框控件 | 正式实现零改动 | A0只验证工具，不实施视觉修复 |

Source Gate建议先接入轻量注册表/fixture来源/隔离合同，再把17项负向控制作为有Browser环境的外部门禁；生产页面保持REVIEW_REQUIRED，待A1校准例外与变异覆盖后再选少数确定性断言。现有shell-geometry、chart-one-screen不能被泛用采集器替代。本轮仅在config/verifier-coverage.json的external组登记两项独立工具（需要本地候选/浏览器），未把采集器列为必过产品门禁；coverage校验通过。未修改CI工作流，未跑全量Source Gate或前端build（纯独立QA工具，无生产依赖改动）。

验证命令：`node --check scripts/verify-layout-integrity-browser.mjs`；`node scripts/verify-layout-a0-contracts.mjs`；采集器`--self-test`、`--fixture-test`、35路由390采集；合同`--evidence=<run>`核对截图数、字段和SHA256；`git diff --check`。台账见[UI_QUALITY_MASTER_LEDGER.md](UI_QUALITY_MASTER_LEDGER.md)。
