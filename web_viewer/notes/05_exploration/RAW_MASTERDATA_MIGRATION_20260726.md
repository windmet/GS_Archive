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
byte-identical. `waribashi` is the only distinct same-name group. ACB sequence
metadata proves its 0.529- and 0.505-second streams are two authored tracks:
the second starts after a 529 ms delay, producing one approximately
1.033-second composite cue. The organizer packages each retained a different
half, so neither package is authoritative on its own.

The second candidate batch was resolved automatically from `cue_index.json`:

- `flash_in` -> `se_commu_2022.acb`, selection 62;
- `phone_rusuden_start` -> `se_telephone.acb`, selection 12;
- `2_4_003_02_09_c1900_t` -> story-specific ACB, selection 1.

All three decoded in their actual 5174 story steps. The 22.302-second
story-specific cue entered the SE cache, registered as a one-shot source, and
advanced beyond two seconds after AudioContext unlock.

The full audit and remaining-domain matrix are maintained in:

`notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`

### Full RAW story inventory batch

All 1,435 `scenario_*.unity3d` bundles have now been inspected through their
Unity container paths rather than TextAsset names alone. The 4,939 valid
scenario JSON assets form 3,398 semantic story groups, and all 3,398 compile
without error. Every group has one unique current public match.

This container-path rule is essential because eleven bundles contain
same-name, different-payload TextAssets under different semantic directories.
The directory under `assets/resources/scenariodata/` supplies the public
namespace; these are different stories, not duplicate revisions.

Across the full compilation, 26,890/26,902 voice references resolve to RAW cue
metadata. All 3,234 unique resolved voice banks have matching RAW lipsync
bundles. A separate gap audit proves the remaining twelve references are
authored dangling references rather than recoverable aliases:

- their surrounding RAW ACB banks exist, but the exact cues do not;
- their surrounding RAW lipsync bundles exist, but the exact TextAssets do not;
- neither current public M4A nor organizer-era OGG contains an exact copy;
- the superficially similar `2_4_013_02_09_a1000` belongs to a different story
  and is explicitly rejected as a substitute for the `2_3` phone dialogue.

The runtime now skips network requests only for those exact twelve
`scenario_id + voice` pairs, preserves the dialogue, and emits an informational
diagnostic. Browser checks on 5174 covered a missing cat voice, a missing
Kyosuke phone voice, and a normal control voice. Both missing lines displayed
without a prepare failure; the normal control still registered
`1_2_001_12_a1000.m4a` as a dialogue source.

The isolated `1_x_001tom_2_1_2_001_12` candidate proves the standalone case:
20 steps, three voice banks, three lipsync banks, 15/15 voice references, and
real browser playback on 5174.

### Costume, Spine, idol-setting, and character-image batch

The new repeatable character audit scans every relevant Unity object instead
of inferring content from filenames:

- 690/690 master costume model IDs have RAW bundles;
- all 728 RAW costume bundle IDs exactly equal the public Spine-directory set;
- 725 are complete communication Spine rigs, three are silhouette-only, and
  none are ambiguous;
- all 1,450 RAW serialized atlas/skel TextAssets equal the public files;
- the `001tom_002_00` representative texture is pixel-identical;
- all 257 RAW idol-setting JSON assets are semantically equal to their current
  public projections;
- the 57 `image_chara*` bundles contain 485 unique image paths, of which 187
  have public exact-basename representatives and all remaining 298 are now
  mapped to six original/current consumer families.

The three RAW-proven silhouette-only models (`104omn_001_00`,
`231sub_001_00`, and `242sub_001_00`) are now explicit direct-fallback models.
Their existing public PNGs are retained because they match RAW Sprite
dimensions but not pixels. Asset identity and image replacement are therefore
kept as two independently reviewable steps.

The bounded 5174 route for real story `1_4_002_00` rendered the `104omn`
silhouette at ADV step 7. Runtime diagnostics showed zero Spine instances, one
settled silhouette, no pending silhouette, and no console warning/error.

### First birthday-visual candidate

The 298 non-public-basename paths are no longer an undifferentiated gap:
birthday, event-story, Mobile bust-up, name-plate, sign, and idol-story
categories each cover all 49 master idols. Birthday visuals are the first
candidate because birthday story detail already has a visual slot and
currently uses a fallback.

The isolated `birthday_visual:001tom` candidate comes from the exact RAW
Sprite, is `801×875`, matches the source-manifest bundle hash, and is tied to
four birthday rows owned by compiled filenames beginning `1_x_001tom_`.
The shared `012yus-013kys` Sprite was also extracted through both idol
identities; both manifests retain their own three birthday rows and resolve to
the same `1109×826` output hash.
The candidate route remains opt-in through
`raw_character_candidate=birthday_visual:001tom`. The first stable publication
described below now supplies the no-query path for `001tom`; all other idols
remain on the existing fallback.

5174 rendered the candidate at its natural dimensions and loaded no fallback;
the control loaded no candidate image and retained the fallback. Both pages
also reproduced the same existing audio decode error even with `noAudio=1`,
so that issue is recorded separately rather than attributed to this image
candidate.

### First stable birthday-visual promotion

A character-image-specific publisher now promotes one registry entry and one
PNG as a recoverable pair. It verifies the candidate manifest, current RAW
bundle hash, PNG hash/dimensions, birthday master ownership, exact Sprite
container, exact decimal-string Unity PathID, explicit confirmation, bounded
paths, and an absent unregistered stable target. Shared/multi-idol Sprite
identities are rejected by this first-batch gate.

The first entry is `birthday_visual:001tom`:

- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_001tom.png`;
- exact PathID: `1704761937170686496`;
- RAW SHA-256:
  `2590eb0feefa7cc23aa5ab7f16b965a42fb84103d5aff12e001621fc4ab6f6f0`;
- PNG `801×875`, SHA-256
  `a572186d263b52c2d70f9f2598304b2c89530f491595cc6561094ad4cf20ef2a`;
- final registry SHA-256
  `758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`.

The actual stable publication was explicitly rolled back before the final
republish. Rollback restored the empty registry SHA-256
`406e9052d7c5782d0e70febbe2a12d5a9e72046854bdac2684c4c7909900ddc3`,
deleted the additive PNG, and restored the old browser fallback. The final
republish then restored the stable image.

5174 verified three bounded states: no-query `001tom` selected the stable URL;
the explicit candidate query still selected the ignored candidate URL; and
unpromoted `002sht` still selected no image and retained the fallback. Both
loaded `001tom` images were complete at natural `801×875`, and the stable image
fit the existing detail layout.

The final rollback evidence is ignored at:

`.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2/`

### Second stable birthday visual

`birthday_visual:002sht` proves that the same gate works against a non-empty
registry rather than only an initial empty state. The publisher now validates
all existing stable registry assets before adding another entry, including
their bounded URLs, PNG bytes/dimensions, hashes, and exact string PathIDs.
Injected corruption of the existing fixture blocks publication.

The second candidate is a single-idol Sprite from
`RAW/asset/image_chara_birthday_visual_002sht.unity3d`, RAW SHA-256
`d205b564b0ba27aad07558553bbf05b623b665c9a601fb37da66572354b75f74`,
PathID `-5810813441337302374`, and four owned birthday-master rows. Its stable
PNG is `730×824`, 325,759 bytes, SHA-256
`edf893abdb34971e847da9c78032593618ddb932ad75a117334987c27500db67`.

The real second publication started from the one-entry registry hash
`758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`.
5174 then loaded both stable images. Explicit rollback removed only `002sht`,
restored that exact registry hash and its fallback, and left `001tom`
unchanged. Final republish produced the two-entry registry hash
`9b524139be7c0df551f020c3ffa05c316d35f3087d90ed294fbf7c028d4c5ef7`.
The final `002sht` stable image loaded at natural `730×824` and passed visual
layout inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/002sht/stable-backup-20260727-final/`

### Shared birthday visual

`012yus` and `013kys` are the one birthday-image exception to the single-idol
gate. A dedicated group publisher consumes both candidate directories,
requires the complete confirmation
`birthday_visual:012yus+013kys`, and proves that both manifests select the same
RAW bundle, Unity Sprite, PathID, Sprite Rect, and PNG while retaining separate
owner-specific master rows.

The stable group uses one physical asset and two registry mappings:

- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_012yus-013kys.png`;
- RAW SHA-256:
  `870a62220a98b6e8ac22b01339fbda2ea8efe4d1cf728e6a17e108a6f68a65ee`;
- PathID: `-2746721419655100402`;
- PNG `1109×826`, 480,735 bytes, SHA-256
  `7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e`.

The real group publication began with two mappings. Both owner routes loaded
the same stable URL. Explicit group rollback removed both new mappings and the
one shared PNG, restored the exact prior registry hash, and returned both
routes to fallback without affecting `001tom`. Final republish leaves four
idol mappings backed by three physical image URLs; registry SHA-256 is
`becc2bb172430cfe7a017883aceab3686131f587051767e675d51b64da4a9ec2`.
The shared two-idol composition passed visual layout inspection.

The validator also rejects incomplete shared registry groups, so future
publication cannot silently build on only one side of this mapping. Final
rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final/`

### Standalone promotion gate and first stable replacement

The generic strict collection publisher requires an aggregate plus episode
files, so it cannot safely publish a one-file RAW story. A dedicated
single-story gate now accepts only the compatibility delta actually proven for
this class:

- scenario ID, step count/type, scene state, cues, choices, dialogue audio,
  and source text must remain unchanged;
- the only permitted compatibility differences are an added top-level episode
  list and added per-step `episode_index`/`episode_part`;
- strict schema and compatibility-to-authoritative projection must pass;
- any non-empty inline `*_cn` value blocks promotion;
- every existing overlay must retain its file hash, RAW source hash, unit IDs,
  and per-unit source hashes;
- candidate output under `public/` is rejected;
- publish requires exact scenario confirmation, current/candidate/evidence
  hashes, an empty external backup, atomic replacement, final hash verification,
  and rollback on injected failure.

The real `1_x_001tom_2_1_2_001_12` manifest passed with 41 episode-only
additions and zero disallowed differences. A mirror publish was accepted first,
then the stable file changed from
`a0fe2085c1ad9d62998196ae29a668eaf8a7ea3061840c4872a3ce80a7d4d089`
to
`274cbd61b618de80a3bda317cfbef7133448ca7bafad1ec3d1f196d879c8cbff`.
The old file and backup manifest remain under the ignored promotion evidence
directory.

On the formal 5174 path, the promoted file rendered the same Japanese
dialogue and two Spine characters and registered
`1_2_001_12_a1000.m4a`. Chinese mode fell back to the original source text
without resetting the story because no overlay exists for this scenario.

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

python ..\data_pipeline\audit_raw_character_resources.py

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  birthday_visual 001tom

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2 `
  --confirm=birthday_visual:001tom

npm run character:promotion-rollback -- `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2 `
  --confirm=birthday_visual:001tom

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/002sht `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/002sht/stable-backup-20260727-final `
  --confirm=birthday_visual:002sht

npm run character:promotion-publish-group -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/012yus,.analysis/raw-migration/character-image-candidate/birthday_visual/013kys `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final `
  --confirm=birthday_visual:012yus+013kys

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

python ..\data_pipeline\audit_raw_story_voice_gaps.py `
  --coverage .analysis\raw-migration\story\coverage.json `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --raw-root ..\RAW `
  --public-voice-root public\assets\voice `
  --legacy-voice-root E:\BaiduNetdiskDownload\SideM\story_viewer\voice_ogg `
  --output .analysis\raw-migration\story\voice_gap_audit.json

npm run story:raw-promotion-candidate -- `
  --current=public/data/compiled/1_x_001tom_2_1_2_001_12.json `
  --compatibility=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/compatibility/1_x_001tom_2_1_2_001_12.json `
  --authoritative=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/authoritative/1_x_001tom_2_1_2_001_12.json `
  --output-dir=.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12 `
  --scenario-id=1_x_001tom_2_1_2_001_12
```

Candidate outputs remain under ignored `.analysis/`; they are not production
assets.

## Next batches

1. Extend the proven single-story promotion gate to multi-part aggregate
   collections and promote another small representative batch.
2. Keep the remaining 46 physical birthday images isolated and promote another
   small representative only after its own 5174 and rollback evidence. The 45
   master idols and `101ken` NPC remain distinct identity scopes.
3. Map all 260 RAW USM files to master-data consumers.
4. Continue promoting verified domains one reversible batch at a time, with
   5174 acceptance and rollback evidence before each stable-path replacement.
