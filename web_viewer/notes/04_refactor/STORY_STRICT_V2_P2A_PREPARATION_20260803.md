# Story strict-v2 P2-A preparation: Event `1_3_10001_01`

Date: 2026-08-03
Status: candidate prepared and gates verified; **NOT PUBLISHED**
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

## 2026-08-03 preparation result

Machine-local candidate root:

`C:\Users\windm\AppData\Local\Temp\sidem-p2a-prep-1_3_10001_01-1d7f63d097fd4f0d9104e37cc304fa94`

The path is ephemeral execution evidence, not a repository or publication
location. The generated `authoritative_candidate_manifest.json` SHA-256 is:

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

## TODO before publication authorization

1. Re-run candidate generation on the final fixed commit and compare the full
   manifest hash and all 12 old/candidate hashes with this preparation run.
2. Review and record representative browser anchors for Event navigation,
   dialogue, Choice, Spine/background/cue behavior, episode transition and
   direct deep link. These anchors are **not selected or browser-accepted yet**.
3. Choose the release ID and construct a collection-scoped publication ledger
   transaction without modifying unrelated domains.
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
