# GS Archive Current Baseline

Status: current
Captured: 2026-07-28
Repository: `E:\Web_build\SideM_Archived`
Application: `E:\Web_build\SideM_Archived\web_viewer`

This document is the current-state entry point for the archive. Older audit
and migration notes remain evidence of what was observed at the time, but
their forward-looking defect lists must not override this baseline.

## 1. Checkout and review state

| Field | Value |
| --- | --- |
| branch | `codex/post-merge-story-handoff` |
| HEAD | `d8d819dedda3ad043bd7885f82ac6f015190d2fc` |
| upstream | `origin/codex/post-merge-story-handoff` |
| upstream relation | identical at capture time |
| worktree | clean at capture time |
| local development server | `127.0.0.1:5174` listening at capture time |
| pull request | Draft PR #2 |
| PR base | `ef804fcb2b258979723fcf8ce62f317671b4d701` |
| PR commits | 63 |
| PR files | 129 |
| PR diff | `+21,432 / -591` |

The PR title still described a documentation-only Story Runtime handoff at
capture time. Its real scope is the RAW/masterdata source contract, resource
audits and candidates, small stable promotions, and migration of live semantic
consumers. PR metadata therefore needs to be rewritten after the current
governance documentation is committed.

`stable-published` in project notes means an artifact occupies the stable path
in the named checkout. It does not imply that the containing commit is merged
to `master`.

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

The strict runtime-v2 surface is:

- two formal authoritative collections:
  - `1_4_001_01`;
  - `5_01_101_22`;
- one standalone RAW-published v2 scene:
  - `1_x_001tom_2_1_2_001_12`;
- 15 JSON artifacts when aggregate and episode files are counted.

Correct status:

```text
RAW story discovery and public matching:
source-proven, scope 3,398 / 3,398 groups

strict authoritative-v2:
2 formal collections + 1 standalone RAW-published scene

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

Runtime ownership, `StoryAudioSession`, strict schema, compiler, publisher, and
the two formal collections are merged through the Story Runtime phase.

Current `noAudio=1` behavior was rechecked at HEAD `d8d819d`:

```text
AudioContext: uninitialized
audio_session.disabled: true
audio_manager.disabled: true
active_sources: 0
```

No null-`AudioContext` or audio decode error occurred. The current status is:

```text
scope: StoryViewer noAudio path
source evidence: source-proven
browser acceptance: browser-accepted
product acceptance: not-accepted
```

This does not prove real-audio behavior. The following remain release
acceptance work:

- Edge first-user-gesture and autoplay behavior;
- operating-system-level hidden/resume behavior;
- real Voice, SE, BGM, and Ambient playback;
- cross-episode BGM/Ambient ownership;
- a 2-4 hour mixed interaction curve;
- quiet-endpoint heap, Spine, stage-child, timer, and active-source convergence.

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
| event visuals `001tom`/`002sht` | source-proven | stable-published in Draft PR #2 | item-level browser-accepted |
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
| THE KOGADO Episode 0 part 1 | collection `1_1_013the_01` |
| THE KOGADO Episode 0 part 2 | collection `1_1_013the_02` |
| THE KOGADO Episode 0 part 3 | collection `1_1_013the_03` |

Exact mapping and UI implementation belong to a later bounded branch. They
must not be added to the current 63-commit migration PR.

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

The documentation and PR-metadata steps below are complete at
`6d72aac3f2022ece739c05f72ef593d8a23d8ed1`. The first machine-executable
governance batch is now in progress.

1. Implement and commit the current archive baseline report generator and
   verifier.
2. Implement the tracked-binary inventory, schema, generator, and verifier.
3. Implement the publication ledger schema, empty-manifest generator, and
   verifier.
4. Exercise the first multi-part RAW story publish, rollback, and republish
   transaction.
5. Keep Runtime release acceptance separate from resource/governance work.
6. After PR #2 closes, create bounded branches for:
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
Mounted verification currently fails as designed because it detected 18 WAV
files under `RAW/audio`:

| Metric | Recorded RAW manifest | Live mounted tree |
| --- | ---: | ---: |
| files | 13,000 | 13,018 |
| bytes | 8,232,049,221 | 8,645,733,285 |
| audio files | 4,098 | 4,116 |
| WAV | 0 | 18 |

The 18 WAV files total 413,684,064 bytes and have timestamps around
2026-07-27 21:52. They have not been deleted, moved, added to Git, or accepted
as RAW authority. The recorded manifest remains the baseline until their
provenance and disposition are explicitly resolved.
