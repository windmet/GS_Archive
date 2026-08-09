# Story step 9 auto-advance stall audit: `1_3_10001_01_a`

Date: 2026-08-09
Status: **REPAIR PUBLISHED; BROWSER-SAMPLE ACCEPTED; REAL-AUDIO/LONG-SOAK TODO**
Observed checkout: `codex/story-strict-v2-compilation-p2a@e0a1eb487f16ddc71fee2bb91f45509ab4f94516`

## Decision summary

The long blank delay shown as player step 8 is not an intended strict-v2
playback policy. It is a pre-existing semantic defect preserved by the
parity-oriented strict-v2 publication:

1. the compiler expands an authored `wait=0.5` stage to `5.2` seconds because
   it treats a delayed animation at `t=5.0` as the stage duration tail;
2. the Runtime then keeps auto-advance blocked while retrying an unavailable
   Spine target for up to five seconds.

The observed result is approximately ten seconds before the next dialogue.
The user reports that the corresponding archived story video transitions
quickly. That comparison is directionally consistent with the RAW `wait=0.5`
command, but the external video itself was not captured as repository evidence
in this audit.

The initial diagnosis was recorded before any code change. The bounded repair
candidate was subsequently regenerated from RAW, published as release
`2026-08-09-story-1-3-10001-01-002`, rolled back exactly once, and finally
republished after the old and candidate hashes were verified.

## Reproduction identity

Player URL:

```text
http://127.0.0.1:5174/?view=player&idol=001tom&story_mode=search&event=410001&q=1_3_10001_01&scenario=episodes%2F1_3_10001_01_a.json&start_step=2&end_step=25&return=event_detail&parent=story_catalog
```

Because the range begins at source step 2, the UI's displayed step 8 maps to
compiled `step_id=9`. `StoryViewer.vue` computes the displayed number as the
current step index minus the range-start index plus one.

Relevant published artifact:

`public/data/compiled/episodes/1_3_10001_01_a.json`

## Browser observations

The same step was timed in the local browser twice:

| Run | Enter source step 9 | Enter source step 10 | Step 9 residence |
| --- | ---: | ---: | ---: |
| normal URL | 1.484 s | 11.465 s | about 9.981 s |
| `noAudio=1` | 1.476 s | 11.373 s | about 9.897 s |

Both runs produced this application warning:

```text
[StoryRuntime] spine cue target unavailable step-9:000:spine-body 048mom
```

The near-identical `noAudio=1` timing excludes voice playback and audio loading
as the primary cause. Two Pixi warning stack traces were also present, but this
audit did not establish them as part of the auto-advance delay.

## Published strict-v2 evidence

Compiled `step_id=9` has these relevant properties:

```text
type: stage
auto_advance: true
duration: 5.2
hide_dialogue: true

cue_id: step-9:000:spine-body
at: 5
duration: 0
action: spine.body.play
target: 048mom
lifecycle.blocks_auto: true
```

The step's entry snapshot contains visible Spine state for `047shu`, not
`048mom`. The delayed cue therefore reaches its start time without an available
target.

## Source and compiler evidence

The authoritative extracted scenario used by the P2-A compile is:

`E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01\scenario_1_3_10001_01_a.json`

The source command sequence represented by this stage includes:

```text
idol_animation: target=048mom, delay=5, animation=wait_loop
idol_fadein: target=047shu, delay=0, duration=0.2
wait: 0.5
```

The explicit wait is therefore 0.5 seconds. The five-second value belongs to a
delayed animation command and is not itself an authored five-second wait.

`E:\Web_build\SideM_Archived\data_pipeline\scenario_compiler.py` currently
derives a stage duration in `_emit_stage` using:

```python
max(0.05, duration, self._stage_duration_hint, timeline_tail + 0.2)
```

For this stage, `timeline_tail=5.0`, so the compiler emits `duration=5.2` even
though `_wait` received `0.5`.

The same 5.2-second stage and delayed `048mom` timeline event existed in the
pre-replacement backup under:

`.analysis/publication/2026-08-03-story-1-3-10001-01-001/backup-before-replace/episodes/1_3_10001_01_a.json`

The duration heuristic predates this P2-A strict-v2 transaction. This is why
the current finding must be classified as a parity-preserved defect, not a new
strict-v2 regression.

## Runtime blocking chain

The Runtime behavior is deterministic from the current source:

1. `src/utils/StoryStepFlow.js` schedules a stage auto-advance from the compiled
   `duration`, here 5.2 seconds.
2. `src/core/story-runtime/useStoryRuntimeCues.js` creates the Spine handle with
   `blocksAuto` from `cue.lifecycle.blocks_auto` and retries a missing target
   until a five-second deadline.
3. `src/core/useStepSceneEffects.js` reaches the 5.2-second auto timer, sees an
   active auto blocker, and polls again every 50 ms.
4. The cue began at 5.0 seconds and remains blocking until roughly 10.0
   seconds, producing the visible stall.

This is a compound defect. Correcting only the compiled duration would still
leave an unavailable target capable of blocking; correcting only the Runtime
retry would still preserve an incorrect 5.2-second silent stage.

## Evidence classification

| Claim | Classification |
| --- | --- |
| displayed step 8 maps to source `step_id=9` | consumer-verified and source-audited |
| delay is approximately ten seconds | consumer-verified in two local browser runs |
| real audio is the primary cause | rejected by the `noAudio=1` comparison |
| strict-v2 newly introduced the 5.2-second duration | rejected by the pre-replacement artifact |
| compiler tail heuristic contributes 5.2 seconds | source-audited |
| unavailable blocking cue contributes the remaining wait | consumer-verified and source-audited |
| archived video proves the exact intended timing | **TODO consumer-check**; user comparison reported, video evidence not ingested |
| proposed fix preserves all other story timing semantics | source-candidate verified for this 12-file batch; browser sample covers episode-a only |

## 2026-08-09 bounded repair candidate

The repair is intentionally limited to the two owners identified above:

- `E:\Web_build\SideM_Archived\data_pipeline\scenario_compiler.py` now lets a
  delayed timeline event extend a stage only when its Spine target is visible
  in the stage entry state and is not pending fade-out;
- `src/core/story-runtime/useStoryRuntimeCues.js` derives an expected target set
  from `entry_snapshot.spines`, skips an absent target immediately, and removes
  that cue's Auto-blocking capability;
- `scripts/verify-story-step9-timing.py` covers the RAW step-9 fixture;
- `scripts/verify-story-runtime-foundation.mjs` covers the Runtime no-block
  behavior; `package.json` exposes it as `verify:story-step9-timing`.

The fresh external candidate was generated under:

`C:\Users\windm\AppData\Local\Temp\sidem-step9-fix-p2a-2ca72381cdd54956a97a77ba37a6f3d4`

Candidate facts:

| Gate | Result |
| --- | --- |
| aggregate + episodes a-k | 12 files / 312 steps / 116 voice refs |
| candidate `step_id=9` duration | `0.5` seconds |
| candidate `048mom` cue | retained at `at=5`, no longer extends the stage |
| current v2 vs candidate semantic diff | aggregate + episode-a only; exactly `/steps/8/duration` `5.2 -> 0.5` |
| other episode semantic diff | 0 for b-k |
| candidate manifest SHA-256 | `1839490A89ACB38B51373AC7EDF2B0FC2EBA6C7714E3BF4B3E9ED7216D4CEBBC` |
| browser range timing | `1 -> 2`: about 691ms; `2 -> 3`: about 453ms |
| browser target-unavailable warning | 0 in the fresh repair sample |
| browser application errors | 0 relevant errors; 6 existing Pixi warning records were not attributed to this fix |
| screenshot | not captured; current in-app Browser runtime reports screenshot command unsupported |

The temporary browser overlay was followed by a real publish transaction. The
final published episode-a SHA-256 is
`5339FE7D5F652F20BFE4374B95D7BC4FA56C92BCC34302D7C1780DA1355825F0`; the
aggregate SHA-256 is
`11EB9C6CC88E1734E2E5A97BDE8C2387AFEB6A29E0ABD4068B9C999BF00A9EE9`.

Publication record:

| Gate | Result |
| --- | --- |
| release | `2026-08-09-story-1-3-10001-01-002` |
| candidate manifest | `sha256:0f8ade01030f2f5b697b7a66d6967df3d25561988c811a87c13bc114dceb9341` |
| approved non-text paths | `1_3_10001_01.json#/steps/8/duration`; `episodes/1_3_10001_01_a.json#/steps/8/duration` |
| exact rollback | PASS; prior 12-file hashes restored |
| final republish | PASS; candidate hashes verified |
| browser sample | PASS with `noAudio=1`; `2/5 -> 3/5` in about 652ms |
| real audio / long soak | **TODO consumer-check** |

Validation completed:

```text
npm run verify:compiled-migration                 PASS
npm run verify:story-schema                       PASS
npm run verify:story-step9-timing                PASS
npm run verify:story-runtime-foundation          PASS
npm run build                                     PASS
```

The published JSON, release ledger, append-only annotation, exact rollback
backup, and final republish evidence are now present. No PR push was performed
in this turn. The repair is a released strict-v2 batch, while real-audio,
long-soak, and broader batch rollout remain outside this acceptance claim.

## Hold boundary for further strict-v2 rollout

Do not use schema validity, deterministic hashes, projection parity, or an exact
rollback/republish cycle as evidence that timing semantics are correct. Those
gates successfully prove reproducibility and preservation; in this case they
also reproducibly preserve the defect.

Before another strict-v2 batch is authorized, decide whether the next bounded
work item will:

1. define which delayed timeline cues may extend a stage and add a compiler
   regression fixture for this exact RAW sequence;
2. define fail-open behavior for an unavailable Spine target, including when a
   cue is allowed to block auto-advance;
3. regenerate the candidate from source rather than hand-editing published
   JSON;
4. repeat deterministic candidate, parity/provenance, replace, exact rollback,
   exact republish, and browser timing acceptance;
5. verify representative stories with legitimate long stage performances so a
   narrow fix does not shorten authored choreography.

The implementation and publication portions are complete for this bounded
repair. Expansion to additional strict-v2 batches and broader timing semantics
remain pending a separate authorization and consumer-check plan.
