# Development Status - 2026-07-08

## Current Architecture

- `App.vue` remains the entry and archive/navigation surface.
- `StoryViewer.vue` is the playback coordinator and now delegates voice, timeline, navigation, and step scene effects to composables.
- `SpineStage.vue` is still the main Vue-to-Pixi adapter. Its highest-risk area remains `applyState()` and state synchronization.
- `PixiStageManager.js` is now mostly a facade over `BackgroundManager`, `CameraController`, `SpineManager`, and `LipSyncController`.

## Confirmed Decisions

- `cameraflare` is archived and must stay disabled. An extracted particle/flare implementation exists, but the web result is poor and should not be enabled, including through URL flags.
- Neck animation remains disabled. Do not attempt a motion-system rewrite yet; keep the current no-op behavior until the broader body/neck transition model is ready to be revisited.
- Encoding-review files have been copied to `_encoding_review/garbled_files_20260708/`. After review, the remaining items are mostly Markdown notes and may be Japanese resource text or display-encoding artifacts rather than true source corruption.
- Old `PixiStageManager.js.bak-*` migration backups were confirmed safe to delete.

## Current Validation State

- `npm run build` passes.
- The production build still reports the expected large chunk warning for the Pixi/Spine-heavy bundle.

## Next Debugging Direction

1. Classify encoding-review files before repairing anything: display-only, resource-text, true-mojibake, or obsolete-note.
2. Keep regression focus on known story samples:
   - `1_1_013the_02_1_1_013_02`
   - `1_1_015leg_04_1_1_015_04`
   - `1_4_001_00`
   - `1_4_001_01`
3. Continue treating compiled JSON as the first source of truth before debugging Vue/Pixi rendering.
4. Do not expand visual effects work until `image_bg_view_type` and remaining text asset semantics are verified against samples.
5. Follow `NEXT_STEP_GUIDANCE_20260708.md` for the next stabilization pass.
