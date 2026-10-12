# L4 两页 SSG 实验与 L5 决策建议

日期：2026-10-13。计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md) §6；基线见 [L3 基线](GS_ARCHIVE_PORTAL_PERF_BASELINE_20261013.md)。实验代码在分支 `claude/portal-ssg-experiment-20261013`（提交 `602c0734`，**不合入**）；通用工具改进已拣选回主计划分支（`861b50fd`）。

语言：静态 HTML 按 zh-CN（用户已确认）。

## 1. 实验设置

- 同一份代码构建（`npm run build:check`），只换外壳内容；用 `scripts/serve-archive-build.mjs` 在本地提供生产包（gzip、目录 index、308 尾斜杠、SPA 回退；`/_catalog` 指向候选包 `E:/GS_readmodels_candidate_20261012_age`，`/assets` 等指向 `public/`）。
- 测量：`scripts/measure-portal-cold-load.mjs`，模拟手机档（Lighthouse 移动预设：RTT 150 ms、1.6 Mbps、CPU ×4、390×844），冷缓存，每组每页 5 次取中位数。本地测量波动很小（同组 5 次相差多在 ±100 ms 内）。
- 新增指标“内容空窗”：内容出现后又从 DOM 消失、到重新出现的时长。
- 被测页：偶像详情 `001tom`、Unit 详情 `01jup`。

| 组 | 做法 | 改 `main.js` |
|---|---|---|
| 基准 | 无外壳，`?view=` 旧地址 | 否 |
| A | L2 head 外壳（只改 head） | 否 |
| A+ | A + 外壳里 `modulepreload` 路由代码块、`preload` read-model 与译文 JSON（构建时记录该页实际请求得到） | 否 |
| B | A + 快照预渲染正文：无头浏览器加载本地生产包，抓取渲染完成的 `#app` 和所需样式表写进外壳；App 照常 `createApp().mount('#app')` 替换 | 否 |
| B+ | B + `main.js` 检测到预渲染时，App 先挂到隐藏的兄弟容器，等它渲染出同一实体再一次性替换；快照里的图片加 `loading="lazy"` | 是（约 30 行） |
| C | `createSSRApp` 真 hydration | 未实施，见 §4 静态评估 |

## 2. 结果（毫秒，中位数，模拟手机）

**偶像详情**

| 组 | FCP | 内容进入 DOM | 内容空窗 | LCP | CLS | App 接管（可交互） |
|---|---:|---:|---:|---:|---:|---:|
| 基准 | 2108 | 3574 | 0 | 3680 | 0 | ≈3574 |
| A | 2060 | 3507 | 0 | 3588 | 0 | ≈3507 |
| A+ | 2708 | 3103 | 0 | 3160 | 0 | ≈3103 |
| B | 1112 | 556 | **2744** | 2196 | 0 | ≈3300（空窗结束） |
| B+ | 1036 | 559 | 0 | **1420** | 0 | 5688（替换时刻，`check-prerender-swap.mjs` 单次） |

**Unit 详情**

| 组 | FCP | 内容进入 DOM | 内容空窗 | LCP* | CLS | App 接管 |
|---|---:|---:|---:|---:|---:|---:|
| 基准 | 2084 | 2877 | 0 | 27492 | 0 | ≈2877 |
| A | 2076 | 2879 | 0 | 27488 | 0 | ≈2879 |
| A+ | 2452 | 2420 | 0 | 27060 | 0 | ≈2420 |
| B | 1276 | 255 | **5046** | 26276 | 0 | ≈5300 |
| B+ | 1340 | 252 | 0 | 26284 | 0 | 3094 |

\* Unit 页 LCP 元素是背景大图；本地 `public/` 里是 PNG 原图（约 4 MB），正式站经 R2 转为 WebP，所以本地 LCP 绝对值无意义，只能组间比较。

“内容进入 DOM”对 B/B+ 是 HTML 解析即得；真正“看到”要等阻塞渲染的样式表到达，即 FCP（约 1.0–1.3 s）。

### 观察

1. **A 组不影响性能**，与基准持平（差异在噪声内）。它的价值是分享预览与标签页标题（L2）。
2. **A+ 收益有限**：内容提前 0.4–0.5 s，但 FCP 慢了约 0.6 s（预加载资源与入口脚本争带宽）；另有 3 个 JSON 预加载没被应用复用、被重复请求。
3. **B 组直接上不可行**：内容 0.3–0.6 s 进入 DOM、FCP 快约 1 s，但 App 挂载会清空它，**偶像页空白 2.7 s、Unit 页 5.0 s** 后才重新出现——实际观感是“出现→闪白→再出现”。
4. **B+ 消除了空窗**：偶像页 FCP 2108→1036、LCP 3680→1420，CLS 0，替换前后截图一致，替换后导航与返回正常、无 console error（`.analysis/ssg/bplus-check/`）。代价：
   - **可交互时间推迟**：替换前点击的是静态副本，没有反应。偶像页替换在 5.7 s，比基准接管晚约 2 s。原因已定位为带宽争用：静态副本里的图片与 App 自己的代码块/数据抢 1.6 Mbps；不限网速时偶像页 1.3 s、Unit 页 0.5 s 即完成替换。图片加 `loading="lazy"` 后从 7.9 s 降到 5.7 s，仍未消除。
   - 实验期间两次踩坑都与“替换判定”有关：最初用第一个 `data-archive-focus-id` 做标记，结果是 `idol-unit:`（要等 Unit 数据），替换只能靠 8 s 兜底。每类页面都需要可靠的“已渲染”信号。
   - 构建期要跑无头浏览器对每个页面快照，且快照必须与同一构建的代码块哈希一致。
5. 所有组的脚本执行时间都在 300 ms 左右，与 L3 一致：**JS 执行不是瓶颈**。

## 3. 对照计划 §6.4 的决策门

建议阈值（模拟手机）：LCP ≤ 2.5 s、实体出现 ≤ 2.0 s、CLS ≤ 0.1。

| 组 | LCP | 实体可见 | CLS | 是否达标 |
|---|---:|---:|---:|---|
| 基准 / A | 3.6–3.7 s | 3.5 s | 0 | 否 |
| A+ | 3.2 s | 3.1 s | 0 | 否 |
| B | 2.2 s | 1.1 s（随后空白 2.7 s） | 0 | 形式达标，体验不可接受 |
| B+ | 1.4 s | 1.0 s | 0 | **达标**，但可交互推迟约 2 s |

本地网络为模拟；正式站还叠加真实网络（L3 中偶像页波动 4.1–9.2 s），绝对值会更差，但组间差距的方向应一致。

## 4. C 组（真 hydration）静态评估

没有实施，因为以下改造量已足以判断它是一项正式工程，而非两页实验能覆盖：

- `App.vue` 在 setup 顶层同步读浏览器状态：`:705`、`:893`、`:910` 读 `window.location`，`:907` `loadArchiveUserPreferences()` 与 `:1004` 读 `localStorage`。需要改为从启动参数注入。
- 首屏结构依赖本地偏好（onboarding 弹层、启动页、界面语言），服务端只能按默认偏好输出，回访用户必然 hydration mismatch，需要把这些 UI 改为挂载后再出现。
- 约 40 个页面是异步组件，read-model 数据在挂载后异步获取；hydration 要求把初始数据序列化进 HTML 并在挂载前同步灌入各 composable 的状态。
- Vue 3.5.38 支持异步组件的延迟 hydration，可以减少部分工作，但不改变上面三项。

## 5. L5 决策建议（由用户决定）

**结论：不迁 Astro。** 依据：

1. L3 与 L4 都显示 JS 执行只有约 300 ms，Astro“少发 JS”的核心收益在本项目上空间很小。
2. 真正的等待来自“首个 HTML 不带内容 + 串行的代码块/数据请求”。这个问题在 Vue 内可以解决（B+ 已在两页上把 LCP 从 3.7 s 降到 1.4 s），不需要换框架。
3. 换 Astro 仍然要解决同样的问题（MPA 下的导航合同、偏好、数据注入），且要额外维护第二套构建与路由。

**可选的下一步，按投入从小到大：**

| 选项 | 内容 | 收益 | 代价 / 风险 |
|---|---|---|---|
| ① 只上 A（推荐先做） | 把 L1+L2 接入发布（处理 L2 记录里的 4 项上线前事项）并部署 | 路径地址、分享预览、标签页标题 | 低；需要用户授权部署 |
| ② 修 Portal CLS | 定位 Portal 0.68 的布局偏移来源并修掉 | 手机 CLS 从 0.68 降到 <0.1 | 低，与框架无关 |
| ③ 缩短串行链 | 让路由准备在入口脚本里更早发起 read-model 请求（例如把详情 JSON 的地址放进外壳，由 App 启动时直接复用），而不是 `<link preload>` 盲预加载 | 预计 0.5–1 s，且不推迟可交互 | 中；改启动链，需要完整导航回归 |
| ④ B+ 产品化 | 构建期快照 49+16 页；每类页面定义“已渲染”信号；替换前把点击排队或给出明确的加载态；继续压低替换时间 | LCP −2 s 级别 | 中高；构建期依赖无头浏览器，可交互推迟约 2 s 需先解决 |
| ⑤ Vue SSG（真 hydration） | §4 的改造 | 首屏 + 可交互兼得 | 高；正式工程 |

建议顺序：① → ② → ③，做完后用同一套脚本重测，再决定是否值得 ④。⑤ 与 Astro 都不建议在现阶段启动。

## 6. 复现

```bash
npm run build:check
cp -r .analysis/build-check .analysis/ssg/a && node scripts/generate-entity-head-shells.mjs --dist=.analysis/ssg/a
node scripts/serve-archive-build.mjs --dist=.analysis/ssg/a --port=5182
node scripts/measure-portal-cold-load.mjs ssg-a --base=http://127.0.0.1:5182 --runs=5 --profile=mobile --pages=idol,unit --paths
# B / B+ / A+（实验分支）：
MSYS_NO_PATHCONV=1 node scripts/experiments/snapshot-prerender.mjs --base=http://127.0.0.1:5184 --dist=.analysis/ssg/bplus --paths=/idols/001tom/,/units/01jup/
MSYS_NO_PATHCONV=1 node scripts/experiments/preload-shells.mjs --base=http://127.0.0.1:5184 --dist=.analysis/ssg/aplus
node scripts/experiments/check-prerender-swap.mjs http://127.0.0.1:5185 .analysis/ssg/bplus-check
```

Git Bash 下以 `/` 开头的参数会被改写成 Windows 路径，需要 `MSYS_NO_PATHCONV=1`。B+ 的快照必须取自与之相同构建的服务（代码块哈希一致）。原始数据：`.analysis/perf-baseline/ssg-*`、`.analysis/ssg/`。所有实验服务已关闭。

## 7. 限制

- 模拟网络与 CPU，非真机；本地图片为 PNG 原图。
- 只测两页；B+ 的替换时间只做了单次测量。
- 未测 INP；B+ 替换前的“点击无响应”没有量化。
