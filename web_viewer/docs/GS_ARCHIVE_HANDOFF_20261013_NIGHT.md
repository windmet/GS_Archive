# 2026-10-13 晚间交接：整合分支、称号贴图排查、短链接进度

- 分支：`claude/native-relations-integrated-20261013`；worktree `E:/Web_build/GS_Archive_Domain_Work/native-relations-integrated-20261013`。
- 本文写入时的输入 HEAD 为 `de3e2f2d`；本文与 Vite 预警告在其后的一次提交中加入。全部只在本地，未推送、未部署。
- 本日实施细节见 [原版关联修正实施记录](NATIVE_RELATION_IMPLEMENTATION_20261013.md)。

## 一、分支关系（以后以本分支为准）

| 分支 | 状态 |
| --- | --- |
| `claude/native-relations-integrated-20261013` | **继续开发的分支**。基线是 `claude/portal-image-budget-20261013`（含 L0–L2 路径地址、head 外壳、门户 CLS 修复与图片延迟加载），合并了 `claude/native-runtime-fidelity-20261013`。 |
| `claude/native-runtime-fidelity-20261013` | 已并入。它仍带已撤回的首页「原版」抽选，不要再从它发版。 |
| `claude/portal-static-route-20261012` | 是 image-budget 的祖先，已包含在内。 |
| `claude/preview-image-edge-cache-20261013` | 实验分支，按其结论不合入。 |
| `claude/portal-ssg-experiment-20261013` | 实验分支，标注 not for merge。 |

read-model 候选：`E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-integrated-20261013`，release `b3c1f13a32f5098e46b5aa793ee3f7f89a25fc65d03e2256c7d47f792bfde32b`（由 `47d518ae` 生成，此后只改了文档、Vite 开发警告和撤回原版抽选后的一处括号，数据产物不变）。正式发版仍需按发布清单重建候选并同步 `readmodels/bootstrap.inline.json`。

Codex 侧更新 5212：切到本分支，用 `SIDEM_READMODEL_CANDIDATE=<上面的候选>` 启动。

## 二、称号贴图「消失」排查

**结论：只发生在新 worktree 的本地预览（5177）上，代码、读模型与线上都正常。**

- 称号图片地址是 `/assets/domain-images/image/image_honor/...`。开发时它不在 `public/` 里，而是由 Vite 中间件 `sidem-domain-images` 从本机 `GS_Res/ALL_PHOTOS/assets/resources` 读取。
- 这个本机路径来自被 git 忽略的 `config/archive_sources.local.json`。新 worktree 没有这个文件，就回退到 example 配置，路径不存在，中间件放行，Vite 返回首页 HTML，图片显示为缺失。
- 同一配置还决定 `/assets/card-art`（卡面原图）、`/assets/audio`、`/assets/lipsync/adxlip` 和旧语音目录。这些在当时的 5177 上也一并失效。
- 修复：复制该配置后，从候选读模型中抽出的 7,349 个 `/assets` 引用里，按 1,508 个目录分组抽样 3,102 个，5177 与 5212 全部返回正确类型（含称号图）。线上 `gs-archive-preview.pages.dev` 与 `preview.gs-archive.com` 的称号图片均为 200 `image/webp`（由 R2 提供）。
- 防再犯：`vite.config.js` 启动时检查这些本机素材根目录，缺失时打印 `local media roots not found: ...`。

同类风险（下列文件都被 git 忽略，新 worktree 都要自己补齐）：

| 缺什么 | 表现 | 补法 |
| --- | --- | --- |
| `config/archive_sources.local.json` | 称号、卡面原图、音频、唇形同步失效 | 从主工作区复制 |
| `public/assets/{bg,cards,spines,voice,…}`、`public/data/compiled` 等语料 | 页面缺图，播放器无法载入剧本 | 整个目录不存在时用目录联接；目录里有被跟踪文件时（如 `compiled`、`events`）用 `cp -rln` 硬链接补缺，不复制 |
| `core.autocrlf=true` 把 LF 文件检出为 CRLF | 依赖字节哈希的校验失败（如 `verify-extra-story-visuals`、`verify-event-resource-graph`） | 按 `git cat-file` 的原字节改写，再 `git add -u` 刷新索引（暂存区应为空） |
| `node_modules` | 无法构建 | 依赖一致时联接主工作区的目录 |

另外：`build:check` 会按 worktree 里的本地素材重写 `config/resource-audit.json`。在素材不全的 worktree 里，这份结果不能提交，应恢复。

## 三、短链接（路径地址）推广进度

计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md)，各阶段记录 L0/L1/L2、[性能基线](GS_ARCHIVE_PORTAL_PERF_BASELINE_20261013.md)、[SSG 实验](GS_ARCHIVE_PORTAL_SSG_EXPERIMENT_20261013.md)、[测试站发布](GS_ARCHIVE_PORTAL_TEST_DEPLOY_20261013.md)、[图片预算](GS_ARCHIVE_PORTAL_IMAGE_BUDGET_20261013.md)。

### 已完成

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| L0 | 偶像、Unit 详情的地址只保留身份参数 | 完成 |
| L1 | `/idols/<id>/`、`/units/<code>/` 路径地址，可读、可写、可往返，旧 `?view=` 链接照常可用；全部 49 位偶像与 16 个 Unit 已逐一往返验证 | 完成 |
| L2 | 65 个实体 head 外壳（title、description、OG、canonical）与标签页标题；打包后生成，`/idols/*`、`/units/*` 不缓存 | 完成，已接入预览打包 |
| L3 | 冷加载基线（headless，模拟手机） | 完成；真机数据未补 |
| L4 | 两页 SSG 实验，结论是不迁 Astro | 完成 |
| L5 ① | 把 L1+L2 发布到测试站与 `preview.gs-archive.com` | 完成（用户授权）；正式站未动 |
| L5 ② | 门户 CLS 0.68 → 0 | 已上 preview |
| 图片预算 | 门户首屏以下图片延迟加载 | 已上 preview |

本分支在此基础上加入：资料页自我介绍；从资料页进播放器后，返回仍回到 `/idols/<id>/`（冷启动的播放器 URL 也能恢复）。

### 未完成（按建议顺序）

1. **用户确认项**
   - 在 X、Discord、LINE 粘贴 `https://preview.gs-archive.com/idols/001tom/`、`/units/05w00/`，看分享卡片。
   - iPhone、Android 真机走一遍。
   - 是否放开整站的 `X-Robots-Tag: noindex, nofollow`：不影响分享卡片，影响搜索收录。
   - 是否把正式站迁到 `gs-archive.com`。
2. **正式站发布**：用本分支重建 read-model 候选，按发布清单打包（`prepare-readmodel-preview` / `assemble_pages` 都要生成外壳），部署需用户授权。正式站目前还是 10-12 的 `?view=` 版本，**正式站发布前不要对外推广路径链接**。
3. **扩展路径地址**：现在只有偶像和 Unit 有路径。下一批建议是卡片 `/cards/<id>/`、歌曲 `/songs/<code>/`、活动 `/events/<id>/`。
   - 每扩一类，先把该视图加入 `ENFORCED_ROUTE_VIEWS`（路由 schema 审计的批次 F/G）。
   - 再在 `archiveRoute.js` 加路径读写，在 `verify-archive-path-locator.mjs` 里全量往返，在 `generate-entity-head-shells.mjs` 里加外壳。
   - Reader、Player、Home 按原计划不改格式。批次 E（Reader 链接默认不带 `reading_rev`）仍未做。
4. **大图分享卡**：现在 148px 头像只够 `summary` 小卡；要 `summary_large_image`，需要另备 1200×630 图。
5. **L5 ③ 缩短串行链**：在入口脚本里更早发起 read-model 请求，预计省 0.5–1 s，需要完整导航回归。
6. **缓存**：迁到自定义域名后，用 zone 的 Cache Rules 缓存 `/assets/voice/*`、`/assets/spines/*`、`/data/*`。这些 URL 不带数据版本，换 R2 快照时要清缓存。zone 浏览器 TTL 建议改为 “Respect Existing Headers”。这两项都需要控制台权限。

## 四、其他待办

- 首页「原版」抽选：已撤回，现在是待办（`src/data/homeVoiceDecider.js` 和测试保留，未接入）。接入前要先定下点舞台时如何离开当前时段、切到卡面语音。
- 卡池告知视频：27 条推定关联只显示文字；转码需要 CRI 密钥，上传 R2 需要授权。
- 交接第五节的运行时数据：trackTime 历史回填、空表情继承、cue 去重。
- 工作剧情投影读不了 runtime-v2 剧本格式：完整重生 `work_story_index.json` 会丢标题和背景。改造前只能做字段迁移。
- 自我介绍的方法体 `IdolProfileView.OnClickVoiceButton` 尚未反编译。目前结论来自字段与方法声明、表数据和脚本文本的一致。

## 五、本地服务

- 5212：用户的 Codex 预览，跑的是主工作区。
- 5177：本 worktree 的预览，用上面的候选启动，已带本机素材配置。用完关闭。
