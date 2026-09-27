# Player repair application and local acceptance — 2026-09-28

## Source and changes

- Input branch/HEAD, checked against a fresh origin fetch: `codex/gs-architecture-rebuild` / `a93a647e6e82fc1340e58e59c8ea18bcd60a2228`.
- User requested applying and accepting `GS_Player_Repair_a93a647_r1.zip`. Its documents were implementation reference, not independent authorization for deployment.
- ZIP SHA-256: `1a2b0af456b9753a2d67d7d224a4c6ffdedc338fafc8342327e04656f1cc3810`.
- Installer preflight matched all 51 target files. Applied with per-file backups; receipt: `.analysis/player-repair-backups/20260927T161709Z-00b7e09a/receipt.json`. The backup is the package-application baseline; subsequent fixes mean automated rollback correctly refuses changed installed files.
- Code commit: `b41ea8177694c1dc3db03352a226a3084f29f5fd`, pushed to the same branch. No PR, Preview, production deployment, R2 changes, media conversion, or full public copy was performed.
- Entry/return descriptors, cancellation ownership, renderer-led readiness, live near-resource window, retryable actor configuration, Buffer/media voice backends, audio pause/disposal, backlog audition and Home asynchronous success handling were applied together because their contracts are coupled.

Local acceptance found and corrected omissions in the supplied package:

1. Reader navigation/playback and Portal VM fixtures now receive the real `isDirectScenarioEntry` import. No assertions were removed.
2. Empty preload plans again omit progress callbacks, preserving the existing zero-task contract.
3. Cancellation regression uses the actual shared deadline implementation and preserves real HTTP body abort/image cleanup checks in full/audit mode. Runtime-owned entry/warmup cancellation is covered separately by the repair suite.
4. The full repair suite is explicitly included in Source Gate.
5. Browser inspection found the diagnostic control overlapping the desktop Back button. It now sits below the top controls. Diagnostic JSON remains visible after export because the in-app clipboard read returned empty despite a successful page copy indication.

## Commands and build evidence

- `npm run verify:player-repair`: **35/35**, exit 0, actual installed Vue; no fixture loader/shim.
- All 17 scripts listed in the package's existing-regression matrix passed, including real local configuration metadata and actual Pixi atlas parsing. `verify-voice-load-recovery` uses its candidate default.
- Local Source Gate sweep executed 82 command groups. Initial Reader/Portal fixture failures and loading-safety regressions were fixed, and the complete affected aggregates were rerun successfully. `verify:publication-ledger -- --base-sha a93a647e6e82fc1340e58e59c8ea18bcd60a2228` also passed (short SHA was rejected and rerun with the required full SHA).
- `npm run build:check` and `npm run verify:build-audit`: exit 0. Final local application bundle was built before commit, recording input `a93a647` plus `sourceDirty=true`; its source became `b41ea81`. Output reused `.analysis/build-check`, `copyPublicDir=false`. It is not a standalone media release package.
- Final local initial JS gzip estimate: 111,789 bytes. `forbiddenModules`, `productionLegacyModules`, `legacyCallSites` are empty; `globalArchiveLoadRemoved=true`. Progress audit still reports `allPublicRoutesMigrated=false`, `deviceReviewAccepted=false`.
- `git diff --check`: passed.
- Local `verify:archive-assets` failed twice at different loopback fixture requests (`ECONNRESET`, then timeout). This is retained as a local failure, not a passing test or diagnosed root cause.
- [Full Linux Source Gate on b41ea81](https://github.com/windmet/GS_Archive/actions/runs/36333259096): **success**, including the new repair suite, complete Reading aggregate, shared archive asset HTTP contract, compilation and build audit. This supplies the missing clean-environment HTTP gate evidence; it does not erase the local failures.

Small QA logs, request logs, screenshots and exported JSON are in `E:/Web_build/SideM_Archived/.analysis/player-repair-qa/`; original package material remains in sibling `player-repair-input/`. Unrelated untracked files were preserved.

## Actual browser environment

Used Codex in-app Browser through the available unified computer-use Browser APIs (`goto`, DOM snapshots, scoped clicks, viewport, screenshots, console logs). No external Playwright/browser installation was needed.

- Desktop: 1280 × 900; narrow layout: 390 × 844. Temporary viewport override reset afterwards.
- Initial 5188 check exposed its intentional legacy `/data/` block, including actor metadata 503s. Background-only playback still opened, but this service cannot accept later actor/audio flows.
- Dedicated loopback QA at `http://127.0.0.1:5194` serves the current compiled application, existing public files, r23 readmodels and the repository's existing external audio/lipsync resolver. Audio supports Range. Nothing was copied into a media package.
- Readmodel release: `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`, from `E:/GS_ReadModels_QA/candidate_20260927_r23/pages`.
- Request caching is disabled by the QA server. First visit to the new QA origin and subsequent fresh-document navigations were tested; an entirely fresh browser process/context or explicit profile-cache purge was **not** available/claimed.
- Deterministic delays/statuses came from the QA server's `rules.json`; the file was restored to `[]` after tests. They are fault tests, not real-network latency measurements.

## Browser journeys

Target: supplied main-story deep link → current renderer frame → dialogue/voice → cancel, retry, backlog and return with preserved source.

| Journey | Observed result |
| --- | --- |
| Supplied `episodes/1_4_001_00_a.json`, steps 2–27, return collection 101 | Real background and dialogue render; no blank page or framework error overlay. Final trace reports first renderer playable at 594 ms and collection-index request starting at 621 ms. This proves order for this local sample, not a mobile timing guarantee. |
| Desktop dialogue and backlog | Reached character 047shu / STEP 12. Backlog replay reported `voice-started`, backend `webaudio`, context `running`; scheduler remained paused by overlay while voice source was active. Actual M4A request returned 200. |
| Menu → compatible playback → replay | Actual backend `media`, `sourceStarted=true`, `currentTime=0.566183`, duration about 3.403 s, `readyState=4`, unmuted, no media error. One voice source alongside BGM/ambient. This is playback-state evidence, not human listening or RMS measurement. |
| Back → original collection | Returned to main collection 101 with selected PROLOGUE, story file and original story-catalog source retained. |
| Directory episode click / delayed raw deep link → cancel | Loading request delayed 12 seconds. Cancelled deep link returned to the correct chapter; later observation remained on that route, with no obsolete Player takeover. |
| Initial bg066 404 | Explicit required-frame blocked message and retry/return controls; no fabricated playable result. After restoring resource, current-segment retry rendered the background. |
| Narrow layout: skip first episode → next episode 503 | Current episode completion stayed available with an error and retry. Restoring source and selecting retry entered `1_4_001_00_b.json`, range 1–33, once; no permanent transition spinner. |
| Second episode → skip/end | Story-complete state offered return only, no next episode from another chapter. |
| Reader → modified scenario response bytes | First attempt, repeated entry and generic retry all refused with the source-version mismatch message. Restoring source allowed playback; Back restored the same Reader document and full origin chain. |
| Home | Welcome selection → 冬馬; stage double-click changed dialogue and showed a real stop-voice control. Switching to 翔太 displayed his own first line, then Portal navigation succeeded. Prepared-cache race ownership is proven by the bounded unit cases, not inferred from this fast local click alone. |

Screenshots: `desktop.png` (character dialogue and clear top controls), `mobile.png` (second episode after failure recovery), `reader-source-rejected.png` (source guard).
Exports: `final-entry-trace.json`, `backlog-trace.json`, `media-trace.json`; requests: `requests.jsonl`.

Normal playback checks reported no console errors. Pixi/Spine deprecation warning stacks were observed. The later error log includes intentional 503 and Reader source-mismatch injections, not a claim of an empty console for the entire run. Earlier test-service 404/503 mapping failures were corrected in the QA mapping, not hidden in production code.

## Remaining acceptance boundaries

- Android Edge and iPad Edge, real first cold launch, physical audio output, subjective lip synchronization, OS background/resume, cross-backend rate behavior and long-duration stability remain unaccepted. Desktop narrow layout is not device evidence.
- Decoder EncodingError fallback, blocked autoplay, delayed PCM ownership, media pause/dispose and late queue behavior passed the repair tests; the independent native-audio harness was not rerun locally, and those injected cases were not all reproduced in the actual site Browser.
- Full metadata bad-200/timeout/recovery UI matrix, late parent-return versus new navigation, Home costume-change races and all corpus/routes were not exhaustively exercised. Store/owner regression evidence must not be promoted into those Browser claims.
- No new Preview URL exists for this batch. Device testing should use a new explicitly requested isolated Preview tied to the code SHA; old deployment URLs still contain old code.
