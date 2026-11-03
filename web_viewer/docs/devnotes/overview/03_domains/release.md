# 发布、仓库与工作方式（骨架）

**论点**：代码进 Git，数据和媒体进对象存储，两边都按哈希绑定。每件事一个短分支、一个 PR，合并前跑完整套门禁。

## 事实

### 发布

- 站点在 Cloudflare Pages，媒体和数据在 R2。测试站是 `preview.gs-archive.com`。〔`CURRENT_STATE.md`；`PREVIEW_DEPLOYMENT.md`〕
- R2 实际占用 7,688,943,418 B（10-21 口径）。〔`CURRENT_STATE.md`〕
- 每次只上传增量批次，批次按叠加链记录。〔`GS_ARCHIVE_R2_RELEASE_20261021.md`；`R2_INCREMENTAL_UPLOAD_20261014.md`〕
- 结构化 JSON 用 gzip 存储。〔`STRUCTURED_GZIP_ROLLOUT.md`〕

### 仓库

- 不拆仓，不重写历史。本地 pack 233 MiB（GitHub 显示约 202 MiB），最重的是历史里的 PNG；新媒体不进 Git。〔`REPO_DATA_GOVERNANCE_20261022.md`；PR #82〕
- 多个 worktree 共用主检出的语料，不拷贝。〔PR #63〕

### 工作方式

- 10-14 PR #48（108 个提交）之后不再开大分支，改成按领域命名的短分支：`portal/`、`stage/`、`chart/`、`docs/`……（从 10-20 起）。〔`gh pr list`；合并记录里的分支前缀〕
- 本地门禁 `npm run gate:source` 一次跑完 CI 的所有检查；复现 CI 要用 LF 检出。〔`package.json`；`CURRENT_STATE.md` 本机环境〕
- 验证脚本要做变异测试：把修复改回坏版本，确认它真的失败。
- 每个领域有交接文档，新会话从 `CURRENT_STATE.md` 开始。

## 【站长撰写】

- 一个人带着几个 AI 并行开发，是怎么分工、怎么避免互相踩的（多窗口、多 worktree）。
- 额度和花费要不要写，由站长决定（`00_WRITING_PROCESS.md` 第 6 步）。

## 不写的

R2 密钥、上传凭据和账户信息。
