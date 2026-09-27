# Loading presentation preview — 2026-09-27

## Source and scope

- User requested implementation of `GS_Loading_Code_Guide_c6a6e19.zip` and a new test deployment. The package was reference material; its standalone installer restriction on deployment did not override that request.
- Input HEAD: `39f8085`; package blob preflight passed for all targeted loading files.
- Code commit: `4f9bf633ef8e0600612411cfca1991870f190796` on `codex/gs-architecture-rebuild`.
- Shared presentation component supplies the silver badge, turquoise ring, inline variant, light/dark copy, reduced-motion and forced-colors CSS. LoadingScreen, ArchiveShell, StoryViewer, SpineViewer, ChibiStageViewer and ArchiveStoryReader consume it.
- Caller-owned readiness, cancellation, resource counts, error branches and audio policy remain in their existing owners. Soft navigation sits inside shell content, above the mobile bottom navigation.
- The supplied component regression script was isolated from the full Vite archive middleware (`configFile: false`, Vue plugin, no filesystem watcher). Its first full-config attempt stalled and was stopped; the isolated test and the separate normal application build both passed.

## Verification

Passed on this code batch:

- `node scripts/verify-archive-loading-copy.mjs` — 17 checks.
- `npm run verify:archive-startup-route`
- `npm run verify:archive-async-navigation`
- `npm run verify:archive-navigation-state`
- `npm run verify:story-step-playback-state`
- `node scripts/verify-story-audio-session.mjs`
- `npm run build:check` and `npm run verify:build-audit`
- `git diff --check`

Browser observations used the compiled application in the in-app Browser. Local QA injected response delays/errors through an untracked loopback server; these are deterministic state checks, not measurements of real network speed.

| Flow | Observed result |
| --- | --- |
| 390 × 844 portal → delayed gasha navigation | Compact waiting indicator above bottom navigation; existing portal remained usable. Selecting cards during the wait opened cards. |
| Card `001tom_sr07` → phone story | Silver Now Loading badge and original preparation message appeared; normal completion entered the player and displayed dialogue. |
| Delayed phone-story load → cancel | Cancel button actionable; loading overlay disappeared and card detail remained. Slow-loading copy was also observed after the threshold. |
| Reader `1_4_001_00_b`, delayed detail response | Inline loading indicator, no full-screen blocker. |
| Reader injected 503 → retry after recovery | Error and retry button appeared; retry restored EPISODE 02 and the actual dialogue body. |
| Remote deployment portal | Actual portal heading and all eight navigation entries rendered. |

Not claimed as accepted: real Android/iOS/QQ devices, complete viewport matrix, assistive-technology interaction, OS reduced-motion/forced-colors rendering, or every Spine/chibi/local-buffering transition. Component checks and code compilation cover those edited components; they do not replace those runtime checks.

## Test deployment

- Immutable test URL: https://83871fee.gs-archive-preview.pages.dev
- Test alias: https://gs-architecture-device-test.gs-archive-preview.pages.dev
- Project: `gs-archive-preview`; preview branch: `gs-architecture-device-test`.
- Package: `.deploy/loading-preview-4f9bf63`; 8,541 files / 62,642,091 bytes, clean source code build. No full public/media corpus copy and no R2 media upload.
- ReadModels: `E:/GS_ReadModels_QA/candidate_20260927_r23`, release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`.
- Data revision: `c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9`.
- Initial JavaScript gzip estimate: 108,383 bytes; build audit found no forbidden modules or legacy call sites.
- Remote HTTP receipt: `.deploy/loading-preview-4f9bf63/http-receipt.json`; **78 checks passed**, zero failures, including artifact hashes, deployed index/bootstrap/receipt identity, audio Range/416 and decoded gzip data.
- Before/after production deployment listings both identify `6ed057d8-7178-4183-96bd-a5f5c1942406`, branch `master`, source `37fe055`. Production was unchanged.
- `productionApproved` and `deviceReviewAccepted` remain false. This is a test deployment, not a completed production/device release gate.

Unrelated untracked files were preserved. QA scratch files and the deployment package remain outside the scoped commits.
