# GS Archive P0 Architecture Closeout

Status: branch-level P0 closeout verified; merge to `master` required before P1
Date: 2026-07-30
Functional baseline: `master@721c58b29e0eb953e8ba6138521d825d98e1cc63`
Closeout branch: `codex/reconcile-product-history-p2`
Pull request: #31 (draft)

## 1. P0 scope

This closeout covers only the present-tense engineering map:

- product and Agent entry points;
- tracked source authority;
- Story Runtime owner, active adapter, debug/release instrumentation and retired
  boundaries;
- the 26 query-route views;
- current publication, authoritative and external-resource facts;
- standard machine commands that prove those boundaries.

It does not implement a P1 portal feature, create a publication transaction,
promote another strict-v2 collection, modify resource mappings or claim the
2–4 hour Runtime soak has run.

## 2. Current product topology

```text
src/main.js
  -> src/App.vue
     -> ArchiveShell + archive list/detail/resource views
     -> StoryViewer.vue
        -> SpineStage.vue
           -> PixiStageManager.js + rendering managers
```

`src/core/archiveRoute.js` is the query-route contract. Its `VALID_VIEWS` set
contains 26 views. A direct source comparison against every `view === ...`
branch in `src/App.vue` also produces 26 views with no difference.

The authoritative view list is maintained in `docs/PROJECT_MAP.md`. Historical
screenshots and notes do not override `VALID_VIEWS` or the mounted branches in
`App.vue`.

## 3. Runtime ownership

| Responsibility | Authoritative owner |
| --- | --- |
| Playback session, step coordination, history restore, pause reasons and diagnostics | `src/core/StoryViewer.vue` |
| Scenario normalization and cue scheduling | `src/core/story-runtime/useStoryRuntimeCues.js` |
| Logical time | `src/core/story-runtime/StoryClock.js` |
| Cue lifecycle and channel registry | `src/core/story-runtime/EffectScheduler.js`, `PerformanceRegistry.js` |
| Stable scene history | `src/core/story-runtime/SceneSnapshotStore.js`, `StepSceneState.js` |
| Shared Voice/SE/BGM/Ambient context and buses | `src/core/story-runtime/StoryAudioSession.js` |
| Pixi/Spine/background/camera/screen execution | `src/core/PixiStageManager.js` and its managers |

### Active adapters

- `useStoryNavigation.js`: bounded episode navigation, choice and restore entry;
- `useVoicePlayer.js`: Voice loading/playback/lipsync over the shared audio session;
- `useStepSceneEffects.js`: BGM, Ambient, Voice trigger and legacy Auto glue;
- `AudioManager.js`: BGM, Ambient and SE sources over `StoryAudioSession`;
- `applyStepSceneState.js`: compatible projection of local visual state not owned
  by Runtime transition cues;
- `SpineStage.vue`: Vue lifecycle and scene/snapshot bridge to Pixi.

These modules are production-active. None is a second clock, cue scheduler or
audio-session owner.

### Debug/release instrumentation

- `DebugSnapshotRuntime.js` is only used by the `snapshotAt` diagnostic cue;
- `ReleaseSoakRecorder.js` supplies bounded sampling/export under
  `runtimeDebug=1`;
- `installSpineAnimationDebug.js` exposes diagnostic hooks.

Passing their automated tests proves instrumentation behavior only. It does not
convert the unexecuted 2–4 hour acceptance run into PASS.

### Retired or non-authoritative

- `useTimelineRunner.js` is absent from tracked source and is retired;
- `SpineStage.vue` is not the whole-step timeline owner;
- the ignored local `src/core/PixiStageManager_4_guided_fix.js` is an early work
  copy and is not repository authority;
- `ArchiveHome.vue` is tracked but not mounted by `App.vue`; the active home view
  mounts `ArchiveImmersiveHome.vue`.

## 4. Legacy state and Runtime cue boundary

`ScenarioNormalizer` translates legacy `state.screen_slide`,
`state.screen_fade`, background, camera and SE shapes into normalized Runtime
cues. `useStoryRuntimeCues` owns those transitions.

`applyStepSceneState` deliberately does not replay retired Screen, Background,
Camera or SE transition paths. The fixed examples in `docs/SMOKE_CASES.md` and
`docs/SMOKE_EXPECTATIONS.md` are manual compatibility inputs; they are not an
automated owner test and `npm run smoke` is only a production build alias.

## 5. Current governance facts

Fresh local verification on this branch proves:

- archive baseline: 10,329 compiled JSON artifacts and 108 tracked PNG files;
- authoritative Runtime v2: 3 collections + 1 standalone / 18 artifacts;
- ledger-governed authoritative scope: 1 logical object;
- publication ledger: 1 release / 1 stable logical ID;
- external GS resources: 8 records / 8 exact mappings / 8 unique BVIDs;
- publication v1 is frozen; publication v2 and annotation v1 are active;
- no second production release or historical annotation was created by P0.

Compiled artifact count is not story count. External community links remain
outside the local publication ledger.

## 6. P0 verification record

The following commands passed:

```powershell
npm run verify:story-runtime-foundation
npm run verify:story-audio
npm run verify:routes
npm run verify:story-playback-range
npm run verify:release-soak
npm run verify:archive-sources
npm run verify:archive-baseline:source-only
npm run verify:authoritative-story-publications
npm run verify:publication-ledger
npm run verify:external-story-resources
npm run build
git diff --check
```

Observed production build:

```text
Vite 6.4.3
2,407 modules transformed
PASS in 1 minute 56 seconds
```

At capture time, `127.0.0.1:5174` remained served by PID 27536. This PID is
ephemeral and must be rechecked in the next window.

## 7. Completion and merge boundary

P0 is branch-level complete only when:

- current entry documents agree with this report;
- the standard verifier command exists in `package.json`;
- the intended diff contains no P1 implementation or unrelated generated files;
- all commands in section 6 pass;
- the branch is committed and pushed.

P0 is repository-level complete only after this closeout is merged into
`master`. A P1 window must verify that its `origin/master` contains this report
before starting a product batch.

## 8. P1 handoff boundary

The first recommended P1 batch is the bounded archive breadcrumb:

- derive the model from `archiveRoute.js` and the loaded entity;
- use existing route builders;
- keep canonical hierarchy separate from browsing provenance;
- preserve filters plus existing `parent`, `return` and Back behavior;
- do not render it in `player`, `spine_lab` or `chibi_stage`;
- do not combine it with search, relation-data or publication changes;
- verify Idol, Card, Event, Story collection and External resource through
  natural entry, deep link, refresh, Back, narrow viewport and accessibility
  semantics.

Representative strict-v2 promotion belongs to P2-A. The 2–4 hour Runtime soak
belongs to P2-B and remains `NOT EXECUTED`.
