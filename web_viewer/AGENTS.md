# Local verification and disk use

Read [BUILD_ACCEPTANCE_POLICY.md](docs/BUILD_ACCEPTANCE_POLICY.md) before building or creating QA output.

- Routine code verification uses `npm run build:check`: complete Vite code compilation, no public corpus copy, one reusable output under this checkout's `.analysis/build-check`.
- Do not use `npm run build`, `npm run smoke`, or direct Vite builds with default public copying for every commit. Those create full asset packages and are reserved for actual packaging/release validation.
- Never put full SideM asset packages or repeated timestamped build trees on C: or under `$CODEX_HOME/qa`. Screenshots and small logs are different from media packages.
- Documentation-only changes need link/content/diff checks, not an application build. Code changes need relevant regressions; rendered changes also need actual Browser verification.
- Check latest HEAD/worktree and active process before cleanup or starting a server. Preserve unrelated untracked files and evidence. Stage explicit paths; record validation boundaries and commit/push the scoped batch.
