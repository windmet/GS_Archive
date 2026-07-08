# Next Step Guidance - 2026-07-08

## Summary

The next phase should be a stabilization and evidence pass, not a broad feature push.
The viewer has enough architecture split to keep moving, but the biggest risk is
misclassifying data/resource behavior as frontend bugs.

The first stabilization pass is now underway: the regression ledger exists, a
direct scenario URL is available for browser checks, active source mojibake has
been repaired, and scene-level state synchronization has been extracted from
`SpineStage.vue` into `src/core/applyStepSceneState.js`.

## Current Decisions

- `cameraflare` stays archived. The extracted particle path exists for reference,
  but it is not visually reliable on web and must remain disabled at runtime.
- Neck animation stays disabled. Do not reopen body/neck motion blending until a
  larger action-system review is explicitly scheduled.
- The `PixiStageManager.js.bak-*` backups were safe to delete and should not be
  carried forward.
- The remaining encoding-review items are mostly Markdown notes. Treat them as
  review material, not urgent product bugs, unless the same broken text appears
  in active source code or rendered UI.

## Principle

For every visual or playback issue, verify the chain in this order:

1. Raw command or resource evidence.
2. Compiled JSON output.
3. Vue state consumption.
4. Pixi/Spine/Audio runtime behavior.
5. Rendered browser result.

Do not tune frontend constants until the compiled state is proven correct.

## Recommended Work Order

### 1. Continue The Regression Ledger

Maintain the manual regression table before more refactors. The ledger lives in
`REGRESSION_LEDGER_20260708.md` and currently starts with:

- `1_1_013the_02_1_1_013_02`
- `1_1_015leg_04_1_1_015_04`
- `1_4_001_00`
- `1_4_001_01`

For each sample, record:

- expected official behavior
- current web behavior
- relevant step IDs
- raw command evidence
- compiled state fields
- frontend consumer file/function
- pass/fail status

Current browser smoke status:

- `1_1_013the_02_1_1_013_02`: rendered successfully through the direct URL with
  `noVoice=1`; auto-advanced to `10 / 202`.
- `1_1_015leg_04_1_1_015_04`: rendered successfully with visible multi-character
  stage at `12 / 252`.
- `1_4_001_00`: rendered successfully with three characters at `20 / 60`; lip
  motion still needs a voice-on pass.
- `1_4_001_01`: still pending; prioritize choice/phone branch validation next.

Direct validation URL pattern:

```text
http://127.0.0.1:5173/?scenario=<compiled-file>.json&startStep=<step>&noVoice=1
```

### 2. Keep Encoding Findings Classified

Do not bulk-rewrite notes. First classify each copied Markdown file as one of:

- `display-only`: terminal or editor display issue
- `resource-text`: valid Japanese/game text that matched broad scan rules
- `true-mojibake`: text is visibly corrupted in the file itself
- `obsolete-note`: historical note kept only for context

Only `true-mojibake` files should be repaired from clean sources.

Active source has already been repaired in:

- `src/core/useStoryNavigation.js`
- `src/components/SpineStage.vue`
- `src/App.vue`

The remaining copied files under `_encoding_review/garbled_files_20260708/` are
review material unless a specific section is promoted back into active docs.

### 3. Stabilize State Cleanup

Keep testing fast forward/back navigation and step replay. The highest-risk
areas are:

- stale tween cancellation
- `text_disable` transition replay
- screen effect replay keys
- multi-character visibility retention
- camera reset and background clamp

These should remain higher priority than new visual effects.

### 4. Continue Containing `SpineStage.vue`

The next useful refactor is not another renderer feature. The first extraction
has moved scene-level sync into `applyStepSceneState()`. Continue by extracting
only one additional narrow boundary at a time.

The first-cut extraction boundary is documented in
`SPINE_STAGE_SYNC_EXTRACTION_PLAN_20260708.md`.

Current shape:

- keep template/debug UI in `SpineStage.vue`
- keep scene-level state diff and manager calls in `applyStepSceneState()`
- preserve the existing manager facade calls
- verify with the regression ledger before and after

Possible next boundary:

- isolate Spine model lifecycle/reconciliation from `applyState()`, but only
  after the pending choice/voice regression checks are recorded.

### 5. Keep Deferred Areas Explicit

Do not work on these unless they become the named focus of a new pass:

- cameraflare and similar guessed visual effects
- neck/head animation blending
- broad motion transition model changes
- large package splitting or bundle optimization

## Definition Of Done For The Next Pass

- Regression ledger covers the four anchor samples and includes browser evidence.
- Encoding review files remain classified, with no bulk rewrite.
- `cameraflare` remains unreachable at runtime.
- Neck animation remains no-op.
- Scene-level synchronization extraction stays build-clean.
- `1_4_001_01` choice/phone flow and `1_4_001_00` voice-on lip motion are checked
  before the next renderer refactor.
