# Local verification and disk use

Read [BUILD_ACCEPTANCE_POLICY.md](docs/BUILD_ACCEPTANCE_POLICY.md) before building or creating QA output.

- Routine code verification uses `npm run build:check`: complete Vite code compilation, no public corpus copy, one reusable output under this checkout's `.analysis/build-check`.
- Do not use `npm run build`, `npm run smoke`, or direct Vite builds with default public copying for every commit. Those create full asset packages and are reserved for actual packaging/release validation.
- Never put full SideM asset packages or repeated timestamped build trees on C: or under `$CODEX_HOME/qa`. Screenshots and small logs are different from media packages.
- Documentation-only changes need link/content/diff checks, not an application build. Code changes need relevant regressions; rendered changes also need actual Browser verification.
- Check latest HEAD/worktree and active process before cleanup or starting a server. Preserve unrelated untracked files and evidence. Stage explicit paths; record validation boundaries and commit/push the scoped batch.

# Branches and current state

Read [CURRENT_STATE.md](docs/CURRENT_STATE.md) first, then [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

- Never push to `master`; enter it only by PR with a merge commit (no squash/rebase).
- Work on the lane branch for the task: `portal/<date>-<topic>`, `stage/<date>-<topic>` or `i18n/<date>-<topic>` (translation), each cut from the latest `master`; `fix/` and `exp/` for small fixes and local experiments; `release/` for R2 uploads, read-model binds and deploy records. Do not name branches after the agent.
- Keep a lane current with `git merge origin/master`; never rebase or force-push a pushed branch.
- Merging to `master` is not a deploy. Production deploys need explicit user authorization.
