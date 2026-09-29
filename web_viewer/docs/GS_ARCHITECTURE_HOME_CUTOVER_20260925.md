# GS 游戏风首页 read-model 接线：2026-09-25

## 基线与范围

- 输入分支 `codex/gs-architecture-rebuild`，本批开始于 `1f52392`。保留原有无关未跟踪文件。
- 生成器为 Home 索引投影 49 位偶像、原首页统计与 36 项活动焦点；候选 `E:\GS_readmodels_candidate_20260925_r4`，release `91e0d3fdc9821a3496e8337784f711b73a66e435f65b88aa8e137540c8eeb7f8`，共 2,961 个产物，已逐一核验。仓库内同步该候选的 11,509 字节 inline bootstrap。候选未发布。
- Portal → 选择偶像 → 游戏风首页、Home 直达与偶像切换改为加载 Home 索引、所选偶像详情和其台词页。保留重复台词 ID 的原始顺序；内存只保留最近三个完整偶像档案。返回 Portal 保留 Home 来源；进入尚未迁移的故事等栏目时再读取旧批量数据。

## 验证

- `node --test readmodels/tests/*.test.mjs`、相关 archive 路由及导航回归、`npm run build:check` 通过。`build:check` 只编译代码到 `.analysis/build-check`，不复制 `public` 语料；主 JS 约 597 kB（gzip 约 188 kB），仍有大 chunk 提示。
- Codex 应用内 Browser 在 `127.0.0.1:5176` 检查了 Portal → 选择天ヶ瀬冬馬 → Home（63 条台词）、切换御手洗翔太（52 条）、直达刷新、Home → Portal → 返回 Home，以及 Portal → 故事目录。遇到重复台词 ID 导致的首次进入失败后已修复并重验；Home 到 Portal 的导航阻断也已修复并重验。
- QA 服务将 `.analysis/build-check`、现有 `public` 和 r4 候选 `pages` 映射到同一 origin。Home 旅程请求对应 read-model 索引、详情、台词页及舞台静态配置；进入故事栏目时才读取旧启动批量数据。Spine 在偶像切换时有两条运行时警告，所见页面仍渲染；本批未做真实音频或长时间舞台验收。

## 后续边界

- 仍需迁移偶像、组合、卡片、卡池、剧情等栏目并完成指导包的路由合同。代码分包、完整资源包、部署和真实设备验收均未完成。`build:check` 输出不是可发布包。
