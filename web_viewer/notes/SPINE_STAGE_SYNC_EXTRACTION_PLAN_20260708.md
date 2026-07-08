# SpineStage Sync Extraction Plan - 2026-07-08

## Current Reading

`SpineStage.vue` is still the highest-risk frontend file. Its `applyState()`
currently coordinates:

- body-type and positioning data readiness
- background and background effects
- camera filter and camera zoom
- background blur/color overlay
- screen slide/fade/effects
- spine spawn/update/remove lifecycle
- face/body animation dispatch
- fade/tint/slide positioning
- debug state refresh

This is too much for one Vue component, but extracting the whole function at
once would be risky before browser regression evidence exists.

## First Cut

The first cut has been implemented: scene-level state application was extracted
from `SpineStage.vue`. Character spawn and position synchronization remain in
`SpineStage.vue` until the regression ledger has visual pass/fail data.

Helper:

```text
src/core/applyStepSceneState.js
```

Suggested boundary:

```js
applyStepSceneState({
  manager,
  step,
  state,
  fallbackBg,
  lastScreenEffectsKey,
})
```

Responsibilities:

- camera filter reset
- background effects
- background set/clear
- `camera_filter`
- `bg_dof` and `bg_dof_transition`
- `bg_color` and `bg_color_transition`
- `screen_slide`
- `camera_zoom`
- `screen_fade`
- `screen_effects` replay key handling

Not included in the first cut:

- `_loadBodyTypes()`
- `_loadOtherSetting()`
- prefab/Y-axis resolution
- `spawnSpine()`
- `updateSpineFace()`
- body animation dispatch
- lip-sync or neck animation decisions
- official z-order handling
- debug panel state

## Why This Boundary

This moves a self-contained group of manager calls without changing the async
spine lifecycle. It also covers high-risk cleanup behavior:

- stale blur/color
- stale screen slide
- stale screen fade
- screen effects replay keys
- camera reset
- cameraflare remaining disabled through `BackgroundManager`

## Required Verification

Completed:

- `npm run build`
- Confirm `REGRESSION_LEDGER_20260708.md` has the four anchor samples listed.

Still required for full confidence:

- Manual visual pass on at least:
  - `1_1_013the_02_1_1_013_02`: intro stage, heart-voice transitions, camera reset.
  - `1_1_015leg_04_1_1_015_04`: multi-character retention and camera clamp.

## Hold Points

Do not extract the spine loop until these are visually checked:

- `001tom` / `004ter` / `047shu` lip-sync sample in `1_4_001_00`.
- Repeated choice navigation in `1_4_001_01`.
- Back navigation across automatic `stage` and `text_disable` steps.
