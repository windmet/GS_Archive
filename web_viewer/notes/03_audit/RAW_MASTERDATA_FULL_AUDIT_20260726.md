# RAW + Master Data Full Resource Audit

Date: 2026-07-26
Repository: `E:\Web_build\SideM_Archived`
Branch: `codex/post-merge-story-handoff`

## Executive conclusion

The archive can change from an organizer-package-first pipeline to a
master-data-plus-RAW pipeline.

The authority boundary is:

1. master data supplies semantic IDs, titles, grouping, unlock relations, and
   cross-domain relations;
2. `RAW/asset`, `RAW/audio`, and `RAW/movie` supply original physical payloads;
3. Unity object metadata and ACB cue metadata supply subresource identity;
4. organizer-created image/audio packages remain comparison and browser-format
   references only;
5. stable `public/` URLs are promoted one domain and one verified batch at a
   time.

This is not yet a statement that every public resource has been regenerated.
Cards, ADV backgrounds, one complete story sample, the complete RAW audio cue
inventory, and representative browser candidates have strong evidence.
Movies, general UI images, costumes/Spine, and full-story regeneration still
require domain-specific audits.

## 1. Source integrity

The clean extracted RAW tree contains:

| Section | Files | Physical formats |
| --- | ---: | --- |
| `asset` | 8,639 | Unity bundles |
| `audio` | 4,098 | 4,055 ACB + 43 AWB |
| `movie` | 260 | USM |
| archive metadata | 3 | TXT |
| total | 13,000 | 8,232,049,221 bytes |

The earlier archive-member comparison found zero missing members, zero extra
members, and zero size differences. A new SHA-256 file manifest is generated
under the ignored path:

`web_viewer/.analysis/raw-migration/source/files.jsonl`

During audio work, 268 range-enumeration WAVs and three candidate-metadata WAVs
were detected because they were absent from the 13,000-member archive baseline.
All 271 were moved out of `RAW/audio` into the ignored recoverable quarantine:

`web_viewer/.analysis/raw-migration/generated-wav-quarantine/`

RAW was then re-counted and re-manifested at exactly 13,000 files. The cue
indexer no longer uses vgmstream range mode, and candidate metadata inspection
now explicitly uses metadata-only mode. A fresh candidate extraction kept the
RAW WAV count at zero.

## 2. Master-data products in scope

The current site has normalized master-data products for:

- backgrounds;
- card summaries and card detail;
- costumes;
- events;
- face names;
- gasha records and announcements;
- home interactions;
- idol episodes;
- idols and units;
- Mobile communication;
- songs and BGM;
- seasonal campaigns and communication;
- short ADV profiles;
- speakers;
- story hierarchy and presentation;
- work stories;
- validation and migration reports.

These JSON files are projections, not physical-resource authorities. Their
`_source` fields preserve table/field/offset evidence and should remain in
generated data.

## 3. Domain status matrix

| Domain | Semantic authority | RAW physical source | Current evidence | Status |
| --- | --- | --- | --- | --- |
| stories | story master/presentation + scenario IDs | `scenario_*.unity3d` | RAW-only `1_4_001_01`, 432 steps, 139/139 voices | candidate proven |
| lipsync | scenario dialogue identity | `lipsync_*.unity3d` | 3,437 RAW bundles; sample auxiliary parts resolved | sample proven |
| cards | card master `resource_id` | `card_<resource_id>.unity3d` | 826/826 unique resources | full physical coverage proven |
| ADV backgrounds | catalog/story background ID | `adv_background_<id>.unity3d` | catalog 192/192; story IDs 356/356 | full referenced coverage proven |
| songs | master song code | `song3_<code>.acb` | 61/61 master codes and exact cues | full identity coverage proven |
| story BGM | compiled cue ID | same-stem ACB/AWB | 105/105 referenced IDs have containers | full referenced coverage proven |
| story ambient | compiled environmental cue | same-stem ACB/AWB | 83/83 non-sentinel cues have containers | full referenced coverage proven |
| story SE | compiled SE cue | multi-cue ACB bank | 435/435 classified | full identity coverage proven |
| master seasonal BGM | table 133 resource/switch ID | variant cues/banks | 39/92 exact cues | relation mapping incomplete |
| character/costume/Spine | costume/idol dictionaries | `costume_*`, `idol_*`, `image_*` | counts known, relation audit incomplete | pending |
| live/chibi | song/choreography IDs | `live_*`, `song_*`, image/object layers | representative song playback proven | partial |
| movies | event/live/card movie relations | 260 USM | filename inventory only | pending |
| general UI images | master records + bundle object names | 1,271 `image_*` bundles | no full relation table yet | pending |

## 4. Card-only question

RAW does contain the card-only physical content.

- master data has 836 card rows;
- tutorial/alias rows reuse ten resources;
- there are 826 unique `resource_id` values;
- RAW has exactly 826 `card_<resource_id>.unity3d` bundles;
- missing unique resources: 0;
- extra RAW card bundles: 0.

Organizer-created card image packages are therefore not required for card
identity. They remain useful regression evidence.

Each card bundle may contain both a full `Texture2D` and one or more cropped
Unity `Sprite` objects. The organizer exports do not consistently choose the
same layer. The RAW candidate pipeline therefore preserves:

- `textures/` for full Texture2D exports;
- `sprites/` for Sprite Rect exports;
- `resolved/` for the current Sprite-preferred runtime choice.

N/R/SR/SSR candidates all rendered normal and awakened `640x800` portraits in
5174. The SSR sample also rendered two `1800x960` landscape images.

## 5. Story and background evidence

The RAW-only `1_4_001_01` candidate includes:

- 10 scenario parts;
- 13 lipsync containers;
- 13 voice ACB containers;
- 432 compiled steps;
- 10 episode boundaries;
- 139/139 exact voice cue memberships.

Ignoring provenance-only fields, its authoritative form is semantically equal
to the published scenario.

ADV background evidence:

- 394 RAW ADV background bundles;
- 192/192 master background-catalog IDs match exact RAW bundles;
- 356/356 compiled-story background IDs match exact RAW bundles;
- every RAW ADV background currently has a public PNG;
- six public PNGs are deliberate legacy/non-RAW aliases.

The browser candidate for `bg001_315pro_in_01` rendered the correct
`1800x960` image in the bounded EP10 story route with three Spine characters
and dialogue.

## 6. Complete RAW audio inventory

The resumable audio index covers:

| Metric | Count |
| --- | ---: |
| logical ACB banks | 4,055 |
| external AWB partners | 43 |
| indexed streams | 33,651 |
| unique cue aliases | 33,754 |

All 43 AWBs have a same-stem ACB. They are original external-wave-bank pairs,
not organizer derivatives. `usual_day.acb`, for example, contains the cue-sheet
metadata while the decodable HCA stream and loop points are in
`usual_day.awb`.

### Story SE coverage

Compiled story data references 435 unique SE cue strings:

- 433 resolve to one or more decodable RAW streams;
- two resolve to non-waveform ActionTrack controls in
  `se_commu_action.acb`;
- unclassified cues: 0.

The controls are:

- `00_action_volume_down_sebgm`;
- `00_action_volume_default_sebgm`.

They must not be fetched as sound files. The runtime now recognizes them as
non-waveform controls and skips audio loading. Their exact original control
curve remains a separate semantic reconstruction task.

### Same-name ambiguity

Thirteen story SE cues have more than one indexed entry.

- twelve ordinary/telephone duplicates decode to byte-identical WAV output and
  may be safely folded at the browser-derivative layer;
- `waribashi` has two distinct streams in `se_commu_2022.acb`, with durations
  0.529 and 0.505 seconds.

`waribashi` is a real multi-waveform cue, not a duplicate-file error. The
current organizer OGG is 0.529 seconds and corresponds to the first variant,
but organizer choice is not sufficient authority to delete the second
variation. A production replacement should either preserve randomized
variants or document a deterministic selection policy.

### Master BGM distinction

All 61 song codes have exact `song3_<code>` cues.

Only 39 of the 92 `music_catalog.json` BGM records are exact waveform cue
names. The remaining 53 are mainly table-133 seasonal/switch resources such as
`bgm_main_day`, `*_sw_idol`, and `bgm_system_*`. RAW contains concrete variants
such as:

- `bgm_main_day_a`;
- `bgm_main_day_a_sub`;
- `bgm_main_day_b`;
- `bgm_main_day_c`;
- `bgm_main_day_d`;
- `bgm_main_day_story_sub`.

Therefore the 53 records must not be reported as missing audio. They are
selector-level semantic records requiring a table-133 row/field-to-variant
mapping.

## 7. Browser candidate verification

No candidate changes a default production URL. Opt-in query parameters select
ignored `.analysis` outputs.

Verified on port 5174:

- story candidate JSON;
- N/R/SR/SSR card matrix;
- ADV background sample;
- `usual_day` BGM;
- `ambi_room` ambient loop;
- `step_walk_come_lino_boot` ordinary SE;
- `flash_in` from `se_commu_2022.acb`;
- `phone_rusuden_start` from `se_telephone.acb`;
- `2_4_003_02_09_c1900_t` from a story-specific bank;
- `DRIVE A LIVE` in the multi-character live stage.

The long story-specific SE was verified with:

- the exact RAW-derived candidate URL;
- `se_cache_entries: 1`;
- one registered SE source;
- AudioContext transition from `suspended` to `running`;
- source age advancing beyond two seconds.

The live stage reported audio ready and advanced from 0:00 to 0:19 while
choreography and singer positions changed.

## 8. Promotion contract

A RAW-derived candidate may replace a stable path only when all of these are
recorded:

1. semantic ID and master-data evidence;
2. exact RAW container and object/cue identity;
3. source file SHA-256;
4. extraction selection, Sprite Rect, or stream index;
5. output dimensions/audio probe and SHA-256;
6. comparison with the current published derivative;
7. 5174 browser rendering or real playback;
8. build and domain regression checks;
9. rollback hash for the previous stable artifact;
10. a domain-scoped Git commit.

Failures or ambiguity keep the candidate isolated. They do not fall back to
organizer folder layout as authority.

## 9. Remaining work in priority order

1. Decode table 133 completely and map the 53 selector-level BGM records to
   concrete RAW variants.
2. Define and test the browser policy for genuine multi-waveform cues such as
   `waribashi`.
3. Extend RAW-only story compilation from the proven sample to all 1,435
   scenario bundles, with full voice/lipsync coverage reports.
4. Audit `costume_*`, `idol_*`, and character-related `image_*` bundles against
   costume/idol dictionaries and current Spine directories.
5. Map all 260 USM files to live-stage, card, event, and announcement semantics.
6. Audit the remaining 1,271 general `image_*` bundles by Unity object name and
   master-data consumer.
7. Promote verified domains into stable public paths in small reversible
   commits, never as one bulk replacement.

## 10. Reproduction

```powershell
python ..\data_pipeline\raw_source_manifest.py `
  --raw-root ..\RAW `
  --output .analysis\raw-migration\source\files.jsonl `
  --summary .analysis\raw-migration\source\summary.json

python ..\data_pipeline\index_raw_audio_cues.py `
  --raw-root ..\RAW `
  --compiled-root public\data\compiled `
  --output-root .analysis\raw-migration\audio\cue-index `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --workers 12

python ..\data_pipeline\compare_raw_audio_cue_variants.py `
  --raw-root ..\RAW `
  --coverage .analysis\raw-migration\audio\cue-index\story_se_coverage.json `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --output .analysis\raw-migration\audio\cue-index\ambiguous_decode_comparison.json
```

Generated evidence remains ignored under `.analysis`. Reproducible scripts,
runtime guards, and this audit document are tracked in Git.
