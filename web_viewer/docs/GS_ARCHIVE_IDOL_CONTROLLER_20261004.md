# 桌面资料馆：担当视角控制台

## 基线与范围

- 输入 HEAD：`87010d68`（Polish archive portal atmosphere and wallpaper discovery）。
- 实施分支：`codex/portal-idol-controller-20261004`。
- 保留现有 GS 字体、担当颜色、磨砂材质、SSR 壁纸、原版卡面与共享交互部件。
- 本批改造桌面门户与关联数据投影；手机门户继续使用原有入口布局。
- 构建和验收遵循 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)。

## 实施结果

1. 标题精简为“资料馆 · 担当档案”。顶部偶像选择器控制卡片、歌曲、可读故事和活动；可切到全站或回到已保存担当。临时浏览不会写入担当偏好，另有显式“设为我的担当”入口。
2. 四项可点击统计显示当前关联数 / 全站同口径总数。卡片按所属偶像，歌曲按明确演唱成员或固定组合，故事按真实出场名单和可读性，活动按偶像详情关联或已绑定剧情角色筛选。预览不足不填入其他偶像的内容；读取中或来源失败显示“—”，与零条区分。
3. 担当身份与精选卡片合为约 32:68 的通栏展台。立绘只使用既有生日透明 PNG 的正式 promotion 记录；路径、偶像 ID 和来源记录匹配后展示，失败回退共享头像。保留资料、故事、卡片、工作、通信五项入口，目标使用当前视角 ID。
4. 歌曲保留真实演唱成员和现有舞台入口。相关歌曲较少时单列，全站较多时双列；故事增加分类和真实角色头像。预览各最多四项，面板底部对齐。
5. 活动按历史日期排序，采用缩小 Banner 的横卡。PT 标签必须匹配实际报酬行和卡片归属；普通卡片报酬、兑换和剧情登场分别依来源标注。只有关联关系时显示“活动关联”，不猜测排名或卡池角色。
6. 统计和各区“查看全部”共用当前视角完整集合，24 项一页；另设明确的全站目录入口。复用共享原生对话框、搜索选择器和焦点恢复。

## 验证命令

| 检查 | 结果 |
| --- | --- |
| `npm run build:check` | PASS，最后一次 12.69 s；仅代码产物，既有 >500 kB chunk 提示仍存在 |
| `node scripts/verify-archive-portal-presentation.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004` | PASS，portable fixture 与实际 artifact；新增严格关联、同口径比例、全站集合、空集、来源失败、立绘绑定和报酬证据回归 |
| `node scripts/verify-portal-navigation.mjs` | PASS，来源返回、深链、刷新及过期关闭 |
| `npm run verify:home` | PASS，49 偶像、首页卡片/偏好、scene/stage 合同 |
| `npm run verify:archive-startup-route` | PASS，URL/偏好优先级、存储失败、历史与过期状态 |
| 49 份正式 birthday promotion 原图的文件大小与 SHA-256 | 全部匹配记录；Browser 实际显示都筑圭、牙崎涟和阿斯兰立绘 |
| `git diff --check` | PASS |

## Browser 实际旅程

目标：`http://127.0.0.1:5208/`，Codex In-app Browser。验证生产代码 bundle，未使用复制全库的发布包。

| 场景 | 实际结果 |
| --- | --- |
| 已保存担当都筑圭 | 卡片 18/826、相关歌曲 4/60、出场故事 39/1394、活动 3/59；原立绘、Logo、卡面正常显示 |
| 临时切到牙崎涟 | 19/826、4/60、41/1394、3/59；颜色、身份和内容同步变化；资料入口实际打开 `idol=040ren`，返回保留临时视角 |
| 牙崎涟查看全部故事 | 41 条，两页为 24 + 17；关闭恢复统计按钮焦点；活动故事分类显示三条真实关联 |
| 临时牙崎涟视角搜索都筑圭 | 全站匹配 62 条（偶像 1、卡片 18、歌曲 4、故事 39），搜索范围与担当透镜清晰分离 |
| 全站与回到担当 | 全站 826 卡片、60 歌曲、1394 可读故事、59 活动；回到担当仍为都筑圭 |
| 都筑圭卡面详情 | 实际打开 `card=007kei_ssr01&idol=007kei`，返回正常 |
| 1024×768 长名字 | 阿斯兰·别西卜II世完整换行；“当前视角”保持单行；控制器、姓名、面板无横向溢出 |
| 1280×800、1440×900、1920×1080 | 首屏展台与下层网格正常，无面板横向溢出；1440 下歌曲、故事面板高度均约 451.82 px |
| 390×844 手机回归 | 原有门户和底栏正常，无页面横向溢出；偏好仍为都筑圭，卡片入口打开 `idol=007kei` 并可返回 |
| 最终代码复查 | 重载后默认担当正确；长名字、全站歌曲密度及活动标签复查通过；控制台错误/警告为空 |

## 产物与边界

- 可复用代码输出：本 checkout 的 `.analysis/build-check`，`copyPublicDir:false`，不含 public 媒体语料副本。
- 已在用的 `5208` QA 服务按核实后的归属刷新：`.analysis/ui-audit-20261003/serve-production.mjs`。编译 JS/CSS 固定在内存，映射现有 `public/` 与既有外部 readmodels；不影响其他端口。
- Readmodel release：`2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`。
- 外部 readmodels：`E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004`。
- 代码指纹、HTTP 日志：`E:/Web_build/GS_Archive_Domain_Work/qa-portal-controller-20261004`。
- 构建日志：`E:/Web_build/GS_Archive_Domain_Work/portal-controller-build.log`。
- Browser 截图根：`C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac`。主要证据：`portal-controller-kei-1440.jpg`、`portal-controller-lower-1440.jpg`、`portal-controller-ren-1440.jpg`、`portal-controller-aslan-1024.jpg`、`portal-controller-mobile-390.jpg`，另有 1024/1280/1920 断点图。
- 本批未做完整媒体打包、部署、真实手机硬件或音频播放验收。错误/零条/缺图证据守卫主要由来源回归覆盖，不把它写成故障注入 Browser 验收；未点击偏好保存按钮改写用户担当。
- 历史上的今天、随机卡面等扩展组件留待独立范围；本批聚焦担当控制器和既有资产布局。
- 构建输出、外部 readmodels、截图和无关未跟踪文件不进入本批提交。
