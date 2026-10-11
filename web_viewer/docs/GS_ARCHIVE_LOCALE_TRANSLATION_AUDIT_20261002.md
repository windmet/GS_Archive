# 中日资料切换、通用校对批次与当前资源审计

输入 HEAD `aa595ddbd5c7088af29d6f72e0515e108b714ee8`，分支 `codex/story-interaction-v2-before-b002`。本轮不改变 RAW、剧情翻译状态、音频声部和舞台编排；没有新增媒体资源。

## 用户可见变化

共用「中文 / 日本語」资料语言开关接入资料馆、门户、首页、首次引导、Reader、Player 菜单、摄影、谱面和舞台实验页。切换保存到现有偏好记录，只更新 ui_locale，不覆盖 P 名字、剧情原文/译文/双语模式、音量与自动播放。Reader 标题也跟随资料语言；正文保持独立阅读模式。硬编码导航和部分专业工具文案尚未全量日文化，审计页明确列为未统计。

道具保持紧凑网格；名称固定两行、12px。SP/DX、彩光碎片稀有度及抽卡券次数从原名称提取成角标，不按图标颜色或内部 ID 猜测。中日名称均可搜索；悬浮和详情保留日文原名。390px 实测四列，Go Go 果冻 SP/DX 可辨识。320px 摄影页把语言开关收进菜单，保留返回、撤销、导出、保存全部按钮；舞台实验页窄屏改两行工具栏，标题不再挤成竖列。

## 翻译校对与统计

当前通用资料为 5,596 个不同字段、9,952 次使用、60 批。原文键按资料域/字段/原文 SHA-256 绑定，逐批附带相关原文字段和使用位置；旧初译独立对照。校验拒绝漏行、重复、变更原文/哈希/数字/参数、过期来源或批次错配。导入只创建 draft 修订，人工确认绑定具体批次和回传 SHA 后才提升 reviewed，始终 not_final。生成器保留已导入修订，不会被初译重新覆盖。本轮未向 AI Studio 自动提交，也没有假冒 Gemini 回传或人工批准。

当前 5,584 个通用字段有初译、0 个通用字段已人工校对；12 个摄影场景原键没有可靠语义，保留原值并列缺译。当前 Reader 2,801 文档、30,121 个去重原文单元：主线 3,483 项中 993 reviewed、999 draft、1,491 缺译；其他已挂载剧情域当前没有有效译文。B001/B002 状态不混用。首页对话、未挂载 RAW、歌词、图片中文字和未提取界面文案单列未统计，不能由目录数量推断完成。

资源页分为通用资料、剧情、界面与人名，可展开日中对照，筛选状态/批次和搜索来源；剧情清单支持直接进入 Reader。大清单按资料域懒加载、25 条分页，不进入启动包。

使用方法：[Gemini 校对流程](GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md)。本轮交付包位于 Downloads 的 `GS_Archive_General_Translation_Batches_20261002.zip`。

## 当前资源审计

资源数量从当前目录自动生成：49 偶像、836 卡片资料记录、690 衣装记录、535 道具、1,613 称号、533 摄影素材、61 歌曲、2,801 阅读文档、1,368 发布来源记录。248 谱面文件全量 size/SHA 验证一致，其中 244 个正常难度文件和 4 个未分配“5”轨文件；不能把后者当作新增可选难度。

本地 public/assets 58,222 文件 / 7,737,544,651 B，包含原始及转换资源。2026-10-02 11:29 北京时间独立 R2 查询：目标桶 107,290 对象 / 7,410,544,554 B，严格低于 8,600,000,000 B；本轮 R2 新增 0。二者统计范围不同。

`build:check` 和实际 `npm run build` 打包前重算资源与翻译审计。来源未变时保留核对日期，来源变更才更新日期；没有把编译时间冒充实装时间。`npm run audit:resources:r2` 才重新查询远端，普通构建保留最近查询时间。旧 7 月覆盖率、可播放性和“通过”结果移进默认折叠历史区，不作为当前结论。

## 验收边界

通过 general-translation-workflow、resource-audit、reader-titles、archive-general-texts、story-localization-runtime。小型 fixture 验证目录/素材变化更新统计、无变化保留日期，修订导入读取和精确人工审批绑定；没有写入真实翻译目录。`build:check` 2,732 模块 / 11.20s，入口 gzip 130,929 B，forbiddenModules 为空，不复制 public。审计详情的较大懒加载 chunk 仍有 Vite 500k 警告。

真实本地生产 bundle Browser：1280×900 道具两行和角标、中日双向搜索、详情原名、刷新保留；390×844 四列网格、资源页清单、主线 reviewed 筛选和 Reader 跳转、摄影原衣装名；320px 摄影菜单及两个舞台页标题/语言键完整；首页切换卡名同时保留 windmetP 台词，Reader 标题中日切换不改正文模式。资源页日中对照 SP 搜索定位 G-items-007。未捕获本批 error；保留既有 Spine update/tint 调用栈 warnings。没有重新声称真实 iPad 扬声器、长稳或冷缓存性能验收通过。

证据目录 `.analysis/general-translation-batches-20261002`：build-check.log、items-desktop.png、items-mobile.png、resource-audit-desktop.png、translation-audit-desktop.png、audit-mobile.png、studio-mobile-ja.png。仅截图和小型 JSON/batch，不是媒体包。测试部署结果补记于文末。

## 提交、测试部署与交付

代码 `4dc731d5d6dd00fb125a412438973fce2862fbff` 已推送。committed build-check 为 2,732 模块 / 10.37s，sourceDirty=false，入口 gzip 130,929 B，sourceDigest `b93cb75bdd30bb983640b5b34e765ce34f7ab4410769ee41b136247099318d79`。来源不变，自动审计再生成没有产生 tracked 差异。

E 盘打包前可用 496,443,641,856 B；实际包 `.deploy/locale-audit-preview-4dc731d5` 为 10,324 文件 / 126,204,943 B。只含代码、readmodel、既有翻译及工作回填，没有 full public 媒体复制。Wrangler 4.146.0 仅部署 `gs-architecture-device-test`，固定地址 [d5f0be9e](https://d5f0be9e.gs-archive-preview.pages.dev/?view=archive_status)，别名 [测试分支](https://gs-architecture-device-test.gs-archive-preview.pages.dev)。productionApproved/deviceReviewAccepted 仍为 false，R2 dataRevision 未改。

线上九个关键文件（HTML、回执、入口、状态页、藏品页、道具校对清单、剧情清单等）均与包 manifest 的 size/SHA 一致。真实 Browser 展示当前资源计数、R2 最近核对时间和默认折叠历史；切换剧情统计出现主线 993 reviewed / 3,483 总量。日文模式中文「果冻」搜索匹配四项，普通/SP/DX 名称和角标完整，最后恢复中文并保留资源审计入口。线上未捕获 warn/error；没有把一次 Browser 创建标签等待超时当作站点失败，复用已实际创建的标签后验收完成。截图 online-resource-audit.png、online-translation-audit.png 与部署回执另存证据目录。

Downloads 校对 ZIP：244 文件 / 2,091,807 B，60 inputs / 60 maps / 60 templates / 60 旧译对照，另附 plan、glossary、README 和完整流程。没有包含假回传或假批准。本轮旧修复指南同步更新，历史指导原文保留。

播放器菜单补验：从 Reader 的日文模式进入 Player，菜单 UI 由日文切中文后，正文仍为 JP，P 名字仍 windmet，画面仍显示 windmetP。同时修正语言组件外层 label 对第一个按钮可访问名称的意外覆盖，改为普通布局容器，中文按钮恢复自身文字名称。截图 player-locale-menu.png。

最终补修代码 `c6e4ec3548accd8233e293d3043038380a73acf9` 已推送并重新 Browser 验收：Player 两个按钮为「中文 译 / 日本語 原」，中日菜单双向切换，正文 JP / windmet 保留。committed build-check 2,732 模块 / 12.69s，入口 gzip 130,930 B，sourceDirty=false，sourceDigest `313b08c3a7bff06672ec900dc77a315b64308f99a82f3e4990637ad20fd899e6`。这次重建由实际可访问性修复触发。

最终固定地址 [fc8c1bb0](https://fc8c1bb0.gs-archive-preview.pages.dev/?view=archive_status)，同一测试分支；包 `.deploy/locale-audit-preview-c6e4ec35` 为 10,324 文件 / 126,204,941 B。11 个关键文件（额外含 Player JS/CSS）在线 size/hash 均与 manifest 一致，最终 Browser 当前资源页再次显示正确数量、翻译批次与历史边界。截图 online-resource-audit-final.png。前一 d5f0be9e 是同批补修前的完整资料页验收，不冒称重复全部旅程；真实 iPad 和冷缓存边界不变。
