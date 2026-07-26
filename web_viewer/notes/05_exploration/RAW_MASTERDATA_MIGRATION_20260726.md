# RAW + Master Data Resource Migration

Date: 2026-07-26

## Decision

The migration source of truth is now split by responsibility:

- master data defines semantic identity and relations;
- `RAW/asset`, `RAW/audio`, and `RAW/movie` provide the original physical resources;
- organizer-created exports such as `ALL_PHOTOS` and grouped audio folders remain regression references, not identity authorities;
- published paths under `public/` stay unchanged until an isolated candidate passes comparison and 5174 browser verification.

`RAW/` is extracted at the repository root and ignored by Git. The verified
archive contains 13,000 files: 8,639 asset bundles, 4,098 audio files, 260 movie
files, and 3 source URL text files. Archive-to-disk verification found no
missing, extra, or size-different members.

## Current candidate gates

### Story sample: `1_4_001_01`

The RAW-only candidate resolves:

- 10 scenario parts;
- 13 lipsync containers, including `t01`, `t02`, and `t03`;
- 13 ACB containers;
- 432 compiled steps and 10 episode boundaries;
- 139 of 139 voice references by exact cue membership.

The authoritative candidate is semantically equal to the current published
scenario when provenance-only fields are ignored. It is served only at:

`/data/compiled/candidate/1_4_001_01.json`

5174 verification reached the title, background transition, two Spine
characters, and ADV dialogue without changing `/data/compiled/1_4_001_01.json`.

### Card sample: `001tom_r01`

Master data identifies the sample as:

- `card_id`: `1201001`;
- `resource_id`: `001tom_r01`;
- rarity: `R`;
- title: `GROWING STARS`.

RAW contains the directly named source bundle:

`asset/card_001tom_r01.unity3d`

The bundle exports eight `Texture2D` and eight `Sprite` objects: two icons, four
portraits, one piece icon, and one cut-in. The candidate keeps three explicit
layers:

- `textures/`: complete Texture2D exports;
- `sprites/`: Unity Sprite Rect exports;
- `resolved/`: Sprite-preferred runtime candidates.

This resolves the cut-in correctly to `667x900` from its `680x1108` source
texture. The rarity matrix also proves that the organizer package did not use
one consistent rule: some cut-ins and piece icons were exported as full
textures, while others were exported as cropped sprites. The organizer output
therefore remains comparison evidence, not the crop authority.

The card candidate is served only at:

- `/assets/card-candidate/001tom_r01/<texture>.png`;
- `/data/card-candidate/001tom_r01.json`.

The existing card detail page opts into the candidate only with:

`raw_card_candidate=001tom_r01`

Both clean and framed modes loaded their normal and awakened RAW portraits at
`640x800`. Without the query parameter, the resolver keeps using the published
card paths.

### Full card bundle coverage

`card_index.json` contains 836 master-data rows but only 826 unique
`resource_id` values. Ten tutorial rows deliberately reuse an existing normal,
R, SR, or SSR resource ID. RAW contains exactly 826
`card_<resource_id>.unity3d` bundles:

- matched unique resource IDs: 826;
- missing RAW bundles: 0;
- extra RAW card bundles: 0;
- unique-resource coverage: 100%.

The coverage report is generated at the ignored path
`.analysis/raw-migration/card/coverage.json`. It preserves the ten duplicate
master-data resource groups so a later pipeline does not incorrectly demand one
physical bundle per master-data row.

### Card rarity matrix

The isolated candidate was expanded to:

- N: `002sht_n01`;
- R: `001tom_r01`;
- SR: `001tom_sr01`;
- SSR: `001tom_ssr02`.

5174 loaded normal and awakened `640x800` portraits for all four resources.
The SSR sample also loaded both RAW `1800x960` landscape images. Every displayed
image used `/assets/card-candidate/`; the normal card route remained on
`/assets/card-art/`.

### Background sample and full coverage

The EP10 portion of `1_4_001_01` references `bg001_315pro_in_01` in 16 compiled
steps. RAW contains the exact physical bundle:

`asset/adv_background_bg001_315pro_in_01.unity3d`

It contains a full `1800x960` Sprite/Texture2D and a `300x160` thumbnail. The
candidate is served at `/assets/bg-candidate/bg001_315pro_in_01.png` only when
the route includes `raw_bg_candidate=bg001_315pro_in_01`. 5174 verified the
candidate in the bounded EP10 playback range with three Spine characters and
ADV dialogue.

The full background audit scanned all 3,405 compiled JSON files:

- 394 RAW ADV background bundles;
- 192/192 background-catalog IDs have exact RAW bundles;
- 356/356 compiled-story background IDs have exact RAW bundles;
- all 394 RAW backgrounds already have a public PNG;
- six additional public PNGs are legacy/non-RAW aliases.

This proves the current ADV background library can be regenerated directly from
RAW without using the organizer directory for identity.

### Audio candidate matrix

RAW contains 4,055 ACB and 43 AWB files. All 43 AWBs have a same-stem ACB;
these are external-wave-bank pairs rather than organizer exports. For example,
`usual_day.acb` has no directly decodable subsong, while `usual_day.awb`
contains the exact `usual_day` HCA stream and loop points.

The first isolated matrix keeps all AAC/M4A derivatives below ignored
`.analysis/raw-migration/audio/`:

- song `song3_drvalv`: `song3_drvalv.acb`, selection 17, 130.285 seconds;
- BGM `usual_day`: `usual_day.awb`, selection 1, 80.512 seconds;
- ambient `ambi_room`: `ambi_room.acb`, selection 1, 5.454 seconds;
- SE `step_walk_come_lino_boot`: `se_commu.acb`, selection 228, 1.849 seconds.

Each candidate has a `candidate.json` containing its RAW path and SHA-256,
stream selection and aliases, original CRI HCA metadata, output probe, and
output SHA-256. The 5174-only routes are:

- `/assets/audio-candidate/<kind>/<cue>.m4a`;
- `/data/audio-candidate/<kind>/<cue>.json`.

Runtime selection is opt-in through repeatable or comma-separated
`raw_audio_candidate=<kind>:<cue>` values. Without the parameter, story and
live-stage audio continue to use their current published/proxy paths.

Browser verification used actual application audio paths rather than only HTTP
checks:

- the story `001tom_201_2_2_001_01_00` decoded and registered RAW-derived
  `usual_day` and `ambi_room` as loop sources;
- after a pointer gesture the shared AudioContext changed from `suspended` to
  `running`, and both source ages advanced;
- main-story step 27 registered `step_walk_come_lino_boot` as a one-shot source
  and populated the SE decode cache;
- the multi-character stage loaded `DRIVE A LIVE`, reported its audio clock as
  ready, and advanced from 0:00 to 0:19 while choreography and singer positions
  changed.

The first global audit found:

- all 61 master-data song codes have exact `song3_<code>.acb` containers;
- all 105 BGM IDs referenced by compiled stories have same-stem RAW containers;
- all 83 non-sentinel ambient cues referenced by compiled stories have
  same-stem RAW containers;
- compiled stories reference 435 unique SE cues, which require a real
  cue-to-multi-bank membership index rather than filename guessing.

The 92 master-data BGM records include 53 selector-level switch/seasonal names
without an exact waveform cue match. Those are not missing audio conclusions:
they must be resolved from cue metadata or switch relations in the next
inventory pass.

### Full cue index and second SE batch

The resumable index now covers all 4,055 logical ACB banks:

- 33,651 streams;
- 33,754 unique cue aliases;
- 435/435 story SE cues classified;
- 433 cues with decodable audio;
- two `se_commu_action.acb` volume controls with no waveform;
- 13 same-name ambiguities.

Decoded WAV hashing proves twelve ordinary/telephone duplicate groups are
byte-identical. `waribashi` is the only distinct same-name group: its two RAW
streams are 0.529 and 0.505 seconds, so it must remain a multi-waveform cue.

The second candidate batch was resolved automatically from `cue_index.json`:

- `flash_in` -> `se_commu_2022.acb`, selection 62;
- `phone_rusuden_start` -> `se_telephone.acb`, selection 12;
- `2_4_003_02_09_c1900_t` -> story-specific ACB, selection 1.

All three decoded in their actual 5174 story steps. The 22.302-second
story-specific cue entered the SE cache, registered as a one-shot source, and
advanced beyond two seconds after AudioContext unlock.

The full audit and remaining-domain matrix are maintained in:

`notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`

## Reproduction

```powershell
python ..\data_pipeline\extract_raw_story_candidate.py `
  --raw-root ..\RAW `
  --scenario-id 1_4_001_01 `
  --output-dir .analysis\raw-migration\1_4_001_01

python ..\data_pipeline\verify_raw_story_candidate.py `
  --candidate .analysis\raw-migration\1_4_001_01\compiled\authoritative\1_4_001_01.json `
  --current public\data\compiled\1_4_001_01.json

python ..\data_pipeline\extract_raw_card_candidate.py 001tom_r01 `
  --organized-photo-root E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS\assets\resources\image\image_card

python ..\data_pipeline\audit_raw_card_coverage.py

python ..\data_pipeline\extract_raw_background_candidate.py `
  bg001_315pro_in_01 `
  --scenario .analysis\raw-migration\1_4_001_01\compiled\authoritative\1_4_001_01.json

python ..\data_pipeline\audit_raw_background_coverage.py

python ..\data_pipeline\extract_raw_audio_candidate.py `
  --raw-root ..\RAW --kind bgm --container usual_day.awb --cue usual_day `
  --selection 1 --output-root .analysis\raw-migration\audio `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --ffmpeg "D:\Program Files\ffmpeg\bin\ffmpeg.exe"

python ..\data_pipeline\audit_raw_audio_coverage.py `
  --raw-root ..\RAW `
  --music-catalog public\data\masterdata\music_catalog.json `
  --compiled-root public\data\compiled `
  --output .analysis\raw-migration\audio\audit.json

python ..\data_pipeline\index_raw_audio_cues.py `
  --raw-root ..\RAW `
  --compiled-root public\data\compiled `
  --output-root .analysis\raw-migration\audio\cue-index `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --workers 12
```

Candidate outputs remain under ignored `.analysis/`; they are not production
assets.

## Next batches

1. Build a resumable full cue-to-bank index for the 4,055 ACB files, beginning
   with multi-cue SE and master-data BGM alias banks. Cue identity must come
   from ACB metadata, not the organizer folder layout.
2. Expand the candidate matrix by a small representative batch, compare decoded
   duration/loop/channel behavior against the current derivative, and keep
   verifying actual playback through 5174.
3. Define the promotion gate that copies a verified RAW-derived asset into the
   stable public path while preserving a manifest and rollback hash.
4. Replace formal paths one resource domain at a time only after candidate
   coverage, semantic comparison, browser rendering, and rollback evidence all
   pass.
