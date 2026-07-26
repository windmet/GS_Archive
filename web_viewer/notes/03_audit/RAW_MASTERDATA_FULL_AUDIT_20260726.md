# RAW + Master Data Full Resource Audit

Started: 2026-07-26
Last updated: 2026-07-27
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
inventory, the complete table-133 seasonal BGM relation, and representative
browser candidates have strong evidence.
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
| story SE | compiled SE cue + ACB sequence metadata | multi-cue ACB bank | 435/435 classified; `waribashi` composite reconstructed | full identity and representative sequence semantics proven |
| master seasonal BGM | table 133 relation + ACB action metadata | variant cues/banks | 92/92 classified; 42/42 switches resolved | full identity relation proven |
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

The neutral comparison classification is `distinct_decoded_waveforms`; it does
not assert that the cue randomly selects one waveform.

`waribashi` occurs in one actual scenario, `1_1_012_03_e`. Collection,
episode, and old compiled projections account for the repeated JSON hits. The
two organizer packages each retained only one half:

- `GS_Res/Audio/sfx/waribashi.ogg` is a 0.529-second Vorbis file matching the
  first decoded RAW stream;
- `story_viewer/voice_ogg/waribashi.ogg` is actually a 0.505-second PCM WAV
  despite its suffix, and its SHA-256 exactly matches the second decoded RAW
  stream.

The ACB metadata proves temporal composition rather than random variation:

- `CueTable`: cue ID 110, Sequence reference 60, length 1033 ms, two related
  waveforms;
- `SequenceTable`: Type 0, two tracks, indices 60 and 61;
- track 60 starts at 0 ms and references waveform 60 / selection 159;
- track 61 contains `0x07d1 00000211`, a 529 ms start delay, and references
  waveform 61 / selection 160;
- 529 ms + 505 ms is approximately the authored 1033 ms cue length.

This interpretation also agrees with CRI's official Atom Craft documentation:
Sequence Type 0 is Polyphonic, tracks may have timeline start offsets, and
`DelayTimeMS` is the track playback start time:

- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_cue_type.html>
- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_atombinary_json.html>
- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_api_refparam_workunittree.html>

The tracked sequence extractor now emits both isolated segments plus a
1.040-second composed AAC candidate. It preserves every raw event command,
including `0x07d5 016c`; that command's exact meaning is unknown and is not
simulated or guessed.

### Master BGM distinction

All 61 song codes have exact `song3_<code>` cues.

Only 39 of the 92 `music_catalog.json` BGM records are exact waveform cue
names. The other 53 are table-133 control or container resources rather than
missing sound files. They are now classified as:

| Resource role | Count | Physical meaning |
| --- | ---: | --- |
| waveform cue | 39 | directly decodable HCA stream |
| switch ActionTrack cue | 42 | selects one of six running waveform cues |
| base ActionTrack cue | 7 | controls the six contextual waveform cues |
| ACB bank identifier | 4 | seasonal cue sheet/container name |

The concrete waveform family includes:

- `bgm_main_day_a`;
- `bgm_main_day_a_sub`;
- `bgm_main_day_b`;
- `bgm_main_day_c`;
- `bgm_main_day_d`;
- `bgm_main_day_story_sub`.

No BGM catalog resource remains unresolved.

### Table 133 and ACB action mapping

Table 133 contains 56 complete rows:

- four `season_id` groups: Christmas, New Year, Valentine, and White Day;
- 14 source states per group: day/night base plus six contextual states;
- field 3: normal source selector;
- field 4: seasonal ACB bank;
- field 5: seasonal base ActionTrack cue;
- field 6: seasonal selector.

The old projection retained only `row_id` and the field number on each resource,
which lost the four-way row relation. `music_catalog.json` schema 2 now keeps:

- all 56 records in `seasonal_switch_rows`;
- `season_id`, role, and field on every legacy `seasonal_variants` item;
- the set of table-133 roles on every affected BGM record;
- 61 songs and all 92 prior BGM records unchanged.

The ACB `@UTF` metadata proves that base and switch names are not audio
waveforms. Their `CueTable` rows report zero related waveforms, and their
`SequenceTable` rows point to `ActionTrackTable` actions. Every switch has six
targets. One target uses a command index that occurs once while the other five
share another command index. This recovers all 42 selections:

| Switch suffix | Selected concrete cue suffix |
| --- | --- |
| `sw_main` | `a` |
| `sw_work` | `b` |
| `sw_story` | `c` |
| `sw_idol` | `d` |
| `sw_main_sub` | `a_sub` |
| `sw_story_sub` | `story_sub` |

The rule resolves 42/42 switch cues, all selected targets exist in the full RAW
waveform index, and the structural-anomaly count is zero. The ignored evidence
report is:

`web_viewer/.analysis/raw-migration/audio/master-bgm/selector_mapping.json`

It records the master-data, catalog, cue-index and five inspected ACB hashes,
all 56 complete relation rows, the ACB action targets, and the selected concrete
waveform for every switch.

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
- reconstructed `waribashi` two-track composite from `se_commu_2022.acb`;
- `bgm_main_christmas_day_a` selected by the Christmas `sw_main` ActionTrack;
- `DRIVE A LIVE` in the multi-character live stage.

The long story-specific SE was verified with:

- the exact RAW-derived candidate URL;
- `se_cache_entries: 1`;
- one registered SE source;
- AudioContext transition from `suspended` to `running`;
- source age advancing beyond two seconds.

The seasonal BGM was extracted from
`RAW/audio/bgm_system_christmas.awb`, selection 2:

- source SHA-256:
  `22206da46cc01500be788cf3c106f0dabee74642f821a03ccfe99bc2e77b7ad0`;
- source cue aliases: `bgm_main_christmas_day_a` and
  `bgm_main_christmas_day_a_sub`;
- output duration: 79.277 seconds, stereo AAC/M4A;
- candidate HTTP response: 200 `audio/mp4`;
- browser AudioContext: `suspended` before the user gesture, then `running`;
- registered runtime cue: `bgm_main_christmas_day_a`;
- source age observed at 2.64 seconds.

The opt-in browser probe requires both
`raw_audio_candidate=bgm:<cue>` and `raw_bgm_probe=<cue>`. It replaces only the
effective BGM requested by the bounded QA route. No default story or stable
asset URL changes.

The `waribashi` verification used the bounded actual episode route for
`episodes/1_1_012_03_e.json`, steps 21-24, with
`raw_audio_candidate=se:waribashi`:

- segment selection 159: HTTP 200 `audio/mp4`, 0.529 seconds;
- segment selection 160: HTTP 200 `audio/mp4`, 0.505 seconds;
- composed cue: HTTP 200 `audio/mp4`, 1.040 seconds;
- candidate manifest: HTTP 200 JSON;
- runtime log: `step-23:000:se-waribashi`;
- AudioContext state after the user gesture: `running`.

The one-shot source had normally ended before the periodic diagnostics
snapshot. The runtime trigger log, running context, exact candidate routing
unit check, and independent candidate HTTP/probe evidence are therefore kept
together instead of requiring a short-lived source to remain registered.

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

1. Extend RAW-only story compilation from the proven sample to all 1,435
   scenario bundles, with full voice/lipsync coverage reports.
2. Audit `costume_*`, `idol_*`, and character-related `image_*` bundles against
   costume/idol dictionaries and current Spine directories.
3. Map all 260 USM files to live-stage, card, event, and announcement semantics.
4. Audit the remaining 1,271 general `image_*` bundles by Unity object name and
   master-data consumer.
5. Reconstruct any additional non-waveform ActionTrack, sequence, loop, or
   switch semantics only when their ACB structure is proven.
6. Promote verified domains into stable public paths in small reversible
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

python ..\data_pipeline\extract_raw_acb_sequence_candidate.py `
  --raw-root ..\RAW `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --cue waribashi `
  --kind se `
  --output-root .analysis\raw-migration\audio `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --ffmpeg "D:\Program Files\ffmpeg\bin\ffmpeg.exe" `
  --ffprobe "D:\Program Files\ffmpeg\bin\ffprobe.exe"

python ..\data_pipeline\masterdata_extract.py $env:SIDEM_MASTER_DATA_PATH `
  --music-catalog-only `
  --out-dir .analysis\raw-migration\masterdata-music-generated `
  --public-out-dir public\data\masterdata

python ..\data_pipeline\audit_master_bgm_selector_mapping.py `
  --master-data $env:SIDEM_MASTER_DATA_PATH `
  --music-catalog public\data\masterdata\music_catalog.json `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --raw-root ..\RAW `
  --output .analysis\raw-migration\audio\master-bgm\selector_mapping.json
```

Generated evidence remains ignored under `.analysis`. Reproducible scripts,
runtime guards, and this audit document are tracked in Git.
