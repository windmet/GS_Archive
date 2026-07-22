# Story Runtime legacy owner cleanup (2026-07-22)

## Decision

Screen, background, camera, SE, snapshot, and Spine cue playback now have one production owner: `useStoryRuntimeCues` and its channel runtimes. The compatibility URL flags and their duplicate writers are retired.

The independent owner commits remain the rollback boundary in Git. Runtime behavior is no longer switched by `runtimeCues`, `runtimeScreen`, `runtimeBackground`, `runtimeCamera`, `runtimeSE`, `runtimeSnapshots`, or `runtimeSpine` query parameters; those parameters are ignored.

## Removed paths

- Deleted `RuntimeFeatureFlags.js` and all conditional handler/snapshot registration.
- Deleted `useTimelineRunner.js`, including its separate Spine RAF, settle, cancel, and fast-forward path.
- Removed legacy background, camera transform, directional wipe, and fade writes from `applyStepSceneState`.
- Removed legacy SE timers and playback from `useStepSceneEffects`.
- Removed timeline fast-forward/cancel plumbing from navigation, episode completion, scene freeze, and component cleanup.
- Replaced rollback-flag verifier cases with assertions that retired manager/audio methods are never called.

## Responsibilities intentionally retained

These are not duplicate Runtime channel owners and must remain until separately migrated:

- `useStepSceneEffects`: voice start, BGM, environmental audio, and authored transition-step auto advance.
- `applyStepSceneState`: camera filters, background effects/blur/color overlay, and non-fade screen effects.
- `SpineStage`: initial/fallback background setup when the current step does not author a background, Spine instance lifecycle, and scene rendering.

## Acceptance contract

- Normalized cues always register Screen, Background, Camera, SE, and Spine handlers.
- Entry snapshots always restore camera, screen overlay, and background through Runtime channel snapshot helpers.
- Back/History restore always uses `SceneSnapshotStore`; there is no URL rollback to the index-only path.
- Delayed cues remain owned by `EffectScheduler` and are settled or cancelled through the Runtime lifecycle.
- Legacy query parameters must produce the same behavior as an otherwise identical default URL.

## Verification

- `node scripts/verify-story-runtime-foundation.mjs`
- `node scripts/verify-story-playback-range.mjs`
- `npm run build`
- Single-tab browser checks on the `1_4_001_01_a` Passion cue anchor and the `1_4_001_01_d` fade/neck restore anchor, including one URL carrying retired query flags.

This record supersedes the URL rollback sections in the individual Screen, Background, Camera, SE, and Snapshot owner audit notes.
