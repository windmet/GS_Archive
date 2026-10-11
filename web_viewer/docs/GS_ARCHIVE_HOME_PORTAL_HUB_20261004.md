# 偶像主页与资料馆：双视角修整验收

- 输入 HEAD：`29f86025afaff74db94e58a54a159739bf7cb480`。
- 分支：`codex/portal-idol-controller-20261004`；接续 [担当控制器首批记录](GS_ARCHIVE_IDOL_CONTROLLER_20261004.md)。
- 遵循 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)。保留原 GS 素材、字体、壁纸与磨砂配色；本批没有新增媒体副本、部署或全库打包。

## 实施与视觉决策

| Before | After | Why |
| --- | --- | --- |
| 全站套用偶像模板 | 全站采用 16 组合索引、跨组合卡面探索、演唱范围分类、真实主线章节和运营年份 | 全站负责分流，担当负责聚合 |
| 全站/担当是隐蔽链接 | 显式分段控制器；临时视角和搜索写入 URL | 刷新、详情返回仍能理解当前范围 |
| 立绘以宽度缩放，人物大小不一 | 原图统一高 210px，独立图片/文字列，底部淡出 | 稳定人物高度且不会挡字；宽姿势仅在图片槽横向裁切 |
| W 共用双人图未区分位置 | 保留正式双人图；悠介向右偏 8%，享介向左偏 12%，加宽图片槽 | 两位保持官方原图，并突出当前偶像所在的一侧 |
| 搜索结果进入文档流 | 搜索框下方浮层，独立限高滚动，Esc/外部点击/收起按钮关闭 | 展开搜索不推动档案内容 |
| 相关歌曲 5 首却只预览 4 首，桌面可变两列 | 偶像相关歌曲全部呈现，所有断点统一单列和行分隔 | 标题总数与真实列表行数一致 |
| 启动页面混在主页样式中 | v3 独立保存 startupPage/homeMode/startupIdol/preferredIdol；兼容迁移 v1/v2 | 保留卡面和 Spine 两种完整主页，允许默认直接进馆 |
| 主页与门户只有侧栏跳转 | 查看他的档案 / 打开他的主页 / 返回资料馆；限定本地返回上下文 | 保留当前偶像、台词、服装及门户视角/查询，避免递归 URL |

设置下拉框即时保存，并明确提示；临时访问不会改写担当或默认主页偶像。主页场景、卡面、专注模式和语音入口仍采用既有实现，资料馆不挂载常驻微型 Spine。

## 来源边界

- Readmodel release：`2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`。
- 全站 16 组合、49 偶像。卡面换组在已发布卡片集合内选取四个不同组合，不声称最新或按官方推荐排序。
- 歌曲分类依真实 performance.scope：自由编成 5、固定组合 47、特别编成 7；另有未指明特别范围 1 首仍在完整目录。未推测 Solo、唱片系列或卡片属性。
- 主线目录 101/102 各 11 节、102 话；103 没有可读内容，禁用入口。
- 年份活动数 2021/2022/2023 为 9/38/12；日期是收录活动起始日期的范围，不作为完整运营起止时间。
- 立绘仅接受正式生日 promotion。47 位对应单人图；W 是严格绑定 012yus/013kys 的唯一共享双人图例外。

## 命令验证

| 命令 | 结果 |
| --- | --- |
| `npm run build:check` | PASS，最后一次 19.10s；copyPublicDir:false，固定 `.analysis/build-check`；既有大于 500kB chunk 提示 |
| `npm run verify:archive-startup-route` | PASS，旧设置迁移、独立偏好、URL 优先级、存储失败和过期恢复 |
| `npm run verify:archive-navigation-state` | PASS，61 scoped refs、1792 投影/URL 场景、视图恢复和关系导航 |
| `npm run verify:portal-navigation` | PASS，门户/主页来源、临时视角、查询、服装/台词、刷新和有界返回 |
| `npm run verify:home` | PASS，49 偶像、2564 台词和既有 scene/stage 握手 |
| `node scripts/verify-home-portal-visits.mjs` | PASS，生产函数的显式偶像、访问状态、偏好隔离、失败和过期完成 |
| `node scripts/verify-archive-portal-presentation.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004` | PASS，fixture + 实际 readmodels；49 位歌曲完整列表/计数一致，渡边实五首，单位/章节/年份与 W 共享例外 |
| `git diff --check` | PASS |

## Browser 实际验收

Codex In-app Browser，`http://127.0.0.1:5208/`；生产代码 bundle + 当前 public 和外部 readmodels 映射。服务为 `.analysis/ui-audit-20261003/serve-production.mjs`，最后刷新进程 PID 55136；没有复制 public 语料。

| 检查/旅程 | 观察结果 |
| --- | --- |
| 身份、非空、错误遮罩 | 页面标题 SideM Story Viewer，预期 portal/home/detail URL，实际内容非空，无框架错误遮罩 |
| 控制台 | 最终代码验收时段没有 error；完整 Spine 主页出现两条 SimpleMesh/SpineBase update/tint 警告，保留原渲染兼容警告边界。更早 bundle 的已修复错误不计作最终代码结果 |
| 立绘 | 47 位单人图逐位验证已渲染、高 210px、独立文字区、无横向溢出；W 两人分别验证新偏移和加宽槽 |
| 桌面断点 | 1024/1280/1440/1920 实际已生效的宽度，长名字阿斯兰无溢出，切换器不碰搜索框，歌曲一列；五种代表姿势另有断点记录 |
| 五首歌曲 | 渡边实标题 5，独立五行，包含末行 GO FOR IT!!；1920 大屏仍单列 |
| 搜索浮层 | Ren 搜索 K.now O.nly 前/中/后页面高 1551、宽 1274、统计 y=207.62 均不变；Esc 和外部点击关闭；都筑圭 62 条结果浮层高约 560、内容高 1740，可独立滚动 |
| 全站导航 | 16 组合 Logo，Jupiter 进入正式组合详情；换组实际卡名发生变化；组合曲分类变更真实曲目；第1章进入 main/101 目录，未实装第3章禁用 |
| 年表 | Not Alone 进入 event=410001，返回 all 视角和原查询；稳定内容往返前/后 scrollTop=1280.92、scrollHeight=2181 |
| 完整主页 | 悠介 Spine 事务所实际渲染；换装并切换台词，往返保留 home_cue=2_2_012_01_00_01、home_costume=012yus_005_00；专注模式只留姓名/台词/退出入口；卡面主页也完成进入/返回 |
| 偏好隔离 | portal + spine 可独立保存，刷新后仍为这组值；测试后恢复 home + card、默认主页偶像为空；已保存担当仍为都筑圭 |
| 390×844 | 原手机紧凑门户、底栏、卡片入口仍正常，宽度 390 无横向溢出；卡片仍指向保存担当 007kei，可返回 |

截图及小型几何记录根：`C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac`。

- `portal-five-songs-final.jpg`：五首完整竖列。
- `portal-search-floating-final.jpg`：搜索浮层覆盖而非推移内容。
- `portal-W-yus-final.jpg` / `portal-W-kys-final.jpg`：正式双人图两个位置。
- `portal-all-hub-final.jpg` / `home-spine-hub-final.jpg` / `portal-mobile-final.jpg` / `portal-independent-startup-final.jpg`：全站、主页、手机与独立设置。
- `portal-portrait-geometry-47.json` / `portal-portrait-stress-widths.json` / `portal-final-responsive.json` / `portal-final-console.json`：实际 Browser DOM 和控制台证据。
- 早期 uniform-height-W/single-fallback 截图属于已废弃中间状态，不用于最终视觉结论。

构建日志：`E:/Web_build/GS_Archive_Domain_Work/portal-home-hub-build.log`；现有 QA 映射证据目录：`E:/Web_build/GS_Archive_Domain_Work/qa-portal-controller-20261004`。

未做完整媒体打包/发布部署、真实手机硬件、跨浏览器兼容、长时间 Spine 运行或可听音质验收。语音切换按钮实际更新台词，但不据此宣称扬声器播放质量通过。全站歌曲保持分类精选预览，完整集合可通过查看全部打开；偶像相关歌曲则全部列出。
