# Story strict-v2 P2-A preparation: Event `1_3_10001_01`

Date: 2026-08-03
Status: deterministic candidate and provenance verified; **NOT PUBLISHED**
Branch: `codex/story-strict-v2-compilation-p2a`
Base: `master@17d8c1a88df3f3a0b0ebce127775473a903068b2`

## Scope

This batch prepares one representative Event collection for a future strict-v2
publication transaction:

- group: `1_3_10001_01`;
- aggregate plus episodes a-k: 12 files / 11 episodes;
- unique content: 312 steps / 116 voice references;
- manifest double representation: 624 step records / 232 voice references.

The group is not one of the three currently published strict-v2 collections.
It was selected because the 2026-07-22 migration audit already covered it as a
multi-episode Event sample, while the current run can repeat the stronger
two-stage Python-native plus Node-oracle evidence chain used by later strict
publications.

This preparation does not modify `public/data/compiled`, create a publication
ledger transaction, publish, roll back, republish, or claim browser acceptance.
P2-B 2-4 hour Runtime stability remains **NOT EXECUTED** and is outside this
batch.

## Inputs

- formal compatibility corpus:
  `public/data/compiled/1_3_10001_01.json` and episode a-k files;
- raw JSON group:
  `E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01`;
- required raw part set: a-k, all 11 files present;
- voice identity source: `public/data/compiled/voice_index.json`;
- compiler provenance used for this preparation:
  `scenario-compiler-python-v2-p2a-prep`.

RAW `asset/audio/movie` remains immutable source evidence. Candidate and parity
outputs stay outside the repository workspace.

## Reproducible candidate sequence

Use a new empty directory under the system temporary directory for each run:

```powershell
$candidateRoot = Join-Path ([IO.Path]::GetTempPath()) `
  ('sidem-p2a-prep-1_3_10001_01-' + [guid]::NewGuid().ToString('N'))
$compat = Join-Path $candidateRoot 'compatibility'
$authoritative = Join-Path $candidateRoot 'authoritative'
$candidate = Join-Path $candidateRoot 'candidate'
New-Item -ItemType Directory -Path $candidateRoot | Out-Null

python scripts/compile-story-migration-candidate.py `
  --raw-group-dir 'E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01' `
  --group-id '1_3_10001_01' `
  --expected-parts 'a-k' `
  --output-dir $compat

python scripts/compile-story-migration-candidate.py `
  --raw-group-dir 'E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01' `
  --group-id '1_3_10001_01' `
  --expected-parts 'a-k' `
  --output-contract authoritative `
  --compiler-version 'scenario-compiler-python-v2-p2a-prep' `
  --output-dir $authoritative

node scripts/build-authoritative-story-collection.mjs `
  --group-id=1_3_10001_01 `
  --output-dir=$candidate `
  --compiler-version=scenario-compiler-python-v2-p2a-prep `
  --authoritative-dir=$authoritative `
  --compatibility-dir=$compat
```

The third command independently verifies formal-to-compat migration parity,
compat-to-strict Runtime/text projection, strict schema, identity, source hashes
and candidate hashes. A rejected file makes the command fail; the manifest's
boolean fields are not optional advisory data.

## 2026-08-03 initial preparation result (superseded)

Machine-local candidate root:

`C:\Users\windm\AppData\Local\Temp\sidem-p2a-prep-1_3_10001_01-1d7f63d097fd4f0d9104e37cc304fa94`

The path is ephemeral execution evidence, not a repository or publication
location. Its generated `authoritative_candidate_manifest.json` SHA-256 was:

`eea029d79fafaf9b5350ccfce0d23eeba8c363c7ce6546211bb4b55d1e347a36`

Results:

| Gate | Result |
| --- | --- |
| raw part identity | a-k exact, 11/11 |
| compatibility recompile | 312 aggregate steps, 11 episodes |
| Python authoritative compile | 312 aggregate steps, 11 episodes |
| voice relink | 116/116 resolved, 0 unresolved |
| candidate file set | 12/12 |
| strict schema | 12/12 `schema_valid=true` |
| Runtime/text projection | 12/12 `runtime_text_equivalent=true` |
| formal-to-compat non-text differences | 0 across all 12 files |
| compatibility evidence | embedded and hashed for all 12 files |

Infrastructure gates passed on the same branch:

```text
verify:compiled-migration
verify:story-schema
verify:story-authoritative-publish
verify:publication-ledger
verify:story-runtime-foundation
verify:archive-baseline:source-only
python -m py_compile (candidate and migration publisher)
```

The source-only baseline remained 10,329 compiled JSON artifacts and 183 tracked
PNG files. The working tree stayed clean after candidate generation.

## Guidance assessment and binding decisions

The follow-up review supplied on 2026-08-03 is accepted as the direct P2-A
execution contract, with these evidence-based refinements:

1. Draft PR #37 is the active review surface. It keeps branch scope, Source
   Gate, and later browser evidence visible before merge.
2. A fresh candidate run is a hard gate. Compare the manifest plus every old
   artifact, candidate artifact, and compatibility-evidence hash across
   independent processes.
3. Source identity requires the split `RAW.7z.001/.002` member, its Unity
   `TextAsset` identities, and semantic masterdata together. A loose extracted
   copy alone is not source-authority evidence.
4. The first governed replacement uses publication schema v2 with
   `transaction_kind: replace` and `previous_state.kind: unmanaged-existing`;
   it is not a first-time `publish` transaction.
5. The transaction is publish, machine gates, exact-hash rollback, then
   exact-hash republish. A successful overwrite alone is insufficient.
6. Commit A must say `browser_acceptance.state: not-tested`. Browser evidence
   collected against Commit A is appended in Commit B through an
   `acceptance-clarification` annotation; the release record stays immutable.
7. Scope stays aggregate plus a-k for `1_3_10001_01`. UI, unrelated corpora,
   assets, localization, and P2-B are excluded.
8. Use actual repository commands such as `verify:routes`,
   `verify:voice-cues`, and `verify:event-story`. Source Gate is path-filtered,
   so its result only covers the paths and checks it consumed.

The review was right not to assume Choice anchors exist. Inspection now proves
four real Choice steps, so browser acceptance can use real content.

## Determinism incident and resolution

The initial manifest above is retained as incident evidence but is
**superseded and must not be published**. A fresh rerun kept all 12 old hashes
stable but changed 8/12 candidate hashes and 10/12 compatibility-evidence
hashes. Semantic content was equal; only JSON property order changed.
`_process_timeline` iterated the set
`{"anim_flag", "sweat_flag", "blush_flag"}`, so Python's per-process hash seed
changed emitted face-flag insertion order.

The compiler now emits the canonical tuple order `anim_flag`, `sweat_flag`,
`blush_flag`, and `verify-story-migration-candidate.py` has a regression fixture
for that exact order. Two clean full runs with `PYTHONHASHSEED=1` and
`PYTHONHASHSEED=777` produced:

| Comparison | Result |
| --- | --- |
| manifest bytes | exact |
| old artifact hashes | 12/12 exact |
| candidate artifact hashes | 12/12 exact |
| compatibility evidence hashes | 12/12 exact |
| final manifest SHA-256 | `e907624fc3be4b49e540a652868bbeb3b19442eedddf8c750f82b800ad5645c3` |

Both used compiler provenance `scenario-compiler-python-v2-p2a-event-1`.
Machine-local roots (ephemeral evidence only):

- `C:\Users\windm\AppData\Local\Temp\sidem-p2a-determinism-a-64622e10428b4456a2013f9e00067c66`;
- `C:\Users\windm\AppData\Local\Temp\sidem-p2a-determinism-b-b02893e75bb343758fa65be79f03baeb`.

Publication still requires one final fresh run from the committed fix.

## Authoritative source identity

- split authority: `E:\BaiduNetdiskDownload\SideM\GS_Res\RAW.7z.001/.002`;
- archive inventory: 13,004 members, exactly one match;
- member: `RAW/asset/scenario_1_3_10001_01.unity3d`;
- bytes: 23,497;
- SHA-256: `45cdbee9a3196b2abb4f5c9f2125dc37a1e98e77a22f4f2a8c6bd883fe077e3e`;
- the member hash matches both extracted RAW copies and migration coverage.

The bundle contains these publication source objects. Keep `path_id` values as
integers; JavaScript number conversion can lose precision.

| Part | TextAsset name | path_id |
| --- | --- | ---: |
| a | `scenario_1_3_10001_01_a` | -7396976569279784400 |
| b | `scenario_1_3_10001_01_b` | 2232230511138610429 |
| c | `scenario_1_3_10001_01_c` | -4778049729579378088 |
| d | `scenario_1_3_10001_01_d` | -7939988884295694876 |
| e | `scenario_1_3_10001_01_e` | 1317920532207288893 |
| f | `scenario_1_3_10001_01_f` | -8093821257397690381 |
| g | `scenario_1_3_10001_01_g` | -5494639484746811065 |
| h | `scenario_1_3_10001_01_h` | -8742975774894602826 |
| i | `scenario_1_3_10001_01_i` | -2965773072101965112 |
| j | `scenario_1_3_10001_01_j` | -2907388781185124897 |
| k | `scenario_1_3_10001_01_k` | -1858068924922796231 |

Each container path is
`assets/resources/scenariodata/1_3_10001_01/scenario_1_3_10001_01_<part>.json`.

Semantic identity is event code `10001` / story chapter `410001`:

- event `GROWING SIGN@L -Not Alone-`, type `theater`;
- collection title `世界を変えるユニット`;
- episode resources a-k, IDs `4100010100` through `4100010110`;
- prologue plus episodes 1-10;
- cast `047shu`, `048mom`, `049eis`, and `mob`;
- 312 steps, 116 voice references, and 88 lip references;
- step inventory includes 4 Choice, 8 Call, 60 Stage, 135 Adv, 20 Fadeout,
  11 Fadein, and one directional Slidein/Slideout pair.

## Browser acceptance anchors for Commit A

Use one browser tab and test the exact Commit A SHA. `noAudio=1` can establish
navigation and visual/runtime acceptance but is not real-audio acceptance.

1. Open Event `410001`; confirm the collection title and 11 episode rows map to
   a-k.
2. Deep-link
   `?view=player&scenario=1_3_10001_01.json&return=event_detail&event=410001`.
3. Verify prologue steps 1-25: synopsis/title, dialogue, background, Spine
   face/body, and voice linkage.
4. Verify directional wipes at aggregate steps 114 and 117 (episode e).
5. Verify phone mode and Choice blocking/continuation at steps 206-215; Choice
   steps are 209 and 212. Also exercise Choice step 222.
6. Directly enter episode h (aggregate range 176-229), then return to Event
   detail without losing context.
7. Exercise the independent Choice at step 284 in episode j.
8. Verify final episode k range 287-312 and clean completion/return.
9. Record browser/version, OS, URL, timestamp, exact commit, visible evidence,
   and application console state. Acceptance requires zero unexpected
   application-console errors.

## Binding publication transaction

Commit A must contain one schema-v2 collection release with:

- release ID `2026-08-03-story-1-3-10001-01-001`;
- `transaction_kind: replace`;
- scope ID `1_3_10001_01` and logical ID
  `story-collection:1_3_10001_01`;
- the split-archive source and all 11 `TextAsset` objects above;
- `previous_state.kind: unmanaged-existing`, all 12 exact old artifacts, and
  evidence that they predate ledger governance;
- all 12 final candidate artifacts in `published`;
- `comparison.state: parity-verified` with manifest/two-seed evidence;
- `rollback_evidence.performed: true`, an ignored repository-relative backup
  manifest, all 12 restored old artifacts, and
  `final_republish_verified: true`;
- `browser_acceptance.state: not-tested`, nullable fields null, evidence empty.

After Commit A passes Source Gate, run the browser anchors on that SHA. Commit B
may only append an `acceptance-clarification` annotation targeting this release;
it must not alter release JSON.

## TODO before publication authorization

1. Commit and push the deterministic compiler fix plus this handoff update.
2. Re-run candidate generation on that exact commit and compare all manifest,
   old, candidate and compatibility-evidence hashes with the two-seed result.
3. Construct the collection-scoped v2 `replace` release described above.
4. Execute explicit-confirmation atomic publish only after the manifest review;
   then run schema, Runtime, text, voice, playback range, presentation, Event
   navigation, source-only and production-build gates.
5. Complete one-browser-tab acceptance with application console errors at zero.
   Real audio status must be reported separately from `noAudio=1` checks.
6. Execute explicit rollback and verify all 12 exact old hashes, then republish
   and verify all 12 candidate hashes and final browser state.
7. Commit only the bounded stable corpus, ledger/manifest and evidence updates.
   Temporary candidate and backup directories remain ignored and outside the
   repository.

Until items 1-7 are complete, the only valid claim is:

```text
Event 1_3_10001_01 strict-v2 candidate-prepared / parity-verified
publication, rollback, republish and browser acceptance: NOT EXECUTED
```
