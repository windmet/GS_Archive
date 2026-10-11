# 舞台、桌面门户与摄影资料测试页发布验收

2026-10-04（Asia/Shanghai）。本记录补充各批次的本地验收，记录最终资源上传、正式模型绑定与实际远端结果。

测试页：[资料馆门户](https://2d00180a.gs-archive-preview.pages.dev/?view=portal)。固定部署地址：`https://2d00180a.gs-archive-preview.pages.dev`；预览分支：`gs-architecture-device-test`。本轮只发布新测试页，`productionApproved:false`。

## 最终实现与批次

| 范围 | 提交 | 结果与详细记录 |
| --- | --- | --- |
| Chibi 面板 | `ad95f853` | 明亮主题、歌曲与编排分离、原曲成员、共通衣装与部分同步、等高桌面槽位、手机 Tab、检查器；[舞台验收](GS_ARCHIVE_CHIBI_PANEL_ACCEPTANCE_20261003.md) |
| 桌面门户、侧栏、首页语言 | `0134512e` | 真实内容看板、担当关联、四域搜索、收拢导航、手机 compact 门户；[门户验收](GS_ARCHIVE_DESKTOP_PORTAL_ACCEPTANCE_20261004.md) |
| 摄影资料 | `98916655` | 按素材形态分开的网格、七类资料、原生详情弹窗、摄影工作台往返与焦点恢复；[摄影验收](GS_ARCHIVE_PHOTO_GALLERY_ACCEPTANCE_20261004.md) |
| 增量基线工具 | `21a98662` | 已上传基线与叠加批次严格校验、预算守卫、无远端删除；[工具验收](GS_ARCHIVE_INCREMENTAL_BASELINE_ACCEPTANCE_20261004.md) |
| 首页资源可用性 | `0095f083` | 不把原台词中缺少骨骼资源的型号合成为可选衣装，保留全部原 cue 与文字 |
| 资源清单、HTTP 探针 | `49975fb3` | 更新本地资源盘点，覆盖新增 live-chibi 资源类型 |
| 最终模型绑定 | `e23b3ad7` | 绑定最终 bootstrap、路由发布描述与无损资源快照 |

樱庭薰示例采用真实 `005kao_ssr01`、`005kao_ssr02`、`005kao_sr01`，全部使用等高的 4:5 竖图框。SSR 不足按实际卡片补齐，不改用高低不齐的横图。头像保持正圆；输入 `windmet` 显示 `windmetP`。关联歌曲、故事和活动来自已有正式身份及成员关系，没有加入人气、今日热度等无来源数值。

## 发布身份与产物

| 项目 | 最终值 |
| --- | --- |
| 已部署代码 HEAD | `e23b3ad7e6c19dce2c9255960d59df52ba3a65ae` |
| 模型生产输入 HEAD | `49975fb3d358732db067f93ab408b25fba4a50be` |
| 模型目录 | `E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004` |
| 模型 release | `2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774` |
| R2 dataRevision | `2dd2a6ea6d4b72cb40a0b7c7a7f7b33bf1ab0fa08a59104c9f542a4c414c4f65` |
| 模型文件 | 8,751 个，解码后合计 77,220,032 B |
| Pages 发布目录 | `.deploy/ui-gallery-test-pages-20261004` |
| 本地发布包 | 10,333 个文件，127,820,590 B；不复制 public 全语料 |
| 首屏 JS gzip 估算 | 167,619 B |
| R2 绑定 | `ARCHIVE_ASSETS=sidem-archive-preview` |
| 压缩模式 | `ARCHIVE_GZIP_MODE=all` |

模型生成、artifact 校验、正式门户回归与实际消费者资源闭包均通过，证据为模型目录内 `LOCAL_VERIFICATION.json`。完整构建使用 `npm run build:check`，13.14 秒通过，`copyPublicDir:false`，固定输出 `.analysis/build-check`；没有重复生成全量媒体包。最终本地 Browser 使用固定生产代码与上述正式模型，端口 5207、PID 3916，无 QA bootstrap 替换。

发布包由 `scripts/prepare-readmodel-preview.mjs` 生成。已有 Cloudflare 认证正常刷新后，Wrangler Pages deploy 成功上传 8,905 个新文件、复用 1,426 个文件，Worker 编译成功；部署日志为 `.analysis/release-20261004/pages-deploy.log`。此记录的后续提交为文档提交，部署代码身份仍是上表的 `e23b3ad7`。

## 资料体积与无损上传

来源盘点：`.analysis/release-20261004/source-inventory.json`，SHA-256 `577a45d4cb44b9ed639025ad43e1c977e31b9f8a5e9c53a917c5d9f1628deaac`。

| 统计口径 | 结果 |
| --- | --- |
| 来源文件计划 | 103,516 个文件，11,540,098,131 B（11.54 GB，未转换源体积） |
| 本轮上传对象 | 5,270 个；含 286 个媒体/资源对象与 4,984 个快照 JSON |
| 本轮物理对象合计 | 220,199,851 B |
| 本轮对目标桶净增 | 211,657,822 B |
| 上传完成后的目标桶 | 7,622,202,376 B（7.62 GB） |
| 其他桶实测 | 444,588,701 B |
| 账户实际合计 | 8,066,791,077 B（8.07 GB） |
| 使用其他桶 880 MB 预留的保守预算 | 8,502,202,376 B（8.50 GB），低于 8,600,000,000 B 限额 |

本轮图片按既定无损 WebP 策略处理，不缩放，不因 WebP 变大退回 PNG，不修改原始资源。154 张图片逐像素校验通过；完全透明像素的不可见 RGB 按既有策略归零，部分透明及可见像素保持一致。本轮没有追加 terminal 图片衍生对象。

上传前核实实际桶体积、既有上传回执与对象基线；超限守卫保持有效。本轮预计体积与完成后的实际目标桶体积相同，无 R2 删除。上传于 `2026-10-03T17:54:56.831Z` 完成（本地 10 月 4 日 01:54:56）。

- 增量 manifest：`.deploy/ui-gallery-lossless-20261004/manifest.json`；SHA-256 `fcc47b6becba30047f2dc229f250613f6ecb9c45885ca6eb98137c463b667245`。
- 成功回执：同目录 `upload-receipt.json`；SHA-256 `a3cd1063ff07939885a95187e871ed2c77a889a56fffdde9099099544ca0dd4a`。
- 像素校验：同目录 `image-validation.json`，以及 `.analysis/release-20261004/image-validation.log`。
- 完整上传日志：`.analysis/release-20261004/upload.log`。

来源计划中的 82 个缺失项为旧基线已有的 ambient 1、BGM 75、SE 6，本轮没有新增；不能把其计为已补齐。它们与下述两款缺失首页骨骼是不同边界。

## 最终实际验收

本地与远端分别记录。远端均访问上面的固定新测试地址；证据集中在 `.analysis/release-20261004/`。

| 实际旅程 | 验收结果与证据 |
| --- | --- |
| 远端桌面门户 1280×720 | 实际设置樱庭薰与 `windmet`；两 SSR 加一 SR 全部加载，三个框均约 143.994×179.993；根 scrollWidth 1280。全部可见头像、曲封、活动图加载成功；`portal-kaoru-remote.json`、`portal-kaoru-remote.png` |
| 远端手机门户 320×740 | 保留 compact 入口；担当樱庭薰、`windmetP` 正确；scrollWidth 320；`portal-mobile-remote.json` |
| 远端门户 → STARLIGHT CELEBRATE! 舞台 | 通过实际入口载入，3/3 就绪；原曲成员为 2 樱庭薰、3 天道辉、4 柏木翼；实际播放至 0:56/2:01，歌词、开麦状态更新，休息位禁用；`stage-original-remote.png` |
| 远端摄影场景 → 工作台 → 来源页 | `scenes:1` 摄影棚、阿斯兰、搜索“摄影棚”；实际工作台显示人物、背景、12 表情与 9 动作；返回恢复来源弹窗；`photo-studio-remote.png` |
| 远端摄影手机弹窗 320×740 | 弹窗在可见视口内；关闭清除 photo，保留演员 29 与搜索“摄影棚”，焦点恢复 `photo:scenes:1`；五个背景图加载，scrollWidth 320；`photo-scene-mobile-remote.png`、`photo-mobile-remote.json` |
| 最终本地首页源 cue | 隼人/北村缺失型号保存值回退到实际可用常服，原 R/SSR 台词继续显示，人物实际渲染；天峰秀真实默认型号仍可用；`home-hayato-source-cue.png`、`home-eishin-source-cue.png`、`home-shu-default.png` |
| 最终本地卡片 → 素材 → 卡片 | `005kao_ssr01` → typed `item:10504` 彩光碎片 SSR（112 关联卡片）→ 原卡片；身份与来源往返正确；`material-reverse-local.png` |

之前各 UI 批次的 1920、1280、780、390、320 与横屏 Browser 覆盖详见对应文档；上表明确列出最终新部署实际复核过的旅程。验收后已恢复电脑视口，并保留新测试页为浏览器交付标签。

HTTP 验证在实际新 origin 通过：新增 Chibi WebP 的字节、类型、ETag/304；版本 JSON 的 SHA 与 HEAD；gzip 原字节与解码 SHA、identity 406；音频 Range 206/416；译文元数据字节；不存在资源 404、错误方法 405。回执为 `.deploy/ui-gallery-lossless-20261004/http-validation.json`。

门户与摄影另行检查 10 个实际图片对象（11 种用途），包括樱庭薰三竖图及头像、摄影棚地点/场景、Jupiter 贴纸全图及缩图、圣诞相框缩图及两层。依据上传链中的物理 WebP 校验 SHA、大小、响应类型、HEAD 和 ETag/304，全部通过；回执 `.analysis/release-20261004/gallery-delivery-http.json`。这不是用原 PNG 的 SHA 去比较已转换文件。

独立代码与模型响应检查通过：12 个样本 URL、13 次 GET，覆盖根 HTML、bootstrap、初始及 Portal JS/CSS、Photo/ChibiStage JS/CSS、卡片/摄影正式 model index、部署收据，解码后的字节大小和 SHA 全部匹配发布包。PortalOverview 合并在初始文件中，无独立 Portal chunk。`/index.html` 实际为 308 跳转到同源 `/`，两响应均保留 `noindex,nofollow`；首轮错误要求它直接返回 200 的探针记录保留为 `code-delivery-http-first.json`，按实际跳转行为检查后通过。最终回执 `.analysis/release-20261004/code-delivery-http.json`，SHA-256 `1ecd1bb9fdf9d5a3d8b9cf149f5e47e3db03b8d94f21db42cbb28a9336eae3a7`；部署收据和 inline bootstrap 身份均与发布包一致。

最终模型的 7,224 个直接媒体引用与 9,611 个实际消费者派生引用去重为 14,726 个对象，资源闭包无缺失。599 款实际首页衣装、2,564 条原 cue 与 10 类旧保存值回退均核实。`020hay_002_00`、`049eis_002_00` 没有实际骨骼，故不可选；它们原台词的资源型号、文字和顺序保留。`047shu_002_00` 的真实默认资源继续保留。

## 验收边界

这是新测试页的代码、模型、资源交付与代表性交互验收；不是正式生产批准、38 个公共路由全量原版一致性或物理手机验收。发布 receipt 中 `allPublicRoutesMigrated:false`、`deviceReviewAccepted:false` 以及现有 parity/device 边界保留。摄影动作缩略图的静态性质、滤镜近似与工作台现有原版差异见摄影验收记录；没有把本轮网格改造写成原版渲染完全一致。

全部 scoped 代码批次已推送；无关未跟踪文件和其他窗口的工作、服务均保留。发布与验收包位于 E 盘，未在 C 盘或 Codex QA 目录生成完整媒体副本。
