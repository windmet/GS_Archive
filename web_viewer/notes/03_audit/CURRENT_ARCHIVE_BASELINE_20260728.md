# GS Archive Current Baseline

Status: current
Captured: 2026-07-28
Current checkout refreshed: 2026-07-29
Review state refreshed: 2026-07-29
Merge state refreshed: 2026-07-29
Repository: `E:\Web_build\SideM_Archived`
Application: `E:\Web_build\SideM_Archived\web_viewer`

This document is the current-state entry point for the archive. Older audit
and migration notes remain evidence of what was observed at the time, but
their forward-looking defect lists must not override this baseline.

## 1. Checkout and review state

| Field | Value |
| --- | --- |
| current merged baseline | `master` = `origin/master` at `2a1e1ec08ae6331b82f7ac9d9719efbb3322e59e` |
| active track branch | `codex/raw-audio-wav-provenance`, created from `2a1e1ec` |
| active track | P0-S mounted RAW WAV provenance; complete on branch, pending PR #5 merge |
| active upstream | `origin/codex/raw-audio-wav-provenance` |
| active pull request | PR #5, Ready |
| active PR check | Source-only contract `30453332938` passed at `ed675f2`; disposition status commit follows |
| PR #2 merge commit | `bca7042c1d87b261b98f21b5957a36c2eb99f6b1` |
| merged PR head | `6a2a14e741d361dc7c09c6c395946a33782af4d9` |
| merge parents | `ef804fcb2b258979723fcf8ce62f317671b4d701` + `6a2a14e741d361dc7c09c6c395946a33782af4d9` |
| merge method | merge commit; 83 PR commits preserved |
| post-merge documentation | PR #3 merged as `4e416a6731aeaf90b808b7f79a5beb47b5ee20c2` |
| local development server | `127.0.0.1:5174`, PID 27536, listening at refresh time |
| pull request | PR #2 merged at 2026-07-29 08:47:35 UTC |
| PR base | `ef804fcb2b258979723fcf8ce62f317671b4d701` |
| PR commits | 83 |
| PR files | 164 |
| PR diff | `+52,090 / -627` |
| PR checks | final-head run `30435933524` passed |
| post-merge checks | `master` push run `30436935539` passed |
| active-branch production build | PASS at `a68cd60`, 2404 modules, 2m30s; later commits only change verifier/Schema/CI/docs |
| PR #4 merge commit | `2a1e1ec08ae6331b82f7ac9d9719efbb3322e59e` |
| PR #4 final-head check | Source-only contract `30450883462` passed at `9215456` |
| PR #4 post-merge check | `master` push run `30452463385` passed at `2a1e1ec` |

PR #2 is merged. Its title and body reflect its real scope: the RAW/masterdata source
contract, resource audits and candidates, governed stable promotions, live
semantic consumer migration, publication controls, and the bounded Story
Runtime audio follow-up.

PR #3 subsequently merged the first post-merge documentation correction, and
PR #4 merged the authoritative registry, source-only/mounted boundary,
publication EOL correction, and version freeze. Therefore `bca7042` remains the
immutable PR #2 merge identity, while `2a1e1ec` is the current repository
baseline at this refresh.

`stable-published` in project notes means an artifact occupies the stable path
in the named checkout. For PR #2 artifacts, the containing commit is now merged
to `master`; this term still does not imply deployment outside the repository.

## 2. Authority boundary

The project uses four distinct evidence layers:

1. masterdata defines semantic identity, grouping, titles, unlock relations,
   and cross-domain relations;
2. `RAW/asset`, `RAW/audio`, and `RAW/movie` provide authoritative physical
   payloads;
3. Unity object identity, container paths, PathIDs, and CRI cue metadata select
   subresources inside those payloads;
4. organizer-created exports remain parity references and compatibility
   fixtures, not default identity authorities.

Published URLs stay stable until an isolated candidate passes source identity,
comparison, browser inspection, rollback, and final republish checks.

## 3. RAW identity

The ignored RAW tree is extracted at:

```text
E:\Web_build\SideM_Archived\RAW
```

| Section | Files |
| --- | ---: |
| asset | 8,639 |
| audio | 4,098 |
| movie | 260 |
| root metadata | 3 |
| total | 13,000 |

Additional facts:

- total bytes: `8,232,049,221`;
- Unity bundles: 8,639;
- ACB: 4,055;
- AWB: 43;
- USM: 260;
- WAV: 0;
- archive volumes: `RAW.7z.001` and `RAW.7z.002`;
- extracted-tree manifest:
  `.analysis/raw-source/raw_manifest.jsonl`;
- summary:
  `.analysis/raw-source/raw_manifest_summary.json`.

RAW is local evidence and must remain ignored by Git.

## 4. Masterdata identity

The machine-local source configuration points to the original XOR-state file:

```text
E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\Container\Documents\client_master_data
```

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| original XOR-state source | 3,053,002 | `d57f76040c56c5ce0e80910c76328f528d47915c63a040516b470a538cccdc0e` |
| decoded protobuf | 3,053,002 | `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1` |

The decoded copy is:

```text
web_viewer/.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb
```

The XOR source deterministically reproduces the decoded PB used by the
pipeline. The decoded data contains 47,204 top-level records across 158 table
IDs. Both the source and decoded copy remain local and ignored.

## 5. Story metrics

Story metrics must not be collapsed into one number.

### 5.1 RAW semantic coverage

Source:

```text
.analysis/raw-migration/story/coverage.json
```

| Metric | Value |
| --- | ---: |
| RAW logical story groups | 3,398 |
| valid RAW scenario parts | 4,939 |
| groups with a unique public match | 3,398 |
| parts represented in public output | 4,939 |
| compile errors | 0 |
| compiled steps | 70,652 |
| voice references | 26,902 |
| resolved voice references | 26,890 |
| authored dangling references | 12 |

This establishes RAW discovery and public-output matching for all 3,398
logical groups. It does not establish strict authoritative-v2 publication for
all groups.

### 5.2 Compiled artifacts

At capture time:

| Metric | Value |
| --- | ---: |
| recursive JSON artifacts under `public/data/compiled` | 10,329 |
| root JSON files | 3,405 |
| JSON files directly under `compiled/episodes` | 1,884 |

These are artifact counts, not logical-story counts. Aggregate files, episode
files, manifests, fixtures, and per-source compiled files must not be reported
as separate stories.

### 5.3 Authoritative runtime-v2 publication

The published authoritative runtime-v2 surface is:

<!-- authoritative-v2-summary collections=3 standalone=1 artifacts=18 -->

- three authoritative collections:
  - `1_4_001_00`;
  - `1_4_001_01`;
  - `5_01_101_22`;
- one standalone RAW-published v2 scene:
  - `1_x_001tom_2_1_2_001_12`;
- 18 JSON artifacts when aggregate and episode files are counted.

Publication ownership is not the same as authoritative publication:

| Logical ID | Artifacts | Publication ownership |
| --- | ---: | --- |
| collection `1_4_001_00` | 3 | ledger-governed |
| collection `1_4_001_01` | 11 | pre-ledger authoritative |
| collection `5_01_101_22` | 3 | pre-ledger authoritative |
| standalone `1_x_001tom_2_1_2_001_12` | 1 | pre-ledger RAW promotion |

Correct status:

```text
RAW story discovery and public matching:
source-proven, scope 3,398 / 3,398 groups

strict authoritative-v2:
3 published collections + 1 standalone RAW-published scene
18 v2 JSON artifacts

full authoritative-v2 promotion:
deferred
```

## 6. Card metrics

The following counts currently happen to share the value 826 but represent
different populations:

| Metric | Value |
| --- | ---: |
| masterdata card rows | 836 |
| unique card resource IDs | 826 |
| RAW resource coverage | 826 / 826 |
| normalized archive card entities | 826 |

Future documentation must keep physical resource coverage separate from portal
entity normalization.

## 7. Runtime and browser status

Runtime ownership, `StoryAudioSession`, strict schema, compiler, publisher,
three authoritative collections, and one standalone v2 scene are merged.
Only `1_4_001_00` is currently represented in the publication ledger.

The `noAudio=1` startup-isolation defect was fixed in `a393bba`. Fresh
direct-player and home routes, including an explicit home voice-button click,
produced no audio error or warning in disabled mode.

```text
AudioContext: uninitialized
audio_session.disabled: true
audio_manager.disabled: true
active_sources: 0
```

Real-audio acceptance then advanced on `master`:

- Chromium covered first gesture, Voice/SE/BGM/Ambient, cross-episode
  transitions, Menu pause/resume, and debug visibility pause/resume;
- `421c3b0` fixed the cross-scene native-timer `Illegal invocation`;
- Microsoft Edge passed first-click playback and operating-system
  minimize/pause/resume;
- short manual listening found no audible overlap, stale background audio, or
  resume failure.

This is `partial acceptance`, not full release acceptance. The remaining
release gate is:

- a 2-4 hour mixed interaction curve;
- the final 25% resource curve and quiet-endpoint heap, Spine, stage-child,
  timer, MediaElement, AudioContext, and active-source convergence.

The Codex in-app browser does not expose reliable Page Visibility while the
whole Codex window is minimized. Its result must not override the Edge PASS.
Detailed evidence is in
`notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md`.

A bounded mid-story route using `start_step=417` also produced two Pixi Spine
update/tint warnings and one unavailable-target warning for `048mom`. Its state
is `needs-normal-entry-reproduction`; it is not yet classified as a defect.

## 8. Resource-domain status

Status is recorded per scope. A representative sample must not be promoted to
domain-wide browser acceptance.

| Scope | Source | Mapping/publication | Browser |
| --- | --- | --- | --- |
| RAW tree | source-proven | not applicable | not applicable |
| masterdata source chain | source-proven | parity-verified decode | not applicable |
| RAW story groups | source-proven, 3,398/3,398 | public-match verified | sample routes only |
| card resources | source-proven, 826/826 | representative matrix parity-verified | representative matrix sample-accepted |
| ADV backgrounds | source-proven | representative candidates verified | representative samples only |
| audio cue inventory | source-proven | representative song/BGM/Ambient/SE parity-verified | representative matrix sample-accepted |
| costume/Spine | source-proven | representative and full-domain parity audits recorded | representative routes only |
| five live semantic consumers | source-proven | default semantic source migrated to RAW and parity-verified | tested routes sample-accepted |
| event visuals `001tom`/`002sht` | source-proven | stable-published and merged through PR #2 | item-level browser-accepted |
| remaining USM | 77 Backmonitor mappings proven; 183 unresolved semantically | incomplete | not applicable |
| general `image_*` bundles | 1,271 physical bundles known | full relation table absent | not applicable |

The five live semantic consumers already reading RAW by default are:

- the primary live/chibi builder;
- BackMonitor;
- ImageLayer;
- ObjectLayer;
- static-stage.

Organizer CSV/JSON exports remain explicit parity/reference inputs only.

## 9. Repository binary boundary

At capture time Git tracks:

- 108 PNG files;
- 26,384,189 bytes in total.

This includes birthday visuals, `101ken`, event visuals, unit/portal graphics,
fixtures or generated FX images, and documentation images. The old README
statement that all event banners and original media are untracked is therefore
too broad.

The governing policy is:

```text
notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md
```

RAW, original masterdata, bulk decoded media, and reproducible large derived
trees remain excluded. Approved small portal assets, fixtures, documentation
evidence, and explicitly promoted stable assets may be tracked only under the
documented policy.

## 10. External Chinese translation links

Community-subtitled video links are a separate discovery layer, not a source
of RAW identity and not a substitute for Story Runtime publication.

Project scope is restricted to SideM GROWING STARS:

- include only videos that can be related to a GS event, story collection,
  story item, unit story, or idol story;
- link directly to the original Bilibili video and credit the uploader;
- a public uploader favorite folder may be used for discovery;
- exclude Mobage card stories, CD drama, live-event footage, unrelated clips,
  and unknown-product entries;
- do not copy third-party site databases or self-hosted cover images;
- use local RAW/masterdata visuals or a local generic fallback;
- keep external-link coverage separate from interactive-play and built-in-text
  translation coverage.

The first exact pilot mappings are:

| External subject | Internal relation |
| --- | --- |
| `GROWING SIGN@L -K.now O.nly-` | event `10008`, story `1_3_10008_01` |
| `GROWING SELECTION -PROOF OF ONESELF-` | event `30014`, story `1_3_30014_01` |

The three THE KOGADO Episode 0 videos remain candidates for collections
`1_1_013the_01`, `1_1_013the_02`, and `1_1_013the_03`. Their actual video
coverage must be inspected before any record is promoted to an exact mapping.

Schema, exact mapping, and UI implementation belong to a new bounded branch.
They were intentionally excluded from the now-merged PR #2.

## 11. Superseded current-state claims

The following documents remain historical evidence:

- `notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`;
- `notes/05_exploration/RAW_MASTERDATA_MIGRATION_20260726.md`;
- `notes/04_refactor/RAW_MASTERDATA_V1_NEXT_WINDOW_HANDOFF_20260727.md`.

Their dated observations remain valid for the commit and browser state they
describe. Current-sounding claims that `noAudio=1` still produces a null
`AudioContext` error are superseded by this baseline.

`0ba566f` remains a useful RAW/masterdata v1 milestone commit. It is not the
current checkout and is not a Git tag.

## 12. Immediate order

The documentation, PR metadata, and machine-executable P0 governance steps below
are complete and merged through PR #2:

1. Implement and commit the current archive baseline report generator and
   verifier. **Complete in `b20df7c`.**
2. Implement the tracked-binary inventory, schema, generator, and verifier.
   **Complete in `460d89f`.**
3. Implement the publication ledger schema, manifest generator, and verifier.
   **Complete.**
4. Exercise the first multi-part RAW story publish, rollback, and republish
   transaction. **Complete for `1_4_001_00`.**
5. Keep Runtime release acceptance separate from resource/governance work.
   **Still required: the 2–4 hour mixed soak remains separate.**
6. PR #2 is closed; future work may use bounded branches for:
   - a GS-only external translation-link pilot;
   - the 260-USM relation catalog;
   - the 1,271-image-bundle relation catalog.

### 12.1 Current archive baseline reporter implementation

The first P0-A implementation batch adds:

```text
scripts/report-current-archive-baseline.mjs
scripts/verify-current-archive-baseline.mjs
scripts/lib/archive-baseline-report.mjs
public/data/archive_baseline_report.json
```

The report records mounted-source availability, RAW live and recorded-manifest
statistics, masterdata hashes and record/table counts, story and voice metrics,
compiled-artifact counts, card metrics, tracked PNG totals, BackMonitor movie
relations, and the unresolved USM count. It contains no machine absolute paths.

Source-only verification passes without requiring ignored RAW or masterdata.
The mounted drift observed before disposition was:

| Metric | Recorded RAW manifest | Live mounted tree |
| --- | ---: | ---: |
| files | 13,000 | 13,018 |
| bytes | 8,232,049,221 | 8,645,733,285 |
| audio files | 4,098 | 4,116 |
| WAV | 0 | 18 |

The 18 WAV files totalled 413,684,064 bytes. Their provenance is now resolved:
17 are exact decodes of `song3_drvalv.acb` selections 1–17 and one is the exact
decode of `song3_drv999.acb` selection 1. The source defect was live-chibi
metadata inspection using vgmstream `-I` without decode-suppressing `-m`; it is
fixed by `eb44640`. During diagnosis, reproducing the CLI behavior rewrote the
already-existing `song3_drv999.acb.wav` with identical bytes/hash and changed
only its modification time.

All 18 derived WAV files were subsequently moved without deletion to the
ignored, recoverable quarantine subdirectory
`20260729-live-chibi-metadata-inspection`. Target hashes remained exact, real
metadata inspection did not recreate WAV files, and the mounted tree returned
to `13,000 files / 8,232,049,221 bytes / audio 4,098 / WAV 0`. Mounted and
source-only baseline verification now pass. The recorded manifest remains
unchanged and authoritative. See
`notes/03_audit/RAW_AUDIO_WAV_PROVENANCE_20260729.md`.

### 12.2 Tracked-binary inventory implementation

The 108-PNG / 26,384,189-byte baseline now has a deterministic generated
inventory, JSON Schema, and verifier. Every entry records its repository path,
bytes, SHA-256, category, logical ID, consumers, tracking rationale,
force-add permission, owner release, and grandfathered state.

Current classification:

| Category | Files |
| --- | ---: |
| documentation evidence | 3 |
| portal assets | 17 |
| stable promoted assets | 83 |
| test fixtures | 5 |

All 108 entries remain `grandfathered: true`; no PNG bytes changed. Future
non-grandfathered entries require an `owner_release` and are checked against
the policy's per-file and per-batch size boundaries.

### 12.3 Publication ledger and first transaction

The append-only publication ledger now has:

- a strict release JSON Schema;
- an immutable release entry
  `2026-07-28-story-1-4-001-00-001.json`;
- a deterministic stable manifest;
- a generator that replays ordered immutable transactions;
- a source-only verifier for release identity, paths, hashes, consumers,
  previous-state chains, rollback restoration, manifest determinism, and
  current stable-file identity.

The first real transaction used multi-part story collection `1_4_001_00`.
Candidate parity, publish, 5174 inspection, rollback to three exact old
hashes, republish to three exact candidate hashes, and final verification all
completed. Existing PNG files were not backfilled and no speculative
masterdata relation was added.

The GitHub Linux source gate passes the ledger verifier. The Windows
checkout exposed a post-merge portability defect: `core.autocrlf=true` and
Git's `text` classification convert the three governed JSON files to CRLF in
the worktree. Their worktree sizes exceed the canonical Git-blob/ledger sizes
by exactly one byte per line:

| Artifact | Ledger/Git blob | Windows worktree | Delta |
| --- | ---: | ---: | ---: |
| aggregate | 336,694 | 348,594 | 11,900 |
| episode a | 174,502 | 180,447 | 5,945 |
| episode b | 162,250 | 168,206 | 5,956 |

Git reports these files clean because line endings normalize at the index
boundary. The data transaction did not semantically drift. Commit `ae287b3`
fixed the verifier to use canonical index bytes while retaining runtime JSON
semantic checks, and added narrow `eol=lf` attributes without rewriting the
release hashes or globally renormalizing the compiled corpus. Windows and clean
checkout publication verification now pass.

### 12.4 Current post-merge dependency tracks

The current execution entry is:

```text
notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md
```

The work is not one serial queue:

```text
Track G / governance consistency
3+1 / 18 status
-> authoritative-v2 machine registry and reporter complete
-> source-only/mounted boundary complete in 06e71f7
-> cross-platform canonical ledger bytes complete
-> committed HEAD + staged index identity complete in 75f9cb1
-> freeze v1 complete
-> compatible v2 release + append-only annotation contracts

Track R / Runtime acceptance
fixed Runtime commit
-> 2–4 hour mixed soak
-> final 25% resource curve
-> quiet endpoint
-> PASS or FAIL

Track P / portal and resource discovery
18 WAV provenance + quarantine complete
GS-only external translation-link pilot
260-USM relation catalog
1,271-image-bundle relation catalog
```

Current priority and write locks:

- PR #4 governance is merged and its post-merge gate passed;
- the 18-WAV provenance, generator fix, recoverable quarantine, and mounted
  baseline restoration are complete on the active branch;
- no new ledger publication, PNG backfill, or stable binary promotion until
  v2/annotation schemas are active;
- Track R remains independent and is explicitly deferred by the user; it is
  still required before declaring Story Runtime `release-accepted`;
- external-link metadata/UI does not enter the publication ledger and may use
  its own bounded branch;
- PR #5 should merge before the next track branches from `master`;
- after PR #5, the recommended next active track is the bounded GS-only
  external translation-link pilot;
- USM and image work remains catalog-only until a bounded promotion is
  separately authorized.
