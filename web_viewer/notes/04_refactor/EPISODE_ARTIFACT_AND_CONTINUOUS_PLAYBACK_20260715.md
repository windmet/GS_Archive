# Episode Artifact And Continuous Playback

## Decision

Raw lettered scenario files are authored as individual episodes. The archive
should therefore use an episode as the player lifecycle boundary.

The previous aggregate files remain available for compatibility and for state
derivation. New compilation also writes independently loadable files under:

```text
public/data/compiled/episodes/{source_scenario_id}.json
```

For example, `1_4_001_00.json` remains valid while its two authored episodes
are available as `episodes/1_4_001_00_a.json` and
`episodes/1_4_001_00_b.json`.

## Why The Aggregate Is Not Deleted Yet

`ScenarioCompiler.compile_group()` runs lettered raw files through one state
machine. This preserves intentionally carried audio state and lets the
compiler apply audited visual resets between chunks. Compiling every raw file
from a blank state would lose that inherited context.

The episode artifacts are therefore sliced from the completed aggregate. Each
slice keeps the resolved scene state, dialogue, voice and timeline data, while
step ids, choice targets and jump points are rebased to local one-based ids.
Cross-episode choices are rejected during generation.

## Current Inventory

- 3,398 aggregate/standalone compiled scenarios.
- 342 aggregate scenarios containing multiple authored episodes.
- 1,883 generated episode artifacts.
- 0 detected cross-episode choice targets.
- 26,912 / 26,912 aggregate dialogue voice references resolved.

`verify:episode-artifacts` compares every generated episode against its source
slice. It checks step counts, local ids, branch targets, step types, speakers,
dialogue text and voice cues.

## Presentation Data

`story_presentation_index.json` now records these fields for each boundary:

- `source_scenario_id`
- `episode_file`
- `local_playable_start_index`

Story collections and event pages prefer `episode_file`. Aggregate file and
global step boundaries remain in the index for compatibility and auditing.

## Player Lifecycle

The player still enforces a strict local `startStep/endStep` range. Story and
event entry pages create an ordered playback queue above the player.

At the end of an episode:

1. voice and pending timeline work are stopped;
2. continuous playback off shows an episode-complete panel;
3. continuous playback on requests the next queue item;
4. `App.vue` fetches and preloads the next episode artifact;
5. the keyed `StoryViewer` instance is replaced, disposing scene, Spine,
   audio, history and choice state from the previous episode;
6. the URL is replaced with the next episode file and local boundaries.

The continuous-playback preference is stored in local storage. Reloading an
episode URL from a story collection or event detail reconstructs its queue
from the route context.

## Compatibility

Old links such as:

```text
scenario=1_4_001_00.json&start_step=28
```

remain valid and infer the aggregate episode boundary. New catalog links use:

```text
scenario=episodes/1_4_001_00_b.json&start_step=1&end_step=33
```

The aggregate output can be retired only after every story family and every
external/deep link consumer has migrated to episode artifacts.

## Verification

```powershell
python ..\data_pipeline\batch_compile.py
node scripts\generate-story-presentation-index.mjs
npm run verify:episode-artifacts
npm run verify:story-collections
npm run verify:event-story
npm run verify:story-playback-range
npm run verify:voice-cues
npm run verify:routes
npm run build
```

The first production build attempt may hit the existing Windows `dist/assets`
`ENOTEMPTY` race. An immediate retry completed successfully on this change.
