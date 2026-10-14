# Git 工作方式（2026-10-14 起）

当前事实（master、两条线、read-model、正式站、测试站）记在 [CURRENT_STATE.md](CURRENT_STATE.md)。开始任何任务前先读它，再看具体的批次文档。

## 六条规则

1. **master 是稳定基线，不在上面直接开发。** 进入 master 一律走 PR，用普通 merge commit。不 squash、不 rebase：逆向批次的错误实现、反查、纠正都是证据，要保留。
2. **PR 不需要别人审批**，但禁止直接 push、force push 和删除 master（GitHub ruleset「Protect master」）。
3. **长期只有两个开发方向**，每次从最新 master 开一代新分支：
   - `portal/<日期>-<主题>`：资料馆 UI/UX、Reader、导航、短链接、SEO、read-model 消费方、目录、数据关系展示、性能、Cloudflare 前端。周期短，一个功能块做完就 PR。
   - `stage/<日期>-<主题>`：原版逆向、舞台小人、镜头、灯光、材质、粒子、排序、背屏。可以多积累几十个提交，一批原生语义收束后 PR。

   方向是长期的，分支不是。合并后分支自动删除，下一批再从 master 开新的一代。
4. **分支按任务命名，不按 Claude / Codex 命名。** 另外两种前缀：
   - `fix/<日期>-<主题>`：独立小修。
   - `exp/<日期>-<主题>`：高风险实验，尽量只在本地或 worktree 里。
5. **合并了的分支就删。** 不合入但有价值的实验：打 tag `experiment/<主题>-<日期>`，结论写进 docs，然后删分支。被取代的旧分支：打 tag `archive/<原分支名>` 后删除。分支不是档案，档案是 commit、PR、docs 和 tag。
6. **合并到 master 和部署正式站是两件事。** master 更新不会自动上线；正式站部署要用户明确授权，测试站部署按任务授权。

## 两条线之间

- 只以 master（或本线自己）为 base。不要从 portal 分支开 stage 分支，反过来也不行。
- master 前进之后，活跃的线用 `git fetch origin && git merge origin/master` 跟上，**不 rebase、不 force push**。远端分支可能有多个 Agent 在用。
- 临时排查直接提交到当前线的分支。需要隔离时开本地 `exp/` 或 worktree，成功后 merge 或 cherry-pick 回线上，然后删除 `exp/`。

## 合并清单

1. 分支已推送；`npm run build:check` 和相关回归通过（见 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)）。
2. `gh pr create --base master`，描述里写清验证边界。
3. `gh pr merge <PR> --merge`（只用 merge commit）。
4. 更新 [CURRENT_STATE.md](CURRENT_STATE.md)，经下一条线的 PR 进入 master。
5. 阶段性基线打 tag：`baseline/<日期>`。

## 仓库设置（2026-10-14 已应用）

- Ruleset「Protect master」：要求 PR（0 个审批）、禁止删除、禁止 force push。没有 required status checks、linear history、签名提交和 merge queue。
- 合并后自动删除 head 分支。
- 只允许 merge commit；squash 和 rebase 合并已关闭。
