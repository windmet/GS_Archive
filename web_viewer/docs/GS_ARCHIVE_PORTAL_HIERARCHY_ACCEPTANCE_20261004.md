# 资料馆门户层级与紧凑布局验收

2026-10-04（Asia/Shanghai）。本批完成本地代码与 Browser 验收，供用户本地确认；未上传资源、未部署 Pages/R2。

## 输入与范围

- 输入 HEAD：`d14c3299174be53f25e0e01d6872877f85210275`。
- 分支：`codex/chibi-stage-reconstruction-20261002`。
- 用户附件：`7c12c798-df97-45e1-be80-985ecb812116/已粘贴的文本.txt`，作为设计参考。按已有真实资料收录和导航合同取舍，不补造热度、最新收录、获取状态或故事插图。
- 使用 `emil-design-eng` 与 `frontend-testing-debugging` 的布局审查和实际 Browser 验收流程。
- 代码范围：`ArchivePortalOverview.vue` 与 `ArchivePortalLauncher.vue`；资料模型、路由和舞台渲染未修改。≤760px 的 compact 门户保留。

## Before / After / Why

| Before | After | Why |
| --- | --- | --- |
| 品牌、页面标题、前往首页、设置分别占位 | 品牌首页入口与标题同栏，语言/壁纸/设置组成轻量工具栏 | 收拢页面顶部，减少入口重复 |
| 搜索和统计缺少主次 | 搜索为主要操作，真实担当名/组合名提供快捷查询，统计使用统一数字与小字标签 | 先寻找资料，再扫读体量；查询仍是普通文本 |
| 担当和卡片挤在一侧，歌曲占另一大栏 | 担当通栏 Hero：身份和关联数量在左，三张等高卡面在右 | 建立页面主视觉，直接看到担当的真实档案 |
| 卡面与角色名、入口文字重复 | 三张统一4:5竖图，微型稀有度标，担当已明确时不重复角色名 | SSR不足使用真实SR，保持框体整齐，不倾斜、不叠放 |
| 歌曲进入舞台按钮独占第二行 | 小封面、曲名和44px舞台入口同排 | 精简空间；舞台按钮仍跳转真实stageTarget，不伪装为行内试听 |
| 故事摘要与活动混排，框体重量相近 | 歌曲/故事两栏，故事保留分类和标题，活动单独通栏三张统一横幅 | 通过内容形态和大小区分层级；缺故事图时用书本图标 |

## 本地运行环境

- 验收入口：`http://127.0.0.1:5208/?view=portal`。
- 当前本批服务 PID：`10532`。使用既有 `.analysis/ui-audit-20261003/serve-production.mjs`，仅将本次 `.analysis/build-check` 编译代码固定在内存。
- 资料来源：`E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004`；bootstrap release：`2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`，与编译内联身份一致，未使用 preview-bootstrap 替换。
- 服务映射已有 public/外部资源，不复制媒体语料。输入 HEAD 加本批工作区 UI 补丁为实际编译代码来源；PID仅记录验收时状态。
- 其他已有服务与无关未跟踪文件保留。

## 代码验证

| 检查 | 结果与边界 |
| --- | --- |
| `node scripts/verify-archive-portal-presentation.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004` | PASS，fixture和真实资料；计数、null/zero、卡面框、成员关系、语言及stageTarget合同 |
| `npm run verify:portal-navigation` | PASS，入口来源、深链、刷新和返回上下文 |
| `node scripts/verify-archive-view-restoration.mjs` | PASS，焦点、滚动与返回合同 |
| `npm run build:check` | PASS，最终构建13.59s；完整前端代码编译，copyPublicDir:false；固定复用 `.analysis/build-check`，不是完整媒体发布包 |
| `git diff --check` | PASS；Git的LF/CRLF提示不属于内容错误 |

最终只读复核未发现模板、emits、focus-id或数据/路由阻塞问题。既有大chunk提示仍存在，与本批界面改动无关。

## 实际 Browser 覆盖

Codex In-app Browser，本地生产bundle与上述资料映射。以下为实际显示和交互证据，不代替物理手机验收。

| 视口 | 实际结果 |
| --- | --- |
| 1920×1080 | 内容最大1200px；卡面均约156×195px；头像64×64px；无横向溢出 |
| 1280×800 | 担当Hero约1066×367px；卡面均约156×195px；头像64×64px；歌曲/故事两栏均约523×307px；11张图片成功显示；无横向溢出 |
| 780×900 | 依据实际容器宽度堆叠Hero，卡面均约144×180px；工具栏完整，无横向溢出；中文/日文切换正常 |
| 761×900 | 带“返回来源页”的最窄桌面断点仍完整，品牌和工具栏无重叠，document scrollWidth=761 |
| 320×740 | compact入口保持11项、42×42px头像；桌面Overview不挂载，document scrollWidth=320 |

触屏指针的桌面快捷搜索热区补为44px，细指针维持36px的紧凑样式；此媒体条件的实现已审查，未声称真实平板触控验收。

实际旅程：

- 编辑工作台输入 `windmet`，选择樱庭薰；门户显示 `windmetP`。关闭后回到 `portal-personal-edit`。
- 担当真实数量为卡片17、个人故事5、个人聊天19、电话通信4。全库数字为826/1,394/60/49/16。
- 三张实际卡片为 `005kao_ssr01`、`005kao_ssr02`、`005kao_sr01`，全数使用等高竖图框与contain。
- 点击DRAMATIC STARS快捷查询，输入框获得普通文本，实际匹配9条，无搜索错误；清空恢复正常门户。
- 品牌首页按钮进入 `?view=home&home_idol=005kao`，通过资料馆总览返回，品牌入口焦点恢复。
- STARLIGHT CELEBRATE!舞台入口进入实际 `strclb` 演出，3/3就绪且三人Canvas已显示；返回资料馆后焦点为 `portal-song-stage:strclb`，原滚动位置恢复。未测试本轮长音频/整曲播放。
- 主线第5话入口进入 `1_4_001_05.json`、标题 `トリニティ・アタック！！！`；返回后焦点 `portal-story:1_4_001_05.json`，滚动约366px，查询保持为空。
- 门户页初始console无error/warn，最终本地服务stderr为空。访问未修改的舞台运行时出现两条既有Pixi SpineBase.tint warning；不将舞台日志写成全站无警告验收。

## 证据

小型证据保留在 `.analysis/portal-polish-20261004/`，不提交构建和媒体包：

- `build-check.log`、`server.json`、`pinned-code.json`、`http-requests.jsonl`、`browser-checks.json`。
- `before-1280.png`、`after-1280.png`、`content-1280.png`、`after-1920.png`。
- `after-780.png`、`after-761-with-back.png`、`mobile-320.png`、`stage-entry.png`。

本批仅提交上述两份Vue与此验收文档。用户本地验收后再决定后续发布，本批没有R2上传、资料全量打包或部署动作。
